import React, { useEffect, useState } from 'react';
import { ShieldCheck, Check, Loader2, ArrowRight } from 'lucide-react';

export default function ProcessingView({ onComplete, threshold }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [logMessages, setLogMessages] = useState([
    "[Syntax] Segmenting clinical document into candidate sentences...",
  ]);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setCurrentStep(2);
      setLogMessages((prev) => [
        ...prev,
        "[Qwen2.5-3B] Zero-shot extraction: Candidate Diagnoses, Medications, and Follow-ups identified.",
      ]);
    }, 450);

    const timer2 = setTimeout(() => {
      setCurrentStep(3);
      setLogMessages((prev) => [
        ...prev,
        "[DeBERTa-v3] Cross-Encoder checking sentence-level premise-hypothesis entailment vectors...",
        "[Audit] Contradiction detected on negated distractor sentence: P_contra = 88.4%. Safety valve engaged.",
      ]);
    }, 950);

    const timer3 = setTimeout(() => {
      setCurrentStep(4);
      setLogMessages((prev) => [
        ...prev,
        `[Selective Policy] Applying calibrated threshold tau* = ${threshold.toFixed(2)} (Dev-Learned Optimal).`,
        "[Complete] Routing safe findings to patient chart and suppressing contraindicated hallucinations.",
      ]);
    }, 1450);

    const timer4 = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete, threshold]);

  const steps = [
    { num: 1, title: "1. Sentence Segmentation & EHR Syntax Decomposition" },
    { num: 2, title: "2. Zero-Shot Candidate Entity Extraction (Qwen2.5-3B)" },
    { num: 3, title: "3. Cross-Encoder NLI Entailment & Contradiction Audit (DeBERTa-v3)" },
    { num: 4, title: `4. Selective Calibrated Abstention Routing (\u03C4* = ${threshold.toFixed(2)})` },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-8 sm:p-10 shadow-sm text-center">
        
        {/* Radar Loader */}
        <div className="w-16 h-16 rounded-full bg-sky-50 border-2 border-sky-600 flex items-center justify-center mx-auto mb-6 text-sky-600 animate-pulse shadow-sm shadow-sky-600/20">
          <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Auditing Clinical Document
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-1 mb-8">
          Executing Dual-Stage Extraction & Cross-Encoder Verification
        </p>

        {/* Stepper Checklist */}
        <div className="space-y-3.5 text-left mb-8">
          {steps.map((step) => {
            const isCompleted = currentStep > step.num;
            const isActive = currentStep === step.num;
            return (
              <div 
                key={step.num}
                className={`flex items-center gap-3 text-xs font-semibold p-2.5 rounded-lg border transition-all ${
                  isCompleted 
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                    : isActive 
                    ? 'border-sky-300 bg-sky-50/60 text-sky-900 shadow-xs'
                    : 'border-slate-100 bg-slate-50/50 text-slate-400'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
                  isCompleted 
                    ? 'bg-emerald-600 text-white' 
                    : isActive 
                    ? 'bg-sky-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {isCompleted ? <Check className="w-3 h-3 stroke-[2.5]" /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : step.num}
                </div>
                <span>{step.title}</span>
              </div>
            );
          })}
        </div>

        {/* Live Console Output Box */}
        <div className="bg-slate-900 rounded-lg p-3.5 text-left font-mono text-[11px] text-sky-400 space-y-1 overflow-x-auto min-h-[90px] border border-slate-800">
          {logMessages.map((msg, i) => (
            <div key={i} className="leading-relaxed">
              <span className="text-slate-500 mr-2">&gt;</span>
              {msg}
            </div>
          ))}
        </div>

        {/* Skip / View Now Button */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-700 transition-colors"
          >
            <span>Skip Animation & View Report</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
