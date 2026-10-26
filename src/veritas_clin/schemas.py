"""Pydantic contracts shared across the Veritas-Clin pipeline."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FindingType(str, Enum):
    diagnosis = "diagnosis"
    medication = "medication"
    followup = "followup"


Decision = Literal["accept", "flag_for_review", "abstain"]


class Claim(BaseModel):
    """One structured finding extracted from a note."""

    type: FindingType
    value: str = Field(..., min_length=1, description="Name of the finding, e.g. drug or condition.")
    dosage: str | None = Field(default=None, description="Dosage phrase for medications, if present.")
    span_text: str | None = Field(
        default=None,
        description="Verbatim substring of the note that anchors this claim, if one was found.",
    )
    token_conf: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Mean generation-token confidence; None for non-neural extractors.",
    )


class VerifiedClaim(Claim):
    """Claim after NLI verification against its source note."""

    sentence: str | None = Field(default=None, description="Source sentence used for NLI.")
    p_entail: float = Field(..., ge=0.0, le=1.0)
    p_contra: float = Field(..., ge=0.0, le=1.0)
    score: float = Field(..., ge=0.0, le=1.0, description="Calibrated decision score.")
    decision: Decision | None = None  # assigned by the abstention policy


class ExtractRequest(BaseModel):
    note_id: str = "adhoc"
    note_text: str = Field(..., min_length=1)


class ExtractionResponse(BaseModel):
    note_id: str
    claims: list[VerifiedClaim]
    n_flagged: int
    n_accepted: int
