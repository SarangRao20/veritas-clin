from __future__ import annotations
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str


class PaginatedResponse(BaseModel):
    items: list
    total: int
    limit: int
    offset: int
