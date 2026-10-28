import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext, Link } from 'react-router-dom';
import { api } from '../api';
import { Badge, Spinner, CardSkeleton, Err, fmt } from '../components/ui';
import { useToast } from '../components/toast';
import ClinicalQACard from '../components/ClinicalQACard';
import { getLLMConfig } from '../components/SettingsModal';
import {
  Sparkles, UploadCloud, Search,
  X, User, Check, CheckCircle2, Copy, Download,
  History, Clock, ChevronDown, ChevronUp, Trash2,
  ShieldCheck, ArrowRight, Zap, Filter
} from 'lucide-react';
import clsx from 'clsx';

/* ── LocalStorage helpers ── */
const LS_HISTORY  = 'moodtrace_search_history';
const LS_VERIFIED = 'moodtrace_verified_findings';
const LS_QUERY    = 'moodtrace_last_query';

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ── Clinical Inquiry Presets ── */
const CLINICAL_PRESETS = [
  { id: 'sleep',      label: '🌙 Insomnia & 3 AM Waking',   query: 'How severe has the patient sleep insomnia and 3am waking been?' },
  { id: 'suicide',    label: '🛡️ Suicidal Ideation Check',  query: 'Has the patient reported suicidal thoughts, self-harm, or passive death wishes?' },
  { id: 'anhedonia',  label: '🍂 Anhedonia & Loss of Joy',  query: 'Has the patient reported loss of interest, feeling numb, or crying spells?' },
  { id: 'fatigue',    label: '⚡ Lethargy & Leaden Limbs',   query: 'Does the patient describe profound physical fatigue, exhaustion, or heavy limbs?' },
  { id: 'cognitive',  label: '🧠 Brain Fog & Concentration', query: 'Is the patient experiencing cognitive slowing, memory lapses, or brain fog?' },
  { id: 'somatic',    label: '🍽️ Appetite & GI Distress',  query: 'Are there documented appetite changes, weight loss, or gastrointestinal discomfort?' },
];

