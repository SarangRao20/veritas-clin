import React from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  Cpu, 
  Layers, 
  FileCheck2, 
  BookOpen,
  GitBranch
} from 'lucide-react';

export default function LandingView({ onLaunchStudio, onOpenGuide }) {
  return (
    <div className="flex-1 flex flex-col">
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center flex flex-col items-center">
        
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-semibold mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>TESLA T4 GPU BENCHMARKED &bull; 92.9% ACCEPTED CHART PRECISION</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-[1.12] mb-6">
          The Clinical Safety Guardrail Between{' '}
          <span className="text-sky-600">Large Language Models</span> and Patient Records.
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-slate-600 max-w-3xl leading-relaxed mb-10">
          Eliminate dangerous clinical hallucinations before they reach the EHR chart. A dual-stage architecture combining medical LLM extraction with cross-encoder NLI verification and calibrated selective abstention.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={onLaunchStudio}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-7 py-3 rounded-lg shadow-sm shadow-sky-600/30 hover:shadow hover:-translate-y-0.5 transition-all"
          >
            <span>Start Clinical Audit Workflow</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenGuide}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-sm px-6 py-3 rounded-lg shadow-xs hover:border-slate-400 transition-all"
          >
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>Examiner Viva Defense Guide</span>
          </button>
        </div>

        {/* Real GPU Benchmark Telemetry Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm text-left">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-slate-900">92.9%</span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+7.7%</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Accepted Chart Precision (vs 85.2% baseline)</p>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-emerald-700">56.2%</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Planted Hallucinations Caught & Suppressed</p>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-sky-700">90.7%</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Automated EHR Chart Coverage</p>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-indigo-700">0.1353</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">Expected Calibration Error (ECE on Test Split)</p>
          </div>
        </div>

      </section>

      {/* Problem Section: Where Standard AI Fails */}
      <section className="bg-white border-y border-slate-200 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
              THE CLINICAL AI PROBLEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              Where Standard Clinical LLMs Fail
            </h2>
            <p className="text-base text-slate-600 mt-3">
              Prompting an LLM to read clinical notes leads to severe errors because standard models match vocabulary tokens while remaining blind to medical modality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-5">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">1. Negation Blindness</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  When a doctor writes <em>"Community-acquired pneumonia - ruled out"</em>, standard LLMs extract Pneumonia as an active patient diagnosis with 98% confidence simply because the word appears.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-mono text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
                ⚠️ Result: Inappropriate antibiotic course prescribed.
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">2. Allergy Misattribution</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Under <em>"Allergies: Penicillin (anaphylaxis)"</em>, uncalibrated AI models misparse the drug token and enter Penicillin onto the discharge medication order list.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-mono text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                ⚠️ Result: Patient receives contraindicated drug.
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-5">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">3. Family History Bleed</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Phrases like <em>"Father has Type 2 Diabetes"</em> routinely bleed into the patient's own diagnostic problem list, contaminating billing and longitudinal clinical decision support.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-mono text-sky-800 bg-sky-50 p-2.5 rounded border border-sky-200">
                ⚠️ Result: False comorbidities enter patient chart.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
            ENGINEERING FOUNDATION
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
            The Veritas Dual-Stage Safety Pipeline
          </h2>
          <p className="text-base text-slate-600 mt-3">
            A decoupled architecture separating generative candidate extraction from an orthogonal cross-encoder verification barrier.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-slate-50 rounded-xl border-l-4 border-sky-600">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-sky-700">STAGE 1: GENERATOR</span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Qwen2.5-3B Extractor</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Zero-shot instruction-tuned model parses unstructured doctor notes into candidate Diagnoses, Medications with dosage/frequency, and Follow-ups into JSON tokens.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border-l-4 border-cyan-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-cyan-700">STAGE 2: AUDITOR</span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">DeBERTa-v3 Cross-Encoder</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bidirectional NLI model independently checks every claim against the source note. Calculates precise P_entail, P_neutral, and P_contra probabilities.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border-l-4 border-emerald-600">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-emerald-700">STAGE 3: SAFETY VALVE</span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Calibrated Abstention</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Applies dev-optimized threshold &tau;* = 0.35. Automatically charts safe findings, routes borderline cases to doctors, and suppresses hallucinations.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-mono">
              Formula: Decision Score S = 0.8 &bull; P_entail + 0.2 &bull; Token_Conf
            </div>
            <button
              onClick={onLaunchStudio}
              className="inline-flex items-center gap-2 text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              <span>Test live in Clinical Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
