import { useState, useEffect } from 'react';
import { api } from '../api';
import { Panel, Btn, Err, Tag, Spinner } from '../components/ui';
import clsx from 'clsx';

const MODELS = ['word2vec', 'glove', 'tfidf'];

const EXAMPLES = [
  {
    label: 'High risk',
    text: "I haven't left my room in days. I feel completely empty and worthless. Nothing brings me joy. I keep thinking about disappearing and not existing anymore. I can't sleep, can't eat, can't focus on anything.",
  },
  {
    label: 'Moderate risk',
    text: "Feeling really tired and low lately. Work stress is overwhelming me and I've lost interest in hobbies I used to enjoy. Hard to concentrate. Not sure how much longer I can keep going like this.",
  },
  {
    label: 'Low risk',
    text: "Had a tough week but feeling better after talking to a friend. Going to the gym helped a lot. Looking forward to the weekend — planning a hike with family.",
  },
];

const TRIAGE_STYLES = {
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-800',     dot: 'bg-red-500'     },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
};

function ProbBar({ label, value, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-700">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function TokenHighlight({ tokens, contributions }) {
  const scoreMap = {};
  (contributions || []).forEach(c => { scoreMap[c.token] = c.score; });
  const maxAbs = Math.max(...Object.values(scoreMap).map(Math.abs), 0.01);

  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((tok, i) => {
        const score = scoreMap[tok];
        if (score === undefined) {
          return (
            <span key={i} className="text-[12px] font-mono text-zinc-400 px-1">{tok}</span>
          );
        }
        const intensity = Math.min(Math.abs(score) / maxAbs, 1);
        const isRed = score > 0;
        const alpha = (0.15 + intensity * 0.5).toFixed(2);
        const bg = isRed ? `rgba(239,68,68,${alpha})` : `rgba(16,185,129,${alpha})`;
        return (
          <span key={i}
            title={`${isRed ? '+' : ''}${score.toFixed(3)} — ${isRed ? 'depressive' : 'non-depressive'} signal`}
            className="text-[12px] font-mono px-1.5 py-0.5 rounded cursor-default"
            style={{ backgroundColor: bg, color: intensity > 0.5 ? '#18181b' : '#374151' }}>
            {tok}
          </span>
        );
      })}
    </div>
  );
}