/* ── History Dropdown ── */
function SearchHistory({ history, onSelect, onClear, show, onDismiss }) {
  if (!show || history.length === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <History className="h-3.5 w-3.5" />
            Recent Inquiries
          </div>
          <button onClick={onClear} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium">
            <Trash2 className="h-3 w-3" /> Clear History
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onSelect(item.query); onDismiss(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left group"
            >
              <Clock className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
              <span className="text-[13px] text-slate-700 group-hover:text-slate-900 flex-1 truncate font-medium">{item.query}</span>
              <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.time}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function DiscoverPage() {
  const context = useOutletContext() || {};
  const { pendingQuery, clearPendingQuery, openDeid, openSettings } = context;

  const toast = useToast();

  // Load persisted state
  const [query, setQuery] = useState(() => lsGet(LS_QUERY, 'How severe has the patient sleep insomnia and 3am waking been?'));
  const [patientFilter, setPatientFilter] = useState('');
  const [qaResult, setQaResult] = useState(null);

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => lsGet(LS_HISTORY, []));

  // Clinician verification list
  const [verifiedList, setVerifiedList] = useState(() => lsGet(LS_VERIFIED, []));
  const [dismissedSet, setDismissedSet] = useState(new Set());
  const [copiedChart, setCopiedChart] = useState(false);

  const textareaRef = useRef(null);

  // Persist query & verified list
  useEffect(() => { lsSet(LS_QUERY, query); }, [query]);
  useEffect(() => { lsSet(LS_VERIFIED, verifiedList); }, [verifiedList]);

  // Handle command palette query injection
  useEffect(() => {
    if (pendingQuery) {
      setQuery(pendingQuery);
      clearPendingQuery?.();
      setTimeout(() => runRAG(pendingQuery, patientFilter), 50);
    }
  }, [pendingQuery]); // eslint-disable-line

  useEffect(() => {
    api.patients().then(setPatients).catch(() => {});
  }, []);

  /* ── Add to history ── */
  const addToHistory = useCallback((q) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setHistory(prev => {
      const filtered = prev.filter(h => h.query !== q);
      const next = [{ query: q, time: now }, ...filtered].slice(0, 10);
      lsSet(LS_HISTORY, next);
      return next;
    });
  }, []);

  /* ── Main Unified RAG Execution ── */
  const runRAG = useCallback(async (customQuery = null, customPatient = null) => {
    const q = (customQuery ?? query).trim();
    if (!q) return;

    const currentPatient = customPatient !== undefined ? customPatient : patientFilter;
    const llmCfg = getLLMConfig();

    setLoading(true);
    setErr('');
    addToHistory(q);

    try {
      const res = await api.qa(q, currentPatient || null, 6, llmCfg.provider, llmCfg.apiKey);
      setQaResult(res);
      toast.success('Clinical RAG Synthesized', `Grounded in ${res.citations?.length || 0} source note citations`);
    } catch (e) {
      setErr(e.message);
      toast.error('RAG Synthesis failed', e.message, {
        action: { label: 'Retry', fn: () => runRAG(q, currentPatient) }
      });
    } finally {
      setLoading(false);
    }
  }, [query, patientFilter, addToHistory, toast]);

  // Initial execution
  useEffect(() => {
    runRAG();
  }, []); // eslint-disable-line

  const selectPreset = (preset) => {
    setQuery(preset.query);
    runRAG(preset.query);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content === 'string') {
          const cleanText = content.slice(0, 300).replace(/\n+/g, ' ');
          setQuery(cleanText);
          runRAG(cleanText);
          toast.info('File loaded', `Inquiring from "${file.name}"`);
        }
      };
      reader.readAsText(file);
    }
  };

  /* ── Clinician verification ── */
  const confirmFinding = (match, e = null) => {
    if (e) e.stopPropagation();
    const key = `${match.note_id}::${match.sentence}`;
    if (!verifiedList.some(item => `${item.note_id}::${item.sentence}` === key)) {
      setVerifiedList(prev => [...prev, match]);
      toast.success('Finding confirmed', `${match.patient_name || 'Patient'} — added to chart summary`);
    }
  };

  const dismissFinding = (match, e = null) => {
    if (e) e.stopPropagation();
    const key = `${match.note_id}::${match.sentence}`;
    setDismissedSet(prev => new Set(prev).add(key));
    setVerifiedList(prev => prev.filter(item => `${item.note_id}::${item.sentence}` !== key));
    toast.info('Passage dismissed');
  };

  /* ── Chart export ── */
  const copyChartSummary = () => {
    const text = verifiedList.map((item, idx) =>
      `${idx + 1}. [${item.patient_name || 'Patient'} - ${fmt.date(item.date)} - ${item.note_id}] "${item.sentence}" (Assertion: ${item.assertion || 'Affirmed'})`
    ).join('\n');
    const chartNote = `VERIFIED CLINICAL FINDINGS (Veritas-Clin RAG Copilot)\nDate: ${new Date().toLocaleDateString()}\nVerified Items (${verifiedList.length}):\n${text}\n\nReviewer: Signed off by attending clinician.`;
    navigator.clipboard.writeText(chartNote);
    setCopiedChart(true);
    toast.success('Chart note copied', 'Paste into EHR consultation record');
    setTimeout(() => setCopiedChart(false), 2000);
  };

  const downloadChartNote = () => {
    const text = verifiedList.map((item, idx) =>
      `${idx + 1}. [${item.patient_name || 'Patient'} - ${fmt.date(item.date)} - ${item.note_id}] "${item.sentence}" (Assertion: ${item.assertion || 'Affirmed'})`
    ).join('\n');
    const chartNote = `VERIFIED CLINICAL FINDINGS (Veritas-Clin RAG Copilot)\nDate: ${new Date().toLocaleDateString()}\nVerified Items (${verifiedList.length}):\n${text}\n\nReviewer: Signed off by attending clinician.`;
    const blob = new Blob([chartNote], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical_evidence_${Date.now().toString().slice(-6)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded', 'Chart record saved as text file');
  };

  const clearAllVerified = () => {
    setVerifiedList([]);
    toast.info('Verified findings cleared');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" onClick={() => setShowHistory(false)}>

      {/* ── 1. Hero Clinical RAG Command Bar ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'relative rounded-3xl border transition-all p-6 bg-white shadow-sm overflow-hidden',
          isDragging
            ? 'border-blue-500 bg-blue-50/60 border-dashed scale-[1.005]'
            : 'border-slate-200/90 hover:border-slate-300'
        )}
      >
        {isDragging ? (
          <div className="py-12 text-center">
            <UploadCloud className="h-10 w-10 text-blue-600 animate-bounce mx-auto mb-2" />
            <div className="text-[15px] font-bold text-blue-900">Drop Clinical Note File to Analyze</div>
            <p className="text-[12px] text-blue-600 mt-0.5">RAG engine will extract text and match patient records</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top row: Patient selector + Engine badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 font-bold text-[11px]">
                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                  <span>Consensus Dense RAG Engine</span>
                </div>

                {patientFilter && (
                  <Badge tone="blue">
                    Target Patient: {patients.find(p => p.id === patientFilter)?.name || patientFilter}
                  </Badge>
                )}
              </div>

              {/* Patient Dropdown Filter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={patientFilter}
                    onChange={e => {
                      setPatientFilter(e.target.value);
                      runRAG(query, e.target.value);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">All Patients (Whole Corpus)</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id}) · {p.condition || 'General'}</option>
                    ))}
                  </select>
                </div>

                {/* History button */}
                {history.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setShowHistory(s => !s); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs"
                  >
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    History
                    {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>

            {/* Inquiry Textbox */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    runRAG();
                  }
                }}
                onFocus={() => history.length > 0 && setShowHistory(true)}
                rows={2}
                placeholder="Ask a clinical question (e.g. 'How persistent has the sleep insomnia been?' or 'Has the patient reported suicidal thoughts?')..."
                className="w-full bg-slate-50/70 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl p-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all resize-none leading-relaxed font-sans shadow-inner"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); textareaRef.current?.focus(); }}
                  className="absolute right-3.5 top-3.5 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <SearchHistory
                history={history}
                show={showHistory}
                onSelect={q => { setQuery(q); runRAG(q); }}
                onClear={() => { setHistory([]); lsSet(LS_HISTORY, []); }}
                onDismiss={() => setShowHistory(false)}
              />
            </div>

            {/* Presets and Execute button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                {CLINICAL_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full border transition-all whitespace-nowrap font-medium text-[11px]',
                      query === p.query
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => runRAG()}
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-[13px] font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {loading ? <Spinner size="sm" color="white" /> : <Sparkles className="h-4 w-4" />}
                Ask Clinical Copilot
              </button>
            </div>
          </div>
        )}
      </div>

      {err && <Err message={err} onRetry={() => runRAG()} />}

      {/* ── 2. Clinician Verified Findings Strip ── */}
      <AnimatePresence>
        {verifiedList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] shadow-sm"
          >
            <div className="flex items-center gap-2.5 text-emerald-950">
              <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold">{verifiedList.length} Clinical Evidence Finding{verifiedList.length !== 1 ? 's' : ''} Staged</span>
                <span className="text-emerald-700 block text-[11px]">Ready for export into EHR clinical consultation chart</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={clearAllVerified}
                className="px-2.5 py-1.5 bg-white border border-emerald-200 text-slate-600 hover:text-red-600 rounded-lg font-medium transition-colors text-[11px]"
              >
                Clear
              </button>
              <button
                onClick={copyChartSummary}
                className="px-3 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-[11px]"
              >
                {copiedChart ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedChart ? 'Copied to Clipboard' : 'Copy SBAR'}
              </button>
              <button
                onClick={downloadChartNote}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-[11px] shadow-xs"
              >
                <Download className="h-3.5 w-3.5" /> Export Record
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Generative Clinical QA Synthesis ── */}
      {loading && !qaResult && (
        <div className="space-y-4">
          <CardSkeleton />
        </div>
      )}

      {qaResult && (
        <ClinicalQACard
          qaData={qaResult}
          onSelectCitation={() => {}}
        />
      )}

      {/* ── 4. Matched Source Evidence Cards ── */}
      {qaResult?.citations?.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[15px] text-slate-900">Auditable Note Citations</h3>
              <Badge tone="blue">{qaResult.citations.length} Verified Sources</Badge>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Click card to confirm for chart export</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {qaResult.citations
              .filter(c => !dismissedSet.has(`${c.note_id}::${c.sentence}`))
              .map((c, idx) => {
                const isVerified = verifiedList.some(item => `${item.note_id}::${item.sentence}` === `${c.note_id}::${c.sentence}`);
                const isNegated = c.assertion === 'NEGATED';
                const isFamily = c.assertion === 'FAMILY_HISTORY';

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 bg-white',
                      isVerified
                        ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
                        : isNegated
                          ? 'border-purple-200 bg-purple-50/20 hover:border-purple-300'
                          : 'border-slate-200/80 hover:border-blue-400 hover:shadow-md'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            {c.note_id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{fmt.date(c.date)}</span>
                        </div>
                        <Badge tone={isNegated ? 'purple' : isFamily ? 'slate' : 'emerald'}>
                          {isNegated ? 'Negated / Denied' : isFamily ? 'Family History' : '✓ Affirmed'}
                        </Badge>
                      </div>

                      <p className="text-[13px] text-slate-800 italic leading-relaxed font-serif">
                        "{c.sentence}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-700">{c.patient_name}</span>
                      <div className="flex items-center gap-1.5">
                        {isVerified ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Staged
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => confirmFinding(c)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-semibold transition-colors"
                            >
                              ✓ Verify
                            </button>
                            <button
                              onClick={() => dismissFinding(c)}
                              className="px-1.5 py-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
}
