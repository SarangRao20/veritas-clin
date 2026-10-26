# PRD — Veritas-Clin

**Evidence-Grounded Clinical Information Extraction with Calibrated Abstention**

| | |
|---|---|
| Status | v1.0 — one-night build |
| Type | Academic final-year project (deliverable tonight) |
| Phase 2 | Fine-tuning comparison (explicitly out of scope tonight) |

## 1. Problem

Large language models applied to clinical text are materially unreliable: they hallucinate
findings, misread dosages, and extract conditions that were only "ruled out" — and they do so
**while remaining confident**. No deployed clinical extraction system today can answer the
question a clinician actually cares about: *"when should this output be trusted, and when should
it go to a human?"*

Selective prediction + calibration for clinical extraction is an active, unaddressed gap.
This project builds that system.

## 2. Users

- **Primary:** academic evaluators (viva panel) reviewing engineering depth and measured results.
- **Secondary:** any healthcare-NLP team needing a reference architecture for trustworthy extraction.
- **Explicitly not:** live clinical use. The corpus is synthetic; nothing here touches PHI.

## 3. Goals

1. End-to-end pipeline: clinical note in → per-claim structured output out, where every claim
   carries a **source span**, a **calibrated score**, and an explicit decision:
   `accept | flag_for_review | abstain`.
2. An **NLI-based verification layer** that re-checks every extracted claim against the source
   note — the mechanism that makes confidence meaningful.
3. Real calibration science on a labeled corpus: **ECE**, **risk–coverage curves**, and an
   abstention threshold picked on dev data, reported on held-out test data.
4. A working **FastAPI service** with schema-validated output, and a **single Colab notebook**
   reproducing the whole pipeline on a free T4 in under ~20 minutes.
5. Quantified evidence that the flagging policy captures hallucinations (e.g., flag recall on
   incorrect claims at a given coverage).

## 4. Non-Goals (deliberate)

- No fine-tuning / QLoRA (Phase 2; pre-trained zero-shot models only tonight).
- No real PHI, no MIMIC, no hospital integration, no auth/RBAC.
- No patient-facing UI. The API + notebook + metrics are the deliverables.
- No claim of clinical validity: data is template-synthesized and labeled by construction.

## 5. Scope (tonight)

| In scope | Out |
|---|---|
| Synthetic corpus w/ ground truth + planted hallucination traps (ruled-out dx, family history, allergies) | Real clinical corpora (credentialed access — slow) |
| Zero-shot extraction: Qwen2.5-3B-Instruct (GPU) + deterministic heuristic baseline (CPU/testing) | Fine-tuned extraction |
| NLI verification (DeBERTa-v3 MNLI checkpoint; MedNLI swap = Phase 2) | Medical-tuned NLI |
| Score = w_nli·p_entail + w_tok·token_conf; ECE; risk–coverage; τ chosen on dev, F1-maximizing | Conformal prediction, OOD calibration |
| FastAPI `/health`, `/extract`; JSONL corpus; `metrics.json` + plots; pytest suite (network-free) | Docker, load testing, tracing |

## 6. Success Criteria (measured, not asserted)

1. `pytest` passes fully offline.
2. Full corpus run produces `artifacts/metrics.json` containing, per type: precision/recall/F1;
   unsupported-claim rate before verification; ECE; and policy stats: accepted coverage,
   accepted precision, and **flag recall on incorrect claims**.
3. Calibration plot and risk–coverage plot are generated as artifacts.
4. The rule-out trap is demonstrated: ruled-out diagnoses are systematically NOT accepted.
5. Every number reported in the README comes from a run on the test split — none hand-written.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Colab GPU unavailable | Heuristic extractor runs end-to-end on CPU; identical downstream code |
| NLI checkpoint label scheme differs | Label mapping normalized to lowercase {entailment, neutral, contradiction} in one place |
| Extraction JSON malformed | Span-anchoring + JSON recovery; malformed claims surface as verifier flags, not crashes |
| Scope creep overnight | Phase-2 list is written down and closed |
