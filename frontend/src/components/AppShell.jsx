import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { getHealth } from '../api';
import { Spinner } from './ui';

const NAV = [
  { to: '/', label: 'Encounters', end: true },
  { to: '/audit', label: 'Audit' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/nlp-lab', label: 'NLP foundations' },
  { to: '/settings', label: 'Settings' },
  { to: '/viva-guide', label: 'Viva guide' },
];

function EngineStatus() {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const probe = () =>
      getHealth()
        .then((h) => alive && (setHealth(h), setFailed(false)))
        .catch(() => alive && setFailed(true));
    probe();
    const t = setInterval(probe, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-[11px] text-zinc-500">API offline</span>
      </span>
    );
  }
  if (!health) return <Spinner label="Checking API" />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-[11px] text-zinc-500">
        {health.extractor} extractor · NLI {health.extractor === 'hf' ? 'ready' : 'not loaded'}
      </span>
    </span>
  );
}

/** Top navigation bar + content column. Replaces the old fixed sidebar. */
export default function AppShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 flex items-center h-12 gap-3">
          <NavLink to="/" className="text-[13px] font-semibold text-zinc-900 whitespace-nowrap">
            Veritas-Clin
          </NavLink>
          <span className="text-[11px] text-zinc-400 whitespace-nowrap hidden lg:inline">
            Evidence-grounded clinical extraction
          </span>
          <nav className="ml-2 min-w-0 flex items-center gap-1 h-12 overflow-x-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'h-full flex items-center px-3 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-blue-600 text-zinc-900 font-medium'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto shrink-0">
            <EngineStatus />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
      </main>
      <footer className="max-w-6xl mx-auto w-full px-6 py-4 text-[11px] text-zinc-400">
        Backend: FastAPI (serve.py) · the NLI cross-encoder loads only in the HF runtime ·
        benchmark artifacts served from /artifacts
      </footer>
    </div>
  );
}
