import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle,
  Copy, Check, ChevronDown, ChevronUp, FileText, Calendar,
  Bookmark, Award, Sparkles, Stethoscope
} from 'lucide-react';
import { Badge, ScoreChip, fmt } from './ui';
import { useToast } from './toast';
import clsx from 'clsx';

export default function ClinicalQACard({ qaData, onSelectCitation }) {
  const [copied, setCopied] = useState(false);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const toast = useToast();

  if (!qaData) return null;

  const {
    question,
    patient_name,
    answer_summary,
    clinical_status,
    confidence,
    sbar,
    findings = [],
    citations = [],
  } = qaData;

  const copySBAR = () => {
    const sbarText = sbar?.grounded_narrative || answer_summary || `CLINICAL QA SUMMARY (Veritas-Clin RAG Engine)
Patient: ${patient_name || 'Patient'}
Inquiry: "${question}"
Clinical Status: ${clinical_status}
Confidence: ${Math.round(confidence * 100)}%

${answer_summary}

VERIFIED CITATIONS (${citations.length}):
${citations.map((c, i) => `${i + 1}. [${c.note_id} - ${fmt.date(c.date)}] "${c.sentence}" (Assertion: ${c.assertion})`).join('\n')}

Reviewer: Attending Clinician Review. Grounded in longitudinal patient records.`;

    navigator.clipboard.writeText(sbarText);
    setCopied(true);
    toast.success('SBAR consultation note copied', 'Ready to paste into clinical EHR');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    AFFIRMED: {
      tone: 'emerald',
      label: 'Evidence Affirmed',
      icon: CheckCircle2,
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20',
      boxBg: 'bg-emerald-950/20 border-emerald-900/50',
    },
    PARTIALLY_AFFIRMED: {
      tone: 'blue',
      label: 'Mixed / Multi-Aspect Findings',
      icon: ShieldCheck,
      border: 'border-blue-500/30',
      bg: 'bg-blue-950/40 text-blue-400 border border-blue-500/20',
      boxBg: 'bg-blue-950/20 border-blue-900/50',
    },
    NEGATED: {
      tone: 'purple',
      label: 'Evaluated & Explicitly Denied',
      icon: AlertTriangle,
      border: 'border-purple-500/30',
      bg: 'bg-purple-950/40 text-purple-400 border border-purple-500/20',
      boxBg: 'bg-purple-950/20 border-purple-900/50',
    },
    NO_EVIDENCE: {
      tone: 'slate',
      label: 'No Documented Evidence',
      icon: HelpCircle,
      border: 'border-slate-800',
      bg: 'bg-slate-900 text-slate-400 border border-slate-800',
      boxBg: 'bg-slate-900/60 border-slate-800',
    },
    ABSTAINED: {
      tone: 'slate',
      label: 'Abstained',
      icon: HelpCircle,
      border: 'border-slate-800',
      bg: 'bg-slate-900 text-slate-400 border border-slate-800',
      boxBg: 'bg-slate-900/60 border-slate-800',
    },
  };

  const currentCfg = statusConfig[clinical_status] || statusConfig.AFFIRMED;
  const StatusIcon = currentCfg.icon;

  // Format citations inside text into interactive pill badges
  const renderFormattedNarrative = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');
    return (
      <div className="space-y-3 font-sans leading-relaxed text-[13px] text-slate-200">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lIdx} className="h-1.5" />;

          // Check if markdown bold header (e.g. **Situation:** or **SBAR Consultation Note**)
          if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
            return (
              <h4 key={lIdx} className="text-[14px] font-bold text-white tracking-wide pt-1">
                {trimmed.replace(/\*\*/g, '')}
              </h4>
            );
          }

          // Format inline bold headers
          let formattedLine = trimmed;
          const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ');
          const lineContent = isBullet ? trimmed.slice(2) : trimmed;

          // Highlight [Note ID] citations
          const parts = lineContent.split(/(\[[A-Z0-9_]+(?:\s*-\s*[^\]]+)?\])/g);

          return (
            <div key={lIdx} className={clsx(isBullet && 'flex items-start gap-2 pl-2')}>
              {isBullet && <span className="text-blue-400 shrink-0 font-bold">•</span>}
              <p className="flex-1">
                {parts.map((p, pIdx) => {
                  if (p.startsWith('[') && p.endsWith(']')) {
                    return (
                      <span
                        key={pIdx}
                        className="inline-block px-1.5 py-0.5 mx-1 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 font-mono text-[11px] font-semibold"
                      >
                        {p}
                      </span>
                    );
                  }
                  // Render bold segments
                  const boldParts = p.split(/(\*\*[^*]+\*\*)/g);
                  return boldParts.map((bp, bpIdx) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                      return <strong key={bpIdx} className="font-bold text-white">{bp.slice(2, -2)}</strong>;
                    }
                    return <span key={bpIdx}>{bp}</span>;
                  });
                })}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('rounded-3xl border p-6 bg-[#0E1524] shadow-2xl space-y-5', currentCfg.border)}
    >
      {/* ── 1. Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={clsx('h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md', currentCfg.bg)}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[15px] text-white">Clinical RAG Synthesis</span>
              <span className={clsx('text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider', currentCfg.bg)}>
                {currentCfg.label}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Patient: <strong className="text-slate-200">{patient_name || 'All Patients'}</strong> · Grounded in longitudinal EHR record
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
            <Award className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-slate-400 font-medium">Grounding Confidence:</span>
            <span className="font-mono font-bold text-blue-300">{Math.round(confidence * 100)}%</span>
          </div>

          <button
            onClick={copySBAR}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[12px] font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy SBAR'}
          </button>
        </div>
      </div>

      {/* ── 2. Primary Generative Answer (Doctor-grade consultation report) ── */}
      <div className={clsx('p-5 rounded-2xl border leading-relaxed', currentCfg.boxBg, currentCfg.border)}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Consultation Diagnostic Narrative
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Cloud LLM · Grounded Provenance</span>
        </div>

        {renderFormattedNarrative(answer_summary)}
      </div>

      {/* ── 3. Structured SBAR Grid ── */}
      {sbar && sbar.situation && (
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 space-y-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              SBAR Clinical Breakdown
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Attending Review Contract</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <div className="bg-[#121929] p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-blue-400 block mb-1">S · Situation</span>
              <p className="text-slate-300 leading-snug">{sbar.situation}</p>
            </div>

            <div className="bg-[#121929] p-3.5 rounded-xl border border-slate-800">
              <span className="font-bold text-indigo-400 block mb-1">B · Background</span>
              <p className="text-slate-300 leading-snug">{sbar.background}</p>
            </div>

            <div className="bg-[#121929] p-3.5 rounded-xl border border-slate-800 md:col-span-2">
              <span className="font-bold text-emerald-400 block mb-1">A · Assessment</span>
              <div className="text-slate-300 whitespace-pre-line leading-relaxed">
                {sbar.assessment}
              </div>
            </div>

            <div className="bg-[#121929] p-3.5 rounded-xl border border-slate-800 md:col-span-2">
              <span className="font-bold text-amber-400 block mb-1">R · Recommendation</span>
              <p className="text-slate-300 leading-snug">{sbar.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Verified Citations Collapsible ── */}
      {citations.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setShowAllCitations(v => !v)}
            className="flex items-center justify-between w-full text-[12px] font-semibold text-slate-400 hover:text-blue-400 transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-blue-400" />
              Auditable Note Citations ({citations.length} Verified Sources)
            </span>
            {showAllCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence>
            {showAllCitations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1"
              >
                {citations.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectCitation?.(c)}
                    className="p-3.5 bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl text-[12px] space-y-1.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-900">
                          {c.note_id}
                        </span>
                        <span className="text-slate-400">{fmt.date(c.date)}</span>
                        <span className="text-slate-300 font-sans font-medium">{c.patient_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ScoreChip score={c.score} />
                        <span className={clsx(
                          'text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase',
                          c.assertion === 'NEGATED'
                            ? 'bg-purple-950/80 text-purple-400 border border-purple-900'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900'
                        )}>
                          {c.assertion}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-300 italic font-serif leading-relaxed">
                      "{c.sentence}"
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
