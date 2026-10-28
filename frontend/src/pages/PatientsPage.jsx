import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Spinner, Err } from '../components/ui';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export default function PatientsPage() {
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.patients().then(setPatients).catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-8">
        <Err message={error} onRetry={() => { setError(''); api.patients().then(setPatients).catch(e => setError(e.message)); }} />
      </div>
    );
  }

  if (!patients) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const visible = patients.filter(p =>
    !filter ||
    p.name?.toLowerCase().includes(filter.toLowerCase()) ||
    p.id?.toLowerCase().includes(filter.toLowerCase()) ||
    p.condition?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Records</h1>
        <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
          Synthetic demo patient records generated for this prototype.
          No real patient data — these notes exist only to exercise the pipeline.
        </p>
      </header>

      {/* Search */}
      <label className="relative block max-w-sm">
        <span className="sr-only">Filter records</span>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, ID, or condition…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 bg-white"
        />
      </label>

      {/* Patient table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th scope="col" className="px-5 py-3 text-left font-medium">Record</th>
              <th scope="col" className="px-5 py-3 text-left font-medium hidden sm:table-cell">Condition</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(p => (
              <tr
                key={p.id}
                onClick={() => navigate(`/patient/${p.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors focus-visible:outline-none"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/patient/${p.id}`); }}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className={clsx(
                      'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                      'bg-teal-50 text-teal-800 border border-teal-100'
                    )}>
                      {p.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs font-mono text-slate-400">{p.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell text-slate-600 max-w-xs">
                  <span className="line-clamp-1">{p.condition ?? '—'}</span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-slate-500 tabular-nums">
                  {p.note_count}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                  No matching records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
