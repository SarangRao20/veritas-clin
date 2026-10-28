import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Spinner, Err, Badge, fmtDate } from '../components/ui';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

/**
 * Patient detail — longitudinal symptom evidence timeline.
 * Shows the actual backend response shape: per-date top-matching sentence
 * for each tracked symptom, plus DSM-5 2-week persistence computed from data.
 */

function ScorePill({ score }) {
  const pct = Math.round(score * 100);
  return (
    <span className={clsx(
      'font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded border shrink-0',
      pct >= 50
        ? 'bg-teal-50 text-teal-700 border-teal-200'
        : 'bg-slate-50 text-slate-500 border-slate-200'
    )}>
      {pct}%
    </span>
  );
}

export default function PatientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.timeline(id)
      .then(setData)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-4">
        <button
          onClick={() => navigate('/patients')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All records
        </button>
        <Err message={error} onRetry={() => { setError(''); api.timeline(id).then(setData).catch(e => setError(e.message)); }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-16 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const { patient, timeline, symptoms, persistence } = data;

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
      {/* Back + header */}
      <button
        onClick={() => navigate('/patients')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All records
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {patient.name ?? id}
          </h1>
          <p className="text-xs font-mono text-slate-400">
            {patient.id}{patient.age ? ` · ${patient.age} yrs` : ''}{patient.gender ? ` · ${patient.gender}` : ''}
          </p>
        </div>
        <Badge tone="blue">MTSamples record (public domain)</Badge>
      </header>

      {/* Persistence summary */}
      <section className="space-y-3" aria-label="Symptom persistence">
        <h2 className="text-sm font-semibold text-slate-900">
          Symptom persistence across notes
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
          Compute per-note matching for each tracked symptom. Persistence shows date
          span only — DSM-5 “2-week” flags come from the data, not a clinical judgment.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {symptoms.map(sym => {
            const p = persistence[sym];
            if (!p) return null;
            return (
              <div key={sym} className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 capitalize truncate">{sym.replace(/_/g, ' ')}</span>
                  {p.dsm5_persistent
                    ? <Badge tone="amber">2+ wks</Badge>
                    : <Badge tone="slate">isolated</Badge>}
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {p.count} {p.count === 1 ? 'note' : 'notes'}
                  {p.span_days > 0 && ` · over ${p.span_days} days`}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Timeline */}
      <section className="space-y-3" aria-label="Timeline">
        <h2 className="text-sm font-semibold text-slate-900">
          Date-by-date evidence
        </h2>
        {timeline.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-white text-slate-500 text-sm">
            No timeline entries available.
          </div>
        ) : (
          <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {timeline.map((entry, i) => {
              const matched = Object.entries(entry.symptoms ?? {});
              return (
                <li key={entry.note_id ?? i} className="relative pl-7">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-white ring-1',
                      matched.length > 0
                        ? 'bg-teal-600 ring-teal-600/30'
                        : 'bg-slate-300 ring-slate-300/50'
                    )}
                  />
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                      <span className="font-semibold text-slate-700">{fmtDate(entry.date)}</span>
                      <span className="text-slate-400">·</span>
                      <span>{entry.note_id}</span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {matched.length > 0 ? `${matched.length} symptom match${matched.length === 1 ? '' : 'es'}` : 'no symptom match'}
                      </span>
                    </div>

                    {matched.length > 0 && (
                      <div className="space-y-2">
                        {matched.map(([sym, hit]) => (
                          <div key={sym} className="flex gap-2.5 items-start">
                            <span className="text-[11px] font-medium text-slate-600 capitalize w-24 shrink-0 pt-0.5">
                              {sym.replace(/_/g, ' ')}
                            </span>
                            <ScorePill score={hit.score} />
                            <p className="text-xs text-slate-600 font-serif leading-relaxed italic flex-1 min-w-0">
                              “{hit.sentence}”
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
