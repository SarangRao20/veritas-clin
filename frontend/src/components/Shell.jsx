import { Outlet } from 'react-router-dom';
import { FileSearch, ShieldAlert } from 'lucide-react';

export default function Shell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4 sm:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
            <FileSearch className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold tracking-tight">Veritas-Clin</p>
            <p className="text-xs text-slate-500">Local document evidence search</p>
          </div>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="mx-auto flex max-w-5xl items-start gap-2 border-t border-slate-200 px-6 py-4 text-xs leading-relaxed text-slate-500 sm:px-8">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        Academic NLP prototype. Synthetic demo documents are not real patient records. Not for clinical use.
      </footer>
    </div>
  );
}
