import { useEffect, useState } from 'react';
import { api } from '../api';
import { Panel, Btn, Spinner, Err, CMCell, fmt } from '../components/ui';

function MetricsTable({ results }) {
  const best = results.reduce((a, b) => b.f1 > a.f1 ? b : a);
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-zinc-100">
          {['Model','Accuracy','Precision','Recall','F1'].map(h => (
            <th key={h} className={`py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium ${h === 'Model' ? 'text-left px-4' : 'text-right px-3'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-50">
        {results.map(r => {
          const isBest = r.model === best.model;
          return (
            <tr key={r.model} className={isBest ? 'bg-blue-50/50' : 'hover:bg-zinc-50'}>
              <td className={`px-4 py-2.5 font-medium ${isBest ? 'text-blue-700' : 'text-zinc-900'}`}>
                {r.model} {isBest && <span className="ml-1 text-[10px] text-blue-500 font-normal">best</span>}
              </td>
              {['accuracy','precision','recall','f1'].map(k => (
                <td key={k} className={`px-3 py-2.5 text-right font-mono ${isBest ? 'text-blue-700' : 'text-zinc-700'}`}>
                  {fmt.pct(r[k])}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfusionMatrix({ cm, labels }) {
  const max = Math.max(...cm.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-zinc-400 font-normal text-right text-[10px]">pred →</th>
            {labels.map(l => (
              <th key={l} className="px-2 py-1 text-zinc-500 font-medium text-center capitalize">
                {l.slice(0, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cm.map((row, i) => (
            <tr key={i}>
              <td className="px-2 py-1 text-right text-zinc-500 font-medium capitalize pr-3">
                {labels[i]}
              </td>
              {row.map((v, j) => <CMCell key={j} value={v} max={max} />)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-zinc-400">Rows: true · Cols: predicted</p>
    </div>
  );
}

export default function ResultsPage() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [running, setRunning] = useState(false);
  const [activeModel, setActive] = useState(null);

  const load = () => {
    api.results()
      .then(d => { setData(d); setActive(d?.results?.[0]?.model ?? null); })
      .catch(e => setError(e.message));
  };

  const run = () => {
    setRunning(true); setError(null);
    api.evaluate()
      .then(d => { setData(d); setActive(d?.results?.[0]?.model ?? null); setRunning(false); })
      .catch(e => { setError(e.message); setRunning(false); });
  };

  useEffect(load, []);

  const detail = data?.results?.find(r => r.model === activeModel);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-zinc-900">Results</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Test-set performance · {data?.n_test ?? '—'} held-out posts
          </p>
        </div>
        <Btn onClick={run} loading={running} variant="outline">
          {data?.results ? 'Re-run evaluation' : 'Run evaluation'}
        </Btn>
      </div>

      {error && <Err message={error} />}
      {!data && !error && <div className="flex gap-2 items-center text-[12px] text-zinc-400"><Spinner /> Loading…</div>}

      {data && !data.results && (
        <div className="border border-dashed border-zinc-200 rounded-md px-4 py-8 text-center text-[12px] text-zinc-400">
          Train both Word2Vec and GloVe, then click "Run evaluation".
        </div>
      )}

      {data?.results && (
        <>
          <Panel title="Model comparison" sub="Depressive class (positive) metrics">
            <MetricsTable results={data.results} />
          </Panel>

          {/* Key insight */}
          <Panel title="What the embeddings learned">
            <div className="px-4 py-3 grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">Top depressive words</div>
                <div className="flex flex-wrap gap-1">
                  {(data.top_depressive_words ?? []).map(w => (
                    <span key={w} className="text-[11px] font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{w}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">Top non-depressive words</div>
                <div className="flex flex-wrap gap-1">
                  {(data.top_non_depressive_words ?? []).map(w => (
                    <span key={w} className="text-[11px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Per-model confusion matrices */}
          <div>
            <div className="flex gap-1 mb-3">
              {data.results.map(r => (
                <button key={r.model} onClick={() => setActive(r.model)}
                  className={`px-2.5 py-1 rounded text-[12px] transition-colors ${
                    activeModel === r.model
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}>
                  {r.model}
                </button>
              ))}
            </div>
            {detail && (
              <div className="grid sm:grid-cols-2 gap-5">
                <Panel title="Confusion matrix">
                  <div className="px-4 py-3">
                    <ConfusionMatrix cm={detail.confusion_matrix} labels={data.labels ?? ['non-dep','dep']} />
                  </div>
                </Panel>
                <Panel title="Per-class breakdown">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        {['Class','Precision','Recall','F1','Support'].map(h => (
                          <th key={h} className={`py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium ${h === 'Class' ? 'text-left px-4' : 'text-right px-3'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {Object.entries(detail.per_class ?? {}).map(([cls, m]) => (
                        <tr key={cls} className="hover:bg-zinc-50">
                          <td className="px-4 py-2 text-zinc-800 capitalize">{cls}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-700">{fmt.pct(m.precision)}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-700">{fmt.pct(m.recall)}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-700">{fmt.pct(m.f1)}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-500">{m.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
