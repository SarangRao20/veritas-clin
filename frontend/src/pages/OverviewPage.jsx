import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Stat, Panel, Spinner, Err } from '../components/ui';

const STEPS = [
  { n: '1', title: 'Dataset',        detail: '7,731 Reddit posts — depressive vs non-depressive' },
  { n: '2', title: 'Preprocess',     detail: 'Lowercase · strip punctuation · remove stopwords' },
  { n: '3', title: 'Train Word2Vec', detail: 'Skip-gram, window 5, negative sampling, 100-d vectors' },
  { n: '4', title: 'Train GloVe',    detail: 'Co-occurrence matrix, weighted least-squares, 100-d' },
  { n: '5', title: 'Represent',      detail: 'Each post → mean of its in-vocabulary word vectors' },
  { n: '6', title: 'Classify',       detail: 'Logistic regression — same classifier for all 3 models' },
  { n: '7', title: 'Evaluate',       detail: 'Precision · Recall · F1 on held-out test split' },
];

export default function OverviewPage() {
  const [ds, setDs]   = useState(null);
  const [st, setSt]   = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.dataset().then(setDs).catch(e => setErr(e.message));
    api.trainStatus().then(setSt).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Depression screening with NLP</h1>
        <p className="mt-1 text-[13px] text-zinc-500 max-w-2xl">
          Can word embeddings detect depressive language better than keyword frequency?
          We train Word2Vec and GloVe on real Reddit posts and compare them against a TF-IDF baseline
          on binary classification.
        </p>
      </div>

      {err && <Err message={err} />}

      {ds ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total posts"         value={ds.total.toLocaleString()} sub="Reddit dataset" />
          <Stat label="Depressive"          value={ds.depressive.toLocaleString()} sub={`${((ds.depressive/ds.total)*100).toFixed(0)}% of corpus`} />
          <Stat label="Train / val / test"  value={`${ds.split_train} / ${ds.split_val} / ${ds.split_test}`} sub="stratified split" />
          <Stat label="Models trained"
            value={st ? [st.word2vec && 'W2V', st.glove && 'GloVe'].filter(Boolean).join(' · ') || '—' : '—'}
            sub={st?.evaluated ? 'evaluated' : 'not evaluated yet'} mono={false} />
        </div>
      ) : (
        <div className="flex gap-2 items-center text-[12px] text-zinc-400"><Spinner /> Loading…</div>
      )}

      {ds && (
        <Panel title="Sample post from dataset" sub="Depressive class · preview">
          <div className="px-4 py-3 space-y-2">
            <p className="text-[13px] text-zinc-700 leading-relaxed italic">"{ds.sample_text}…"</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {ds.sample_tokens.map(t => (
                <span key={t} className="text-[11px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{t}</span>
              ))}
              <span className="text-[11px] text-zinc-400 self-center">…</span>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Pipeline">
        <div className="divide-y divide-zinc-50">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-baseline gap-4 px-4 py-2.5">
              <span className="text-[11px] font-mono text-zinc-400 w-4 shrink-0">{s.n}</span>
              <span className="text-[13px] font-medium text-zinc-800 w-36 shrink-0">{s.title}</span>
              <span className="text-[12px] text-zinc-500">{s.detail}</span>
            </div>
          ))}
        </div>
      </Panel>

      {st && (!st.word2vec || !st.glove) && (
        <div className="border border-amber-200 bg-amber-50 rounded-md px-4 py-3 text-[12px] text-amber-800">
          Models not yet trained. <Link to="/explore" className="underline underline-offset-2">Explore → Train</Link> to fit Word2Vec and GloVe.
        </div>
      )}
      {st?.evaluated && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-md px-4 py-3 text-[12px] text-emerald-800">
          Models trained and evaluated. <Link to="/results" className="underline underline-offset-2">View results →</Link>
        </div>
      )}
    </div>
  );
}
