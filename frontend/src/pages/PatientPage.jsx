import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { Card, Badge, Btn, Spinner, Err, ScoreChip, fmt } from '../components/ui';
import { useToast } from '../components/toast';
import {
  Search, ChevronDown, ChevronUp, Calendar, Clock,
  Quote, ArrowLeft, Bookmark, BookmarkCheck, Download, ChevronRight, X,
  MessageSquare, ShieldCheck, Sparkles, User
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
    <div className="border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500 transition-colors bg-[#0e1524]">
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-slate-200 leading-relaxed font-sans">
            {parts.map((p, i) => {
              const low = p.toLowerCase();
              const hit = tokens.some(t => low.includes(t));
              return hit
                ? <mark key={i} className="bg-blue-900/80 text-blue-200 rounded-xs px-1 font-semibold">{p}</mark>
                : <span key={i}>{p}</span>;
            })}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] text-slate-400 font-mono">{fmt.date(r.date)}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] font-mono text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/60">{r.note_id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreChip score={r.score} />
          <button
            onClick={() => onBookmark(r)}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark passage'}
            className={clsx('p-1.5 rounded-lg transition-colors cursor-pointer', isBookmarked ? 'text-amber-400 bg-amber-950/60 border border-amber-800' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800')}
          >
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-500 hover:text-slate-200 transition-colors shrink-0 p-1.5 cursor-pointer"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && r.expanded_terms?.length > 0 && (
        <div className="px-5 pb-3.5 pt-0 border-t border-slate-800/80 flex flex-wrap gap-1.5 bg-[#090d18]">
          <span className="text-[11px] text-slate-400 mr-1 py-0.5">Semantic context:</span>
          {r.expanded_terms.map(t => (
            <span key={t} className="text-[11px] font-mono bg-blue-950/80 text-blue-300 border border-blue-900 px-2 py-0.5 rounded-md">{t}</span>
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
    <Card className="bg-[#0e1524] border-slate-800">
      <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-blue-400" />
            <h3 className="text-[14px] font-bold text-white">Symptom Evidence Passage Search</h3>
          </div>
          <p className="text-[12px] text-slate-400">Search patient note passages using natural clinical vocabulary.</p>
        </div>
        <span className="text-[11px] font-bold text-blue-300 bg-blue-950/80 border border-blue-800 px-2.5 py-1 rounded-xl">
          Consensus Dense RAG
        </span>
      </div>

      <div className="p-6 space-y-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOM_PRESETS.map(s => (
            <button key={s} onClick={() => setQuery(s)}
              className={clsx('text-[11px] font-medium rounded-full px-3 py-1 border transition-colors cursor-pointer',
                query === s
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md font-semibold'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 bg-[#090d18]')}>
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2.5">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="e.g. trouble falling asleep, waking at 3am, no joy…"
            className="flex-1 bg-[#080d17] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-hidden transition-all font-sans"
          />
          <Btn onClick={run} loading={loading} disabled={!query.trim()} size="md">Search</Btn>
        </div>

        {err && <Err message={err} onRetry={run} />}
      </div>

      {/* Single Results */}
      {results && (
        <div className="px-6 pb-6 space-y-3">
          <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between border-t border-slate-800 pt-3">
            <span>{results.results.length} passages via <strong className="text-slate-200">Consensus Dense RAG</strong></span>
            {results.expanded_terms?.length > 0 && (
              <span className="hidden sm:inline">Semantic context: {results.expanded_terms.slice(0, 5).join(', ')}</span>
            )}
          </div>
          {results.results.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-8">No matching passages for this query in this patient's record.</p>
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
  const [question, setQuestion] = useState('How severe has the sleep insomnia and 3am waking been?');
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
      toast.success('Clinical RAG Synthesized', `${res.citations?.length ?? 0} citations evaluated`);
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
    'How severe has the sleep insomnia and 3am waking been?',
    'Has the patient reported suicidal thoughts, self-harm, or passive death wishes?',
    'What fatigue, heavy limbs, or loss of energy was noted?',
    'Are there signs of euthymic recovery or restorative sleep?',
    'Has the patient experienced cognitive fog, rumination, or wandering thoughts?',
  ];

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-4 bg-[#0e1524] border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            <h3 className="text-[15px] font-bold text-white">Ask Clinical Copilot About {patientName}</h3>
          </div>
          <Badge tone="blue">Retrieval-Augmented QA</Badge>
        </div>

        <div className="flex gap-2.5">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runQA()}
            placeholder="e.g. Has the patient experienced suicidal ideation or sleep maintenance insomnia?"
            className="flex-1 bg-[#080d17] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-hidden font-sans"
          />
          <button
            onClick={() => runQA()}
            disabled={loading || !question.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[12px] font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {loading ? <Spinner size="sm" color="white" /> : <Sparkles className="h-3.5 w-3.5" />}
            Ask Assistant
          </button>
        </div>

        {/* Suggested Prompts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          <span className="text-slate-400 shrink-0 mr-1">Suggestions:</span>
          {PATIENT_QA_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setQuestion(p); runQA(p); }}
              className="px-3 py-1 rounded-full border border-slate-800 bg-[#080d18] hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors whitespace-nowrap text-[11px] cursor-pointer"
            >
              {p.split('?')[0]}?
            </button>
          ))}
        </div>
      </Card>

      {err && <Err message={err} />}
      {loading && !qaData && (
        <Card className="p-10 text-center text-slate-400 text-[13px] flex items-center justify-center gap-2.5 bg-[#0e1524] border-slate-800">
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
    <Card className="p-10 flex items-center justify-center gap-2.5 text-[13px] text-slate-400 bg-[#0e1524] border-slate-800">
      <Spinner /> Loading longitudinal symptom trajectory…
    </Card>
  );
  if (err) return <Err message={err} />;
  if (!data?.timeline?.length) return null;

  const activeSymptoms = data.symptoms.filter(sym => data.timeline.some(e => e.symptoms[sym]));

  return (
    <Card className="overflow-hidden bg-[#0e1524] border-slate-800">
      <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h3 className="text-[14px] font-bold text-white">Longitudinal Symptom Trajectory</h3>
          </div>
          <p className="text-[12px] text-slate-400">
            Symptom patterns detected across encounters. Click any node to inspect the source passage.
          </p>
        </div>
        <Badge tone="blue">{activeSymptoms.length} active dimensions</Badge>
      </div>

      <div className="p-6 space-y-4">
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2.5 pr-4 text-[10px] uppercase font-bold text-slate-400 w-40">Symptom Theme</th>
                {data.timeline.map((entry, idx) => (
                  <th key={idx} className="px-2 py-2.5 text-center font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {activeSymptoms.map(sym => (
                <tr key={sym} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 pr-4 font-semibold text-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{sym}</span>
                      {data.persistence?.[sym]?.dsm5_persistent && (
                        <span title="Meets DSM-5 continuous duration criterion" className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">≥14d DSM-5</span>
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
                                ? 'ring-2 ring-blue-500 bg-blue-500 text-white font-bold scale-110 shadow-md'
                                : hit.score >= 0.25 ? 'bg-blue-600 text-white hover:bg-blue-500'
                                : hit.score >= 0.12 ? 'bg-blue-900/80 text-blue-200 border border-blue-800 hover:bg-blue-800'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            )}
                          >
                            {(hit.score * 100).toFixed(0)}
                          </button>
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-800 mx-auto" />
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
              className="bg-[#121929] border border-blue-900/80 rounded-2xl p-4 flex items-start gap-3 shadow-md"
            >
              <Quote className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[12px] font-bold text-blue-300">{selectedCell.symptom}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-[11px] text-slate-400 font-mono">{fmt.date(selectedCell.date)}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-[11px] font-mono text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-900">{selectedCell.note_id}</span>
                  <ScoreChip score={selectedCell.score} />
                </div>
                <p className="text-[13px] text-slate-200 italic leading-relaxed font-serif">"{selectedCell.sentence}"</p>
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
    <Card className="bg-[#0e1524] border-slate-800">
      <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-white">Complete Note Log</h3>
          <span className="text-[11px] text-slate-400">{notes.length} longitudinal clinical entries</span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Reverse Chronological</span>
      </div>
      <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
        {sorted.map(n => (
          <div key={n.note_id}>
            <button
              onClick={() => setExpanded(expanded === n.note_id ? null : n.note_id)}
              className="w-full flex items-center gap-3.5 px-6 py-3.5 hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
            >
              <span className="text-[11px] text-slate-400 w-24 shrink-0 font-mono">{fmt.date(n.date)}</span>
              <span className="text-[12px] text-slate-200 flex-1 truncate font-medium">{n.sentences?.[0]}</span>
              <span className="text-[11px] font-mono text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-900 shrink-0">{n.note_id}</span>
              {expanded === n.note_id ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
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
                  <div className="px-6 pb-5 pt-2 text-[12px] text-slate-300 leading-relaxed bg-[#080d17] border-t border-slate-800">
                    <p className="font-sans mb-3 text-slate-200">{n.text}</p>
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-500 mr-1 uppercase font-bold">Sentences:</span>
                      {n.sentences?.map((s, idx) => (
                        <span key={idx} className="text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">{s}</span>
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
    <Card className="p-10 bg-[#0e1524] border-slate-800">
      <div className="text-center space-y-2">
        <Bookmark className="h-9 w-9 text-slate-600 mx-auto" />
        <div className="text-[15px] font-bold text-slate-200">No staged passages yet</div>
        <p className="text-[12px] text-slate-400 max-w-sm mx-auto">Bookmark passages in Symptom Evidence Search to stage them for EHR consultation export.</p>
      </div>
    </Card>
  );

  return (
    <Card className="bg-[#0e1524] border-slate-800">
      <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-amber-400" />
          <h3 className="text-[14px] font-bold text-white">Staged Clinical Passages</h3>
          <span className="text-[11px] text-amber-300 bg-amber-950/80 border border-amber-800 px-2.5 py-0.5 rounded-full font-semibold">{bookmarks.length} staged</span>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 text-[12px] text-blue-300 hover:text-white font-bold border border-blue-800 bg-blue-950/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export Record
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-800/80">
        {bookmarks.map((b, i) => (
          <div key={i} className="flex items-start gap-3.5 px-6 py-4">
            <Quote className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-slate-200 italic leading-relaxed font-serif">"{b.sentence}"</p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400 font-mono">
                <span>{fmt.date(b.date)}</span>
                <span className="text-slate-600">·</span>
                <span className="text-blue-300">{b.note_id}</span>
                <ScoreChip score={b.score} />
              </div>
            </div>
            <button onClick={() => onRemove(b)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0 p-1 cursor-pointer">
              <X className="h-4 w-4" />
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
        toast.success('Passage bookmarked', 'Find it in Staged Findings');
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
      <div className="flex items-center gap-2.5 text-[13px] text-slate-400"><Spinner /> Loading patient history…</div>
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-slate-400">
        <button onClick={() => navigate('/patients')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" />
          Patient Directory
        </button>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <span className="text-white font-bold">{displayName}</span>
      </div>

      {/* Patient header card */}
      <div className="bg-[#0e1524] rounded-3xl border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
              <span className="text-[20px] font-black text-white">
                {deidMode ? 'PT' : patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-black text-white">{displayName}</h1>
                <button
                  onClick={() => setDeidMode(m => !m)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer shadow-xs',
                    deidMode ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {deidMode ? 'HIPAA Redacted' : 'Scrub PHI View'}
                </button>
              </div>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="text-[12px] text-slate-300 font-medium">{patient.condition}</span>
                <span className="text-slate-600">·</span>
                <span className="text-[12px] text-slate-400">{deidMode ? 'Age [REDACTED]' : `Age ${patient.age}`}</span>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-mono text-blue-300 bg-blue-950/80 border border-blue-900 px-2 py-0.5 rounded-md">{patient.id}</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex gap-6">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Entries</div>
              <div className="text-[24px] font-black font-mono text-white mt-0.5">{total}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Latest Note</div>
              <div className="text-[13px] font-bold text-slate-200 mt-1 font-mono">
                {patient.notes?.length ? fmt.date(patient.notes.slice(-1)[0]?.date) : '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Staged</div>
              <div className="text-[24px] font-black font-mono text-amber-400 mt-0.5">{bookmarks.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0 -mb-1 overflow-x-auto no-scrollbar">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold transition-all rounded-t-xl border-b-2 -mb-px cursor-pointer whitespace-nowrap',
                isActive
                  ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60'
              )}
            >
              <Icon className="h-4 w-4" />
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
          {activeTab === 'qa' && (
            <PatientQAPanel patientId={id} patientName={displayName} />
          )}
          {activeTab === 'timeline' && <LongitudinalTimeline patientId={id} />}
          {activeTab === 'search' && (
            <SearchPanel patientId={id} bookmarks={bookmarks} onBookmark={handleBookmark} />
          )}
          {activeTab === 'history' && patient.notes && <NoteHistory notes={patient.notes} />}
          {activeTab === 'bookmarks' && (
            <BookmarksPanel bookmarks={bookmarks} onRemove={handleBookmark} onExport={exportBookmarks} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
