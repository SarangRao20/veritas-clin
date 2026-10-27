import React from 'react';
import { ShieldCheck, Activity, ArrowRight, UserCheck } from 'lucide-react';

export default function Navbar({ currentView, onNavigate, user, onOpenGuide }) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Group */}
        <div 
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-cyan-600 flex items-center justify-center text-white shadow-sm shadow-sky-600/30 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">VERITAS-CLIN</span>
              <span className="text-[11px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                EHR Safety Runtime
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono hidden sm:block">Evidence-Grounded Extraction &bull; DeBERTa NLI Verification</p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button 
            onClick={() => onNavigate('landing')}
            className={`hover:text-sky-600 transition-colors ${currentView === 'landing' ? 'text-sky-600 font-semibold' : ''}`}
          >
            Product Overview
          </button>
          <button 
            onClick={() => onNavigate('input')}
            className={`hover:text-sky-600 transition-colors ${currentView === 'input' || currentView === 'output' ? 'text-sky-600 font-semibold' : ''}`}
          >
            Clinical Studio
          </button>
          <button 
            onClick={onOpenGuide}
            className="hover:text-sky-600 transition-colors flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Viva Defense Guide</span>
          </button>
          <a 
            href="https://github.com/SarangRao20/veritas-clin" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-sky-600 transition-colors"
          >
            GitHub
          </a>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">{user.name}</span>
            </div>
          ) : (
            <button 
              onClick={() => onNavigate('auth')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              Staff Sign In
            </button>
          )}

          <button
            onClick={() => onNavigate('input')}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
          >
            <span>Launch Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
}
