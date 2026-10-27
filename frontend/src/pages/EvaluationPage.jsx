import { useEffect, useState } from 'react';
import { api } from '../api';
import { Panel, Spinner, Err, CMCell, fmt } from '../components/ui';

const MODELS = ['TF-IDF', 'Word2Vec', 'GloVe'];

function MetricsTable({ results }) {
  const cols = ['accuracy', 'precision', 'recall', 'f1'];
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-zinc-100">
          <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Model</th>
          {cols.map((c) => (
            <th key={c} className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-50">
        {results.map((r) => {
          const best = results.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
          const isBest = r.model === best.model;
          return (
            <tr key={r.model} className={isBest ? 'bg-blue-50/40' : 'hover:bg-zinc-50'}>
              <td className={`px-4 py-2 font-medium ${isBest ? 'text-blue-700' : 'text-zinc-900'}`}>
                {r.model}
              </td>
              {cols.map((c) => (
                <td key={c} className={`px-4 py-2 text-right font-mono ${isBest ? 'text-blue-700' : 'text-zinc-700'}`}>
                  {fmt.pct(r[c])}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PerClassTable({ per_class, domains }) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-zinc-100">
          <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Domain</th>
          <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Precision</th>
          <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Recall</th>
          <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">F1</th>
          <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Support</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-50">
        {domains.map((d) => {
          const row = per_class[d] ?? {};
          return (
            <tr key={d} className="hover:bg-zinc-50">
              <td className="px-4 py-2 text-zinc-800 capitalize">{d}</td>
              <td className="px-4 py-2 text-right font-mono text-zinc-700">{fmt.pct(row.precision ?? 0)}</td>
              <td className="px-4 py-2 text-right font-mono text-zinc-700">{fmt.pct(row.recall ?? 0)}</td>
              <td className="px-4 py-2 text-right font-mono text-zinc-700">{fmt.pct(row.f1 ?? 0)}</td>
              <td className="px-4 py-2 text-right font-mono text-zinc-500">{row.support ?? 0}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfusionMatrix({ matrix, domains }) {
  const maxVal = Math.max(...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-zinc-400 font-normal text-right text-[10px]">pred →</th>
            {domains.map((d) => (
              <th key={d} className="px-2 py-1 text-zinc-500 font-medium capitalize text-center">
                {d.slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="px-2 py-1 text-right text-zinc-500 font-medium capitalize pr-3">
                {domains[i]}
              </td>
              {row.map((val, j) => (
                <CMCell key={j} value={val} max={maxVal} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-zinc-400">Rows: true label · Columns: predicted</p>
    </div>
  );
}

export default function EvaluationPage() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [activeModel, setActiveModel] = useState(null);

  const load = () => {
    setError(null);
    api.evaluation()
      .then((d) => { setData(d); setActiveModel(d.results?.[0]?.model ?? null); })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const detail = data?.results?.find((r) => r.model === activeModel);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Evaluation</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Held-out test split. Same classifier (logistic regression) for all three representations.
        </p>
      </div>

      {error && <Err message={error} onRetry={load} />}
      {!data && !error && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">
          <Spinner />
          {error ? null : 'Loading…'}
        </div>
      )}

      {data && !data.results && (
        <div className="border border-dashed border-zinc-200 rounded-md px-4 py-6 text-center text-[12px] text-zinc-400">
          Evaluation not run yet. Train models and run evaluation from the Embeddings tab.
        </div>
      )}

      {data?.results && (
        <>
          <Panel title="Summary">
            <MetricsTable results={data.results} />
          </Panel>

          {/* Per-model detail */}
          <Panel
            title="Per-class detail"
            actions={
              <div className="flex gap-1">
                {data.results.map((r) => (
                  <button
                    key={r.model}
                    onClick={() => setActiveModel(r.model)}
                    className={`px-2 py-0.5 rounded text-[12px] transition-colors ${
                      activeModel === r.model
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {r.model}
                  </button>
                ))}
              </div>
            }
          >
            {detail && (
              <PerClassTable per_class={detail.per_class} domains={data.domains} />
            )}
          </Panel>

          {/* Confusion matrices */}
          <div className="grid sm:grid-cols-3 gap-4">
            {data.results.map((r) => (
              <Panel key={r.model} title={r.model} sub="Confusion matrix">
                <div className="px-4 py-3">
                  <ConfusionMatrix matrix={r.confusion_matrix} domains={data.domains} />
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
