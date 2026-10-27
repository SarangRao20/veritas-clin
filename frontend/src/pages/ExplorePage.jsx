import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Panel, Btn, Spinner, Err, MiniBar } from '../components/ui';

const SEED_WORDS = ['hopeless', 'worthless', 'empty', 'numb', 'anxious', 'happy', 'therapy', 'medication'];

function TrainSection({ status, onDone }) {
  const [loading, setLoading] = useState(null);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');

  const train = (model) => {
    setLoading(model); setMsg(''); setErr('');
    api.train(model)
      .then(r => { setMsg(r.message); onDone(); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(null));
  };

  return (
    <Panel title="Train" sub="Fit embeddings on training split (≈ 5,400 posts)">
      <div className="px-4 py-3 space-y-3">
        <p className="text-[12px] text-zinc-500">
          Word2Vec ≈ 2 min · GloVe ≈ 1.5 min. Classifiers are built automatically after training so Predict works straight away.
        </p>
        <div className="flex flex-wrap gap-2">
          {['word2vec','glove'].map(m => {
            const done = status?.[m];
            return (
              <Btn key={m} variant={done ? 'outline' : 'primary'}
                loading={loading === m} onClick={() => train(m)}>
                {done ? `Retrain ${m}` : `Train ${m}`}
              </Btn>
            );
          })}
          <Btn variant="outline" loading={loading === 'all'} onClick={() => train('all')}>
            Train both
          </Btn>
        </div>
        {msg && <p className="text-[12px] text-emerald-700">{msg}</p>}
        {err && <Err message={err} />}
        {status && (
          <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1 border-t border-zinc-100">
            {['word2vec','glove'].map(m => (
              <div key={m}>
                {m}: {status[m] ? `trained · vocab ${status[`${m}_vocab`] ?? '?'}` : 'not trained'}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function NeighborPanel({ model, trained }) {
  const [query, setQuery]   = useState('');
  const [data,  setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [err,   setErr]     = useState('');
  const inputRef            = useRef(null);

  const search = (word) => {
    const w = (word ?? query).trim().toLowerCase();
    if (!w) return;
    setQuery(w);
    setLoading(true); setData(null); setErr('');
    api.neighbors(model, w)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const maxSim = data?.neighbors?.length
    ? Math.max(...data.neighbors.map(n => n.similarity))
    : 1;

  if (!trained) return (
    <Panel title={model} sub="Train this model above to explore its embeddings.">
      <div className="px-4 py-6 text-center text-[12px] text-zinc-400">Not trained yet.</div>
    </Panel>
  );

  return (
    <Panel title={`${model} — nearest neighbors`} sub="Cosine similarity in learned embedding space">
      <div className="px-4 py-3 space-y-3">
        {/* Seed word chips */}
        <div className="flex flex-wrap gap-1">
          {SEED_WORDS.map(w => (
            <button key={w} onClick={() => search(w)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                data?.word === w
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}>
              {w}
            </button>
          ))}
        </div>

        {/* Free-text search */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Type any word and press Enter…"
            className="flex-1 border border-zinc-200 rounded px-2.5 py-1.5 text-[12px] placeholder:text-zinc-400 focus:outline-none focus:border-blue-400"
          />
          <Btn variant="outline" onClick={() => search()} disabled={!query.trim()}>Search</Btn>
        </div>

        {/* Results */}
        {loading && <div className="flex gap-2 items-center text-[12px] text-zinc-400"><Spinner /></div>}
        {err && <Err message={err} />}
        {data && !data.in_vocab && (
          <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            "{data.word}" is not in the vocabulary (filtered by min_count=3).
          </p>
        )}
        {data?.in_vocab && data.neighbors.length === 0 && (
          <p className="text-[12px] text-zinc-400">No neighbors found.</p>
        )}
        {data?.in_vocab && data.neighbors.map(n => (
          <MiniBar key={n.word} label={n.word} value={n.similarity} max={maxSim} />
        ))}
      </div>
    </Panel>
  );
}

export default function ExplorePage() {
  const [status, setStatus] = useState(null);
  const refresh = () => api.trainStatus().then(setStatus).catch(() => {});
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Explore</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Train the models then inspect what the embeddings learned about mental health language.
        </p>
      </div>

      <TrainSection status={status} onDone={refresh} />

      <div className="grid sm:grid-cols-2 gap-5">
        <NeighborPanel model="word2vec" trained={!!status?.word2vec} />
        <NeighborPanel model="glove"    trained={!!status?.glove} />
      </div>
    </div>
  );
}
