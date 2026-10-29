"""Clinical Analysis Controller: /analyse and /analyze endpoints.

Provides unified clinical synthesis, patient-specific report analysis,
and grounded question answering.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from ..middleware.auth import get_optional_user
from ..services.workflow_trace_service import WorkflowTraceService

router = APIRouter(tags=["analysis"])


class AnalysisRequest(BaseModel):
    patient_id: str | None = None
    question: str | None = None
    query: str | None = None
    document_id: str | None = None
    top_k: int = 8


def _handle_analysis(
    request: Request,
    patient_id: str | None = None,
    question: str | None = None,
    document_id: str | None = None,
    top_k: int = 8,
    user: dict | None = None,
) -> dict[str, Any]:
    user_id = user["user_id"] if user else None
    is_admin = user["role"] == "admin" if user else False

    doc_store = request.app.state.document_store
    retriever = request.app.state.evidence_retriever
    agent = request.app.state.response_agent
    patient_store = request.app.state.patient_store
    workflow_service = getattr(request.app.state, "workflow_service", None)
    if not workflow_service:
        workflow_service = WorkflowTraceService(doc_store, retriever, agent)

    # 1. Patient-specific analysis
    if patient_id:
        patient_docs = doc_store.list_documents(
            user_id=user_id, patient_id=patient_id, admin=is_admin
        )
        patient_passages = patient_store.get_patient_passages(
            patient_id, user_id=user_id, admin=is_admin
        )
        workflow_trace = workflow_service.generate_workflow_trace(
            patient_id=patient_id, user_id=user_id, admin=is_admin
        )
        flags = patient_store.get_flags(patient_id, user_id=user_id, admin=is_admin)

        # Question answering scoped to this patient
        active_q = question or "Provide a comprehensive clinical synthesis of this patient's admission, diagnosis, interventions, and current trajectory."
        evidence = retriever.search(
            active_q,
            document_id=document_id,
            top_k=min(12, max(4, top_k)),
            user_id=user_id,
            patient_id=patient_id,
            admin=is_admin,
            min_score=0.015,
        )
        answer_result = agent.answer(active_q, evidence)

        return {
            "status": "EVIDENCE_FOUND" if evidence else "NO_EVIDENCE",
            "patient_id": patient_id,
            "query": active_q,
            "answer": answer_result.get("answer", ""),
            "summary": workflow_trace.get("summary") or answer_result.get("answer", ""),
            "citations": answer_result.get("citations", []),
            "used_agent": answer_result.get("used_agent", False),
            "pii_audit": answer_result.get("pii_audit", {}),
            "reports": patient_docs,
            "reports_count": len(patient_docs),
            "passages_count": len(patient_passages),
            "workflow_trace": workflow_trace,
            "stages": workflow_trace.get("stages", []),
            "flags": flags,
            "evidence": evidence,
        }

    # 2. General Query across documents
    if question:
        evidence = retriever.search(
            question,
            document_id=document_id,
            top_k=top_k,
            user_id=user_id,
            patient_id=None,
            admin=is_admin,
            min_score=0.015,
        )
        answer_result = agent.answer(question, evidence)
        return {
            "status": answer_result.get("status", "EVIDENCE_FOUND"),
            "patient_id": None,
            "query": question,
            "answer": answer_result.get("answer", ""),
            "citations": answer_result.get("citations", []),
            "used_agent": answer_result.get("used_agent", False),
            "pii_audit": answer_result.get("pii_audit", {}),
            "evidence": evidence,
        }

    # 3. Overview of all patients if no param passed
    patients = patient_store.list_patients(user_id=user_id, admin=is_admin)
    return {
        "status": "OK",
        "total_patients": len(patients),
        "patients": patients,
        "message": "Specify ?patient_id=PT-xxxx or ?question=... for detailed clinical analysis.",
    }


# Wire routes for both /analyse, /analyze, /api/analyse, /api/analyze
@router.get("/analyse")
@router.get("/analyze")
@router.get("/api/analyse")
@router.get("/api/analyze")
def analyze_get(
    request: Request,
    patient_id: str | None = Query(None),
    question: str | None = Query(None),
    query: str | None = Query(None),
    document_id: str | None = Query(None),
    top_k: int = Query(8, ge=1, le=20),
    user: dict | None = Depends(get_optional_user),
):
    active_q = question or query
    return _handle_analysis(
        request=request,
        patient_id=patient_id,
        question=active_q,
        document_id=document_id,
        top_k=top_k,
        user=user,
    )


@router.post("/analyse")
@router.post("/analyze")
@router.post("/api/analyse")
@router.post("/api/analyze")
def analyze_post(
    body: AnalysisRequest,
    request: Request,
    user: dict | None = Depends(get_optional_user),
):
    active_q = body.question or body.query
    return _handle_analysis(
        request=request,
        patient_id=body.patient_id,
        question=active_q,
        document_id=body.document_id,
        top_k=body.top_k,
        user=user,
    )

