import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  Activity, Sparkles, Users, Microscope,
  Wifi, WifiOff, ChevronRight, ShieldCheck, Settings,
  Brain
} from 'lucide-react';
import CommandPalette, { useCmdK, CmdKButton } from './CommandPalette';
import DeidModal from './DeidModal';
import SettingsModal, { getLLMConfig } from './SettingsModal';

const NAV = [
  {
    to: '/',
    icon: Sparkles,
    label: 'Clinical Copilot',
    shortcut: '1',
    desc: 'Evidence-Grounded RAG & SBAR',
    end: true,
  },
  {
    to: '/patients',
    icon: Users,
    label: 'Patient Directory',
    shortcut: '2',
    desc: 'Patient longitudinal charts',
    end: false,
  },
  {
    to: '/research',
    icon: Microscope,
    label: 'Architecture & Specs',
    shortcut: '3',
    desc: 'Clinical RAG methodology',
    end: false,
  },
];

function HealthDot() {
  const [status, setStatus] = useState(null);
  const [latency, setLatency] = useState(null);

  const check = useCallback(() => {
    const t0 = Date.now();
    fetch('/health')
      .then(r => { setStatus(r.ok ? 'ok' : 'error'); setLatency(Date.now() - t0); })
      .catch(() => { setStatus('error'); setLatency(null); });
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 25000);
    return () => clearInterval(id);
  }, [check]);

  if (status === null) return null;

  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-2 rounded-xl border mx-2',
      status === 'ok'
        ? 'bg-emerald-950/40 border-emerald-900/60'
        : 'bg-red-950/40 border-red-900/60'
    )}>
      {status === 'ok' ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className={clsx('text-[11px] font-semibold', status === 'ok' ? 'text-emerald-300' : 'text-red-300')}>
          {status === 'ok' ? 'Consensus RAG Engine Online' : 'Backend Offline'}
        </div>
        {latency && status === 'ok' && (
          <div className="text-[10px] text-emerald-600 font-mono">{latency}ms response</div>
        )}
      </div>
      <div className={clsx(
        'h-1.5 w-1.5 rounded-full shrink-0',
        status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
      )} />
    </div>
  );
}

export default function Shell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [deidOpen, setDeidOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState(getLLMConfig);
  const [pendingQuery, setPendingQuery] = useState(null);
  const navigate = useNavigate();

  useCmdK(useCallback(() => setCmdOpen(true), []));

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') navigate('/');
      if (e.key === '2') navigate('/patients');
      if (e.key === '3') navigate('/research');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div className="min-h-screen flex bg-dot-grid text-slate-900 font-sans">
      {/* ── Dark Premium Sidebar ── */}
      <aside className="sidebar fixed top-0 left-0 h-full w-60 z-40 flex flex-col select-none bg-slate-950 border-r border-slate-800">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 px-5 pt-6 pb-5 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[16px] font-black tracking-tight text-white leading-none">
              Veritas·Clin
            </div>
            <div className="text-[9px] text-blue-400 font-semibold tracking-widest uppercase mt-1">
              Clinical RAG Copilot
            </div>
          </div>
        </Link>

        {/* Divider */}
        <div className="mx-4 border-t border-slate-800/80 mb-3" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, shortcut, desc, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group',
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="leading-tight">{label}</div>
              </div>
              <kbd className="text-[9px] bg-slate-900/80 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-800 shrink-0">
                {shortcut}
              </kbd>
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto pb-4 space-y-2.5">
          {/* Health */}
          <HealthDot />

          {/* ⌘K button */}
          <div className="px-3">
            <CmdKButton onClick={() => setCmdOpen(true)} />
          </div>

          {/* Footer brand */}
          <div className="px-5 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-medium">
              <ShieldCheck className="h-3 w-3" />
              HIPAA Safe Harbor Compliant
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Consensus Dense RAG · SBAR Synthesis
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#080c14]/90 backdrop-blur-xl border-b border-slate-800/80 shadow-xs">
          <div className="px-8 h-15 flex items-center justify-between gap-4">
            {/* Breadcrumb area */}
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="font-bold text-slate-100">Veritas-Clin</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-slate-400 font-medium">Longitudinal Evidence RAG</span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2.5">
              {/* HIPAA Safe Harbor Trigger */}
              <button
                onClick={() => setDeidOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl text-[12px] font-semibold transition-all border border-slate-700/80 shadow-xs cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>HIPAA De-ID</span>
              </button>

              {/* Generative Model Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 rounded-xl text-[12px] font-semibold transition-all border border-blue-800/80 shadow-xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span className="capitalize">{llmConfig.provider === 'builtin' ? 'Deterministic Engine' : `${llmConfig.provider} Cloud`}</span>
                <Settings className="h-3 w-3 text-blue-400 ml-0.5" />
              </button>

              <div className="h-4 border-r border-slate-800 mx-1 hidden sm:block" />

              <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shadow-xs">
                MD
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{
            pendingQuery,
            clearPendingQuery: () => setPendingQuery(null),
            openDeid: () => setDeidOpen(true),
            openSettings: () => setSettingsOpen(true),
          }} />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 py-4 bg-[#080c14]/80 backdrop-blur-sm text-[11px] text-slate-500">
          <div className="px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300">Veritas-Clin RAG Platform</span>
              <span>·</span>
              <span>Evidence-Grounded Clinical Decision Support</span>
              <span>·</span>
              <span className="text-slate-500 font-mono">Real MTSamples Corpus</span>
            </div>
            <span className="font-mono text-slate-500">FastAPI + React 19 + Tailwind CSS</span>
          </div>
        </footer>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onQuery={(q) => { setPendingQuery(q); }}
      />

      {/* HIPAA Safe Harbor De-ID Modal */}
      <DeidModal
        open={deidOpen}
        onClose={() => setDeidOpen(false)}
      />

      {/* Cloud Model Provider Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setLlmConfig(getLLMConfig());
        }}
      />
    </div>
  );
}
