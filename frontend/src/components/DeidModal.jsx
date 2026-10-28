import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Check, Copy, ArrowRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Badge, Spinner } from './ui';
import { useToast } from './toast';
import clsx from 'clsx';

export default function DeidModal({ open, onClose, onApplyText, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState('mask'); // 'mask' | 'surrogate'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleDeidentify = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await api.deidentify(text, mode);
      setResult(res);
      if (res.scrubbed_count > 0) {
        toast.success('HIPAA Scrubbed', `${res.scrubbed_count} PHI entities safely redacted`);
      } else {
        toast.info('Clean Text', 'No Protected Health Information (PHI) detected in text');
      }
    } catch (e) {
      toast.error('De-identification failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (!result?.deidentified_text) return;
    navigator.clipboard.writeText(result.deidentified_text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const applyToSearch = () => {
    if (!result?.deidentified_text) return;
    onApplyText?.(result.deidentified_text);
    onClose();
    toast.success('Applied to inquiry', 'Sanitized text loaded into search box');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                HIPAA Safe Harbor PHI De-Identifier
              </h3>
              <p className="text-[11px] text-slate-500">
                Scrubs 18 HIPAA identifiers (Names, Dates, MRNs, Ages, Contacts) while protecting medical terms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Mode switch */}
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-slate-700">Redaction Strategy:</span>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                onClick={() => setMode('mask')}
                className={clsx(
                  'px-3 py-1 rounded-md text-[11px] font-medium transition-all',
                  mode === 'mask' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                )}
              >
                Semantic Tags ([PATIENT_NAME])
              </button>
              <button
                onClick={() => setMode('surrogate')}
                className={clsx(
                  'px-3 py-1 rounded-md text-[11px] font-medium transition-all',
                  mode === 'surrogate' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                )}
              >
                Synthetic Surrogates (Patient_A)
              </button>
            </div>
          </div>

          {/* Raw input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Input Clinical Narrative / Query
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="e.g. Patient Aiden Sharma (MRN-90218), age 34, was evaluated at St. Jude Clinic on 2024-03-15 by Dr. House for severe insomnia and Parkinson's screening..."
              className="w-full border border-slate-200 rounded-xl p-3 text-[13px] text-slate-900 focus:outline-none focus:border-emerald-500 bg-slate-50/50 leading-relaxed font-sans"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleDeidentify}
              disabled={loading || !text.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-medium transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" color="white" /> : <ShieldCheck className="h-4 w-4" />}
              Scrub Protected Health Info
            </button>
          </div>

          {/* Result view */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 pt-3 border-t border-slate-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-slate-900">Sanitized Clinical Text:</span>
                  <Badge tone={result.scrubbed_count > 0 ? 'emerald' : 'slate'}>
                    {result.scrubbed_count} PHI Item{result.scrubbed_count !== 1 ? 's' : ''} Scrubbed
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyResult}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-700 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={applyToSearch}
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Use in Query
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-emerald-200/80 rounded-xl text-[13px] text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                {result.deidentified_text}
              </div>

              {result.entities_found?.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Redacted Identifiers:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.entities_found.map((e, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] bg-white border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-800 font-mono flex items-center gap-1"
                      >
                        <span className="text-slate-400 line-through">{e.original}</span>
                        <span>→</span>
                        <strong className="text-emerald-700">{e.replacement}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Safe Harbor 45 CFR § 164.514(b)(2) compliant filter</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-medium">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
