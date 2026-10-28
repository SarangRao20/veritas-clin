import clsx from 'clsx';

/**
 * Shared UI primitives — light, restrained clinical workbench style.
 */

export function Badge({ tone = 'slate', children, className }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-800 border-teal-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap',
        tones[tone] ?? tones.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };
  return (
    <svg
      className={clsx('animate-spin text-teal-600', sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
      role="status"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Err({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="font-semibold">Request failed</p>
        <p className="text-sm text-red-600 mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Minimal synthesis formatter: markdown headings/bold/italic/bullets to JSX.
 * Does not attempt full markdown — the backend produces limited formatting only.
 */
export function RichText({ text, className }) {
  if (!text) return null;
  const lines = String(text).split('\n');

  const inline = (line, keyBase) => {
    // Split on **bold** first
    const boldParts = line.split(/\*\*(.+?)\*\*/g);
    return boldParts.map((part, j) => {
      if (j % 2 === 1) {
        return <strong key={`${keyBase}-b${j}`} className="font-semibold text-slate-900">{part}</strong>;
      }
      // Then single *italic* within plain parts
      const italics = part.split(/\*(.+?)\*/g);
      return italics.map((sub, k) =>
        k % 2 === 1
          ? <em key={`${keyBase}-i${j}-${k}`} className="text-slate-500">{sub}</em>
          : <span key={`${keyBase}-t${j}-${k}`}>{sub}</span>
      );
    });
  };

  return (
    <div className={clsx('space-y-1.5', className)}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return (
            <p key={i} className="text-sm font-semibold text-slate-900 pt-1.5">
              {inline(trimmed.replace(/^#+\s*/, ''), `h${i}`)}
            </p>
          );
        }
        if (trimmed === '---') {
          return <div key={i} className="border-t border-slate-100 my-2" />;
        }
        const isBullet = /^[*•]\s+/.test(trimmed);
        const content = inline(isBullet ? trimmed.replace(/^[*•]\s+/, '') : line, `l${i}`);
        return isBullet
          ? <p key={i} className="text-sm text-slate-700 leading-relaxed pl-4 relative before:absolute before:left-0 before:text-slate-400 before:content-['•']">{content}</p>
          : trimmed
            ? <p key={i} className="text-sm text-slate-700 leading-relaxed">{content}</p>
            : <div key={i} className="h-1" />;
      })}
    </div>
  );
}
