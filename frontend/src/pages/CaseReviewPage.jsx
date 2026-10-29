import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Workflow } from 'lucide-react';
import { api } from '../api';

export default function CaseReviewPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .patients()
      .then((res) => setPatients(res.patients || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Case Review Workbench</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Select a Patient Case</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
          Review the case chronologically. Trace findings back to exact passages with assertion status and confidence signals.
        </p>
      </header>
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading…</div>
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No patient cases available</p>
          <Link to="/patients" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            View Patients
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link
              key={p.patient_id}
              to={`/cases/${encodeURIComponent(p.patient_id)}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-teal-300"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.patient_id}</p>
                <p className="text-xs text-slate-500">{p.document_count} docs · {p.flag_count} flags</p>
              </div>
              <Workflow className="h-4 w-4 text-teal-700" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
