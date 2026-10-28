import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { SectionHeader, Card, Btn, Err, Badge, ScoreChip } from '../components/ui';
import { Sparkles, Layers, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const CLINICAL_PRESETS = [
  {
    title: 'Severe Depression (Intake)',
    tag: 'Severe presentation',
    tone: 'red',
    text: "I haven't left my room in days. I feel completely empty and worthless. Nothing brings me joy. I keep thinking about disappearing and not existing anymore. I can't sleep, can't eat, can't focus on anything.",
  },
  {
    title: 'Anhedonia & Work Strain',
    tag: 'Moderate presentation',
    tone: 'amber',
    text: "Feeling really tired and low lately. Work stress is overwhelming me and I've lost interest in hobbies I used to enjoy. Hard to concentrate. Not sure how much longer I can keep going like this.",
  },
  {
    title: 'Somatic & Sleep Complaints',
    tag: 'Somatic focus',
    tone: 'amber',
    text: "I haven't slept properly for weeks. I wake up at 3am and can't go back to sleep. Food has no appeal, lost nearly 3kg, and my body feels completely exhausted by noon.",
  },
  {
    title: 'Reactive Low Mood',
    tag: 'Situational low',
    tone: 'blue',
    text: "Had a rough patch mid-week after a dispute at home. Cried for most of the afternoon without knowing why, but pulled through after spending time reading.",
  },
  {
    title: 'Recovery Check-in',
    tag: 'Baseline check-in',
    tone: 'emerald',
    text: "Had a decent week. Went for a walk with a friend and felt a bit lighter afterwards. Managed to cook dinner and mood was stable with no major lows.",
  },
];

const BATCH_SAMPLE_NOTES = [
  "I haven't been able to sleep properly for weeks. I wake up at 3am and feel completely empty inside. Nothing matters anymore.",
  "Went for a brisk walk with my sister this morning. Mood was steady, sleep was restorative, and appetite is back to normal.",
  "I feel like such a failure at work. Can't concentrate on tasks, snapping at colleagues, and exhausted by lunchtime.",
  "Had coffee with an old friend. It was genuinely nice to get out of the house. Managed to complete my daily chores.",
  "The fatigue is overwhelming. Even getting out of bed feels impossible. I keep thinking my family would be better off without me.",
];

export default function TriagePage() {
  const [tab, setTab]             = useState('single'); // 'single' | 'batch'
  const [text, setText]           = useState(CLINICAL_PRESETS[0].text);
  const [model, setModel]         = useState('word2vec');
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');

  // Batch state
  const [batchRaw, setBatchRaw]     = useState(BATCH_SAMPLE_NOTES.join('\n---\n'));
  const [batchModel, setBatchModel] = useState('word2vec');
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchErr, setBatchErr]     = useState('');
  const [selectedNote, setSelectedNote] = useState(null);

  const runAnalysis = useCallback(() => {
    if (!text.trim()) return;
    setLoading(true); setErr('');
    api.explain(text, model)
      .then(setResult)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [text, model]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const runBatch = () => {
    const notes = batchRaw
      .split(/\n---\n|\n\n+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!notes.length) return;
    setBatchLoading(true); setBatchErr('');
    api.batch(notes, batchModel)
      .then(d => { setBatchResult(d); setSelectedNote(d.results?.[0] ?? null); })
      .catch(e => setBatchErr(e.message))
      .finally(() => setBatchLoading(false));
  };

  const triage = result?.triage;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Clinical Note Triage & Screening"
        sub="Screen clinical free text for depressive language markers, extract DSM-5/PHQ-9 symptom criteria, and verify model consensus."
        actions={
          <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 bg-white">
            <button
              onClick={() => setTab('single')}
              className={clsx('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                tab === 'single' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}>
              Single Note Studio
            </button>
            <button
              onClick={() => setTab('batch')}
              className={clsx('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                tab === 'batch' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}>
              <Layers className="h-3.5 w-3.5 inline mr-1" />
              Batch Screening ({batchResult ? batchResult.count : 'Queue'})
            </button>
          </div>
        }
      />

      {/* ── Single Note Studio ── */}
      {tab === 'single' && (
        <div className="space-y-5">
          {/* Input Panel */}
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">Clinical Narrative Input</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">Select a clinical preset or paste any consultation note, portal check-in, or intake narrative.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-mono">Model:</span>
                {['word2vec', 'glove', 'tfidf'].map(m => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={clsx(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                      model === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Preset Chips */}
              <div className="flex flex-wrap gap-2">
                {CLINICAL_PRESETS.map(p => (
                  <button
                    key={p.title}
                    onClick={() => { setText(p.text); runAnalysis(); }}
                    className={clsx(
                      'text-[11px] rounded-lg px-2.5 py-1.5 border transition-all text-left flex items-center gap-1.5',
                      text === p.text
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}>
                    <span className={clsx('h-1.5 w-1.5 rounded-full',
                      p.tone === 'red' ? 'bg-red-500' : p.tone === 'amber' ? 'bg-amber-500' : p.tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500')} />
                    <span className="font-medium">{p.title}</span>
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste intake notes, therapy check-ins, or consultation text here..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 leading-relaxed font-sans"
                />
                <div className="absolute right-3 bottom-3 text-[11px] font-mono text-slate-400">
                  {text.split(/\s+/).filter(Boolean).length} words
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  Advisory tool · Trained on research text · Clinician confirmation required.
                </span>
                <Btn onClick={runAnalysis} loading={loading} disabled={!text.trim()} size="md">
                  <Sparkles className="h-3.5 w-3.5" /> Screen Note
                </Btn>
              </div>

              {err && <Err message={err} />}
            </div>
          </Card>

          {/* Triage Advisory Banner */}
          {triage && (
            <div className={clsx(
              'rounded-xl border p-4 flex items-start gap-3.5 transition-all',
              triage.color === 'red' ? 'bg-red-50 border-red-200 text-red-900' :
              triage.color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              'bg-emerald-50 border-emerald-200 text-emerald-900'
            )}>
              <div className="mt-0.5 shrink-0">
                {triage.color === 'red' ? <AlertTriangle className="h-5 w-5 text-red-600" /> :
                 triage.color === 'amber' ? <AlertTriangle className="h-5 w-5 text-amber-600" /> :
                 <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold">{triage.level}</span>
                  <Badge tone={triage.color === 'red' ? 'red' : triage.color === 'amber' ? 'amber' : 'emerald'}>
                    {result.p_depressive ? `${Math.round(result.p_depressive * 100)}% signal` : 'Classified'}
                  </Badge>
                </div>
                <p className="text-[12px] mt-1 leading-relaxed opacity-90">{triage.action}</p>
              </div>
            </div>
          )}

          {/* Detailed Diagnostic Results */}
          {result && (
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Model Agreement */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Cross-Model Consensus</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Word2Vec vs GloVe vs TF-IDF on this text</p>
                  </div>
                  {result.disagreement ? (
                    <Badge tone="amber">Models Disagree</Badge>
                  ) : (
                    <Badge tone="emerald">Consensus</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {result.comparison?.map(c => {
                    const pct = Math.round(c.p_depressive * 100);
                    const isHigh = pct >= 50;
                    return (
                      <div key={c.model} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-mono font-medium text-slate-700 uppercase">{c.model}</span>
                          <span className={clsx('font-mono font-semibold', isHigh ? 'text-red-600' : 'text-emerald-600')}>
                            {pct}% ({c.label})
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all duration-500', isHigh ? 'bg-red-500' : 'bg-emerald-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  {result.token_count} total tokens · {result.tokens_used} active in {model} vocabulary
                </div>
              </Card>

              {/* DSM-5 / PHQ-9 Criteria Detected */}
              <Card className="p-5 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-[13px] font-semibold text-slate-900">DSM-5 / PHQ-9 Symptom Criteria</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Symptom domains mapped from clinical narrative tokens</p>
                </div>

                {result.phq9_hits && Object.keys(result.phq9_hits).length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(result.phq9_hits).map(([crit, tokens]) => (
                      <div key={crit} className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[12px] font-medium text-slate-800">{crit}</span>
                        <div className="flex flex-wrap gap-1">
                          {tokens.map(t => (
                            <span key={t} className="text-[11px] font-mono bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-[12px] text-slate-400">
                    No explicit DSM-5 keyword criteria detected in this passage.
                  </div>
                )}
              </Card>

              {/* Token-Level Attribution Map */}
              <Card className="p-5 space-y-3 sm:col-span-2">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-[13px] font-semibold text-slate-900">Token-Level Explainability Map</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Color intensity represents TF-IDF logistic regression feature weight (<span className="text-red-600 font-medium">Red = depressive</span>, <span className="text-emerald-600 font-medium">Green = non-depressive baseline</span>)
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-wrap gap-1.5 leading-relaxed">
                    {result.tokens?.map((tok, i) => {
                      const match = result.contributions?.find(c => c.token === tok);
                      if (!match) {
                        return <span key={i} className="text-[12px] font-mono text-slate-400 px-1">{tok}</span>;
                      }
                      const isDep = match.score > 0;
                      const absScore = Math.abs(match.score);
                      const bg = isDep
                        ? `rgba(239, 68, 68, ${Math.min(0.15 + absScore * 0.4, 0.8)})`
                        : `rgba(16, 185, 129, ${Math.min(0.15 + absScore * 0.4, 0.8)})`;
                      const textColor = absScore > 0.6 ? '#ffffff' : '#0f172a';
                      return (
                        <span
                          key={i}
                          title={`Token: ${tok} | Weight: ${match.score > 0 ? '+' : ''}${match.score}${match.phq9 ? ` | Criterion: ${match.phq9}` : ''}`}
                          style={{ backgroundColor: bg, color: textColor }}
                          className="text-[12px] font-mono px-1.5 py-0.5 rounded-md cursor-help transition-transform hover:scale-105">
                          {tok}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Hover over any highlighted token to view exact regression weight and diagnostic criteria.</span>
                  <span>{result.contributions?.length ?? 0} feature weights resolved</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Batch Screening Queue ── */}
      {tab === 'batch' && (
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">Batch Note Intake</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">Separate entries with <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">---</code> or double line breaks.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                  {['word2vec', 'glove', 'tfidf'].map(m => (
                    <button
                      key={m}
                      onClick={() => setBatchModel(m)}
                      className={clsx(
                        'px-2 py-0.5 rounded text-[11px] font-mono uppercase transition-colors',
                        batchModel === m ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                      )}>
                      {m}
                    </button>
                  ))}
                </div>
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchRaw(BATCH_SAMPLE_NOTES.join('\n---\n'))}>
                  Load 5 Sample Notes
                </Btn>
                <Btn onClick={runBatch} loading={batchLoading} size="sm">
                  Run Batch Triage
                </Btn>
              </div>
            </div>

            <textarea
              value={batchRaw}
              onChange={e => setBatchRaw(e.target.value)}
              rows={6}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[12px] font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 leading-relaxed"
            />

            {batchErr && <Err message={batchErr} />}
          </Card>

          {/* Batch Results Table */}
          {batchResult && (
            <div className="grid lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">Ranked Triage Queue</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sorted by depressive language signal (descending)</p>
                  </div>
                  <Badge tone="blue">{batchResult.count} notes processed</Badge>
                </div>

                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {batchResult.results.map((row, idx) => {
                    const isSelected = selectedNote?.index === row.index;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedNote(row)}
                        className={clsx(
                          'p-4 cursor-pointer transition-colors flex items-center gap-4 hover:bg-slate-50',
                          isSelected && 'bg-blue-50/60 hover:bg-blue-50'
                        )}>
                        <span className="text-[12px] font-mono text-slate-400 w-6 shrink-0">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-slate-800 truncate">{row.preview}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge tone={row.triage_color === 'red' ? 'red' : row.triage_color === 'amber' ? 'amber' : 'emerald'}>
                              {row.triage_level}
                            </Badge>
                            {row.phq9_count > 0 && (
                              <span className="text-[11px] text-slate-400">
                                {row.phq9_count} criteria ({row.phq9_hits.join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                        <ScoreChip score={row.p_depressive} />
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Selected Note Detail */}
              <Card className="p-5 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-slate-900">Inspection Drawer</h3>
                  {selectedNote && (
                    <Badge tone={selectedNote.triage_color === 'red' ? 'red' : selectedNote.triage_color === 'amber' ? 'amber' : 'emerald'}>
                      {selectedNote.triage_level}
                    </Badge>
                  )}
                </div>

                {selectedNote ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Full Text</div>
                      <div className="p-3 bg-slate-50 rounded-lg text-[12px] text-slate-700 leading-relaxed border border-slate-100">
                        "{selectedNote.full_text}"
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Language Signal</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full', selectedNote.p_depressive >= 0.5 ? 'bg-red-500' : 'bg-emerald-500')}
                            style={{ width: `${Math.round(selectedNote.p_depressive * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12px] font-semibold text-slate-800">
                          {Math.round(selectedNote.p_depressive * 100)}%
                        </span>
                      </div>
                    </div>

                    {selectedNote.phq9_hits?.length > 0 && (
                      <div>
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1.5">Detected PHQ-9 Markers</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedNote.phq9_hits.map(h => (
                            <span key={h} className="text-[11px] font-mono bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md">
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-[12px] text-slate-400">
                    Select a note from the queue to view full diagnostic breakdown.
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
