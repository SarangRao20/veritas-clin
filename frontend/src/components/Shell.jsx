import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Activity, FileSearch, LogOut, Menu, Settings, ShieldAlert,
  User, X,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function HealthDot({ health }) {
  if (!health) return null;
  const ok = health.status === 'ok';
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
        title={ok ? 'Backend healthy' : 'Backend error'}
      />
      {health.llm_enabled && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
          <Activity className="h-3 w-3" />
          {health.llm_provider} AI
        </span>
      )}
    </div>
  );
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  const ROLE_COLORS = {
    admin: 'bg-purple-100 text-purple-800',
    clinician: 'bg-teal-100 text-teal-800',
    viewer: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:bg-slate-100 transition-colors"
        aria-label="Open user menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
          {initials}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.username}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            {user?.role && (
              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-slate-100'}`}>
                {user.role}
              </span>
            )}
          </div>
          <div className="py-1">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                Admin panel
              </Link>
            )}
          </div>
          <div className="border-t border-slate-100 py-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_LINK_CLASS = ({ isActive }) =>
  `text-sm font-medium transition-colors px-1 py-0.5 border-b-2 ${
    isActive
      ? 'border-teal-700 text-teal-700'
      : 'border-transparent text-slate-600 hover:text-slate-900'
  }`;

export default function Shell() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/patients" className="flex items-center gap-2 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
              <FileSearch className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:block text-sm font-bold tracking-tight text-slate-900">
              Veritas-Clin
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-5 ml-4">
            <NavLink to="/patients" className={NAV_LINK_CLASS}>Patient Hub</NavLink>
            <NavLink to="/workbench" className={NAV_LINK_CLASS}>All Reports</NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={NAV_LINK_CLASS}>Admin</NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <HealthDot health={health} />
            <UserMenu user={user} logout={logout} />

            {/* Mobile hamburger */}
            <button
              className="sm:hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              onClick={() => setDrawerOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            <NavLink
              to="/patients"
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`
              }
            >
              Patient Hub
            </NavLink>
            <NavLink
              to="/workbench"
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`
              }
            >
              All Reports
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`
              }
            >
              Profile
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`
                }
              >
                Admin panel
              </NavLink>
            )}
            <button
              onClick={() => { setDrawerOpen(false); logout(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mx-auto flex max-w-7xl items-start gap-2 border-t border-slate-200 px-4 py-4 text-xs leading-relaxed text-slate-500 sm:px-6 lg:px-8">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        Academic NLP prototype — not for clinical use. Not assessed for HIPAA compliance; do not upload real patient records or protected health information (PHI). Synthetic demo documents are entirely fictional.
      </footer>
    </div>
  );
}
