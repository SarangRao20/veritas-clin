import { useEffect, useState } from 'react';
import { api } from '../api';
import { Spinner, Badge } from '../components/ui';

/**
 * Pipeline page — shows the ACTUAL architecture and measured results.
 * No invented metrics; results come from /api/results when available,
 * otherwise honest static architecture explanation.
 */

const ARCHITECTURE = [
  {
    step: '1',
    title: 'Extraction',
    body: 'Candidate findings are pulled from note sentences — a zero-shot 3B model or, when it is unavailable, the heuristic baseline. Each candidate claims a span in the source text.',
  },
  {
    step: '2',
    title: 'NLI verification',
    body: 'Every claim is re-checked against the sentence it came from. Does that sentence actually support the claim, or is it negating it, or silent on it?',
  },
  {
    step: '3',
    title: 'Calibration & policy',
    body: 'A score combines entailment probability and token confidence. A threshold τ*, learned on dev data, decides whether the claim is accepted, flagged for human review, or dropped.',
  },
  {
    step: '4',
    title: 'Abstention',
    body: 'When evidence is missing, contradictory, or weak, the system says so. An explicit abstain is treated as a valid, sometimes correct, output.',
  },
];

const FLOW = [
  'note sentence',
  '→ candidate claim + source span',
  '→ NLI: claim vs. source',
  '→ score = 0.8·p_entail + 0.2·token_conf',
  '→ compare against τ*',
  '→ accept / flag_for_review / abstain',
];

export default function PipelinePage() {
  const [results, setResults] = useState(null);
  const [resultsError, setResultsError] = useState(false);

  useEffect(() => {
    api.results().then(setResults).catch(() => setResultsError(true));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-8 py-8 space-y-10">
      {/* Header */}
      <header className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipeline</h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
          What this prototype actually does — extraction, source-span anchoring,
          NLI verification, and calibrated abstention. Everything below reflects
          the running code, not aspirational features.
        </p>
      </header>

      {/* Architecture steps */}
      <section className="space-y-3" aria-label="Pipeline architecture">
        {ARCHITECTURE.map(({ step, title, body }) => (
          <div key={step} className="flex gap-4 bg-white border border-slate-200 rounded-lg p-5">
            <div className="shrink-0 h-7 w-7 rounded-full bg-teal-700 text-white text-xs font-bold flex items-center justify-center">
              {step}
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Compact flow */}
      <section aria-label="Decision flow">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">One-line flow</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-2 text-sm">
          {FLOW.map((f, i) => (
            <span key={i} className={i % 2 === 0 ? 'font-mono text-slate-600' : 'text-teal-700 font-medium'}>
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* Measured results (if backend exposes them) */}
      <section aria-label="Measured results">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Measured results</h2>
        {resultsError ? (
          <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-4">
            Evaluation metrics are not available right now — start the backend to load /api/results.
          </p>
        ) : !results ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <ResultsTables data={results} />
        )}
      </section>

      {/* Honest limitations */}
      <section aria-label="Limitations">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Known limitations</h2>
        <ul className="space-y-2 text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-5">
          <li className="flex gap-2">
            <Badge tone="amber" className="shrink-0 h-5">data</Badge>
            <span className="leading-relaxed">Corpus is hand-authored synthetic text — results demonstrate mechanism, not clinical performance.</span>
          </li>
          <li className="flex gap-2">
            <Badge tone="amber" className="shrink-0 h-5">scope</Badge>
            <span className="leading-relaxed">Depression-focused categories; generalise with caution outside that frame.</span>
          </li>
          <li className="flex gap-2">
            <Badge tone="amber" className="shrink-0 h-5">privacy</Badge>
            <span className="leading-relaxed">De-identification is heuristic; recognisable identifiers may be missed. Not a HIPAA Safe Harbor guarantee.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function ResultsTables({ data }) {
  if (!data) return null;
  const modelResults = Array.isArray(data.results) ? data.results : [];
  const scalarEntries = Object.entries(data).filter(
    ([k, v]) => k !== 'results' && !Array.isArray(v) && typeof v !== 'object'
  );

  return (
    <div className="space-y-4">
      {/* Dataset basics */}
      {scalarEntries.length > 0 && (
        <dl className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {scalarEntries.map(([key, value]) => (
            <div key={key} className="px-5 py-2.5 flex items-baseline gap-4">
              <dt className="text-xs font-mono text-slate-500 w-40 shrink-0">{key}</dt>
              <dd className="text-sm text-slate-800 font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Model comparison */}
      {modelResults.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Model comparison</h3>
          {modelResults.map((r) => (
            <div key={r.model} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-slate-800">{r.model}</span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  F1 {Math.round((r.f1 ?? r.macro_f1 ?? 0) * 1000) / 10}% · acc {Math.round((r.accuracy ?? 0) * 1000) / 10}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-600"
                  style={{ width: `${Math.max(Math.round((r.f1 ?? r.macro_f1 ?? 0) * 100), 2)}%` }}
                  role="img" aria-label={`${r.model} F1 score`}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 pt-1">
            Synthetic Reddit-style corpus — these numbers exercise the pipeline, not clinical performance.
          </p>
        </div>
      )}

      {/* Everything else as compact key-value */}
      {Object.entries(data)
        .filter(([k, v]) => k !== 'results' && (Array.isArray(v) || typeof v === 'object'))
        .map(([key, value]) => (
          <div key={key} className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-xs font-mono text-slate-500 mb-2">{key}</h3>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(value) ? value : [value]).map((s, i) => (
                <span key={i} className="text-xs font-mono bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 break-all">
                  {typeof s === 'string' ? s : JSON.stringify(s)}
                </span>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
