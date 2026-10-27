import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  ShieldCheck, 
  Activity, 
  Sliders, 
  BookOpen, 
  ExternalLink,
  Cpu,
  UserCheck,
  Binary
} from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { to: '/', label: 'Patient Encounters', icon: Users, badge: '4' },
    { to: '/audit', label: 'Clinical Auditor', icon: ShieldCheck, badge: 'Live' },
    { to: '/nlp-lab', label: 'NLP Foundations Lab', icon: Binary, badge: 'Theory' },
    { to: '/analytics', label: 'Telemetry & GPU Benchmarks', icon: Activity },
    { to: '/settings', label: 'Safety Policy & Config', icon: Sliders },
    { to: '/viva-guide', label: 'Examiner Defense Manual', icon: BookOpen, highlight: true },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      
      {/* Top Header & Hospital System Info */}
      <div>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-600/30">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block">VERITAS-CLIN</span>
              <span className="text-[10px] font-mono text-sky-400 font-semibold block">Clinical AI Safety OS</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded">
            <span>Hospital Health System</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
            Clinical Workstation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all
                  ${isActive 
                    ? 'bg-sky-600 text-white shadow-xs font-bold' 
                    : item.highlight
                    ? 'text-sky-300 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Hardware Attributions */}
      <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
        
        {/* Model Stack Pill */}
        <div className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700/60 text-[11px] font-mono space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Cpu className="w-3 h-3 text-sky-400" />
              Runtime Stack:
            </span>
            <span className="text-emerald-400 font-bold">CUDA / T4</span>
          </div>
          <div className="text-slate-300 truncate">Qwen2.5-3B + DeBERTa-v3</div>
        </div>

        {/* Attending Physician Profile */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
              SR
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Dr. Sarang Rao, MD</div>
              <div className="text-[10px] text-slate-400 font-mono">Clinical NLP Lead</div>
            </div>
          </div>

          <a 
            href="https://github.com/SarangRao20/veritas-clin" 
            target="_blank" 
            rel="noopener noreferrer"
            title="Open GitHub Repo"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>

    </aside>
  );
}
