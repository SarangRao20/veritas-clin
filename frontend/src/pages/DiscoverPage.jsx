import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api';
import { Badge, Spinner, CardSkeleton, Err, fmt } from '../components/ui';
import { useToast } from '../components/toast';
import ClinicalQACard from '../components/ClinicalQACard';
import { getLLMConfig } from '../components/SettingsModal';
import {
  Sparkles, UploadCloud, Search,
  X, User, Check, CheckCircle2, Copy, Download,
  History, Clock, ChevronDown, ChevronUp, Trash2,
  ShieldCheck, Zap, Filter
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
  { id: 'thoughts',   label: '💭 Lost in Thoughts & Rumination', query: 'He looks lost in his own thoughts, ruminating excessively' },
  { id: 'sleep',      label: '🌙 Insomnia & 3 AM Waking',        query: 'How severe has the patient sleep insomnia and 3am waking been?' },
  { id: 'suicide',    label: '🛡️ Suicidal Ideation Check',       query: 'Has the patient reported suicidal thoughts, self-harm, or passive death wishes?' },
  { id: 'anhedonia',  label: '🍂 Anhedonia & Loss of Joy',       query: 'Has the patient reported loss of interest, feeling numb, or crying spells?' },
  { id: 'fatigue',    label: '⚡ Lethargy & Leaden Limbs',        query: 'Does the patient describe profound physical fatigue, exhaustion, or heavy limbs?' },
  { id: 'cognitive',  label: '🧠 Brain Fog & Concentration',      query: 'Is the patient experiencing cognitive slowing, memory lapses, or brain fog?' },
  { id: 'somatic',    label: '🍽️ Appetite & GI Distress',       query: 'Are there documented appetite changes, weight loss, or gastrointestinal discomfort?' },
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
        className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#0c1222]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <History className="h-3.5 w-3.5" />
            Recent Inquiries
          </div>
          <button onClick={onClear} className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-medium cursor-pointer">
            <Trash2 className="h-3 w-3" /> Clear History
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/80">
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onSelect(item.query); onDismiss(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/60 transition-colors text-left group cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400 shrink-0 transition-colors" />
              <span className="text-[13px] text-slate-300 group-hover:text-white flex-1 truncate font-medium">{item.query}</span>
              <span className="text-[10px] text-slate-500 font-mono shrink-0">{item.time}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function DiscoverPage() {
  const context = useOutletContext() || {};
  const { pendingQuery, clearPendingQuery } = context;

  const toast = useToast();

  // Load persisted state
  const [query, setQuery] = useState(() => lsGet(LS_QUERY, 'He looks lost in his own thoughts, ruminating excessively'));
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
          'relative rounded-3xl border transition-all p-6 bg-[#0e1524] shadow-2xl overflow-hidden',
          isDragging
            ? 'border-blue-500 bg-blue-950/30 border-dashed scale-[1.005]'
            : 'border-slate-800 hover:border-slate-700'
        )}
      >
        {isDragging ? (
          <div className="py-12 text-center">
            <UploadCloud className="h-10 w-10 text-blue-400 animate-bounce mx-auto mb-2" />
            <div className="text-[15px] font-bold text-blue-300">Drop Clinical Note File to Analyze</div>
            <p className="text-[12px] text-blue-400/80 mt-0.5">RAG engine will extract text and match patient records</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top row: Patient selector + Engine badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-950/80 text-blue-300 rounded-xl border border-blue-800 font-bold text-[11px]">
                  <Zap className="h-3.5 w-3.5 text-blue-400" />
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
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <select
                    value={patientFilter}
                    onChange={e => {
                      setPatientFilter(e.target.value);
                      runRAG(query, e.target.value);
                    }}
                    className="bg-[#090d18] border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-inner"
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
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 bg-[#090d18] hover:bg-slate-800 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 text-slate-500" />
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
                placeholder="Ask a clinical question (e.g. 'He looks lost in his own thoughts' or 'Has Eleanor reported severe insomnia?')..."
                className="w-full bg-[#080d17] border border-slate-800 focus:border-blue-500 rounded-2xl p-4 text-[14px] text-slate-100 placeholder:text-slate-500 focus:outline-hidden transition-all resize-none leading-relaxed font-sans shadow-inner"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); textareaRef.current?.focus(); }}
                  className="absolute right-3.5 top-3.5 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
                      'px-3 py-1.5 rounded-full border transition-all whitespace-nowrap font-medium text-[11px] cursor-pointer',
                      query === p.query
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md font-semibold'
                        : 'bg-[#090d18] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => runRAG()}
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer"
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
            className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] shadow-lg"
          >
            <div className="flex items-center gap-2.5 text-emerald-300">
              <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-emerald-200">{verifiedList.length} Clinical Evidence Finding{verifiedList.length !== 1 ? 's' : ''} Staged</span>
                <span className="text-emerald-400/80 block text-[11px]">Ready for export into EHR clinical consultation chart</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={clearAllVerified}
                className="px-2.5 py-1.5 bg-slate-900 border border-emerald-900/60 text-slate-400 hover:text-red-400 rounded-lg font-medium transition-colors text-[11px] cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={copyChartSummary}
                className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-[11px] cursor-pointer"
              >
                {copiedChart ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedChart ? 'Copied to Clipboard' : 'Copy SBAR'}
              </button>
              <button
                onClick={downloadChartNote}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-[11px] shadow-sm cursor-pointer"
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
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[15px] text-white">Auditable Note Citations</h3>
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
                      'p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 bg-[#0e1524]',
                      isVerified
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                        : isNegated
                          ? 'border-purple-900/60 bg-purple-950/20 hover:border-purple-600'
                          : 'border-slate-800 hover:border-blue-500 hover:shadow-xl'
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-lg border border-blue-900">
                            {c.note_id}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">{fmt.date(c.date)}</span>
                        </div>
                        <Badge tone={isNegated ? 'purple' : isFamily ? 'slate' : 'emerald'}>
                          {isNegated ? 'Negated / Denied' : isFamily ? 'Family History' : '✓ Affirmed'}
                        </Badge>
                      </div>

                      <p className="text-[13px] text-slate-300 italic leading-relaxed font-serif">
                        "{c.sentence}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px]">
                      <span className="font-semibold text-slate-300">{c.patient_name}</span>
                      <div className="flex items-center gap-2">
                        {isVerified ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Staged
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => confirmFinding(c)}
                              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 font-semibold transition-colors cursor-pointer"
                            >
                              ✓ Verify
                            </button>
                            <button
                              onClick={() => dismissFinding(c)}
                              className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
