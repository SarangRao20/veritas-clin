import { useEffect, useState } from 'react';
import { api } from '../api';
import { Panel, Btn, Spinner, Err, MiniBar } from '../components/ui';

const SEED_WORDS = ['hopeless', 'worthless', 'empty', 'numb', 'anxious', 'happy', 'therapy', 'medication'];
const MODELS = ['word2vec', 'glove'];

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
        <div className="text-[12px] text-zinc-500">
          Word2Vec takes ~2 min · GloVe ~1.5 min · server stays responsive during training.
        </div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => {
            const trained = status?.[m];
            return (
              <Btn key={m} variant={trained ? 'outline' : 'primary'}
                loading={loading === m} onClick={() => train(m)}>
                {trained ? `Retrain ${m}` : `Train ${m}`}
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
          <div className="text-[11px] text-zinc-400 space-y-0.5">
            {MODELS.map(m => (
              <div key={m}>
                {m}: {status[m]
                  ? `trained · vocab ${status[`${m}_vocab`] ?? '?'}`
                  : 'not trained'}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function NeighborPanel({ model }) {
  const [word, setWord]     = useState('');
  const [query, setQuery]   = useState('');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const search = (w) => {
    if (!w) return;
    setLoading(true); setData(null); setErr('');
    api.neighbors(model, w)
      .then(d => { setData(d); setWord(w); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const maxSim = data?.neighbors?.length
    ? Math.max(...data.neighbors.map(n => Math.abs(n.similarity)))
    : 1;

  return (
    <Panel title={`${model} — nearest neighbors`}
      sub="Cosine similarity in learned embedding space">
      <div className="px-4 py-3 space-y-3">
        {/* seed chips */}
        <div className="flex flex-wrap gap-1">
          {SEED_WORDS.map(w => (
            <button key={w} onClick={() => { setQuery(w); search(w); }}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                word === w
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}>
              {w}
            </button>
          ))}
        </div>
        {/* custom */}
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(query.trim())}
            placeholder="Enter any word…"
            className="flex-1 border border-zinc-200 rounded px-2.5 py-1.5 text-[12px] placeholder:text-zinc-400 focus:outline-none focus:border-blue-400" />
          <Btn variant="outline" onClick={() => search(query.trim())} disabled={!query.trim()}>
            Search
          </Btn>
        </div>
        {loading && <div className="flex gap-2 items-center text-[12px] text-zinc-400"><Spinner /></div>}
        {err && <Err message={err} />}
        {data && !data.in_vocab && (
          <p className="text-[12px] text-zinc-400">"{data.word}" is not in vocabulary.</p>
        )}
        {data?.neighbors?.map(n => (
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

  const bothTrained = status?.word2vec && status?.glove;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Explore</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Train the models then inspect what the embeddings learned about mental health language.
        </p>
      </div>

      <TrainSection status={status} onDone={refresh} />

      {bothTrained && (
        <div className="grid sm:grid-cols-2 gap-5">
          <NeighborPanel model="word2vec" />
          <NeighborPanel model="glove" />
        </div>
      )}

      {status && !bothTrained && (
        <p className="text-[12px] text-zinc-400">Train both models above to explore embeddings.</p>
      )}
    </div>
  );
}
