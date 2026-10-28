import clsx from 'clsx';
import { AlertCircle, RefreshCw } from 'lucide-react';

/* ── Spinner ──────────────────────────────────────────────────────── */
export function Spinner({ size = 'sm', color = 'blue', className }) {
  const sizes = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };
  const colors = { blue: 'text-blue-500', white: 'text-white', slate: 'text-slate-400' };
  return (
    <svg className={clsx('animate-spin', sizes[size], colors[color], className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────── */
export function Skeleton({ className }) {
  return <div className={clsx('bg-slate-800/60 animate-pulse rounded-lg', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-[#0e1524] rounded-2xl border border-slate-800 p-5 space-y-3.5 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function PatientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-800 animate-pulse">
      <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-24 hidden md:block" />
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */
export function Card({ children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-[#0e1524] rounded-2xl border border-slate-800/90 text-slate-100 shadow-md',
        onClick && 'cursor-pointer hover:border-blue-500 hover:shadow-xl transition-all',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, accent = false, tone = 'blue' }) {
  const tones = {
    blue:    { bg: 'bg-blue-950/60',    text: 'text-blue-400',    border: 'border-blue-800/60'    },
    emerald: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60' },
    amber:   { bg: 'bg-amber-950/60',   text: 'text-amber-400',   border: 'border-amber-800/60'   },
    violet:  { bg: 'bg-violet-950/60',  text: 'text-violet-400',  border: 'border-violet-800/60'  },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div className={clsx(
      'rounded-2xl border px-5 py-4 flex items-start gap-4 transition-all',
      accent ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-[#0e1524] border-slate-800/90',
    )}>
      {Icon && (
        <div className={clsx('mt-1 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border', accent ? 'bg-blue-500 border-blue-400' : t.bg, t.border)}>
          <Icon className={clsx('h-4.5 w-4.5', accent ? 'text-white' : t.text)} />
        </div>
      )}
      <div>
        <div className={clsx('text-[11px] font-bold uppercase tracking-wider',
          accent ? 'text-blue-200' : 'text-slate-400')}>
          {label}
        </div>
        <div className={clsx('text-[24px] font-black font-mono mt-1 leading-none',
          accent ? 'text-white' : 'text-white')}>
          {value}
        </div>
        {sub && <div className={clsx('text-[11px] mt-1', accent ? 'text-blue-200' : 'text-slate-500')}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Badge ────────────────────────────────────────────────────────── */
const BADGE = {
  blue:    'bg-blue-950/80 text-blue-300 border-blue-800',
  emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
  amber:   'bg-amber-950/80 text-amber-300 border-amber-800',
  red:     'bg-red-950/80 text-red-300 border-red-800',
  slate:   'bg-slate-900 text-slate-300 border-slate-800',
  violet:  'bg-violet-950/80 text-violet-300 border-violet-800',
  purple:  'bg-purple-950/80 text-purple-300 border-purple-800',
};

export function Badge({ tone = 'slate', children, dot }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
      BADGE[tone] || BADGE.slate,
    )}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full',
        tone === 'red' ? 'bg-red-400' : tone === 'amber' ? 'bg-amber-400' :
        tone === 'emerald' ? 'bg-emerald-400' : 'bg-blue-400')} />}
      {children}
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────────── */
export function Btn({ children, onClick, disabled, loading, variant = 'primary', size = 'md', className }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const sizes = { sm: 'px-3 py-1.5 text-[12px]', md: 'px-4 py-2 text-[13px]', lg: 'px-6 py-2.5 text-[14px]' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20',
    outline: 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:border-slate-600',
    ghost:   'text-slate-400 hover:text-white hover:bg-slate-800',
    danger:  'bg-red-600 text-white hover:bg-red-500',
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={clsx(base, sizes[size], variants[variant], className)}>
      {loading && <Spinner size="sm" color={variant === 'primary' ? 'white' : 'blue'} />}
      {children}
    </button>
  );
}

/* ── Error ────────────────────────────────────────────────────────── */
export function Err({ message, onRetry, dismissible, onDismiss }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-red-900/80 bg-red-950/40 rounded-2xl px-4 py-3 text-[12px] text-red-300 animate-slide-bottom">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
        <div>
          <div className="font-bold text-red-200 mb-0.5">Clinical Engine Notice</div>
          <span className="text-red-400">{message ?? 'An unexpected error occurred.'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1 text-[11px] font-bold text-red-300 hover:text-white border border-red-800 bg-red-900/60 hover:bg-red-900 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
        {dismissible && (
          <button onClick={onDismiss} className="text-red-400 hover:text-white cursor-pointer">×</button>
        )}
      </div>
    </div>
  );
}

/* ── Section header ───────────────────────────────────────────────── */
export function SectionHeader({ title, sub, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[24px] font-black text-white leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-slate-400 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Score chip ───────────────────────────────────────────────────── */
export function ScoreChip({ score }) {
  const v = Math.round(score * 100);
  const color = v >= 70 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' :
                v >= 50 ? 'bg-blue-950/80 text-blue-300 border border-blue-800' :
                          'bg-slate-900 text-slate-400 border border-slate-800';
  return (
    <span className={clsx('inline-block font-mono text-[11px] rounded-md px-2 py-0.5 font-bold', color)}>
      {v}%
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
export function Empty({ icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      {icon && <div className="text-4xl mb-4 opacity-60">{icon}</div>}
      <div className="text-[15px] font-bold text-slate-200">{title}</div>
      {sub && <div className="mt-1.5 text-[13px] text-slate-400 max-w-xs leading-relaxed">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Mini bar (embedding vis) ─────────────────────────────────────── */
export function MiniBar({ label, value, max = 1 }) {
  const pct = Math.min(100, (Math.abs(value) / (max || 1)) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {label && <span className="w-24 truncate text-slate-400 shrink-0 font-mono">{label}</span>}
      <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-slate-300 font-mono shrink-0">{value.toFixed(3)}</span>
    </div>
  );
}

/* ── Confusion matrix cell ────────────────────────────────────────── */
export function CMCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = `rgba(37,99,235,${(intensity * 0.75).toFixed(2)})`;
  return (
    <td className="text-center text-[12px] font-mono px-3 py-2 border border-slate-800 transition-colors"
      style={{ backgroundColor: bg, color: intensity > 0.5 ? '#fff' : '#cbd5e1', minWidth: '3rem' }}>
      {value}
    </td>
  );
}

/* ── Animated metric bar ─────────────────────────────────────────── */
export function MetricBar({ label, value, best = false }) {
  const pct = Math.round(value * 100);
  const color = best ? 'bg-blue-500' : 'bg-slate-600';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={clsx('font-medium', best ? 'text-blue-300' : 'text-slate-400')}>{label}</span>
        <span className={clsx('font-mono font-bold', best ? 'text-blue-300' : 'text-slate-300')}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const fmt = {
  pct:  (x, d = 1) => `${(x * 100).toFixed(d)}%`,
  f:    (x, d = 3) => Number(x).toFixed(d),
  date: (d) => {
    if (!d) return '—';
    try {
      const parsed = new Date(d);
      return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  },
};
