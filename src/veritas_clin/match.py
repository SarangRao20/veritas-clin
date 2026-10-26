"""Pure matching logic: does a claim correspond to a ground-truth finding?"""

from __future__ import annotations

import re

_PUNCT = re.compile(r"[^\w\s%]")
_WS = re.compile(r"\s+")


def normalize(value: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    return _WS.sub(" ", _PUNCT.sub("", value.lower())).strip()


def claim_matches_gt(claim_type: str, claim_value: str, gt_type: str, gt_value: str) -> bool:
    """A claim is correct iff types match and normalized values align.

    Value alignment: exact string equality after normalization, or token containment
    (e.g. "Metformin 500 mg" vs GT "Metformin 500 mg twice daily"). Dosage numbers must
    agree — a claim asserting a *different* dose never containment-matches, which is
    exactly the hallucination class this project must catch.
    """
    if claim_type != gt_type:
        return False
    cv, gv = normalize(claim_value), normalize(gt_value)
    if cv == gv:
        return True
    nums_c = set(re.findall(r"\d+", cv))
    nums_g = set(re.findall(r"\d+", gv))
    if nums_c != nums_g:
        return False
    c_tokens = set(cv.split())
    g_tokens = set(gv.split())
    return c_tokens.issubset(g_tokens) or g_tokens.issubset(c_tokens)
