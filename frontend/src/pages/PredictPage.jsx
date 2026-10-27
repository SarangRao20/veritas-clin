import { useState, useEffect } from 'react';
import { api } from '../api';
import { Panel, Btn, Err, Tag } from '../components/ui';

const MODELS = ['word2vec', 'glove', 'tfidf'];

const EXAMPLES = [
  { label: 'Depressive',     tone: 'red',     text: "I feel completely empty and worthless. Nothing brings me joy anymore. I just want to disappear and stop existing." },
  { label: 'Non-depressive', tone: 'emerald', text: "Had a great workout today and feeling really energised. Going out for dinner with friends tonight, really looking forward to it." },
  { label: 'Ambiguous',      tone: 'amber',   text: "Feeling a bit tired lately and struggling to sleep. Work has been really stressful this month and I'm not sure how to cope." },
];

function ProbBar({ label, value, color }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-700">{pct}%</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PredictPage() {
  const [text, setText]   = useState('');
  const [model, setModel] = useState('word2vec');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.trainStatus().then(setStatus).catch(() => {});
  }, []);

  const predict = () => {
    setLoading(true); setResult(null); setErr('');
    api.predict(text, model)
      .then(setResult)
      .catch(e => {
        // Parse the FastAPI error detail if JSON
        let msg = e.message;
        try { msg = JSON.parse(msg).detail ?? msg; } catch {}
        setErr(msg);
      })
      .finally(() => setLoading(false));
  };

  const notTrained = status && !status.word2vec && !status.glove;
  const isDepressive = result?.label === 1;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Predict</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Enter any text and see how the trained model classifies it.
        </p>
      </div>

      {notTrained && (
        <div className="border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-[12px] text-amber-800">
          No models trained yet. Go to <a href="/explore" className="underline">Explore</a> and train Word2Vec or GloVe first.
        </div>
      )}

      <Panel title="Input">
        <div className="px-4 py-3 space-y-3">
          {/* Example buttons */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-zinc-400">Try an example</div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button key={ex.label}
                  onClick={() => { setText(ex.text); setResult(null); setErr(''); }}
                  className={`text-[11px] border rounded px-2 py-0.5 transition-colors ${
                    text === ex.text
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setResult(null); setErr(''); }}
            placeholder="Type or paste text here…"
            rows={4}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-[13px] text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-blue-400 leading-relaxed"
          />

          {/* Model + classify */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400 shrink-0">Model</span>
            <div className="flex gap-1">
              {MODELS.map(m => {
                const available = m === 'tfidf' ? !!status?.word2vec || !!status?.glove : !!status?.[m];
                return (
                  <button key={m} onClick={() => setModel(m)} disabled={!available}
                    title={!available ? `${m} not trained` : undefined}
                    className={`px-2.5 py-1 rounded text-[12px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                      model === m
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}>
                    {m}
                  </button>
                );
              })}
            </div>
            <Btn onClick={predict} loading={loading} disabled={!text.trim()}>
              Classify
            </Btn>
          </div>

          {err && <Err message={err} />}
        </div>
      </Panel>

      {/* Result */}
      {result && (
        <Panel title="Result">
          <div className="px-4 py-4 space-y-4">
            {/* Verdict */}
            <div className="flex items-center gap-3">
              <span className={`text-[24px] font-semibold font-mono ${isDepressive ? 'text-red-600' : 'text-emerald-600'}`}>
                {result.label_name}
              </span>
              <Tag tone={isDepressive ? 'red' : 'emerald'}>
                {(result.confidence * 100).toFixed(1)}% confidence
              </Tag>
            </div>

            {/* Probability bars */}
            <div className="space-y-2">
              <ProbBar label="depressive"     value={result.p_depressive}     color="bg-red-400" />
              <ProbBar label="non-depressive" value={result.p_non_depressive} color="bg-emerald-400" />
            </div>

            {/* Token coverage note */}
            <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
              {result.token_count} tokens after preprocessing ·{' '}
              {result.tokens_used} matched in {model} vocabulary
              {result.tokens_used < result.token_count * 0.4 && (
                <span className="ml-1 text-amber-600">
                  — low vocab coverage, result less reliable
                </span>
              )}
            </div>
          </div>
        </Panel>
      )}

      <p className="text-[11px] text-zinc-400">
        Trained on Reddit posts · not validated for clinical use · do not use to assess real patients.
      </p>
    </div>
  );
}
