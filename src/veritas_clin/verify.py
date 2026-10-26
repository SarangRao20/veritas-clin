"""NLI verification layer: re-checks every claim against its source note.

The verifier is what makes the abstention score meaningful: an extracted claim has to be
ENTAILED by text actually present in the note, otherwise its score collapses and the
policy routes it to review instead of the chart.
"""

from __future__ import annotations

import re
from typing import Callable, Protocol

from .config import SETTINGS
from .schemas import Claim, FindingType

_SENT_SPLIT = re.compile(r"(?<=[.;])\s+")
_TOKEN = re.compile(r"[a-z0-9]+")

HYPOTHESIS_TEMPLATES: dict[str, str] = {
    "diagnosis": "The patient has {value}.",
    "medication": "The patient takes {value}.",
    "followup": "A follow-up is planned: {value}.",
}

PredictFn = Callable[[str, str], dict[str, float]]


def sentences_of(note_text: str) -> list[str]:
    out: list[str] = []
    for line in note_text.splitlines():
        line = line.strip()
        if not line:
            continue
        out.extend(s for s in _SENT_SPLIT.split(line) if s.strip())
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def best_sentence(note_text: str, claim_value: str, claim_dosage: str | None) -> str | None:
    """Highest lexical-overlap source sentence, or None when nothing overlaps."""
    target = set(_TOKEN.findall(f"{claim_value} {claim_dosage or ''}".lower()))
    best, best_score = None, 0.0
    for sent in sentences_of(note_text):
        score = _jaccard(target, set(_TOKEN.findall(sent.lower())))
        if score > best_score:
            best, best_score = sent, score
    return best if best_score > 0 else None


def hypothesis_for(claim: Claim) -> str:
    value = f"{claim.value}"
    if claim.type == FindingType.medication and claim.dosage and claim.dosage not in claim.value:
        value = f"{claim.value} {claim.dosage}"
    return HYPOTHESIS_TEMPLATES[claim.type.value].format(value=value)


class Verifier:
    """Wraps an NLI text-classification pipeline; `_predict` allows dependency injection."""

    def __init__(
        self,
        model_id: str = SETTINGS.nli_model,
        device: str = SETTINGS.device,
        _predict: PredictFn | None = None,
    ) -> None:
        self._predict: PredictFn
        if _predict is not None:
            self._predict = _predict
            return
        import torch
        from transformers import pipeline

        resolved = device
        if resolved == "auto":
            resolved = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = pipeline("text-classification", model=model_id, device=resolved, top_k=None)
        self._predict = _pipeline_predict(pipe)

    def verify(
        self, note_text: str, claims: list[Claim]
    ) -> list[tuple[str | None, float, float]]:
        """Returns (matched_sentence, p_entail, p_contra) per claim, aligned to input."""
        results: list[tuple[str | None, float, float]] = []
        for claim in claims:
            sent = best_sentence(note_text, claim.value, claim.dosage)
            if sent is None:
                results.append((None, 0.0, 0.0))
                continue
            labels = self._predict(sent, hypothesis_for(claim))
            results.append(
                (sent, labels.get("entailment", 0.0), labels.get("contradiction", 0.0))
            )
        return results


def _pipeline_predict(pipe) -> PredictFn:
    """Adapter so the verifier depends on {label: score} only, not on checkpoint specifics."""

    def predict(premise: str, hypothesis: str) -> dict[str, float]:
        out = pipe({"text": premise, "text_pair": hypothesis}, top_k=None)
        if isinstance(out, dict):  # single best label case
            return {out["label"].lower(): out["score"]}
        return {d["label"].lower(): d["score"] for d in out}

    return predict
