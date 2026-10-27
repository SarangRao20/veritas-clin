import { useState } from 'react';
import { api } from '../api';
import { Panel, Btn, Err } from '../components/ui';

const MODELS = ['word2vec', 'glove', 'tfidf'];

const EXAMPLES = [
  { label: 'Depressive', text: "I feel completely empty and worthless. Nothing brings me joy anymore. I just want to disappear." },
  { label: 'Non-depressive', text: "Had a great workout today and feeling really energised. Going out for dinner with friends tonight." },
  { label: 'Ambiguous', text: "Feeling a bit tired lately and struggling to sleep. Work has been really stressful this month." },
];

function ResultBar({ label, value, isDepressive }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-700">{pct}%</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isDepressive ? 'bg-red-400' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
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

  const predict = () => {
    setLoading(true); setResult(null); setErr('');
    api.predict(text, model)
      .then(setResult)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const isDepressive = result?.label === 1;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Predict</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Enter any text and see how the trained model classifies it.
        </p>
      </div>

      <Panel title="Input">
        <div className="px-4 py-3 space-y-3">
          {/* Examples */}
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-zinc-400">Examples</div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button key={ex.label} onClick={() => setText(ex.text)}
                  className="text-[11px] border border-zinc-200 rounded px-2 py-0.5 text-zinc-600 hover:bg-zinc-50 transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Type or paste text here…"
            rows={4}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-[13px] text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-blue-400 font-sans leading-relaxed"
          />

          {/* Model selector */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400 shrink-0">Model</span>
            <div className="flex gap-1">
              {MODELS.map(m => (
                <button key={m} onClick={() => setModel(m)}
                  className={`px-2.5 py-1 rounded text-[12px] transition-colors ${
                    model === m
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}>
                  {m}
                </button>
              ))}
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
              <span className={`text-[22px] font-semibold font-mono ${
                isDepressive ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {result.label_name}
              </span>
              <span className="text-[12px] text-zinc-400">
                {(result.confidence * 100).toFixed(1)}% confidence
              </span>
            </div>

            {/* Probability bars */}
            <div className="space-y-2">
              <ResultBar label="depressive"     value={result.p_depressive}     isDepressive={true} />
              <ResultBar label="non-depressive" value={result.p_non_depressive} isDepressive={false} />
            </div>

            {/* Token stats */}
            <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100">
              {result.token_count} tokens after preprocessing ·{' '}
              {result.tokens_used} matched in {model} vocabulary
              {result.tokens_used < result.token_count * 0.5 && (
                <span className="ml-1 text-amber-600">
                  (low vocab coverage — result may be less reliable)
                </span>
              )}
            </div>
          </div>
        </Panel>
      )}

      <p className="text-[11px] text-zinc-400">
        This model was trained on Reddit posts and is not validated for clinical use.
        Do not use it to assess real patients.
      </p>
    </div>
  );
}
