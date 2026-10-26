# Architecture — Veritas-Clin

## 1. System Overview

```mermaid
flowchart LR
    A[Clinical note] --> B[Extractor\nQwen2.5-3B zero-shot\nor heuristic baseline]
    B --> C[Claims\n{type, value, dosage,\nsource span, token conf}]
    C --> D[NLI Verifier\nDeBERTa-v3\nclaim vs. best-matching\nsource sentence]
    D --> E[Score blend\nw_nli·p_entail + w_tok·token_conf]
    E --> F{Decision policy\nthresholds τ*, τ_low from dev}
    F -->|score ≥ τ*| G[accept]
    F -->|τ_low ≤ score < τ*| H[flag_for_review]
    F -->|score < τ_low| I[abstain]
    G & H & I --> J[FastAPI /extract\nPydantic-validated response]
    E -. dev split .-> K[Calibration\ntau* = argmax F1\nECE, risk-coverage]
    K --> F
```

The critical property: **no claim reaches the output without (a) an anchoring attempt in the
source note and (b) an NLI re-check.** Unsupported claims get low scores by construction.

## 2. Components & Interfaces

| Module | Responsibility | Depends on |
|---|---|---|
| `schemas.py` | Pydantic contracts: `Claim`, `VerifiedClaim`, request/response models | pydantic |
| `data_gen.py` | Deterministic synthetic corpus: rendered notes + ground-truth findings + planted traps (seeded, reproducible) | — |
| `extract.py` | `Extractor` protocol; `HeuristicExtractor` (CPU baseline); `HuggingFaceExtractor` (3B zero-shot, JSON-constrained, span anchoring, token confidence) | torch, transformers |
| `verify.py` | `Verifier`: sentence best-match + NLI entailment probability per claim | transformers |
| `calibrate.py` | Pure math — no model calls: `ece`, `risk_coverage`, `pick_threshold` (F1-max on dev), policy application | — |
| `eval.py` | Orchestrator: run extractor+verifier over corpus, match vs ground truth, produce `metrics.json` + plots | all above |
| `serve.py` | FastAPI: lazy singletons, `/health`, `/extract` | all above |

### Key design decisions

1. **`Extractor` as a protocol.** The heuristic extractor exists for two reasons: the test suite
   runs network-free, and eval can compare baseline vs LLM extraction under identical
   verification/calibration. Same downstream code path either way.
2. **Calibration module is pure.** `calibrate.py` has zero I/O and zero model dependencies, so
   threshold math is unit-tested against hand-computed cases.
3. **Ground truth lives with the corpus.** Spans are recorded at generation time by construction
   (the renderer knows where it placed each finding), then re-validated as an integrity check.
4. **Traps are explicit.** The generator plants: (a) diagnoses stated only as "ruled out",
   (b) conditions appearing only as family history, (c) drugs appearing only in the allergy
   line. A correct extractor must read *modality*, not strings. These traps make
   hallucination measurement possible at all.

## 3. Data Flow

```
data/corpus.jsonl ──► split(dev|test) ──► extract ──► verify ──► calibrate(dev)
                                                                      │ τ*, τ_low
                                                    test claims ◄─────┘
                                                          │
                              artifacts/metrics.json ◄────┴──► artifacts/plots/*.png
                                                          │
                                          serve.py loads policy.json + models lazily
```

- Splits are seeded and fixed before any model runs; the threshold never touches test data.
- A claim is *correct* iff its normalized value (+ dosage semantics) matches a same-type
  ground-truth finding. Correctness XORs with verifier flags to yield flag recall.

## 4. Error Handling

| Failure | Behavior |
|---|---|
| Model download/load fails | Surfaced at startup of the heavy path; `/health` reports load state, `/extract` returns HTTP 503 |
| Extraction returns non-JSON | Recovery parse; on failure → empty claim list + `parse_ok=false` in trace |
| Span text not found verbatim in note | `span_text=None` (claim continues, score reflects anchoring gap via NLI) |
| No sentence overlaps a claim | `p_entail = p_contra = 0`, decision degrades to `flag/abstain` |
| NLI label scheme varies by checkpoint | Single normalization map in `verify.py` |

## 5. Testing Strategy

- **Unit (offline, no downloads):** corpus integrity + trap assertions; heuristic extraction on
  a fixed note; ECE / risk–coverage / threshold selection on hand-built vectors; GT matching
  edge cases; Verifier behavior against a mocked NLI pipeline.
- **End-to-end smoke:** heuristic extractor over the full corpus produces metrics + plots.
- **GPU path:** one Colab notebook flips the extractor to `HuggingFaceExtractor` — same
  downstream modules, so code correctness is already covered offline.

## 6. Phase 2 (explicitly not built tonight)

- QLoRA fine-tuning of the 3B extractor; A/B against zero-shot under the same harness.
- MedNLI-tuned NLI checkpoint substitution (n2c2-style data).
- Conformal abstention; OOD annotations; real (credentialed) corpora.
