import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const NAV = [
  { to: '/',           label: 'Overview',   end: true },
  { to: '/corpus',     label: 'Corpus' },
  { to: '/embeddings', label: 'Embeddings' },
  { to: '/evaluation', label: 'Evaluation' },
  { to: '/about',      label: 'About' },
];

function ApiDot() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let live = true;
    const check = () =>
      fetch('/health')
        .then((r) => { if (live) setOk(r.ok); })
        .catch(() => { if (live) setOk(false); });
    check();
    const t = setInterval(check, 20000);
    return () => { live = false; clearInterval(t); };
  }, []);

  if (ok === null) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-500' : 'bg-red-500')} />
      <span className="text-[11px] text-zinc-400">{ok ? 'API' : 'API offline'}</span>
    </span>
  );
}

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 flex items-center h-11 gap-4">
          {/* Wordmark */}
          <span className="text-[13px] font-semibold text-zinc-900 shrink-0">
            ClinNLP
          </span>
          <span className="text-[11px] text-zinc-300 hidden sm:inline shrink-0">|</span>
          <span className="text-[11px] text-zinc-400 hidden sm:inline shrink-0 truncate">
            Word2Vec · GloVe · Clinical classification
          </span>

          {/* Nav */}
          <nav className="flex items-center h-11 ml-auto overflow-x-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'h-full flex items-center px-3 text-[12px] border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-blue-600 text-zinc-900 font-medium'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-3 shrink-0">
            <ApiDot />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-5 py-7">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 mt-8">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <span className="text-[11px] text-zinc-400">
            Synthetic corpus · PICT NLP coursework · not for clinical use
          </span>
          <span className="text-[11px] text-zinc-300">FastAPI + React</span>
        </div>
      </footer>
    </div>
  );
}
