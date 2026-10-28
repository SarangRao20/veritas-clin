import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

/* ── Toast Context ───────────────────────────────────────────── */
const ToastCtx = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
};
const COLORS = {
  success: {
    bar: 'bg-emerald-500',
    icon: 'text-emerald-500',
    bg: 'bg-white',
    border: 'border-emerald-200',
    title: 'text-slate-900',
    msg: 'text-slate-500',
  },
  error: {
    bar: 'bg-red-500',
    icon: 'text-red-500',
    bg: 'bg-white',
    border: 'border-red-200',
    title: 'text-slate-900',
    msg: 'text-slate-500',
  },
  info: {
    bar: 'bg-blue-500',
    icon: 'text-blue-500',
    bg: 'bg-white',
    border: 'border-blue-200',
    title: 'text-slate-900',
    msg: 'text-slate-500',
  },
  warning: {
    bar: 'bg-amber-500',
    icon: 'text-amber-500',
    bg: 'bg-white',
    border: 'border-amber-200',
    title: 'text-slate-900',
    msg: 'text-slate-500',
  },
};

let _id = 0;

function ToastItem({ toast, onRemove }) {
  const c = COLORS[toast.type] || COLORS.info;
  const Icon = ICONS[toast.type] || Info;
  const dur = toast.duration ?? 4000;

  return (
    <div
      className={clsx(
        'animate-toast-in relative rounded-xl border shadow-lg overflow-hidden min-w-72 max-w-sm',
        c.bg, c.border,
      )}
    >
      {/* Progress bar */}
      <div
        className={clsx('absolute top-0 left-0 h-0.5', c.bar, 'toast-progress')}
        style={{ animationDuration: `${dur}ms` }}
      />

      <div className="flex items-start gap-3 px-4 py-3 pt-4">
        <Icon className={clsx('h-4.5 w-4.5 mt-0.5 shrink-0', c.icon)} />
        <div className="flex-1 min-w-0">
          <div className={clsx('text-[13px] font-semibold leading-snug', c.title)}>
            {toast.title}
          </div>
          {toast.message && (
            <p className={clsx('text-[12px] mt-0.5 leading-relaxed', c.msg)}>
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={() => { toast.action.fn(); onRemove(toast.id); }}
              className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-slate-300 hover:text-slate-600 transition-colors shrink-0 -mr-1 mt-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const remove = useCallback((id) => {
    setToasts(p => p.filter(t => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const push = useCallback(({ type = 'info', title, message, duration = 4000, action }) => {
    const id = ++_id;
    setToasts(p => [...p.slice(-4), { id, type, title, message, duration, action }]);
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {/* Toast Portal */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastCtx);
  if (!push) throw new Error('useToast must be inside ToastProvider');

  return {
    toast: push,
    success: (title, message, opts) => push({ type: 'success', title, message, ...opts }),
    error:   (title, message, opts) => push({ type: 'error',   title, message, ...opts }),
    info:    (title, message, opts) => push({ type: 'info',    title, message, ...opts }),
    warning: (title, message, opts) => push({ type: 'warning', title, message, ...opts }),
  };
}
