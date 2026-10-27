import { PageHeader } from '../components/ui';

/** Examiner Q&A — every answer traces to a document, a unit-tested module, or a live artifact. */
const QANDA = [
  {
    q: 'Walk through the pipeline end to end.',
    a: 'Three stages. (1) Extraction: a zero-shot instruction-tuned LLM (Qwen2.5-3B-Instruct) emits structured claims typed as diagnosis / medication / follow-up. (2) Verification: each claim is paired with the sentence in the source note that grounds it, and a DeBERTa-v3 NLI cross-encoder (trained on MNLI+FEVER+ANLI) scores the pair — p(entailment) and p(contradiction). (3) Calibrated abstention: score = 0.8·p(entail) + 0.2·token_conf is compared with a threshold learned on the dev split (τ* = 0.3499) with a hysteresis band at 0.8·τ*: above τ* the claim is auto-written, inside the band it is held for physician review, below it the system abstains outright.',
  },
  {
    q: 'Why no fine-tuning — isn\'t that the whole point of an ML project?',
    a: 'Fine-tuning was a deliberate exclusion, not an omission. Zero-shot extraction shows the safety architecture does the work rather than dataset memorization: the 13 diagnosis false positives on the test split are exactly the planted traps (modality-qualified, family-history, allergy lines), and the NLI layer plus abstention is what suppresses them. It also keeps the audit non-circular: a cross-encoder trained on public NLI data, not on our own corpus, checks the extractor. Phase 2 in the PRD specifies QLoRA fine-tuning and a likert-to-calibration step, and the eval harness is written to accept either an HF checkpoint or the deterministic heuristic extractor.',
  },
  {
    q: 'Why is the corpus synthetic?',
    a: 'Because ground truth must be exact, not estimated. Notes are rendered from a seeded template while recording every finding\'s character span — so precision, recall, and hallucination rates are computed against known-by-construction answers. It also lets us plant adversarial traps deterministically (a condition stated as "ruled out", a condition in the family-history line, penicillin in the allergy line). No PHI is involved, and the eval harness and serving path exercise identical code.',
  },
  {
    q: 'Why not use embeddings and similarity search instead of an NLI model?',
    a: 'See the NLP foundations page, computed live: cosine(pneumonia, pneumonitis) ≈ 1.0 (correct) but cosine(pneumonia, "ruled out pneumonia") ≈ 0.96 (a fatal failure). Static Word2Vec/GloVe vectors are bag-of-context by construction — Firth\'s distributional hypothesis — so a condition and its negation share nearly the same vector. NLI is asymmetric and directional: a premise–hypothesis pair is classified as entailment or contradiction. That asymmetry is precisely what clinical safety needs.',
  },
  {
    q: 'What does "calibrated" mean here — how is it measured?',
    a: 'The decision score should mean what it says: ECE (Expected Calibration Error) is Σ over bins of (bin share × |accuracy − mean confidence|). On the dev split (τ search only) ECE = 0.15; on the untouched test split ECE = 0.1353. The score blends token confidence with NLI entailment so it is honest about two failure sources.',
  },
  {
    q: 'What do the benchmark numbers actually say?',
    a: 'Held-out test split, 108 claims, all read from artifacts/metrics.json: diagnosis F1 87.1% (recall 100%, the 13 FPs are planted traps), medication F1 95.1%, follow-up F1 97.4%; accepted precision 92.9% at 90.7% coverage (a +7.7pt precision improvement over the un-calibrated baseline); 56.2% of planted hallucination traps suppressed while a human sees only what is held in the hysteresis band.',
  },
  {
    q: 'Where is the engineering rigor beyond "model calls"?',
    a: 'Calibration math (ECE, risk–coverage, pick-threshold) is pure, unit-tested Python with no model or I/O calls; the serving path and benchmark harness share the same pipeline run() so numbers in analytics describe what actually ships; determinism is seeded end to end; a single FastAPI process serves the pipeline, the SPA, and the artifacts; the frontend calls /extract live — the Audit page is the real pipeline, reproducible with any text pasted in; CI runs the full pytest suite (15 tests) plus the frontend build.',
  },
  {
    q: 'What is the deployment story?',
    a: 'A single FastAPI process: /extract runs the current policy (heuristic extractor on CPU hosts, full HF stack on GPU hosts), /artifacts exposes the benchmark plots served to the UI, and the SPA is a static bundle with no separate web server. What you see in the Audit page is real pipeline output, reproducible with any text pasted in.',
  },
  {
    q: 'What is the single biggest limitation?',
    a: 'The accept path is only as safe as the extractor–verifier agreement — the NLI verifier is a single model, not an ensemble, and it was not adversarially fine-tuned. Robustness is measured, not guaranteed: the risk–coverage curve is the tool that makes the residual risk explicit and tunable by moving τ*.',
  },
];

/** Plain document layout — no boxes, no widgets. A reading page. */
export default function VivaGuidePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Defense"
        title="Viva guide"
        sub="Nine questions an examiner is likely to ask, with answers that trace to a document, a unit-tested module, or a live artifact in this repo."
      />
      <dl className="divide-y divide-zinc-200 border-y border-zinc-200">
        {QANDA.map((item, i) => (
          <div key={i} className="py-5">
            <dt className="text-[16px] font-semibold text-zinc-900">
              <span className="text-zinc-400 font-mono text-[13px] mr-2">{i + 1}.</span>
              {item.q}
            </dt>
            <dd className="mt-2 text-[13.5px] leading-relaxed text-zinc-700">{item.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
