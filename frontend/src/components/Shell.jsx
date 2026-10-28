import { Outlet, NavLink, Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  FileText, Users, Workflow,
  Wifi, WifiOff, ShieldAlert
} from 'lucide-react';

const NAV = [
  { to: '/', icon: FileText, label: 'Note Review', end: true },
  { to: '/patients', icon: Users, label: 'Records', end: false },
  { to: '/pipeline', icon: Workflow, label: 'Pipeline', end: false },
];

function HealthDot() {
  const [ok, setOk] = useState(null);

  const check = useCallback(() => {
    fetch('/health')
      .then(r => setOk(r.ok))
      .catch(() => setOk(false));
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [check]);

  if (ok === null) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      {ok ? (
        <>
          <Wifi className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-teal-700">api connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5 text-red-600" />
          <span className="text-red-600">backend offline</span>
        </>
      )}
    </div>
  );
}

export default function Shell() {
  return (
    <div className="min-h-screen flex text-slate-900">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-56 z-40 flex flex-col border-r border-slate-200 bg-white select-none">
        {/* Brand */}
        <Link to="/" className="px-5 pt-6 pb-5 group focus-visible:outline-none">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-teal-600 shrink-0" />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Veritas<span className="text-teal-700">·Clin</span>
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            note review workbench
          </div>
        </Link>

        <div className="mx-5 border-t border-slate-200 mb-4" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5" aria-label="Main navigation">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-teal-50 text-teal-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="mt-auto px-5 pb-5 space-y-3">
          <HealthDot />
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Research prototype.<br />
                Synthetic data only.<br />
                Not for clinical use.
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 py-3 px-8 bg-white text-[11px] text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 font-mono">
            <span>Veritas-Clin · academic prototype · synthetic corpus</span>
            <span>extraction → NLI verification → calibrated abstention</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
