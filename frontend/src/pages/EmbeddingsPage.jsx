import { useEffect, useState } from 'react';
import { api } from '../api';
import { Panel, Btn, Spinner, Err, MiniBar } from '../components/ui';

const MODELS = ['word2vec', 'glove'];

const SEED_WORDS = ['hypertension', 'metformin', 'diabetes', 'furosemide', 'kidney', 'glucose', 'wheezing'];

function TrainPanel({ model, onDone }) {
  const [status, setStatus] = useState('idle'); // idle | training | done | error
  const [msg, setMsg] = useState('');

  const train = () => {
    setStatus('training');
    setMsg('');
    api.train(model)
      .then((r) => { setStatus('done'); setMsg(r.message ?? 'Done'); onDone(); })
      .catch((e) => { setStatus('error'); setMsg(e.message); });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-zinc-200 rounded-md bg-zinc-50 text-[12px]">
      <span className="text-zinc-500">Model not trained.</span>
      <Btn onClick={train} loading={status === 'training'} variant="outline">
        Train {model}
      </Btn>
      {msg && (
        <span className={status === 'error' ? 'text-red-600' : 'text-emerald-700'}>{msg}</span>
      )}
    </div>
  );
}

function NeighborResults({ model, word }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!word) return;
    setLoading(true);
    setData(null);
    setError(null);
    api.neighbors(model, word)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [model, word]);

  if (!word) return null;
  if (loading) return <div className="flex items-center gap-2 text-[12px] text-zinc-400 px-1"><Spinner /> Searching…</div>;
  if (error)   return <Err message={error} />;
  if (!data?.neighbors?.length) return <p className="text-[12px] text-zinc-400 px-1">No results — word may be out of vocabulary.</p>;

  const maxSim = Math.max(...data.neighbors.map((n) => Math.abs(n.similarity)));
  return (
    <div className="space-y-1.5">
      {data.neighbors.map((n) => (
        <MiniBar key={n.word} label={n.word} value={n.similarity} max={maxSim} />
      ))}
    </div>
  );
}

function NoteVectorPanel({ model }) {
  const [text, setText] = useState('');
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setData(null);
    setError(null);
    api.noteVector(model, text)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const maxV = data ? Math.max(...data.vector.map(Math.abs)) : 1;

  return (
    <Panel title="Note vector" sub="Mean of word vectors for an arbitrary note">
      <div className="px-4 py-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a note or any clinical text…"
          rows={3}
          className="w-full border border-zinc-200 rounded px-3 py-2 text-[12px] text-zinc-800 placeholder:text-zinc-400 font-mono resize-none focus:outline-none focus:border-blue-400"
        />
        <Btn onClick={run} disabled={!text.trim()} loading={loading}>Vectorize</Btn>
        {error && <Err message={error} />}
        {data && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-1">
              {data.dim}-d vector · {data.oov_count} OOV tokens
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {data.vector.slice(0, 20).map((v, i) => (
                <MiniBar key={i} label={`d${i}`} value={v} max={maxV} />
              ))}
            </div>
            {data.vector.length > 20 && (
              <p className="text-[11px] text-zinc-400">Showing first 20 of {data.vector.length} dimensions</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function EmbeddingsPage() {
  const [model, setModel]     = useState('word2vec');
  const [status, setStatus]   = useState(null);
  const [word, setWord]       = useState('');
  const [query, setQuery]     = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);

  const checkStatus = () => {
    setLoadingStatus(true);
    api.trainStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(checkStatus, []);

  const trained = status?.[model];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Embeddings</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Explore trained word vectors. Nearest neighbors show distributional similarity in the clinical corpus.
        </p>
      </div>

      {/* Model toggle */}
      <div className="flex gap-1">
        {MODELS.map((m) => (
          <button
            key={m}
            onClick={() => setModel(m)}
            className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              model === m
                ? 'bg-zinc-900 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {m}
          </button>
        ))}
        {loadingStatus && <span className="ml-2 flex items-center"><Spinner size="sm" /></span>}
        {status && (
          <span className="ml-2 text-[11px] text-zinc-400 self-center">
            {trained ? `trained · vocab ${status[`${model}_vocab`] ?? '—'}` : 'not trained'}
          </span>
        )}
      </div>

      {/* Train prompt if needed */}
      {status && !trained && (
        <TrainPanel model={model} onDone={checkStatus} />
      )}

      {/* Nearest neighbors */}
      {trained && (
        <div className="grid sm:grid-cols-2 gap-5">
          <Panel title="Nearest neighbors" sub="Cosine similarity in embedding space">
            <div className="px-4 py-3 space-y-4">
              {/* Seed words */}
              <div className="flex flex-wrap gap-1">
                {SEED_WORDS.map((w) => (
                  <button
                    key={w}
                    onClick={() => { setWord(w); setQuery(w); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border ${
                      query === w
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              {/* Custom query */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setWord(query.trim()); }}
                  placeholder="Enter a word…"
                  className="flex-1 border border-zinc-200 rounded px-2.5 py-1.5 text-[12px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-blue-400"
                />
                <Btn variant="outline" onClick={() => setWord(query.trim())} disabled={!query.trim()}>
                  Search
                </Btn>
              </div>
              <NeighborResults model={model} word={word} />
            </div>
          </Panel>

          <NoteVectorPanel model={model} />
        </div>
      )}
    </div>
  );
}
