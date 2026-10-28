import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { SectionHeader, Card, Btn, Spinner, Err, Badge, MiniBar } from '../components/ui';
import { Compass, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const SEED_WORDS = [
  'hopeless', 'sleep', 'worthless', 'tired', 'empty', 'anxious',
  'crying', 'lonely', 'appetite', 'guilt', 'therapy', 'happy'
];

function ModelNeighborsCard({ model, title, desc, data, loading, err, trained }) {
  const maxSim = data?.neighbors?.length
    ? Math.max(...data.neighbors.map(n => n.similarity), 0.01)
    : 1;

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-slate-900 uppercase font-mono">{title}</h3>
            <Badge tone={trained ? (model === 'word2vec' ? 'blue' : 'violet') : 'slate'}>
              {trained ? 'Trained' : 'Not Ready'}
            </Badge>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>

      <div className="p-5 flex-1 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[12px] text-slate-400 gap-2">
            <Spinner /> Computing cosine neighbors in {model} space...
          </div>
        )}

        {err && <Err message={err} />}

        {!loading && !err && data && !data.in_vocab && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
            "{data.word}" was filtered out during training because its frequency was below the minimum count threshold (min_count=3).
          </div>
        )}

        {!loading && !err && data?.in_vocab && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-100 pb-2">
              <span>Top Semantically Related Tokens</span>
              <span>Cosine Sim (cos θ)</span>
            </div>
            <div className="space-y-2.5">
              {data.neighbors.map((n, i) => (
                <div key={n.word} className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400 w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1">
                    <MiniBar label={n.word} value={n.similarity} max={maxSim} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !err && !data && (
          <div className="py-12 text-center text-[12px] text-slate-400">
            Select a clinical seed word or type a term above to inspect neighbors.
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ExplorePage() {
  const [query, setQuery]         = useState('hopeless');
  const [activeWord, setActiveWord] = useState('hopeless');
  const [w2vData, setW2vData]     = useState(null);
  const [glvData, setGlvData]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState(null);
  const [trainLoading, setTrainLoading] = useState(null);
  const [trainMsg, setTrainMsg]   = useState('');
  const [err, setErr]             = useState('');

  const loadStatus = () => {
    api.trainStatus().then(setStatus).catch(() => {});
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const searchWord = useCallback((targetWord) => {
    const w = (targetWord ?? query).trim().toLowerCase();
    if (!w) return;
    setActiveWord(w);
    setLoading(true); setErr('');
    Promise.allSettled([
      api.neighbors('word2vec', w, 10),
      api.neighbors('glove', w, 10),
    ]).then(([resW2v, resGlv]) => {
      if (resW2v.status === 'fulfilled') setW2vData(resW2v.value);
      if (resGlv.status === 'fulfilled') setGlvData(resGlv.value);
    }).finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    searchWord('hopeless');
  }, [searchWord]);

  const triggerTrain = (model) => {
    setTrainLoading(model); setTrainMsg(''); setErr('');
    api.train(model)
      .then(r => { setTrainMsg(r.message); loadStatus(); searchWord(activeWord); })
      .catch(e => setErr(e.message))
      .finally(() => setTrainLoading(null));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Semantic Embedding Lab"
        sub="Inspect how Word2Vec (skip-gram) and GloVe (co-occurrence) learn clinical language associations from unlabelled text."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Vocab: {status?.word2vec_vocab ?? 5093} words
            </span>
            <Btn variant="outline" size="sm" onClick={() => triggerTrain('all')} loading={trainLoading === 'all'}>
              <RefreshCw className="h-3 w-3" /> Retrain Embeddings
            </Btn>
          </div>
        }
      />

      {/* Global Seed Search Card */}
      <Card className="p-5 space-y-4">
        <div>
          <div className="text-[12px] font-semibold text-slate-900 mb-1">Clinical Vocabulary Seeds</div>
          <p className="text-[12px] text-slate-500">
            Click any clinical seed word to query its nearest geometric neighbors in both embedding spaces simultaneously:
          </p>
        </div>

        {/* Seed Chips */}
        <div className="flex flex-wrap gap-2">
          {SEED_WORDS.map(w => (
            <button
              key={w}
              onClick={() => { setQuery(w); searchWord(w); }}
              className={clsx(
                'text-[12px] font-mono px-3 py-1.5 rounded-lg border transition-all',
                activeWord === w
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
              )}>
              {w}
            </button>
          ))}
        </div>

        {/* Free-form input */}
        <div className="flex gap-2 pt-1">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchWord(query)}
            placeholder="Type any word to explore (e.g. insomnia, crying, overwhelmed)..."
            className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2 text-[13px] placeholder:text-slate-400 focus:outline-none focus:border-blue-500 bg-white"
          />
          <Btn onClick={() => searchWord(query)} disabled={!query.trim()} size="md">
            Compare Spaces
          </Btn>
        </div>

        {trainMsg && <p className="text-[12px] text-emerald-700 font-medium">{trainMsg}</p>}
        {err && <Err message={err} />}
      </Card>

      {/* Side-by-Side Neighbor Comparison */}
      <div className="grid md:grid-cols-2 gap-5">
        <ModelNeighborsCard
          model="word2vec"
          title="Word2Vec Skip-Gram"
          desc="Local context prediction: uses sliding window of 5 tokens with negative sampling."
          word={activeWord}
          data={w2vData}
          loading={loading}
          trained={status?.word2vec ?? true}
        />

        <ModelNeighborsCard
          model="glove"
          title="GloVe Matrix Factorization"
          desc="Global co-occurrence matrix: fits weighted least-squares on corpus log-counts."
          word={activeWord}
          data={glvData}
          loading={loading}
          trained={status?.glove ?? true}
        />
      </div>

      {/* Technical Insight Card */}
      <Card className="p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-blue-200/70 space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-blue-600" />
          <h4 className="text-[13px] font-semibold text-blue-950">Why Distributional Semantics Matter for Symptom Retrieval</h4>
        </div>
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Traditional keyword retrieval (like TF-IDF) only scores sentences that share the exact literal words of the clinician's query.
          When a patient writes <em>"I wake up at 3am and can't go back"</em>, a keyword query for <em>"insomnia"</em> produces zero matches.
          Because Word2Vec and GloVe map words appearing in similar psychiatric contexts (such as <em>tired, night, awake, exhaustion</em>) into adjacent vector regions,
          MoodTrace retrieves meaning-equivalent evidence passages without requiring human-curated synonym dictionaries.
        </p>
      </Card>
    </div>
  );
}
