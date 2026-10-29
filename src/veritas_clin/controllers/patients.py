"""Patient-centric API: timeline, findings, workflow trace."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..middleware.auth import get_current_user, get_optional_user
from ..deidentifier import default_deidentifier
from ..services.workflow_trace_service import WorkflowTraceService
from ..services.clinical_sentiment_service import clinical_sentiment_service
from ..services.prescription_tokenizer import prescription_tokenizer

router = APIRouter(prefix="/api", tags=["patients"])


def _get_stores(request: Request):
    return request.app.state.patient_store, request.app.state.document_store, request.app.state.evidence_retriever, request.app.state.response_agent


@router.get("/patients")
def list_patients(request: Request, user: dict | None = Depends(get_optional_user)):
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    patients = patient_store.list_patients(user_id=user_id, admin=is_admin)
    return {"patients": patients}


@router.get("/patients/{patient_id}/timeline")
def patient_timeline(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    timeline = patient_store.get_timeline(patient_id, user_id=user_id, admin=is_admin)
    return {"patient_id": patient_id, "timeline": timeline}


@router.get("/patients/{patient_id}/documents")
def patient_documents(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    doc_store = request.app.state.document_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    docs = doc_store.list_documents(user_id=user_id, patient_id=patient_id, admin=is_admin)
    return {"patient_id": patient_id, "documents": docs}


@router.get("/patients/{patient_id}/passages")
def patient_passages(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    passages = patient_store.get_patient_passages(patient_id, user_id=user_id, admin=is_admin)
    # Light de-id for safe inspection
    safe = []
    for p in passages:
        d = default_deidentifier.deidentify(p.get("text", ""))
        safe.append({**p, "text": d["deidentified_text"]})
    return {"patient_id": patient_id, "passages": safe}


@router.get("/patients/{patient_id}/workflow-trace")
def patient_workflow_trace(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    workflow_service = getattr(request.app.state, "workflow_service", None)
    if not workflow_service:
        workflow_service = WorkflowTraceService(
            request.app.state.document_store,
            request.app.state.evidence_retriever,
            request.app.state.response_agent,
        )
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    return workflow_service.generate_workflow_trace(
        patient_id=patient_id,
        user_id=user_id,
        admin=is_admin,
    )


@router.get("/patients/{patient_id}/insights")
def patient_insights(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user), top_k: int = Query(8, ge=3, le=12)):
    patient_store = request.app.state.patient_store
    retriever = request.app.state.evidence_retriever
    agent = request.app.state.response_agent
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None

    passages = patient_store.get_patient_passages(patient_id, user_id=user_id, admin=is_admin)
    if not passages:
        return {"patient_id": patient_id, "flags": [], "status": "NO_EVIDENCE"}

    # Broad evidence-grounded queries to derive dynamic findings (no hardcoded diagnosis strings)
    queries = [
        "Key active problems, diagnoses, or clinical concerns",
        "Current medications, doses, changes",
        "Abnormal or concerning lab/imaging findings",
        "Red flags, alerts, or recommendations requiring follow-up",
    ]

    collected = []
    seen = set()
    for q in queries:
        try:
            hits = retriever.search(q, document_id=None, top_k=top_k, user_id=user["user_id"], patient_id=patient_id, admin=is_admin)
            for h in hits:
                pid = h.get("passage_id")
                if pid in seen:
                    continue
                seen.add(pid)
                collected.append(h)
        except Exception:
            continue

    if not collected:
        return {"patient_id": patient_id, "flags": [], "status": "NO_EVIDENCE"}

    # Deterministic grouping by document + negation to build traceable findings
    flags = []
    by_doc = {}
    for h in collected:
        by_doc.setdefault(h["document_id"], []).append(h)

    for doc_id, items in by_doc.items():
        filename = items[0].get("filename")
        neg = [i for i in items if i.get("assertion") == "NEGATED"]
        aff = [i for i in items if i.get("assertion") != "NEGATED"]
        if aff:
            label = f"Findings documented — {filename}"
            urgency = "med" if len(aff) >= 2 else "low"
            rationale = f"{len(aff)} affirmed evidence item(s) found in this document; {len(neg)} negated/rule-out item(s)."
        elif neg:
            label = f"Rule-outs documented — {filename}"
            urgency = "low"
            rationale = f"No affirmed findings surfaced; {len(neg)} negated/rule-out item(s) documented."
        else:
            continue

        evidence = []
        for it in items[:6]:
            evidence.append(
                {
                    "passage_id": it["passage_id"],
                    "document_id": it["document_id"],
                    "filename": it["filename"],
                    "page": it.get("page"),
                    "snippet": it.get("passage", "")[:220],
                    "assertion": it.get("assertion"),
                    "fused_score": it.get("fused_score"),
                }
            )

        trace = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "steps": [
                {"type": "trigger", "text": "Evidence aggregation across clinical documents for this patient case", "evidence": evidence[:2]},
                {"type": "finding", "text": rationale, "evidence": evidence[2:4] if len(evidence) > 2 else evidence[:1]},
                {"type": "conclusion", "text": label, "evidence": evidence[:1]},
            ],
            "sources": [{"passage_id": e["passage_id"], "document_id": e["document_id"], "filename": e["filename"]} for e in evidence],
        }

        flag = {
            "flag_id": f"auto:{patient_id}:{doc_id}",
            "patient_id": patient_id,
            "user_id": user["user_id"],
            "kind": "evidence_group",
            "label": label,
            "status": "open",
            "urgency": urgency,
            "confidence": min(0.95, max(0.4, sum(i.get("fused_score", 0) for i in items) / max(1, len(items)))),
            "rationale": rationale,
            "evidence": evidence,
            "trace": trace,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        flags.append(flag)
        try:
            patient_store.save_flag(flag)
        except Exception:
            pass

    flags.sort(key=lambda x: (0 if x["urgency"] == "med" else 1, -x["confidence"]))
    return {"patient_id": patient_id, "flags": flags, "status": "EVIDENCE_FOUND"}


@router.get("/patients/{patient_id}/flags")
def patient_flags(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    flags = patient_store.get_flags(patient_id, user_id=user_id, admin=is_admin)
    return {"patient_id": patient_id, "flags": flags}


@router.get("/patients/{patient_id}/trace/{flag_id}")
def patient_trace(patient_id: str, flag_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    patient_store = request.app.state.patient_store
    retriever = request.app.state.evidence_retriever
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    flags = patient_store.get_flags(patient_id, user_id=user_id, admin=is_admin)
    flag = next((f for f in flags if f.get("flag_id") == flag_id), None)
    if not flag:
        raise HTTPException(404, "Trace not found")

    # Reconstruct trace strictly from stored evidence/passage ids
    evidence = flag.get("evidence") or []
    trace = flag.get("trace") or {}
    sources = []
    for e in evidence:
        try:
            hits = retriever.search(e.get("snippet") or e.get("passage_id"), document_id=e.get("document_id"), top_k=1, user_id=user["user_id"], patient_id=patient_id, admin=is_admin)
            for h in hits:
                if h.get("passage_id") == e.get("passage_id"):
                    sources.append(
                        {
                            "passage_id": h["passage_id"],
                            "document_id": h["document_id"],
                            "filename": h["filename"],
                            "page": h.get("page"),
                            "passage": h.get("passage"),
                            "assertion": h.get("assertion"),
                            "fused_score": h.get("fused_score"),
                        }
                    )
                    break
        except Exception:
            continue

    return {
        "patient_id": patient_id,
        "flag": flag,
        "trace": trace,
        "sources": sources,
        "validated": len(sources) == len(evidence),
    }


@router.get("/patients/{patient_id}")
def get_patient(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    """Fetch dynamically synthesized clinical profile for a patient."""
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    profile = patient_store.get_patient_profile(patient_id, user_id=user_id, admin=is_admin)
    return profile


@router.get("/patients/{patient_id}/sentiment")
def get_patient_sentiment(patient_id: str, request: Request, user: dict | None = Depends(get_optional_user)):
    """Evaluate evidence-grounded clinical sentiment, trajectory, and patient acuity."""
    patient_store = request.app.state.patient_store
    is_admin = user["role"] == "admin" if user else False
    user_id = user["user_id"] if user else None
    profile = patient_store.get_patient_profile(patient_id, user_id=user_id, admin=is_admin)
    return {
        "patient_id": patient_id,
        "sentiment": profile.get("sentiment", {}),
    }


@router.post("/prescriptions/tokenize")
async def tokenize_prescription(request: Request):
    """Tokenize and parse clinical prescription into structured pharmacology entities."""
    data = await request.json()
    result = prescription_tokenizer.tokenize_form(data)
    return result


@router.post("/prescriptions/save")
async def save_prescription(request: Request, user: dict | None = Depends(get_optional_user)):
    """Save, tokenize, chunk, and embed a clinical prescription order."""
    data = await request.json()
    tokenized = prescription_tokenizer.tokenize_form(data)
    patient_id = tokenized["patient_id"] or "PT-DEMO"
    user_id = user["user_id"] if user else None

    synthesized_text = tokenized["synthesized_text"]
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"{patient_id}_{now_str}_Clinical_Prescription_Order.txt"

    # Chunk and embed
    processor = getattr(request.app.state, "processor", None)
    embedder = getattr(request.app.state, "embedder", None)
    doc_store = request.app.state.document_store

    if processor:
        passages = processor.extract_and_chunk(filename, "text/plain", synthesized_text.encode("utf-8"))
        model_id = processor.embedder.model_id
    else:
        from ..document_nlp import DocumentProcessor, LocalSentenceEmbedder
        active_embedder = embedder or LocalSentenceEmbedder()
        active_proc = DocumentProcessor(active_embedder)
        passages = active_proc.extract_and_chunk(filename, "text/plain", synthesized_text.encode("utf-8"))
        model_id = active_embedder.model_id

    doc_id = doc_store.add_document(
        filename=filename,
        media_type="text/plain",
        extracted_text=synthesized_text,
        passages=passages,
        embedding_model=model_id,
        user_id=user_id,
        is_synthetic=False,
        patient_id=patient_id,
        encounter_date=tokenized["encounter_date"] or now_str,
        encounter_type="Prescription Order",
    )

    return {
        "status": "SAVED_AND_INDEXED",
        "document_id": doc_id,
        "filename": filename,
        "patient_id": patient_id,
        "passages_count": len(passages),
        "tokens": tokenized,
    }

