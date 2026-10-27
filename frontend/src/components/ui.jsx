/** Shared UI primitives. Small set, used by every page for consistency.
 *
 * Design contract (see frontend/README.md):
 * - neutrals only (zinc) for chrome; one blue accent; color labels clinical state
 * - white panels, 1px zinc-200 border, 6px radius, no top accent bars, no gradients
 * - type scale: 11 (fine print) / 12 (labels, meta) / 13 (data) / 14 (body) / 16 / 20 (page h1)
 * - mono reserved for identifiers and numeric scores
 */
import React from 'react';
import clsx from 'clsx';

const CHIP_TONES = {
  zinc: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

export function Chip({ tone = 'zinc', dot = false, children, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 border rounded px-1.5 py-0.5 text-[11px] font-medium',
        CHIP_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export const DECISION_LABELS = {
  accept: { tone: 'emerald', label: 'Auto-accepted' },
  flag_for_review: { tone: 'amber', label: 'Physician review' },
  abstain: { tone: 'zinc', label: 'Held back' },
};

export function DecisionChip({ decision }) {
  const d = DECISION_LABELS[decision] ?? { tone: 'zinc', label: decision };
  return <Chip tone={d.tone} dot>{d.label}</Chip>;
}

const TYPE_LABELS = { diagnosis: 'Diagnosis', medication: 'Medication', followup: 'Follow-up' };

export function TypeChip({ type }) {
  const tone = { diagnosis: 'blue', medication: 'emerald', followup: 'amber' }[type] ?? 'zinc';
  return <Chip tone={tone}>{TYPE_LABELS[type] ?? type}</Chip>;
}

/** Minimal flat panel. */
export function Panel({ title, sub, actions, children, className }) {
  return (
    <section className={clsx('min-w-0 bg-white border border-zinc-200 rounded-md', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-200">
          <div>
            {title && <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12px] text-zinc-500">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-md px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-[20px] font-semibold text-zinc-900 leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-zinc-500">{sub}</div>}
    </div>
  );
}

/** Horizontal score bar with a tick marking the decision threshold tau*. */
export function ScoreBar({ score, threshold }) {
  return (
    <div className="relative h-1.5 w-24 rounded-full bg-zinc-200" title={`score ${score} · tau* ${threshold}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-blue-600"
        style={{ width: `${Math.min(100, score * 100)}%` }}
      />
      {threshold > 0 && threshold < 1 && (
        <div
          className="absolute inset-y-[-3px] w-px bg-zinc-500"
          style={{ left: `${threshold * 100}%` }}
        />
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub }) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">{eyebrow}</div>
      )}
      <h1 className="text-[20px] font-semibold text-zinc-900">{title}</h1>
      {sub && <p className="mt-1 text-[13px] text-zinc-500 max-w-3xl">{sub}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-zinc-500">
      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </span>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 rounded-md px-3 py-2 text-[12px] text-red-700">
      <span>{error?.message ?? 'Request failed'}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

/** Central number formatting so every page looks identical. */
export const fmt = {
  pct(x, digits = 1) {
    return `${(x * 100).toFixed(digits)}%`;
  },
  num(x) {
    return Number(x).toLocaleString('en-US');
  },
  round(x, digits = 4) {
    return Number(x).toFixed(digits);
  },
};
