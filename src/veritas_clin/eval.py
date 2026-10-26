"""Evaluation harness: corpus -> extraction -> verification -> calibration -> metrics + plots.

Protocol: pick the abstention threshold on the DEV split only; report everything else
(including ECE and policy metrics) on the held-out TEST split.
"""

from __future__ import annotations

import argparse
import json
from random import Random

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .calibrate import ece, ece_bins, pick_threshold, risk_coverage
from .config import SETTINGS, ensure_dirs
from .data_gen import ensure_corpus
from .extract import build_extractor
from .match import claim_matches_gt
from .pipeline import assign_decisions, extract_and_verify
from .schemas import VerifiedClaim
from .verify import Verifier

F_TYPES = ("diagnosis", "medication", "followup")
FALLBACK_THRESHOLD = 0.7


def split_note_ids(corpus: list[dict], dev_frac: float, seed: int) -> tuple[set[str], set[str]]:
    ids = [rec["note_id"] for rec in corpus]
    Random(seed).shuffle(ids)
    k = round(len(ids) * dev_frac)
    return set(ids[:k]), set(ids[k:])


def _greedy_match(record: dict, claims: list[VerifiedClaim]) -> tuple[list[bool], set[int]]:
    """One claim consumes at most one GT finding (one-to-one, in order)."""
    correct: list[bool] = []
    used: set[int] = set()
    for claim in claims:
        hit = None
        for j, g in enumerate(record["gt"]):
            if j in used:
                continue
            if claim_matches_gt(claim.type.value, claim.value, g["type"], g["value"]):
                hit = j
                break
        if hit is not None:
            used.add(hit)
        correct.append(hit is not None)
    return correct, used


def run_corpus(corpus, extractor, verifier, note_ids):
    claims_by_note = {}
    for rec in corpus:
        if rec["note_id"] not in note_ids:
            continue
        claims_by_note[rec["note_id"]] = extract_and_verify(
            extractor, verifier, rec["text"]
        )
    return claims_by_note


def collect(claims_by_note, corpus) -> dict:
    """Flat claim/score/correct lists plus per-type tp/fp/fn totals."""
    scores, corrects = [], []
    totals = {t: {"tp": 0, "fp": 0, "fn": 0} for t in F_TYPES}
    records = {r["note_id"]: r for r in corpus}
    for note_id, claims in claims_by_note.items():
        marks, matched_gt = _greedy_match(records[note_id], claims)
        scores += [c.score for c in claims]
        corrects += marks
        for t in F_TYPES:
            totals[t]["tp"] += sum(
                1 for j, g in enumerate(records[note_id]["gt"])
                if j in matched_gt and g["type"] == t
            )
            totals[t]["fp"] += sum(
                1 for c, ok in zip(claims, marks) if not ok and c.type.value == t
            )
            totals[t]["fn"] += sum(
                1 for j, g in enumerate(records[note_id]["gt"])
                if j not in matched_gt and g["type"] == t
            )
    return {"scores": scores, "corrects": corrects, "totals": totals}


def _prf(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3),
            "tp": tp, "fp": fp, "fn": fn}


def policy_metrics(test_claims, test_corrects) -> dict:
    acc_list, incorrect = [], []
    for c, ok in zip(test_claims, test_corrects):
        if c.decision == "accept":
            acc_list.append(ok)
        if not ok:
            incorrect.append(c.decision)
    n = len(test_claims)
    coverage = len(acc_list) / n if n else 0.0
    accepted_precision = sum(acc_list) / len(acc_list) if acc_list else 0.0
    captured = sum(1 for d in incorrect if d in ("flag_for_review", "abstain"))
    counts = {"accept": 0, "flag_for_review": 0, "abstain": 0}
    for c in test_claims:
        counts[c.decision] = counts.get(c.decision, 0) + 1
    return {
        "coverage": round(coverage, 3),
        "accepted_precision": round(accepted_precision, 3),
        "hallucination_capture": round(captured / len(incorrect), 3) if incorrect else None,
        "n_incorrect": len(incorrect),
        "decision_counts": counts,
    }


def make_plots(dev, test, threshold, plots_dir) -> None:
    fig, ax = plt.subplots(figsize=(5, 4))
    bins = ece_bins(dev["scores"], dev["corrects"])
    if bins:
        conf, acc, n = zip(*bins)
        ax.scatter(conf, acc, s=n, alpha=0.8)
    ax.plot([0, 1], [0, 1], "--", color="gray", label="perfect")
    ax.set(xlabel="mean score", ylabel="accuracy", title="Calibration (dev)")
    ax.legend()
    fig.savefig(plots_dir / "calibration.png", dpi=150)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5, 4))
    cov, risk = zip(*risk_coverage(test["scores"], test["corrects"]))
    ax.plot(cov, risk, marker=".")
    ax.set(xlabel="coverage", ylabel="selective risk", title="Risk–coverage (test)")
    fig.savefig(plots_dir / "risk_coverage.png", dpi=150)
    plt.close(fig)


def run_eval(extractor_kind: str, use_nli: bool, n_notes: int, seed: int) -> dict:
    ensure_dirs()
    corpus = ensure_corpus(n_notes, seed)
    dev_ids, test_ids = split_note_ids(corpus, SETTINGS.dev_frac, seed)

    extractor = build_extractor(extractor_kind)
    verifier = Verifier() if use_nli else None

    dev_claims_by_note = run_corpus(corpus, extractor, verifier, dev_ids)
    test_claims_by_note = run_corpus(corpus, extractor, verifier, test_ids)

    dev = collect(dev_claims_by_note, corpus)
    tau = pick_threshold(dev["scores"], dev["corrects"]) if dev["scores"] else FALLBACK_THRESHOLD
    low_frac = SETTINGS.low_frac

    test_claims = [c for cs in test_claims_by_note.values() for c in cs]
    assign_decisions(test_claims, tau, low_frac)
    test = collect(test_claims_by_note, corpus)

    n_claims = len(test_claims)
    totals = test["totals"]
    metrics = {
        "config": {
            "extractor": extractor_kind,
            "use_nli": use_nli,
            "n_notes": n_notes,
            "seed": seed,
            "n_claims_test": n_claims,
        },
        "extraction": {t: _prf(**totals[t]) for t in F_TYPES},
        "unsupported_claim_rate": (
            round(sum(totals[t]["fp"] for t in F_TYPES) / n_claims, 3) if n_claims else None
        ),
        "calibration": {
            "ece_dev": round(ece(dev["scores"], dev["corrects"]), 4),
            "ece_test": round(ece(test["scores"], test["corrects"]), 4),
            "threshold": round(tau, 4),
            "low_frac": low_frac,
        },
        "policy": policy_metrics(test_claims, test["corrects"]),
    }
    SETTINGS.metrics_path.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    SETTINGS.policy_path.write_text(
        json.dumps({"threshold": tau, "low_frac": low_frac, "extractor": extractor_kind}),
        encoding="utf-8",
    )
    make_plots(dev, test, tau, SETTINGS.plots_dir)
    return metrics


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Run the Veritas-Clin evaluation harness.")
    p.add_argument("--extractor", choices=("heuristic", "hf"), default="heuristic")
    p.add_argument("--no-nli", action="store_true", help="Skip NLI verification (offline smoke).")
    p.add_argument("--n-notes", type=int, default=SETTINGS.n_notes)
    p.add_argument("--seed", type=int, default=SETTINGS.seed)
    args = p.parse_args(argv)

    metrics = run_eval(args.extractor, use_nli=not args.no_nli, n_notes=args.n_notes, seed=args.seed)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
