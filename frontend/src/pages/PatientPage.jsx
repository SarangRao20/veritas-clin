import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { Card, Badge, Btn, Spinner, Err, ScoreChip, fmt } from '../components/ui';
import { useToast } from '../components/toast';
import {
  Search, ChevronDown, ChevronUp, Layers, Calendar, Clock,
  Quote, ArrowLeft, Bookmark, BookmarkCheck, Download, ChevronRight, X,
  MessageSquare, ShieldCheck, Sparkles
} from 'lucide-react';
import { getLLMConfig } from '../components/SettingsModal';
import ClinicalQACard from '../components/ClinicalQACard';
import clsx from 'clsx';

const SYMPTOM_PRESETS = [
  'trouble sleeping and 3am waking',
  'loss of interest and feeling numb',
  'feeling worthless or guilty',
  'profound physical fatigue and heavy limbs',
  'difficulty concentrating and brain fog',
  'appetite loss and weight drop',
  'thoughts of death or self-harm',
];

const LS_BOOKMARKS = 'moodtrace_bookmarks';

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function ResultCard({ r, query, onBookmark, isBookmarked }) {
  const [open, setOpen] = useState(false);
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const parts = r.sentence.split(/(\s+)/);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors bg-white">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-800 leading-relaxed">
            {parts.map((p, i) => {
              const low = p.toLowerCase();
              const hit = tokens.some(t => low.includes(t));
              return hit
                ? <mark key={i} className="bg-amber-100 text-slate-900 rounded-xs px-0.5">{p}</mark>
                : <span key={i}>{p}</span>;
            })}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-slate-400 font-mono">{fmt.date(r.date)}</span>
            <span className="text-slate-200">·</span>
            <span className="text-[11px] font-mono text-slate-400">{r.note_id}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreChip score={r.score} />
          <button
            onClick={() => onBookmark(r)}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark passage'}
            className={clsx('p-1 rounded-md transition-colors', isBookmarked ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50')}
          >
            {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-300 hover:text-slate-600 transition-colors shrink-0 p-1"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {open && r.expanded_terms?.length > 0 && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100 flex flex-wrap gap-1 bg-slate-50/60">
          <span className="text-[11px] text-slate-400 mr-1">Expanded terms:</span>
          {r.expanded_terms.map(t => (
            <span key={t} className="text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPanel({ patientId, bookmarks, onBookmark }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const toast = useToast();

  const run = useCallback(() => {
    if (!query.trim()) return;
    setLoading(true); setResults(null); setErr('');
    api.search(query, patientId, 'hybrid', 8)
      .then(d => {
        setResults(d);
        const n = d.results?.length ?? 0;
        if (n > 0) toast.success('Evidence retrieved', `${n} passages via Consensus RAG`);
        else toast.info('No matches', 'Try different symptom keywords');
      })
      .catch(e => { setErr(e.message); toast.error('Search failed', e.message); })
      .finally(() => setLoading(false));
  }, [query, patientId, toast]);

  return (
    <Card>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-blue-500" />
            <span className="text-[13px] font-semibold text-slate-900">Symptom Evidence Passage Search</span>
          </div>
          <p className="text-[12px] text-slate-500">Search patient note passages using natural clinical vocabulary.</p>
        </div>
        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
          Consensus Dense RAG
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOM_PRESETS.map(s => (
            <button key={s} onClick={() => setQuery(s)}
              className={clsx('text-[11px] rounded-full px-2.5 py-1 border transition-colors',
                query === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 bg-white')}>
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="e.g. trouble falling asleep, waking at 3am, no joy…"
            className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] placeholder:text-slate-400 focus:outline-hidden focus:border-blue-400 bg-slate-50/40 focus:bg-white transition-all font-sans"
          />
          <Btn onClick={run} loading={loading} disabled={!query.trim()} size="md">Search</Btn>
        </div>

        {err && <Err message={err} onRetry={run} />}
      </div>

      {/* Single Results */}
      {results && (
        <div className="px-5 pb-5 space-y-2">
          <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
            <span>{results.results.length} passages via <strong className="text-slate-700">Consensus Dense RAG</strong></span>
            {results.expanded_terms?.length > 0 && (
              <span className="hidden sm:inline">Semantic context: {results.expanded_terms.slice(0, 5).join(', ')}</span>
            )}
          </div>
          {results.results.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">No matching passages for this query in this patient's record.</p>
          ) : (
            results.results.map((r, i) => (
              <ResultCard
                key={i} r={r} query={query}
                isBookmarked={bookmarks.some(b => b.note_id === r.note_id && b.sentence === r.sentence)}
                onBookmark={onBookmark}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}

function PatientQAPanel({ patientId, patientName }) {
  const [question, setQuestion] = useState('Has the patient reported suicidal thoughts or self-harm?');
  const [loading, setLoading] = useState(false);
  const [qaData, setQaData] = useState(null);
  const [err, setErr] = useState('');
  const toast = useToast();

  const runQA = async (q = question) => {
    if (!q.trim()) return;
    setLoading(true);
    setErr('');
    try {
      const llmCfg = getLLMConfig();
      const res = await api.qa(q, patientId, 6, llmCfg.provider, llmCfg.apiKey);
      setQaData(res);
      toast.success('Clinical RAG Synthesized', `${res.findings?.length ?? 0} findings evaluated`);
    } catch (e) {
      setErr(e.message);
      toast.error('QA Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runQA();
  }, [patientId]);

  const PATIENT_QA_PROMPTS = [
    'Has the patient reported suicidal thoughts or self-harm?',
    'How severe has the sleep insomnia and 3am waking been?',
    'What fatigue, heavy limbs, or loss of energy was noted?',
    'Are there signs of euthymic recovery or restorative sleep?',
    'Has the patient experienced cognitive fog or wandering thoughts?',
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] font-bold text-slate-800">Ask Clinical Question about {patientName}</span>
          </div>
          <Badge tone="blue">Retrieval-Augmented QA</Badge>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runQA()}
            placeholder="e.g. Has the patient experienced suicidal ideation or sleep maintenance insomnia?"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-blue-500 font-sans"
          />
          <button
            onClick={() => runQA()}
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[12px] font-medium transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {loading ? <Spinner size="sm" color="white" /> : <Sparkles className="h-3.5 w-3.5" />}
            Ask Assistant
          </button>
        </div>

        {/* Suggested Prompts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <span className="text-slate-400 shrink-0 mr-1">Suggestions:</span>
          {PATIENT_QA_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setQuestion(p); runQA(p); }}
              className="px-2.5 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-blue-700 transition-colors whitespace-nowrap text-[11px]"
            >
              {p.split('?')[0]}?
            </button>
          ))}
        </div>
      </Card>

      {err && <Err message={err} />}
      {loading && !qaData && (
        <Card className="p-8 text-center text-slate-400 text-[12px] flex items-center justify-center gap-2">
          <Spinner /> Grounding clinical question against patient notes…
        </Card>
      )}
      {qaData && <ClinicalQACard qaData={qaData} />}
    </div>
  );
}

function LongitudinalTimeline({ patientId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.timeline(patientId)
      .then(d => {
        setData(d);
        const firstEntry = d.timeline?.find(e => Object.keys(e.symptoms).length > 0);
        if (firstEntry) {
          const firstSym = Object.keys(firstEntry.symptoms)[0];
          setSelectedCell({ date: firstEntry.date, note_id: firstEntry.note_id, symptom: firstSym, ...firstEntry.symptoms[firstSym] });
        }
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return (
    <Card className="p-8 flex items-center justify-center gap-2 text-[12px] text-slate-400">
      <Spinner /> Loading longitudinal symptom tracker…
    </Card>
  );
  if (err) return <Err message={err} />;
  if (!data?.timeline?.length) return null;

  const activeSymptoms = data.symptoms.filter(sym => data.timeline.some(e => e.symptoms[sym]));

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <h3 className="text-[13px] font-semibold text-slate-900">Longitudinal BDI-II Symptom Trajectory</h3>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Symptom themes detected across check-in entries. Click any active node to inspect the source passage.
          </p>
        </div>
        <Badge tone="blue">{activeSymptoms.length} symptom dimensions</Badge>
      </div>

      <div className="p-5 space-y-4">
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-4 text-[10px] uppercase font-semibold text-slate-400 w-36">Symptom Theme</th>
                {data.timeline.map((entry, idx) => (
                  <th key={idx} className="px-2 py-2 text-center font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeSymptoms.map(sym => (
                <tr key={sym} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 pr-4 font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{sym}</span>
                      {data.persistence?.[sym]?.dsm5_persistent && (
                        <span title="Meets DSM-5 continuous duration criterion" className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.5 rounded font-mono font-semibold">≥2 wks</span>
                      )}
                    </div>
                  </td>
                  {data.timeline.map((entry, idx) => {
                    const hit = entry.symptoms[sym];
                    const isSelected = selectedCell?.note_id === entry.note_id && selectedCell?.symptom === sym;
                    return (
                      <td key={idx} className="p-1 text-center">
                        {hit ? (
                          <button
                            onClick={() => setSelectedCell({ date: entry.date, note_id: entry.note_id, symptom: sym, ...hit })}
                            title={`${sym} (${fmt.date(entry.date)}): score ${(hit.score * 100).toFixed(0)}%`}
                            className={clsx(
                              'h-6 w-6 rounded-md flex items-center justify-center font-mono text-[10px] transition-all cursor-pointer mx-auto',
                              isSelected
                                ? 'ring-2 ring-blue-600 bg-blue-600 text-white font-bold scale-110'
                                : hit.score >= 0.25 ? 'bg-blue-600 text-white hover:opacity-90'
                                : hit.score >= 0.12 ? 'bg-blue-200 text-blue-900 hover:bg-blue-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            )}
                          >
                            {(hit.score * 100).toFixed(0)}
                          </button>
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200/60 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {selectedCell && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex items-start gap-3"
            >
              <Quote className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-blue-900">{selectedCell.symptom}</span>
                  <span className="text-blue-300">·</span>
                  <span className="text-[11px] text-blue-700 font-mono">{fmt.date(selectedCell.date)}</span>
                  <span className="text-blue-300">·</span>
                  <span className="text-[11px] font-mono text-blue-700">{selectedCell.note_id}</span>
                  <ScoreChip score={selectedCell.score} />
                </div>
                <p className="text-[13px] text-slate-800 italic leading-relaxed">"{selectedCell.sentence}"</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function NoteHistory({ notes }) {
  const [expanded, setExpanded] = useState(null);
  const sorted = [...notes].reverse();

  return (
    <Card>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[13px] font-semibold text-slate-900">Complete Note Log</span>
          <span className="ml-2 text-[11px] text-slate-400">{notes.length} entries</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Reverse Chronological</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {sorted.map(n => (
          <div key={n.note_id}>
            <button
              onClick={() => setExpanded(expanded === n.note_id ? null : n.note_id)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-[11px] text-slate-400 w-24 shrink-0 font-mono">{fmt.date(n.date)}</span>
              <span className="text-[12px] text-slate-700 flex-1 truncate">{n.sentences?.[0]}</span>
              <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 bg-slate-100 rounded shrink-0">{n.note_id}</span>
              {expanded === n.note_id ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
            </button>
            <AnimatePresence>
              {expanded === n.note_id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-1 text-[12px] text-slate-600 leading-relaxed bg-slate-50/70 border-t border-slate-100/60">
                    <p className="font-sans mb-2">{n.text}</p>
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/50">
                      <span className="text-[10px] text-slate-400 mr-1 uppercase font-semibold">Sentences:</span>
                      {n.sentences?.map((s, idx) => (
                        <span key={idx} className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">{s}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BookmarksPanel({ bookmarks, onRemove, onExport }) {
  if (bookmarks.length === 0) return (
    <Card className="p-8">
      <div className="text-center space-y-2">
        <Bookmark className="h-8 w-8 text-slate-300 mx-auto" />
        <div className="text-[14px] font-semibold text-slate-600">No bookmarks yet</div>
        <p className="text-[12px] text-slate-400">Bookmark passages in Symptom Evidence Search to save them here.</p>
      </div>
    </Card>
  );

  return (
    <Card>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-amber-500" />
          <span className="text-[13px] font-semibold text-slate-900">Saved Passages</span>
          <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{bookmarks.length} bookmarked</span>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:text-blue-800 font-medium border border-blue-200 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {bookmarks.map((b, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3.5">
            <Quote className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-slate-800 italic leading-relaxed">"{b.sentence}"</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                <span>{fmt.date(b.date)}</span>
                <span>·</span>
                <span>{b.note_id}</span>
                <ScoreChip score={b.score} />
              </div>
            </div>
            <button onClick={() => onRemove(b)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PatientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient]     = useState(null);
  const [err, setErr]             = useState(null);
  const [activeTab, setActiveTab] = useState('qa');
  const [deidMode, setDeidMode]   = useState(false);
  const toast = useToast();

  // Bookmarks stored per-patient
  const bKey = `${LS_BOOKMARKS}_${id}`;
  const [bookmarks, setBookmarks] = useState(() => lsGet(bKey, []));

  useEffect(() => { lsSet(bKey, bookmarks); }, [bookmarks, bKey]);

  useEffect(() => {
    api.patient(id)
      .then(setPatient)
      .catch(e => { setErr(e.message); toast.error('Failed to load patient', e.message); });
  }, [id]);

  const handleBookmark = useCallback((r) => {
    setBookmarks(prev => {
      const key = `${r.note_id}::${r.sentence}`;
      const exists = prev.some(b => `${b.note_id}::${b.sentence}` === key);
      if (exists) {
        toast.info('Bookmark removed');
        return prev.filter(b => `${b.note_id}::${b.sentence}` !== key);
      } else {
        toast.success('Passage bookmarked', 'Find it in the Bookmarks tab');
        return [...prev, r];
      }
    });
  }, [toast]);

  const exportBookmarks = useCallback(() => {
    const text = bookmarks.map((b, i) =>
      `${i + 1}. [${fmt.date(b.date)} - ${b.note_id}] "${b.sentence}" (Score: ${Math.round(b.score * 100)}%)`
    ).join('\n');
    const out = `BOOKMARKED PASSAGES — ${patient?.name ?? id}\nExported: ${new Date().toLocaleDateString()}\n\n${text}`;
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `bookmarks_${id}_${Date.now().toString().slice(-6)}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Bookmarks exported', `${bookmarks.length} passages saved`);
  }, [bookmarks, patient, id, toast]);

  if (err) return <Err message={err} />;
  if (!patient) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-2 text-[13px] text-slate-400"><Spinner /> Loading patient history…</div>
    </div>
  );

  const total = patient.notes?.length ?? 0;
  const displayName = deidMode ? `[PATIENT_${patient.id}]` : patient.name;
  const TABS = [
    { id: 'qa',        label: 'Clinical RAG Copilot',     icon: MessageSquare },
    { id: 'timeline',  label: 'Longitudinal Trajectory',  icon: Calendar },
    { id: 'search',    label: 'Evidence Passage Search',  icon: Search },
    { id: 'history',   label: 'Complete Note Log',        icon: Clock },
    { id: 'bookmarks', label: `Staged Findings${bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}`, icon: Bookmark },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <button onClick={() => navigate('/patients')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Patients
        </button>
        <ChevronRight className="h-3 w-3 text-slate-300" />
        <span className="text-slate-800 font-medium">{displayName}</span>
      </div>

      {/* Patient header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-[18px] font-bold text-white">
                {deidMode ? 'PT' : patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-bold text-slate-900">{displayName}</h1>
                <button
                  onClick={() => setDeidMode(m => !m)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shadow-2xs',
                    deidMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {deidMode ? 'HIPAA Redacted' : 'Scrub PHI View'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-slate-500">{patient.condition}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] text-slate-500">{deidMode ? 'Age [REDACTED]' : `Age ${patient.age}`}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{patient.id}</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex gap-5">
            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Entries</div>
              <div className="text-[22px] font-bold font-mono text-slate-900">{total}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Latest</div>
              <div className="text-[14px] font-semibold text-slate-900">
                {patient.notes?.length ? fmt.date(patient.notes.slice(-1)[0]?.date) : '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Bookmarks</div>
              <div className="text-[22px] font-bold font-mono text-amber-500">{bookmarks.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800 flex items-center justify-between">
        <span>Synthetic research demo — not a real patient history. Results not clinically validated.</span>
        <Badge tone="amber">Synthetic</Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-slate-200 pb-0 -mb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium transition-all rounded-t-lg border-b-2 -mb-px',
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'search' && (
            <SearchPanel patientId={id} bookmarks={bookmarks} onBookmark={handleBookmark} />
          )}
          {activeTab === 'qa' && (
            <PatientQAPanel patientId={id} patientName={displayName} />
          )}
          {activeTab === 'timeline' && <LongitudinalTimeline patientId={id} />}
          {activeTab === 'history' && patient.notes && <NoteHistory notes={patient.notes} />}
          {activeTab === 'bookmarks' && (
            <BookmarksPanel bookmarks={bookmarks} onRemove={handleBookmark} onExport={exportBookmarks} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


