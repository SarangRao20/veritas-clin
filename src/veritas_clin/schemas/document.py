from __future__ import annotations
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None
    patient_id: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)
    min_confidence: float = Field(default=0.005, ge=0.0, le=1.0)


class DocumentOut(BaseModel):
    document_id: str
    filename: str
    media_type: str
    created_at: str
    embedding_model: str
    is_synthetic: bool
    passage_count: int
    user_id: str | None = None
