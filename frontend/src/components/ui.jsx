/**
 * UI primitives.
 *
 * Design rules:
 *  - zinc neutrals only for chrome; blue-600 is the single accent
 *  - white panels, 1px zinc-200 border, rounded-md
 *  - type: 11 (meta/labels), 12 (secondary), 13 (data/body), 20 (page title)
 *  - mono for numbers and identifiers
 *  - no color for decoration — color only carries meaning
 */
import clsx from 'clsx';

/* ── Stat block ─────────────────────────────────────────────────────────── */
export function Stat({ label, value, sub, mono = true }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-md px-4 py-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 truncate">{label}</div>
      <div className={clsx('mt-1 text-[22px] font-semibold leading-tight text-zinc-900', mono && 'font-mono')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-400 truncate">{sub}</div>}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
export function Panel({ title, sub, actions, children, className }) {
  return (
    <section className={clsx('bg-white border border-zinc-200 rounded-md min-w-0', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-200">
          <div className="min-w-0">
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

/* ── Page header ─────────────────────────────────────────────────────────── */
export function PageHeader({ title, sub }) {
  return (
    <div className="mb-6">
      <h1 className="text-[20px] font-semibold text-zinc-900 leading-tight">{title}</h1>
      {sub && <p className="mt-1 text-[13px] text-zinc-500 max-w-2xl leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 'sm' }) {
  return (
    <svg
      className={clsx('animate-spin text-zinc-400', size === 'sm' ? 'h-4 w-4' : 'h-6 w-6')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ── Error inline ────────────────────────────────────────────────────────── */
export function Err({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 rounded-md px-3 py-2 text-[12px] text-red-700">
      <span>{message ?? 'Request failed.'}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline underline-offset-2 hover:no-underline shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}

/* ── Tag / badge ─────────────────────────────────────────────────────────── */
const TAG_STYLES = {
  zinc:    'bg-zinc-100 text-zinc-600',
  blue:    'bg-blue-50  text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber:   'bg-amber-50 text-amber-700',
  red:     'bg-red-50 text-red-700',
};

export function Tag({ tone = 'zinc', children }) {
  return (
    <span className={clsx('inline-block rounded px-1.5 py-0.5 text-[11px] font-medium', TAG_STYLES[tone])}>
      {children}
    </span>
  );
}

/* ── Button ──────────────────────────────────────────────────────────────── */
export function Btn({ children, onClick, disabled, loading, variant = 'primary', className }) {
  const base = 'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    ghost:   'bg-transparent text-zinc-600 hover:bg-zinc-100',
    outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(base, styles[variant], className)}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/* ── Mini bar (for vector component visualization) ───────────────────────── */
export function MiniBar({ value, max = 1, label }) {
  const pct = Math.min(100, (Math.abs(value) / (max || 1)) * 100);
  const neg = value < 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {label && <span className="w-20 truncate text-zinc-500 shrink-0 font-mono">{label}</span>}
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', neg ? 'bg-amber-400' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-zinc-600 font-mono shrink-0">
        {value.toFixed(3)}
      </span>
    </div>
  );
}

/* ── Confusion matrix cell ───────────────────────────────────────────────── */
export function CMCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = `rgba(37,99,235,${(intensity * 0.7).toFixed(2)})`;
  const fg = intensity > 0.55 ? '#fff' : '#18181b';
  return (
    <td
      className="text-center text-[12px] font-mono px-2 py-1.5 border border-zinc-100 transition-colors"
      style={{ backgroundColor: bg, color: fg, minWidth: '2.5rem' }}
    >
      {value}
    </td>
  );
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
export function Divider() {
  return <hr className="border-t border-zinc-200 my-4" />;
}

/* ── Number formatter ────────────────────────────────────────────────────── */
export const fmt = {
  pct: (x, d = 1) => `${(x * 100).toFixed(d)}%`,
  num: (x) => Number(x).toLocaleString('en-US'),
  f: (x, d = 3) => Number(x).toFixed(d),
};
