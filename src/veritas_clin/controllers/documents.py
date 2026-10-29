"""Documents controller: upload, list, get, delete with ownership enforcement."""
from __future__ import annotations

import json
import random
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

from ..middleware.auth import get_current_user, require_role
from ..config import CONFIG_DIR

router = APIRouter(prefix="/api", tags=["documents"])


def _safe_filename(filename: str | None) -> str:
    cleaned = (filename or "upload").replace("\\", "/").split("/")[-1]
    cleaned = "".join(char for char in cleaned if char.isprintable()).strip(" .")
    if not cleaned or len(cleaned) > 255:
        raise HTTPException(400, "Invalid filename")
    return cleaned


@router.post("/documents", status_code=201)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_role("admin", "clinician")),
):
    filename = _safe_filename(file.filename)
    content = await file.read(5 * 1024 * 1024 + 1)
    try:
        passages = request.app.state.document_processor.extract_and_chunk(
            filename, file.content_type or "", content
        )
        extracted_text = "\n".join(p["text"] for p in passages)
        document_id = request.app.state.document_store.add_document(
            filename, file.content_type or "", extracted_text, passages,
            request.app.state.document_processor.embedder.model_id,
            user_id=user["user_id"],
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, "Document could not be indexed") from exc

    request.app.state.user_store.log(
        "upload", user_id=user["user_id"],
        resource_type="document", resource_id=document_id,
        details={"filename": filename},
    )
    doc = request.app.state.document_store.get_document(
        document_id, user_id=user["user_id"], admin=user["role"] == "admin"
    )
    return doc


@router.get("/documents")
def list_documents(
    request: Request,
    user: dict = Depends(get_current_user),
):
    is_admin = user["role"] == "admin"
    return request.app.state.document_store.list_documents(
        user_id=user["user_id"], admin=is_admin
    )


@router.get("/documents/{document_id}")
def get_document(
    document_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    is_admin = user["role"] == "admin"
    doc = request.app.state.document_store.get_document(
        document_id, user_id=user["user_id"], admin=is_admin
    )
    if doc is None:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    is_admin = user["role"] == "admin"
    # Viewers cannot delete anything
    if user["role"] == "viewer":
        raise HTTPException(403, "Viewers cannot delete documents")
    # Non-admins can only delete their own documents
    if not is_admin and not request.app.state.document_store.owns_document(document_id, user["user_id"]):
        doc = request.app.state.document_store.get_document(document_id, admin=True)
        if doc and doc.get("is_synthetic"):
            raise HTTPException(403, "Synthetic demo documents cannot be deleted by non-admins")
        raise HTTPException(403, "You do not own this document")
    if not request.app.state.document_store.delete_document(document_id):
        raise HTTPException(404, "Document not found")
    request.app.state.user_store.log(
        "delete", user_id=user["user_id"],
        resource_type="document", resource_id=document_id,
    )
    return Response(status_code=204)


# ── Admin: generate a synthetic demo document ─────────────────────────────────

@router.post("/admin/documents/generate", status_code=201)
def generate_demo_document(
    request: Request,
    _admin: dict = Depends(require_role("admin")),
):
    """Generate a new synthetic clinical document from config/medical_data.json."""
    config_path = CONFIG_DIR / "medical_data.json"
    if not config_path.exists():
        raise HTTPException(500, "Medical data config not found")

    try:
        medical = json.loads(config_path.read_text())
    except Exception:
        raise HTTPException(500, "Could not read medical data config")

    condition = random.choice(medical.get("conditions", ["Hypertension"]))
    medications = random.sample(medical.get("medications", []), k=min(2, len(medical.get("medications", []))))
    followups = random.sample(medical.get("followups", []), k=min(1, len(medical.get("followups", []))))
    qualifier = random.choice(medical.get("modality_qualifiers", ["resolved"]))

    doc_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uid = uuid.uuid4().hex[:6].upper()
    filename = f"generated_note_{uid}.txt"

    med_lines = "\n".join(
        f"  - {m['name']} {m['dosage']} {m['frequency']}" for m in medications
    )
    fu_lines = "\n".join(f"  - {f['specialty']} in {f['timeframe']}" for f in followups)

    text = f"""SYNTHETIC DEMONSTRATION DOCUMENT — NOT A REAL PATIENT RECORD
Auto-generated Clinical Summary

DOCUMENT ID: {uid}
DATE: {doc_date}

PATIENT: [Fictional — no real patient]

PRIMARY CONDITION: {condition}
STATUS: {condition} has been {qualifier}.

CURRENT MEDICATIONS:
{med_lines}

PLAN / FOLLOW-UP:
{fu_lines}

NOTES: This document was automatically generated from structured reference data for retrieval
testing purposes. It contains no real patient data and must not be used for any clinical purpose.
All drug names, dosages, conditions, and follow-up recommendations are fictional examples.
"""

    try:
        passages = request.app.state.document_processor.extract_and_chunk(
            filename, "text/plain", text.encode("utf-8")
        )
        document_id = request.app.state.document_store.add_document(
            filename, "text/plain", text, passages,
            request.app.state.document_processor.embedder.model_id,
            is_synthetic=True,
        )
    except Exception as exc:
        raise HTTPException(500, "Could not generate document") from exc

    return request.app.state.document_store.get_document(document_id, admin=True)
