"""Search controller: hybrid BM25 + semantic evidence retrieval."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..middleware.auth import get_current_user
from ..schemas.document import SearchRequest

router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search")
def search_documents(body: SearchRequest, request: Request, user: dict = Depends(get_current_user)):
    is_admin = user["role"] == "admin"
    evidence = request.app.state.evidence_retriever.search(
        body.question.strip(),
        body.document_id,
        body.top_k,
        user_id=user["user_id"],
        patient_id=body.patient_id,
        admin=is_admin,
        min_score=body.min_confidence,
    )
    result = request.app.state.response_agent.answer(body.question.strip(), evidence)
    result["evidence"] = evidence
    request.app.state.user_store.log(
        "search", user_id=user["user_id"],
        details={"question": body.question[:200], "hits": len(evidence)},
    )
    return result
