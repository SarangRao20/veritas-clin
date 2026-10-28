import clsx from 'clsx';

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
  return <div className={clsx('skeleton', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4.5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

export function PatientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 animate-pulse">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-4 w-20 hidden md:block" />
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */
export function Card({ children, className, onClick }) {
  return (
    <div onClick={onClick}
      className={clsx(
        'bg-white rounded-xl border border-slate-200 shadow-sm',
        onClick && 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all',
        className,
      )}>
      {children}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, accent = false, tone = 'blue' }) {
  const tones = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100'    },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100'   },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100'  },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div className={clsx(
      'rounded-xl border px-5 py-4 flex items-start gap-4',
      accent ? 'bg-blue-600 border-blue-600 text-white' : `bg-white border-slate-200`,
    )}>
      {Icon && (
        <div className={clsx('mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0', accent ? 'bg-blue-500' : t.bg, t.border, 'border')}>
          <Icon className={clsx('h-4 w-4', accent ? 'text-white' : t.text)} />
        </div>
      )}
      <div>
        <div className={clsx('text-[11px] font-medium uppercase tracking-wider',
          accent ? 'text-blue-200' : 'text-slate-500')}>
          {label}
        </div>
        <div className={clsx('text-[24px] font-bold font-mono mt-0.5 leading-none animate-count',
          accent ? 'text-white' : 'text-slate-900')}>
          {value}
        </div>
        {sub && <div className={clsx('text-[11px] mt-1', accent ? 'text-blue-200' : 'text-slate-400')}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Badge ────────────────────────────────────────────────────────── */
const BADGE = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  purple:  'bg-purple-50 text-purple-700 border-purple-200',
};

export function Badge({ tone = 'slate', children, dot }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] font-medium',
      BADGE[tone],
    )}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full',
        tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' :
        tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500')} />}
      {children}
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────────── */
export function Btn({ children, onClick, disabled, loading, variant = 'primary', size = 'md', className }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-[12px]', md: 'px-4 py-2 text-[13px]', lg: 'px-6 py-2.5 text-[14px]' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost:   'text-slate-600 hover:bg-slate-100',
    danger:  'bg-red-600 text-white hover:bg-red-700',
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
import { AlertCircle, RefreshCw } from 'lucide-react';
export function Err({ message, onRetry, dismissible, onDismiss }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-[12px] text-red-700 animate-slide-bottom">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
        <div>
          <div className="font-semibold text-red-800 mb-0.5">Something went wrong</div>
          <span className="text-red-600">{message ?? 'An unexpected error occurred.'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:text-red-900 border border-red-200 bg-white/80 hover:bg-white px-2 py-1 rounded-md transition-colors">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
        {dismissible && (
          <button onClick={onDismiss} className="text-red-400 hover:text-red-600">×</button>
        )}
      </div>
    </div>
  );
}

/* ── Section header ───────────────────────────────────────────────── */
export function SectionHeader({ title, sub, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-slate-500 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Risk bar ─────────────────────────────────────────────────────── */
export function RiskBar({ value, showLabel = true }) {
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? 'bg-red-500' : pct >= 35 ? 'bg-amber-400' : 'bg-emerald-400';
  const label = pct >= 60 ? 'High' : pct >= 35 ? 'Moderate' : 'Low';
  const tone  = pct >= 60 ? 'red'  : pct >= 35 ? 'amber'    : 'emerald';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <Badge tone={tone}>{label}</Badge>}
    </div>
  );
}

/* ── Score chip ───────────────────────────────────────────────────── */
export function ScoreChip({ score }) {
  const v = Math.round(score * 100);
  const color = v >= 70 ? 'bg-emerald-100 text-emerald-700' : v >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return (
    <span className={clsx('inline-block font-mono text-[11px] rounded px-1.5 py-0.5 font-semibold', color)}>
      {v}%
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
export function Empty({ icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      {icon && <div className="text-4xl mb-4 opacity-60">{icon}</div>}
      <div className="text-[15px] font-semibold text-slate-700">{title}</div>
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
      {label && <span className="w-24 truncate text-slate-500 shrink-0 font-mono">{label}</span>}
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-slate-600 font-mono shrink-0">{value.toFixed(3)}</span>
    </div>
  );
}

/* ── Confusion matrix cell ────────────────────────────────────────── */
export function CMCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = `rgba(37,99,235,${(intensity * 0.75).toFixed(2)})`;
  return (
    <td className="text-center text-[12px] font-mono px-3 py-2 border border-slate-100 transition-colors"
      style={{ backgroundColor: bg, color: intensity > 0.5 ? '#fff' : '#1e293b', minWidth: '3rem' }}>
      {value}
    </td>
  );
}

/* ── Animated metric bar ─────────────────────────────────────────── */
export function MetricBar({ label, value, best = false }) {
  const pct = Math.round(value * 100);
  const color = best ? 'bg-blue-600' : 'bg-slate-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={clsx('font-medium', best ? 'text-blue-700' : 'text-slate-600')}>{label}</span>
        <span className={clsx('font-mono font-bold', best ? 'text-blue-700' : 'text-slate-700')}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
  date: (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
};
