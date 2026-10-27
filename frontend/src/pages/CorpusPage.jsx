import { useEffect, useState } from 'react';
import { api } from '../api';
import { Panel, Tag, Spinner, Err } from '../components/ui';

const DOMAIN_TONE = {
  cardiac:     'red',
  respiratory: 'blue',
  endocrine:   'amber',
  renal:       'emerald',
};

function NoteDetail({ note, onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-md border border-zinc-200 shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-900 font-mono">{note.note_id}</span>
            <Tag tone={DOMAIN_TONE[note.domain] ?? 'zinc'}>{note.domain}</Tag>
          </div>
          <button
            onClick={onClose}
            className="text-[12px] text-zinc-400 hover:text-zinc-700 transition-colors px-1"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-[13px] text-zinc-700 leading-relaxed whitespace-pre-wrap">{note.text}</p>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-1.5">Tokens</div>
            <div className="flex flex-wrap gap-1">
              {note.tokens.map((t, i) => (
                <span key={i} className="text-[11px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CorpusPage() {
  const [data, setData]         = useState(null);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');

  const load = () => {
    setError(null);
    api.corpus().then(setData).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const notes = data?.notes ?? [];
  const domains = ['all', ...(data?.domains ?? [])];

  const visible = notes.filter((n) => {
    if (filter !== 'all' && n.domain !== filter) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">Corpus</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          {data ? `${data.notes.length} notes · seed ${data.seed}` : 'Synthetic clinical notes with by-construction domain labels.'}
        </p>
      </div>

      {error && <Err message={error} onRetry={load} />}

      {!data && !error && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-400"><Spinner /> Loading…</div>
      )}

      {data && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className={`px-2.5 py-1 rounded text-[12px] transition-colors ${
                    filter === d
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text…"
              className="ml-auto border border-zinc-200 rounded px-2.5 py-1 text-[12px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-blue-400 bg-white"
            />
          </div>

          {/* Table */}
          <Panel>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">ID</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Domain</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium hidden sm:table-cell">Split</th>
                  <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium hidden sm:table-cell">Tokens</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {visible.slice(0, 100).map((n) => (
                  <tr
                    key={n.note_id}
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(n)}
                  >
                    <td className="px-4 py-2 font-mono text-zinc-500">{n.note_id}</td>
                    <td className="px-4 py-2">
                      <Tag tone={DOMAIN_TONE[n.domain] ?? 'zinc'}>{n.domain}</Tag>
                    </td>
                    <td className="px-4 py-2 text-zinc-500 hidden sm:table-cell">{n.split}</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600 hidden sm:table-cell">{n.token_count}</td>
                    <td className="px-4 py-2 text-zinc-500 max-w-xs truncate">{n.text.slice(0, 80)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > 100 && (
              <div className="px-4 py-2 text-[11px] text-zinc-400 border-t border-zinc-100">
                Showing 100 of {visible.length}
              </div>
            )}
            {visible.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-zinc-400">No notes match.</div>
            )}
          </Panel>
        </>
      )}

      {selected && <NoteDetail note={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
