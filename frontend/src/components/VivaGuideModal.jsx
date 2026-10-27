import React from 'react';
import { X, BookOpen, CheckCircle, ShieldAlert, FileText, Activity } from 'lucide-react';

export default function VivaGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-sm tracking-tight">Examiner Viva Defense Guide & Empirical Telemetry</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          
          {/* Quick Elevator Pitch */}
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-800 mb-1">
              The 30-Second Viva Elevator Pitch:
            </h4>
            <p className="text-xs text-sky-950 leading-relaxed">
              &ldquo;Traditional clinical NLP systems extract information and hand it straight to downstream EHR systems. But LLMs hallucinate subtly—extracting conditions that were only ruled out or misattributing family history—with high confidence. Veritas-Clin solves this by introducing a dual-stage architecture: zero-shot structured extraction coupled with an NLI self-verification layer that calculates Expected Calibration Error (ECE) and enforces calibrated selective abstention. Rather than forcing the model to guess, our system automatically routes high-risk claims to human review, boosting accepted precision from 85.2% to 92.9% while capturing 56.2% of all hallucinations at 90.7% chart coverage.&rdquo;
            </p>
          </div>

          {/* Anticipated Viva Questions */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Anticipated Examiner Questions & Winning Responses</span>
            </h4>

            {/* Q1 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="font-bold text-xs text-sky-900">
                Q1: &ldquo;Why did you build an NLI verification layer instead of prompting the LLM to verify itself ('Self-Reflection')?&rdquo;
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Your Defense:</strong> LLM self-reflection suffers from <em>confirmation bias</em>. If an LLM had an attention blind spot and extracted a ruled-out condition, prompting it in the same context almost always reproduces the hallucination. Our system uses an <strong>orthogonal bidirectional cross-encoder (DeBERTa-v3)</strong> specifically trained on premise-hypothesis natural language inference to re-examine the claim against the source note independently.
              </div>
            </div>

            {/* Q2 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="font-bold text-xs text-sky-900">
                Q2: &ldquo;How was the decision threshold &tau;* derived without data leakage?&rdquo;
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Your Defense:</strong> We maintained a strict 50/50 partition (20 Dev notes / 20 Test notes) using seed 7. The decision threshold (&tau;* = 0.3499) was optimized <strong>strictly on the Dev split</strong> to maximize F1 of accepted chart entries. It was then frozen in <code>policy.json</code> and applied blindly to the Test split. All reported numbers (92.9% precision, 56.2% error capture) are on the held-out Test split.
              </div>
            </div>

            {/* Q3 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="font-bold text-xs text-sky-900">
                Q3: &ldquo;What is Expected Calibration Error (ECE) and why does it matter here?&rdquo;
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Your Defense:</strong> Standard accuracy ignores whether stated confidence matches reality. An uncalibrated model can give a lethal wrong dosage with 99% confidence. ECE calculates the gap between predicted confidence and observed empirical accuracy across probability bins. Our test split achieved an ECE of <strong>0.1353</strong>.
              </div>
            </div>
          </div>

          {/* Real GPU Evaluation Plots */}
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>Tesla T4 GPU Empirical Evaluation Plots (Held-Out Test Split)</span>
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="block font-mono text-[11px] font-bold text-slate-700 mb-2">
                  Reliability Diagram (Dev ECE: 0.1500)
                </span>
                <img 
                  src="/artifacts/plots/calibration.png" 
                  alt="Calibration Reliability Diagram" 
                  className="rounded border border-slate-200 mx-auto max-h-56 object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Calibration+Reliability+Plot';
                  }}
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="block font-mono text-[11px] font-bold text-slate-700 mb-2">
                  Selective Risk vs Coverage Curve (Test Split)
                </span>
                <img 
                  src="/artifacts/plots/risk_coverage.png" 
                  alt="Selective Risk vs Coverage Curve" 
                  className="rounded border border-slate-200 mx-auto max-h-56 object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Risk+Coverage+Plot';
                  }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