function ModelComparison({ comparison, disagreement }) {
  return (
    <div className="space-y-1.5">
      {disagreement && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
          Models disagree — check token coverage and consider using TF-IDF for this text.
        </div>
      )}
      {comparison.map(c => {
        const isHigh = c.p_depressive >= 0.55;
        return (
          <div key={c.model} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500 w-16 shrink-0">{c.model}</span>
            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isHigh ? 'bg-red-400' : 'bg-emerald-400'}`}
                style={{ width: `${c.p_depressive * 100}%` }} />
            </div>
            <span className={clsx('text-[11px] font-mono w-12 text-right shrink-0',
              isHigh ? 'text-red-600' : 'text-emerald-600')}>
              {(c.p_depressive * 100).toFixed(0)}%
            </span>
            <Tag tone={isHigh ? 'red' : 'emerald'}>{c.label}</Tag>
          </div>
        );
      })}
    </div>
  );
}

// ── Single note tab ─────────────────────────────────────────────────────────

function SingleTab({ status }) {
  const [text, setText]     = useState('');
  const [model, setModel]   = useState('word2vec');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const analyse = () => {
    setLoading(true); setResult(null); setErr('');
    api.explain(text, model)
      .then(setResult)
      .catch(e => { let m = e.message; try { m = JSON.parse(m).detail ?? m; } catch {} setErr(m); })
      .finally(() => setLoading(false));
  };

  const triage = result?.triage;
  const ts = triage ? TRIAGE_STYLES[triage.color] : null;

  return (
    <div className="space-y-4">
      {/* Input */}
      <Panel title="Patient text">
        <div className="px-4 py-3 space-y-3">
          {/* Examples */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(ex => (
              <button key={ex.label}
                onClick={() => { setText(ex.text); setResult(null); setErr(''); }}
                className={clsx(
                  'text-[11px] border rounded px-2 py-0.5 transition-colors',
                  text === ex.text ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                )}>
                {ex.label}
              </button>
            ))}
          </div>

          <textarea value={text} onChange={e => { setText(e.target.value); setResult(null); setErr(''); }}
            placeholder="Paste patient intake note, journal entry, or any free-text here…"
            rows={5}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-[13px] text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-blue-400 leading-relaxed" />

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400 shrink-0">Model</span>
            <div className="flex gap-1">
              {MODELS.map(m => (
                <button key={m} onClick={() => setModel(m)}
                  className={clsx('px-2.5 py-1 rounded text-[12px] transition-colors',
                    model === m ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}>
                  {m}
                </button>
              ))}
            </div>
            <Btn onClick={analyse} loading={loading} disabled={!text.trim()}>Analyse</Btn>
          </div>
          {err && <Err message={err} />}
        </div>
      </Panel>

      {/* Triage */}
      {triage && (
        <div className={clsx('border rounded-md px-4 py-3 flex items-start gap-3', ts.bg, ts.border)}>
          <span className={clsx('mt-0.5 h-2 w-2 rounded-full shrink-0', ts.dot)} />
          <div>
            <div className={clsx('text-[13px] font-semibold', ts.text)}>{triage.level}</div>
            <div className={clsx('text-[12px] mt-0.5', ts.text)}>{triage.action}</div>
          </div>
        </div>
      )}

      {result && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Risk scores */}
          <Panel title="Risk scores">
            <div className="px-4 py-3 space-y-2">
              <ProbBar label="depressive"     value={result.p_depressive}     color="bg-red-400" />
              <ProbBar label="non-depressive" value={result.p_non_depressive} color="bg-emerald-400" />
              <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100">
                {result.token_count} tokens · {result.tokens_used} in vocabulary
              </div>
            </div>
          </Panel>

          {/* Model comparison */}
          <Panel title="Model agreement" sub="Word2Vec · GloVe · TF-IDF">
            <div className="px-4 py-3">
              <ModelComparison comparison={result.comparison} disagreement={result.disagreement} />
            </div>
          </Panel>

          {/* Token highlight */}
          <Panel title="Token contributions" sub="Red = depressive signal · Green = non-depressive" className="sm:col-span-2">
            <div className="px-4 py-3 space-y-3">
              <TokenHighlight tokens={result.tokens} contributions={result.contributions} />
              <p className="text-[11px] text-zinc-400">
                Intensity reflects TF-IDF logistic regression coefficient magnitude. Hover for exact score.
              </p>
            </div>
          </Panel>

          {/* PHQ-9 criteria */}
          {result.phq9_hits && Object.keys(result.phq9_hits).length > 0 && (
            <Panel title="PHQ-9 criteria detected" sub="DSM-5 symptom criteria suggested by the text" className="sm:col-span-2">
              <div className="divide-y divide-zinc-50">
                {Object.entries(result.phq9_hits).map(([criterion, words]) => (
                  <div key={criterion} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-[12px] text-zinc-700 flex-1">{criterion}</span>
                    <div className="flex gap-1">
                      {words.map(w => (
                        <span key={w} className="text-[11px] font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{w}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

// ── Batch tab ────────────────────────────────────────────────────────────────

const TRIAGE_TAG = { 'High risk': 'red', 'Moderate risk': 'amber', 'Low risk': 'emerald' };

function BatchTab() {
  const [raw, setRaw]       = useState('');
  const [model, setModel]   = useState('word2vec');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const run = () => {
    const notes = raw.split('---').map(s => s.trim()).filter(Boolean);
    if (!notes.length) return;
    setLoading(true); setResults(null); setErr('');
    api.batch(notes, model)
      .then(setResults)
      .catch(e => { let m = e.message; try { m = JSON.parse(m).detail ?? m; } catch {} setErr(m); })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <Panel title="Batch screening" sub="Separate each patient note with --- on its own line">
        <div className="px-4 py-3 space-y-3">
          <textarea value={raw} onChange={e => setRaw(e.target.value)}
            placeholder={"Patient A intake text here…\n---\nPatient B intake text here…\n---\nPatient C intake text here…"}
            rows={8}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-[12px] font-mono text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-blue-400 leading-relaxed" />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400 shrink-0">Model</span>
            <div className="flex gap-1">
              {MODELS.map(m => (
                <button key={m} onClick={() => setModel(m)}
                  className={clsx('px-2.5 py-1 rounded text-[12px] transition-colors',
                    model === m ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}>
                  {m}
                </button>
              ))}
            </div>
            <Btn onClick={run} loading={loading} disabled={!raw.trim()}>Screen all</Btn>
          </div>
          {err && <Err message={err} />}
        </div>
      </Panel>

      {results && (
        <Panel title={`${results.count} patients screened`} sub="Sorted by risk — highest first">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-zinc-100">
                {['#','Preview','Risk score','Triage','PHQ-9 signals'].map(h => (
                  <th key={h} className={clsx(
                    'py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium',
                    h === '#' ? 'px-4 text-left w-8' :
                    h === 'Preview' ? 'px-3 text-left' :
                    'px-3 text-right'
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {results.results.map((r, i) => (
                <tr key={r.index} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-mono text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2.5 text-zinc-600 max-w-xs truncate">{r.preview}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    <span className={r.p_depressive >= 0.55 ? 'text-red-600' : 'text-emerald-600'}>
                      {(r.p_depressive * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Tag tone={TRIAGE_TAG[r.triage_level] ?? 'zinc'}>{r.triage_level}</Tag>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {r.phq9_hits.slice(0,2).map(h => (
                        <span key={h} className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded truncate max-w-24">
                          {h.split('–')[0].trim()}
                        </span>
                      ))}
                      {r.phq9_count > 2 && (
                        <span className="text-[10px] text-zinc-400">+{r.phq9_count - 2}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PredictPage() {
  const [tab, setTab]       = useState('single');
  const [status, setStatus] = useState(null);

  useEffect(() => { api.trainStatus().then(setStatus).catch(() => {}); }, []);

  const notTrained = status && !status.word2vec && !status.glove;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-zinc-900">Triage</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Screen patient text for depression risk. See which phrases drive the prediction and which PHQ-9 criteria are suggested.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {[['single','Single note'],['batch','Batch']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('px-3 py-1.5 rounded text-[12px] font-medium transition-colors',
                tab === id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {notTrained && (
        <div className="border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-[12px] text-amber-800">
          No models trained yet. Go to <a href="/explore" className="underline">Explore → Train</a> first.
        </div>
      )}

      {tab === 'single' ? <SingleTab status={status} /> : <BatchTab />}

      <p className="text-[11px] text-zinc-400">
        Trained on Reddit posts · not validated for clinical use · do not use to make real patient decisions.
      </p>
    </div>
  );
}
