import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Users, Microscope, Command } from 'lucide-react';
import clsx from 'clsx';

const COMMANDS = [
  { id: 'nav-discover',  label: 'Search & Evidence',     category: 'Navigate',  icon: Search,     path: '/' },
  { id: 'nav-patients',  label: 'Patients Directory',    category: 'Navigate',  icon: Users,      path: '/patients' },
  { id: 'nav-research',  label: 'Research & Benchmarks', category: 'Navigate',  icon: Microscope, path: '/research' },
];

const PRESET_QUERIES = [
  { id: 'qa1', label: 'Clinical QA: Suicidal Risk Check',   query: 'Has the patient reported suicidal thoughts or self-harm?' },
  { id: 'qa2', label: 'Clinical QA: Sleep Insomnia Check',  query: 'How severe has the sleep insomnia and 3am waking been?' },
  { id: 'q0',  label: 'Search: Lost in Thoughts',           query: 'he feels lost in his own thoughts' },
  { id: 'q1',  label: 'Search: Severe Insomnia',           query: 'trouble sleeping and waking through the night' },
  { id: 'q2',  label: 'Search: Loss of Interest',          query: 'nothing brings me joy anymore completely numb' },
  { id: 'q3',  label: 'Search: Cognitive Fog',             query: 'cannot concentrate on anything brain fog' },
  { id: 'q4',  label: 'Search: Physical Fatigue',          query: 'physical exhaustion is overwhelming heavy limbs' },
];

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-100 text-blue-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette({ open, onClose, onQuery }) {
  const [input, setInput]     = useState('');
  const [active, setActive]   = useState(0);
  const navigate              = useNavigate();
  const inputRef              = useRef(null);

  const allItems = [
    ...COMMANDS.map(c => ({ ...c, type: 'nav' })),
    ...PRESET_QUERIES.map(q => ({ ...q, type: 'query', category: 'Quick Search', icon: Search, path: '/' })),
  ];

  const filtered = input.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(input.toLowerCase()))
    : allItems;

  useEffect(() => {
    if (open) {
      setInput('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((item) => {
    if (item.type === 'nav') {
      navigate(item.path);
    } else if (item.type === 'query') {
      navigate('/');
      onQuery?.(item.query);
    }
    onClose();
  }, [navigate, onClose, onQuery]);

  const onKey = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[active]) execute(filtered[active]); }
    if (e.key === 'Escape')    { onClose(); }
  }, [active, filtered, execute, onClose]);

  if (!open) return null;

  // Group by category
  const groups = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9998] cmd-backdrop flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="cmd-box w-full max-w-lg animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Navigate pages, run a search query..."
            className="flex-1 text-[14px] bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-mono shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-slate-400">No commands found for "{input}"</div>
          ) : (
            Object.entries(groups).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const idx = globalIdx++;
                  const isActive = idx === active;
                  return (
                    <button
                      key={item.id}
                      onClick={() => execute(item)}
                      onMouseEnter={() => setActive(idx)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                        isActive ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <div className={clsx(
                        'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                        isActive ? 'bg-blue-100' : 'bg-slate-100',
                      )}>
                        <Icon className={clsx('h-3.5 w-3.5', isActive ? 'text-blue-600' : 'text-slate-500')} />
                      </div>
                      <span className="text-[13px] font-medium flex-1">{highlight(item.label, input)}</span>
                      {isActive && <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/* Hook to register global shortcut */
export function useCmdK(onOpen) {
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}

/* Button to show in header */
export function CmdKButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[12px] text-slate-300 transition-colors group"
    >
      <Command className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Command</span>
      <kbd className="text-[10px] bg-slate-700 group-hover:bg-slate-600 px-1.5 py-0.5 rounded font-mono text-slate-400">⌘K</kbd>
    </button>
  );
}
