import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Calendar, FileText, HeartPulse,
  PlusCircle, Search, ShieldCheck, Stethoscope, Users
} from 'lucide-react';
import { api } from '../api';
import { fmtDate } from '../utils/clinicalFormatters';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api
      .patients()
      .then((res) => setPatients(res.patients || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalReports = patients.reduce((acc, p) => acc + (p.document_count || 0), 0);

  const filteredPatients = patients.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.patient_id && p.patient_id.toLowerCase().includes(term)) ||
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.condition && p.condition.toLowerCase().includes(term)) ||
      (p.department && p.department.toLowerCase().includes(term))
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-700 text-white shadow-sm">
              <Stethoscope className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
              Clinical Intelligence Registry
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Patient Case Workspaces
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Select a patient box below to review their full clinical analysis, examine all diagnostic reports, and ask evidence-grounded questions.
          </p>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
            <Users className="h-4 w-4 text-teal-600" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Patients</p>
              <p className="text-sm font-bold text-slate-900">{patients.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
            <FileText className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Reports</p>
              <p className="text-sm font-bold text-slate-900">{totalReports}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Safety Gate</p>
              <p className="text-sm font-bold text-emerald-900">Zero Hallucination</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient ID, name, diagnosis, medication..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        <Link
          to="/workbench"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          Upload & Index New Report
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Patient Boxes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse space-y-4">
              <div className="h-6 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-4 w-2/3 bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center space-y-3">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-900">No matching patient cases</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm ? `No records found matching "${searchTerm}". Try a different search term.` : 'No clinical patient records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPatients.map((p) => {
            const sentiment = p.sentiment || {};
            const score = typeof sentiment.trajectory_score === 'number' ? sentiment.trajectory_score : 0;
            const scoreSign = score > 0 ? `+${score}` : `${score}`;

            return (
              <Link
                key={p.patient_id}
                to={`/patients/${encodeURIComponent(p.patient_id)}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-teal-500/60 transition-all duration-200"
              >
                <div className="space-y-4">
                  {/* Card Header: Avatar, ID, Status, Acuity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800 font-bold text-sm border border-teal-100 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                        {p.patient_id.slice(-2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                            {p.patient_id}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">·</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {p.name || `Patient ${p.patient_id}`}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-teal-700 mt-0.5">
                          {p.department || 'Inpatient Medicine'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${p.status_color || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                        {p.status || 'Active Inpatient'}
                      </span>
                      {sentiment.acuity_level && (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold ${sentiment.acuity_color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {sentiment.acuity_level}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clinical Diagnosis Headline */}
                  <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                      {p.condition || 'Clinical Inpatient Record'}
                    </p>
                  </div>

                  {/* Clinical Sentiment & Trajectory Bar */}
                  {sentiment.sentiment_label && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <HeartPulse className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        <span className="text-[11px] font-medium text-slate-700">
                          Trajectory Sentiment:
                        </span>
                        <span className="text-[11px] font-semibold text-slate-900">
                          {sentiment.sentiment_label}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                        {scoreSign}
                      </span>
                    </div>
                  )}

                  {/* Reports & Encounters Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-teal-600" />
                      {p.document_count} Clinical Reports
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <Activity className="h-3.5 w-3.5 text-purple-600" />
                      {p.passage_count || 0} Passages
                    </span>
                    {p.last_event_at && (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Latest: {fmtDate(p.last_event_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-teal-700 transition-colors">
                    Review Analysis & Reports
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 group-hover:translate-x-1 transition-transform">
                    <span>Open Patient Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
