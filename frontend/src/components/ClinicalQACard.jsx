import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle,
  Copy, Check, ChevronDown, ChevronUp, FileText, Calendar,
  Bookmark, Award
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
    const sbarText = sbar?.grounded_narrative || `CLINICAL QA SUMMARY (MoodTrace RAG Engine)
Patient: ${patient_name || 'Patient'}
Inquiry: "${question}"
Clinical Status: ${clinical_status}
Confidence: ${Math.round(confidence * 100)}%

SITUATION & ASSESSMENT:
${answer_summary}

VERIFIED CITATIONS (${citations.length}):
${citations.map((c, i) => `${i + 1}. [${c.note_id} - ${fmt.date(c.date)}] "${c.sentence}" (Assertion: ${c.assertion})`).join('\n')}

Reviewer: Attending Clinician Review. Grounded in patient note history.`;

    navigator.clipboard.writeText(sbarText);
    setCopied(true);
    toast.success('SBAR note copied', 'Ready to paste into clinical chart');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    AFFIRMED: {
      tone: 'emerald',
      label: 'Evidence Affirmed',
      icon: CheckCircle2,
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/70',
      text: 'text-emerald-900',
    },
    PARTIALLY_AFFIRMED: {
      tone: 'blue',
      label: 'Multi-Aspect / Mixed Findings',
      icon: ShieldCheck,
      border: 'border-blue-300',
      bg: 'bg-blue-50/70',
      text: 'text-blue-900',
    },
    NEGATED: {
      tone: 'purple',
      label: 'Evaluated & Negated',
      icon: AlertTriangle,
      border: 'border-purple-300',
      bg: 'bg-purple-50/70',
      text: 'text-purple-900',
    },
    NO_EVIDENCE: {
      tone: 'slate',
      label: 'No Documented Evidence',
      icon: HelpCircle,
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      text: 'text-slate-800',
    },
    ABSTAINED: {
      tone: 'slate',
      label: 'Abstained',
      icon: HelpCircle,
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      text: 'text-slate-800',
    },
  };

  const currentCfg = statusConfig[clinical_status] || statusConfig.AFFIRMED;
  const StatusIcon = currentCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('rounded-2xl border p-5 bg-white shadow-sm space-y-4', currentCfg.border)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className={clsx('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', currentCfg.bg)}>
            <StatusIcon className={clsx('h-4.5 w-4.5', currentCfg.text)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[14px] text-slate-900">Clinical QA Synthesis</span>
              <Badge tone={currentCfg.tone}>{currentCfg.label}</Badge>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Patient: <strong>{patient_name || 'All Patients'}</strong> · Grounded in verified notes
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
            <Award className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Grounding:</span>
            <span className="font-mono font-bold text-slate-800">{Math.round(confidence * 100)}%</span>
          </div>

          <button
            onClick={copySBAR}
            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[12px] font-medium transition-colors shadow-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
            {copied ? 'Copied' : 'Copy SBAR'}
          </button>
        </div>
      </div>

      {/* Synthesis Box */}
      <div className={clsx('p-4 rounded-xl border leading-relaxed text-[13px]', currentCfg.bg, currentCfg.border)}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Diagnostic Assessment Summary
        </div>
        <div className="whitespace-pre-line text-slate-800 font-sans">
          {answer_summary}
        </div>
      </div>

      {/* Evidence-Grounded SBAR Consultation Report */}
      {sbar && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Evidence-Grounded SBAR Consultation Report
            </span>
            <span className="text-[10px] text-slate-400 font-mono">LLM Synthesizer</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[12px]">
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="font-bold text-slate-900 block mb-1">S · Situation</span>
              <p className="text-slate-700 leading-snug">{sbar.situation}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
              <span className="font-bold text-slate-900 block mb-1">B · Background</span>
              <p className="text-slate-700 leading-snug">{sbar.background}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs md:col-span-2">
              <span className="font-bold text-slate-900 block mb-1">A · Assessment</span>
              <p className="text-slate-700 whitespace-pre-line leading-relaxed">{sbar.assessment}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs md:col-span-2">
              <span className="font-bold text-slate-900 block mb-1">R · Recommendation</span>
              <p className="text-slate-700 leading-snug">{sbar.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Findings Breakdown */}
      {findings.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Documented Symptom Themes ({findings.length})
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {findings.map((f, i) => (
              <div
                key={i}
                className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-[12px] text-slate-900 truncate">{f.category}</span>
                    {f.dsm5_persistent && (
                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-semibold shrink-0">
                        ≥14d DSM-5
                      </span>
                    )}
                  </div>
                  <Badge tone={f.status.includes('Negated') ? 'purple' : 'emerald'}>
                    {f.status}
                  </Badge>
                </div>

                <p className="text-[12px] text-slate-700 italic line-clamp-2">
                  "{f.sample_sentence}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmt.date(f.first_date)} {f.count > 1 ? `– ${fmt.date(f.latest_date)}` : ''}
                  </span>
                  <span>{f.count} entry{f.count > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Citations Footer */}
      {citations.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowAllCitations(v => !v)}
            className="flex items-center justify-between w-full text-[12px] font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5 text-blue-500" />
              Verified Evidence Passages ({citations.length} Notes)
            </span>
            {showAllCitations ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <AnimatePresence>
            {showAllCitations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1"
              >
                {citations.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectCitation?.(c)}
                    className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-[12px] space-y-1.5 hover:border-blue-400 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-700">{c.note_id}</span>
                        <span className="text-slate-400">{fmt.date(c.date)}</span>
                        <span className="text-slate-500 font-sans">{c.patient_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ScoreChip score={c.score} />
                        <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">
                          {c.assertion}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-800 italic font-serif leading-relaxed">
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
