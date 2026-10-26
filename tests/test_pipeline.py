"""Offline verification of Veritas-Clin. No model downloads, no GPU, no network."""

from __future__ import annotations

import re

import pytest

from veritas_clin.calibrate import (
    blend_score,
    decide,
    ece,
    ece_bins,
    pick_threshold,
    risk_coverage,
)
from veritas_clin.config import SETTINGS
from veritas_clin.data_gen import ensure_corpus
from veritas_clin.extract import HeuristicExtractor
from veritas_clin.match import claim_matches_gt, normalize
from veritas_clin.pipeline import assign_decisions, extract_and_verify
from veritas_clin.verify import Verifier

TRAP_LINE = re.compile(r"^\d+\.\s+(.+?)\s+-\s+(?:ruled out|resolved|unlikely)\.$")


# --- corpus -----------------------------------------------------------------

@pytest.fixture(scope="module")
def corpus():
    return ensure_corpus(SETTINGS.n_notes, SETTINGS.seed)


def test_corpus_integrity(corpus):
    for rec in corpus:
        text = rec["text"]
        assert len(rec["gt"]) >= 2  # at least one diagnosis + one follow-up
        for g in rec["gt"]:
            assert text[g["span_start"] : g["span_end"]] == g["value"]


def test_rule_out_trap_excluded_from_ground_truth(corpus):
    """Trapped diagnoses must never appear as ground truth, even though the text has them."""
    caught = 0
    for rec in corpus:
        for line in rec["text"].splitlines():
            m = TRAP_LINE.match(line.strip())
            if m:
                caught += 1
                assert m.group(1) not in {g["value"] for g in rec["gt"] if g["type"] == "diagnosis"}
    assert caught > 0, "generator planted no traps; corpus would measure nothing"


# --- heuristic extractor ------------------------------------------------------

def test_heuristic_extractor_recall_is_perfect_on_corpus(corpus):
    """The rules mirror the renderer, so they must recover 100% of ground truth."""
    ex = HeuristicExtractor()
    miss = 0
    for rec in corpus:
        claims = ex.extract(rec["text"])
        claimed = {(c.type.value, c.value) for c in claims}
        for g in rec["gt"]:
            if not any(
                claim_matches_gt(t, v, g["type"], g["value"]) and t == g["type"]
                for t, v in claimed
            ):
                miss += 1
    assert miss == 0
    # traps must not be claimed either
    for rec in corpus:
        claimed_values = {c.value for c in ex.extract(rec["text"])}
        for line in rec["text"].splitlines():
            m = TRAP_LINE.match(line.strip())
            if m:
                assert m.group(1) not in claimed_values


def test_heuristic_span_anchoring():
    note = "ASSESSMENT:\n1. Hypertension\n"
    claims = HeuristicExtractor().extract(note)
    assert claims[0].span_text == "Hypertension"


# --- ground-truth matching ----------------------------------------------------

def test_normalize():
    assert normalize("Type 2 Diabetes  Mellitus.") == "type 2 diabetes mellitus"


def test_match_dosage_mismatch_is_incorrect():
    assert claim_matches_gt(
        "medication", "Metformin 1000 mg twice daily", "medication", "Metformin 500 mg twice daily"
    ) is False
    assert claim_matches_gt(
        "medication", "Metformin 500 mg", "medication", "Metformin 500 mg twice daily"
    ) is True
    assert claim_matches_gt("diagnosis", "Pneumonia", "diagnosis", "Pneumonia") is True
    assert claim_matches_gt("diagnosis", "Pneumonia", "medication", "Pneumonia") is False


# --- calibration math ---------------------------------------------------------

def test_ece_perfectly_calibrated():
    # a bin is calibrated when its mean score equals its observed accuracy
    scores, corrects = [0.5, 0.5], [True, False]
    assert ece(scores, corrects) == pytest.approx(0.0, abs=1e-9)


def test_ece_hand_computed():
    scores, corrects = [0.9, 0.4], [True, False]
    # bin 9: |0.9 - 1.0| * 1/2 = 0.05 ; bin 4: |0.4 - 0.0| * 1/2 = 0.20
    assert ece(scores, corrects) == pytest.approx(0.25, abs=1e-9)
    assert len(ece_bins(scores, corrects)) == 2


def test_risk_coverage_shape():
    rc = risk_coverage([0.9, 0.8, 0.2], [True, False, False])
    coverages = [c for c, _ in rc]
    assert coverages == [1 / 3, 2 / 3, 1.0]
    assert rc[0][1] == 0.0  # most-confident claim is correct
    assert rc[-1][1] == pytest.approx(2 / 3)


def test_pick_threshold_prefers_f1():
    scores, corrects = [0.9, 0.3], [True, True]
    assert pick_threshold(scores, corrects) == 0.3  # accepting both is better


def test_pick_threshold_empty_guard():
    assert 0.0 <= pick_threshold([], []) <= 1.0


def test_decide_bands():
    assert decide(0.9, 0.8) == "accept"
    assert decide(0.7, 0.8) == "flag_for_review"  # inside [0.64, 0.8)
    assert decide(0.3, 0.8) == "abstain"


def test_blend_score_modes():
    assert blend_score(None, 0.8) == 0.8                      # no-NLI mode
    assert blend_score(0.9, 0.8) == pytest.approx(0.88)       # 0.8*0.9 + 0.2*0.8
    assert blend_score(0.0, 0.9) == pytest.approx(0.18)       # unsupported claim collapses


# --- verifier (mocked pipeline) ------------------------------------------------

def _fake_predict_factory():
    def predict(premise: str, hypothesis: str) -> dict[str, float]:
        if "FOLLOW-UP" in premise.upper():
            return {"entailment": 0.4, "neutral": 0.5, "contradiction": 0.1}
        return {"entailment": 0.9, "neutral": 0.05, "contradiction": 0.05}

    return predict


def test_verifier_matches_best_sentence():
    note = (
        "DISCHARGE SUMMARY\n"
        "The patient reports worsening symptoms.\n"
        "ASSESSMENT:\n"
        "1. Hypertension\n"
        "\n"
        "MEDICATIONS ON DISCHARGE:\n"
        "1. Amlodipine 5 mg once daily\n"
        "\n"
        "FOLLOW-UP: Primary Care in 7 days.\n"
    )

    class C:
        type = None
        value = ""
        dosage = None

    from veritas_clin.schemas import Claim, FindingType

    claims = [
        Claim(type=FindingType.diagnosis, value="Hypertension"),
        Claim(type=FindingType.followup, value="Primary Care in 7 days"),
    ]
    v = Verifier(_predict=_fake_predict_factory())
    results = v.verify(note, claims)
    assert results[0][0].endswith("Hypertension")
    assert results[0][1] == pytest.approx(0.9)
    assert results[1][1] == pytest.approx(0.4)  # keyed off the follow-up branch


# --- pipeline (no-NLI smoke) ---------------------------------------------------

def test_pipeline_assigns_decisions():
    note = (
        "ASSESSMENT:\n"
        "1. Hypertension\n"
        "\n"
        "MEDICATIONS ON DISCHARGE:\n"
        "1. Amlodipine 5 mg once daily\n"
        "\n"
        "FOLLOW-UP: Primary Care in 7 days.\n"
    )
    claims = extract_and_verify(HeuristicExtractor(), None, note)
    assert all(c.score == pytest.approx(0.95) for c in claims)
    assign_decisions(claims, threshold=0.8, low_frac=0.8)
    assert all(c.decision == "accept" for c in claims)
