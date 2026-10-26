"""Extraction pipeline: extractor -> verifier -> score -> decisions.

Shared by eval and serving so both exercise identical code paths.
"""

from __future__ import annotations

from .calibrate import blend_score, decide
from .extract import Extractor
from .schemas import Claim, VerifiedClaim
from .verify import Verifier


def extract_and_verify(
    extractor: Extractor,
    verifier: Verifier | None,
    note_text: str,
) -> list[VerifiedClaim]:
    """Return verified claims; decisions are assigned separately (needs a dev-set threshold)."""
    claims: list[Claim] = extractor.extract(note_text)
    if verifier is not None:
        results = verifier.verify(note_text, claims)
    else:
        results = [(None, None, None)] * len(claims)
    out: list[VerifiedClaim] = []
    for claim, (sent, p_entail, p_contra) in zip(claims, results):
        score = blend_score(p_entail, claim.token_conf)
        out.append(
            VerifiedClaim(
                **claim.model_dump(),
                sentence=sent,
                p_entail=p_entail if p_entail is not None else 0.0,
                p_contra=p_contra if p_contra is not None else 0.0,
                score=score,
                decision=None,
            )
        )
    return out


def assign_decisions(claims: list[VerifiedClaim], threshold: float, low_frac: float) -> None:
    for claim in claims:
        claim.decision = decide(claim.score, threshold, low_frac)


class ExtractionPipeline:
    """Convenience wrapper for serving: holds a fixed calibrated threshold."""

    def __init__(self, extractor: Extractor, verifier: Verifier, threshold: float, low_frac: float) -> None:
        self.extractor = extractor
        self.verifier = verifier
        self.threshold = threshold
        self.low_frac = low_frac

    def run(self, note_text: str) -> list[VerifiedClaim]:
        claims = extract_and_verify(self.extractor, self.verifier, note_text)
        assign_decisions(claims, self.threshold, self.low_frac)
        return claims
