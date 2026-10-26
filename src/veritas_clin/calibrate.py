"""Pure calibration + abstention math. No model calls, no I/O — fully unit-testable."""

from __future__ import annotations

from .config import SETTINGS


def blend_score(
    p_entail: float | None,
    token_conf: float | None,
    w_nli: float = SETTINGS.w_nli,
    w_tok: float = SETTINGS.w_tok,
) -> float:
    """Decision score in [0, 1].

    With NLI available: w_nli * p_entail + w_tok * token_conf.
    Without NLI (offline smoke mode): score is the token confidence alone.
    """
    token_conf = SETTINGS.token_conf_default if token_conf is None else token_conf
    if p_entail is None:
        return min(1.0, max(0.0, token_conf))
    return min(1.0, max(0.0, w_nli * p_entail + w_tok * token_conf))


def ece_bins(
    scores: list[float], corrects: list[bool], n_bins: int = 10
) -> list[tuple[float, float, int]]:
    """Per-bin (mean_score, accuracy, count) for calibration plots and ECE."""
    bins: list[list[float]] = [[] for _ in range(n_bins)]
    for score, correct in zip(scores, corrects):
        bins[min(int(score * n_bins), n_bins - 1)].append((score, 1.0 if correct else 0.0))
    out: list[tuple[float, float, int]] = []
    for b in bins:
        if not b:
            continue
        conf = sum(s for s, _ in b) / len(b)
        acc = sum(c for _, c in b) / len(b)
        out.append((conf, acc, len(b)))
    return out


def ece(scores: list[float], corrects: list[bool], n_bins: int = 10) -> float:
    """Expected Calibration Error: confidence vs. observed accuracy gap."""
    n = len(scores)
    if n == 0:
        return 0.0
    return sum(count / n * abs(conf - acc) for conf, acc, count in ece_bins(scores, corrects, n_bins))


def risk_coverage(
    scores: list[float], corrects: list[bool]
) -> list[tuple[float, float]]:
    """(coverage, selective_risk) as the accept-set grows from most-confident down."""
    n = len(scores)
    order = sorted(range(n), key=lambda i: (-scores[i], i))  # stable tie-break
    out: list[tuple[float, float]] = []
    n_correct = 0
    for k, i in enumerate(order, start=1):
        n_correct += 1 if corrects[i] else 0
        coverage = k / n
        risk = 1.0 - n_correct / k
        out.append((coverage, risk))
    return out


def _prf1(precision: float, recall: float) -> float:
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def pick_threshold(scores: list[float], corrects: list[bool]) -> float:
    """tau maximizing F1 of the accept decision (score >= tau), maximizing coverage on ties.

    Candidates are the distinct score values plus 0.0 (accept everything); the search is
    strictly deterministic. The dev split must be used — never the test split.
    """
    n = len(scores)
    if n == 0:
        return SETTINGS.token_conf_default  # degenerate guard; honestly arbitrary
    candidates = sorted(set(scores), reverse=True)
    best_f1, best_cov = -1.0, -1.0
    best_tau = candidates[-1]
    for tau in candidates:
        accepted_correct = [c for s, c in zip(scores, corrects) if s >= tau]
        accepted = len(accepted_correct)
        coverage = accepted / n
        precision = sum(accepted_correct) / accepted if accepted else 0.0
        recall = coverage  # every correct claim is potentially recallable
        f1 = _prf1(precision, recall)
        if f1 > best_f1 or (f1 == best_f1 and coverage > best_cov):
            best_f1, best_cov, best_tau = f1, coverage, tau
    return best_tau


def decide(score: float, threshold: float, low_frac: float = SETTINGS.low_frac) -> str:
    """Three-way policy: accept / flag_for_review (hysteresis band) / abstain."""
    if score >= threshold:
        return "accept"
    if score >= threshold * low_frac:
        return "flag_for_review"
    return "abstain"
