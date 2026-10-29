import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity, ArrowRight, Brain, CheckCircle2, Database, FileText,
  Lock, Microscope, Pill, ShieldCheck, Sparkles, Zap, ChevronRight
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <Microscope className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">Veritas-Clin</span>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                Clinical NLP
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/patients"
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Patient Hub
                </Link>
                <Link
                  to="/workbench"
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Document Studio
                </Link>
                <Link
                  to="/patients/PT-4091"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition-all"
                >
                  Case PT-4091
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm shadow-teal-500/20 transition-all"
                >
                  Get Started
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero Section (Inspired by CTC & SaharaAI Health Portal) ── */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.teal.50),theme(colors.slate.50))]" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3.5 py-1 text-xs font-medium text-teal-800 mb-6">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Zero Data Leakage • HIPAA Safe Harbor 45 CFR § 164.514(b)(2)</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            Evidence-Grounded Intelligence for <span className="text-teal-600 underline decoration-teal-300 decoration-wavy decoration-2">Clinical Documents</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 max-w-2xl mx-auto">
            Not a mere chatbot. Veritas-Clin combines dense semantic embeddings with BM25 lexical precision, automatic clinical assertion detection, and HIPAA de-identification to deliver verifiable, cited patient intelligence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={isAuthenticated ? "/patients" : "/register"}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 hover:bg-teal-700 transition-all hover:scale-[1.02]"
            >
              <Zap className="h-4 w-4" />
              Patient Command Hub
            </Link>
            <Link
              to={isAuthenticated ? "/patients/PT-4091" : "/login"}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-6 py-3.5 text-sm font-semibold text-teal-900 shadow-sm hover:bg-teal-100/80 transition-all"
            >
              <Activity className="h-4 w-4 text-teal-700" />
              Featured Case: Marcus Vance (PT-4091)
            </Link>
            <Link
              to={isAuthenticated ? "/workbench" : "/login"}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
            >
              <FileText className="h-4 w-4 text-slate-400" />
              Document Studio & NLP
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-left">
              <div className="flex items-center justify-between text-teal-600 mb-2">
                <Brain className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">NLP</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">Hybrid RRF</p>
              <p className="text-xs text-slate-500 mt-1">BM25 Lexical + 384-dim Dense Transformer Vectors</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-left">
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">HIPAA</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">18 PHI Rules</p>
              <p className="text-xs text-slate-500 mt-1">Safe Harbor Masking with Medical Whitelist</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-left">
              <div className="flex items-center justify-between text-amber-600 mb-2">
                <Activity className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Context</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">Negation Eye</p>
              <p className="text-xs text-slate-500 mt-1">Solves Embedding Model Negation Blindness</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-left">
              <div className="flex items-center justify-between text-indigo-600 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">Safety</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">Zero Guessing</p>
              <p className="text-xs text-slate-500 mt-1">Strict Threshold Abstention & Passage Grounding</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Architecture Workflow (Inspired by CTC Flowcharts) ── */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              Ground-Up Pipeline
            </span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">How Clinical Evidence Flows Safely</h2>
            <p className="mt-2 text-sm text-slate-500">
              User-isolated contexts ensure patient records are never contaminated, while rule-based NLP guards against hallucinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative group hover:border-teal-300 transition-colors">
              <span className="text-[10px] font-bold text-slate-400">STAGE 01</span>
              <h3 className="font-bold text-sm text-slate-800 mt-1 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-teal-600" />
                PDF / TXT Ingest
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Boundary-aware chunking protects dosages (e.g. 0.5 mg) and medical abbreviations from arbitrary string splits.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative group hover:border-teal-300 transition-colors">
              <span className="text-[10px] font-bold text-slate-400">STAGE 02</span>
              <h3 className="font-bold text-sm text-slate-800 mt-1 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-600" />
                Safe Harbor PII Masking
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Scrubs 18 PHI types. Inverted whitelist guarantees condition names (<code className="text-teal-700">Parkinson's</code>) and drugs (<code className="text-teal-700">Sertraline</code>) are never redacted.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative group hover:border-teal-300 transition-colors">
              <span className="text-[10px] font-bold text-slate-400">STAGE 03</span>
              <h3 className="font-bold text-sm text-slate-800 mt-1 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-indigo-600" />
                User-Isolated Vector Store
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                SQLite float32 vector store partitions documents by <code className="text-slate-700">user_id</code> so Patient A's context never leaks into Patient B's queries.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative group hover:border-teal-300 transition-colors">
              <span className="text-[10px] font-bold text-slate-400">STAGE 04</span>
              <h3 className="font-bold text-sm text-slate-800 mt-1 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-amber-600" />
                Assertion Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                NegEx-style assertion rules inspect negation triggers to distinguish between affirmed symptoms and denied complaints.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 relative group hover:border-teal-300 transition-colors">
              <span className="text-[10px] font-bold text-slate-400">STAGE 05</span>
              <h3 className="font-bold text-sm text-slate-800 mt-1 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Grounded SBAR Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Strict threshold gate: if evidence score is below confidence threshold, system abstains honestly rather than hallucinating.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why This Is Not Just a Chatbot ── */}
      <section className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-100/70 px-3 py-1 rounded-full">
                Clinical Safety Standard
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Why Standard AI Chatbots Fail in Clinical Environments
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                General-purpose chatbots will confidently invent diagnoses, confuse negated statements (e.g. treating <em>"patient denies chest pain"</em> as active chest pain), and leak protected patient data into public LLM training logs.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✕
                  </div>
                  <div>
                    <strong className="text-sm text-slate-800">Generic Chatbots:</strong>
                    <p className="text-xs text-slate-500">Hallucinate non-existent studies; blind to medical negation; send raw patient names and medical record numbers to third-party cloud APIs.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <strong className="text-sm text-slate-800">Veritas-Clin Architecture:</strong>
                    <p className="text-xs text-slate-500">Zero data leakage via HIPAA Safe Harbor; automatic assertion badge classification (<span className="text-emerald-700 font-semibold">[AFFIRMED]</span> vs <span className="text-amber-700 font-semibold">[NEGATED]</span>); strict threshold abstention when evidence is absent.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  to={isAuthenticated ? "/workbench" : "/register"}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
                >
                  Explore the Interactive Workbench
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Mock Clinical Card Preview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-800">Patient Case: Maya Patel (P001)</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  AFFIRMED
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-2">
                <div className="font-semibold text-slate-700 uppercase tracking-wide text-[10px]">
                  Clinical SBAR Assessment
                </div>
                <p className="text-slate-800 leading-relaxed">
                  <strong>Situation:</strong> Patient Maya Patel evaluated for persistent sleep maintenance disturbance.<br />
                  <strong>Evidence:</strong> Documented across 4 longitudinal visits. Sleep disruption confirmed with active insomnia <span className="text-teal-700 font-mono font-semibold">[doc1:0]</span>. Chest pain and respiratory distress explicitly negated <span className="text-amber-700 font-mono font-semibold">[doc1:2]</span>.
                </p>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-xs text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span><strong>HIPAA Safe Harbor:</strong> Masked 4 personal identifiers before LLM synthesis.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-teal-600" />
            <span className="font-semibold text-slate-700">Veritas-Clin</span>
            <span>— Academic Clinical NLP & Grounded Intelligence Prototype</span>
          </div>
          <p>
            Educational demonstration. Not for medical diagnosis or clinical decision-making.
          </p>
        </div>
      </footer>
    </div>
  );
}
