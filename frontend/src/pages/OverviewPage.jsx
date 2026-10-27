import { useEffect, useState } from 'react';
import { api } from '../api';
import { Stat, Panel, Spinner, Err } from '../components/ui';

const PIPELINE = [
  { step: '1', label: 'Corpus', detail: '400 synthetic notes, 4 domains, seeded' },
  { step: '2', label: 'Tokenize', detail: 'Lowercase, strip punctuation, remove stopwords' },
  { step: '3', label: 'Train embeddings', detail: 'Word2Vec skip-gram · GloVe co-occurrence' },
  { step: '4', label: 'Note vectors', detail: 'Mean of in-vocabulary word vectors' },
  { step: '5', label: 'Classify', detail: 'Logistic regression, stratified split' },
  { step: '6', label: 'Evaluate', detail: 'Accuracy · F1 · confusion matrix on held-out test' },
];

export default function OverviewPage() {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.overview()
      .then(setData)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Clinical note classification</h1>
        <p className="mt-1 text-[13px] text-zinc-500 max-w-xl">
          Comparing TF-IDF, Word2Vec, and GloVe representations on domain classification of synthetic
          clinical notes. All data is generated; no real patient records are used.
        </p>
      </div>

      {/* Stats row */}
      {error && <Err message={error} onRetry={load} />}
      {!data && !error && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">
          <Spinner /> Loading…
        </div>
      )}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Notes"       value={data.n_notes}          sub={`seed ${data.seed}`} />
          <Stat label="Domains"     value={data.n_domains}        sub={data.domains?.join(' · ')} mono={false} />
          <Stat label="Vocab size"  value={data.vocab_size}       sub="after preprocessing" />
          <Stat label="Train / val / test" value={`${data.split_train} / ${data.split_val} / ${data.split_test}`} sub="stratified" />
        </div>
      )}

      {/* Pipeline */}
      <Panel title="Pipeline">
        <div className="divide-y divide-zinc-100">
          {PIPELINE.map((s) => (
            <div key={s.step} className="flex items-baseline gap-4 px-4 py-2.5">
              <span className="text-[11px] font-mono text-zinc-400 w-4 shrink-0">{s.step}</span>
              <span className="text-[13px] font-medium text-zinc-800 w-32 shrink-0">{s.label}</span>
              <span className="text-[12px] text-zinc-500">{s.detail}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Model comparison summary */}
      {data?.results && (
        <Panel title="Model comparison" sub="Test-set accuracy">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Model</th>
                <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Accuracy</th>
                <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Macro F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {data.results.map((r) => (
                <tr key={r.model} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-2 font-medium text-zinc-900">{r.model}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-700">{(r.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-700">{r.macro_f1.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
