import React from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  CheckCircle2, 
  Activity, 
  Layers, 
  FileText,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

export default function VivaGuidePage() {
  return (
    <div className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-5xl w-full mx-auto">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-700 mb-1">
            Academic Examination &bull; Final-Year Capstone
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Examiner Viva Defense Manual
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Architectural decisions, empirical rigor, mathematical proofs, and anticipated panel questions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-sky-800 bg-sky-50 border border-sky-200 px-3.5 py-1.5 rounded-lg">
          <BookOpen className="w-3.5 h-3.5 text-sky-600" />
          <span>Examiner Reference Mode</span>
        </div>
      </div>

      {/* 30-Second Elevator Pitch Box */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 shadow-2xs">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-900 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-700" />
          <span>The 30-Second Viva Elevator Pitch:</span>
        </h3>
        <p className="text-xs text-sky-950 leading-relaxed">
          &ldquo;Doctors spend hours writing unstructured clinical notes. When hospitals use AI to extract diagnoses and medications, large language models hallucinate subtly—extracting conditions that were only ruled out or misattributing family history—and they do so with high confidence. Veritas-Clin solves this by introducing a dual-stage architecture: zero-shot structured extraction coupled with an orthogonal NLI self-verification layer that calculates Expected Calibration Error (ECE) and enforces calibrated selective abstention. Rather than forcing the model to guess, our system automatically routes high-risk claims to human review, boosting accepted precision from 85.2% to 92.9% while capturing 56.2% of all hallucinations at 90.7% chart coverage.&rdquo;
        </p>
      </div>

      {/* Anticipated Viva Questions & Winning Defenses */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <span>Top 5 Anticipated Examiner Questions & Winning Responses</span>
        </h3>

        {/* Q1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
              QUESTION 1
            </span>
            <h4 className="font-bold text-xs text-slate-900">
              &ldquo;Did you fine-tune the Large Language Model? Why not just fine-tune Llama or BioMistral?&rdquo;
            </h4>
          </div>
          <div className="text-xs text-slate-600 pl-11 space-y-2 leading-relaxed">
            <p>
              <strong>The Honest & Winning Answer:</strong> &ldquo;No, sir/ma'am, and that was a deliberate architectural decision. Fine-tuning modifies weights to learn specialized medical vocabulary, but clinical NLP literature proves that fine-tuning <em>does not solve overconfidence or negation blindness</em>. Even fine-tuned models hallucinate when processing long notes with subtle rule-out statements.&rdquo;
            </p>
            <p>
              &ldquo;Our contribution is <strong>architectural rather than parametric</strong>: by pairing a generative extractor with an orthogonal cross-encoder auditor (DeBERTa-v3) and applying calibrated selective prediction (&tau;* = 0.35), we achieved 92.9% precision zero-shot. Parameter-efficient fine-tuning (QLoRA) is scoped as Phase 2 future work in our PRD.&rdquo;
            </p>
          </div>
        </div>

        {/* Q2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
              QUESTION 2
            </span>
            <h4 className="font-bold text-xs text-slate-900">
              &ldquo;Why use Natural Language Inference (NLI) instead of asking the LLM 'Are you sure?' (Self-Reflection)?&rdquo;
            </h4>
          </div>
          <div className="text-xs text-slate-600 pl-11 space-y-2 leading-relaxed">
            <p>
              <strong>The Winning Defense:</strong> &ldquo;Self-reflection in generative LLMs suffers from <strong>confirmation bias</strong>. If the model had an attention blind spot and extracted a ruled-out condition, prompting it in the same context to re-evaluate almost always reproduces the identical hallucination.&rdquo;
            </p>
            <p>
              &ldquo;In contrast, DeBERTa-v3 is an <strong>orthogonal bidirectional cross-encoder</strong> trained specifically on premise-hypothesis entailment. It performs full cross-attention across the source sentence and the extracted finding, providing an independent verification signal.&rdquo;
            </p>
          </div>
        </div>

        {/* Q3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
              QUESTION 3
            </span>
            <h4 className="font-bold text-xs text-slate-900">
              &ldquo;How was the decision threshold &tau;* derived, and how did you prevent data leakage?&rdquo;
            </h4>
          </div>
          <div className="text-xs text-slate-600 pl-11 space-y-2 leading-relaxed">
            <p>
              <strong>The Winning Defense:</strong> &ldquo;We maintained a strict 50/50 partition (20 Dev notes / 20 Test notes) using a deterministic seed (seed=7). The decision threshold <strong>&tau;* = 0.3499</strong> was optimized strictly on the Dev split to maximize the F1 score of accepted chart entries.&rdquo;
            </p>
            <p>
              &ldquo;It was then frozen into <code>policy.json</code> and applied blindly to the Test split. All reported numbers—92.9% precision, 56.2% hallucination capture rate, and 0.1353 test ECE—are on the held-out Test split with zero leakage.&rdquo;
            </p>
          </div>
        </div>

        {/* Q4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
              QUESTION 4
            </span>
            <h4 className="font-bold text-xs text-slate-900">
              &ldquo;What is Expected Calibration Error (ECE) and why is it superior to raw accuracy in healthcare?&rdquo;
            </h4>
          </div>
          <div className="text-xs text-slate-600 pl-11 space-y-2 leading-relaxed">
            <p>
              <strong>The Winning Defense:</strong> &ldquo;In clinical applications, confidence calibration is more critical than raw accuracy. An uncalibrated model can output a lethal wrong drug dosage with 99% confidence. ECE measures whether the model's stated confidence equals empirical reality by computing the weighted average gap between confidence and observed accuracy across probability bins.&rdquo;
            </p>
          </div>
        </div>

        {/* Q5 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
              QUESTION 5
            </span>
            <h4 className="font-bold text-xs text-slate-900">
              &ldquo;Why did you use synthetic notes rather than real MIMIC-III/IV hospital records?&rdquo;
            </h4>
          </div>
          <div className="text-xs text-slate-600 pl-11 space-y-2 leading-relaxed">
            <p>
              <strong>The Winning Defense:</strong> &ldquo;Two scientific reasons: First, <strong>ground truth by construction</strong>—in public MIMIC notes, human annotators frequently disagree on exact entity span boundaries. Our generator records exact character offsets at render time. Second, <strong>planted adversarial traps</strong>—we deliberately planted subtle clinical rule-outs, family histories, and allergy mentions to systematically test negation and modality handling without requiring PHI credentialing.&rdquo;
            </p>
          </div>
        </div>

      </div>

      {/* Mathematical Formulations Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600" />
          <span>Core Mathematical Formulations</span>
        </h3>

        <div className="grid sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">1. Calibrated Decision Score:</span>
            <div className="text-slate-900 font-bold">
              S(claim) = 0.8 &bull; P_entail + 0.2 &bull; conf_tok
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              Weighted blend of cross-encoder entailment and generator token logit confidence.
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">2. Three-Way Policy:</span>
            <div className="text-slate-900 font-bold">
              Decision(S) = S &ge; &tau;* ? ACCEPT : (S &ge; 0.8&tau;* ? REVIEW : ABSTAIN)
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              Applies dev-optimized cutoff &tau;* = 0.35 with hysteresis review band.
            </div>
          </div>
        </div>
      </div>

      {/* GPU Empirical Plots Display */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Tesla T4 GPU Empirical Evaluation Plots (Held-Out Test Split)</span>
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="font-mono text-[11px] font-bold text-slate-700 block mb-2">
              Reliability Diagram (Dev ECE: 0.1500)
            </span>
            <img 
              src="/artifacts/plots/calibration.png" 
              alt="Calibration Reliability Plot" 
              className="max-h-56 mx-auto rounded border border-slate-200"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Calibration+Plot';
              }}
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="font-mono text-[11px] font-bold text-slate-700 block mb-2">
              Selective Risk vs Coverage Curve (Test Split)
            </span>
            <img 
              src="/artifacts/plots/risk_coverage.png" 
              alt="Risk-Coverage Curve" 
              className="max-h-56 mx-auto rounded border border-slate-200"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Risk+Coverage+Plot';
              }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
