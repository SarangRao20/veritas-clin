import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api';
import { StatCard, Err, fmt } from '../components/ui';
import { useToast } from '../components/toast';
import {
  Search, ChevronRight, Users, FileText, CalendarDays, X,
  ShieldCheck, Activity, ArrowRight, Stethoscope
} from 'lucide-react';
import clsx from 'clsx';

const LS_FILTER = 'moodtrace_patient_filter';

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function PremiumPatientCard({ p, onClick, index }) {
  const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = [
    'from-blue-600 to-indigo-600',
    'from-indigo-600 to-purple-600',
    'from-emerald-600 to-teal-600',
    'from-rose-600 to-pink-600',
    'from-amber-600 to-orange-600',
  ];
  const gradient = colors[index % colors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all p-5 cursor-pointer flex flex-col justify-between space-y-4"
    >
      <div>
        {/* Top row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx('h-11 w-11 rounded-2xl bg-gradient-to-tr text-white font-black text-[13px] flex items-center justify-center shadow-md', gradient)}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] text-slate-900 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-mono px-1.5 py-0.5 rounded-md font-semibold">
                  {p.id}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {p.age ? `${p.age} yrs · ${p.gender || 'Patient'}` : 'Clinical Record'}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider font-mono">
            {p.specialty || 'General'}
          </span>
        </div>

        {/* Diagnosis / Primary Condition */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Primary Presentation</span>
          <p className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2">
            {p.condition || 'Clinical evaluation record'}
          </p>
        </div>
      </div>

      {/* Bottom status & action */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <span className="flex items-center gap-1 font-mono">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            {p.note_count} Notes
          </span>
          <span>·</span>
          <span className="flex items-center gap-1 font-mono">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            {p.last_entry ? fmt.date(p.last_entry) : 'Recent'}
          </span>
        </div>

        <div className="flex items-center gap-1 font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
          <span>View Chart</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [patients, setPatients] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState(() => lsGet(LS_FILTER, ''));
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.patients()
      .then(data => { setPatients(data); })
      .catch(e => {
        setErr(e.message);
        toast.error('Failed to load patients', e.message);
      });
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_FILTER, JSON.stringify(filter)); } catch {}
  }, [filter]);

  const sorted = patients
    ? [...patients]
        .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || (p.condition && p.condition.toLowerCase().includes(filter.toLowerCase())))
        .sort((a, b) => a.id.localeCompare(b.id))
    : null;

  const totalNotes = patients?.reduce((s, p) => s + p.note_count, 0) ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              EHR Directory
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Safe Harbor Scrubbed
            </span>
          </div>
          <h1 className="text-[24px] font-black text-slate-900 leading-tight">Patient Clinical Directory</h1>
          <p className="mt-1 text-[13px] text-slate-500 max-w-2xl leading-relaxed">
            Transcribed medical narratives across Psychiatry, Neurology, and General Medicine with longitudinal encounter histories and DSM-5 timelines.
          </p>
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search by name, ID or diagnosis…"
            className="pl-9 pr-8 py-2.5 border border-slate-200 focus:border-blue-500 rounded-xl text-[13px] bg-white shadow-xs w-64 transition-all focus:w-72 focus:outline-hidden font-medium"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {err && <Err message={err} onRetry={() => window.location.reload()} />}

      {/* Metrics Row */}
      {patients && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[20px] font-black text-slate-900 leading-none">{patients.length}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Active Patients</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[20px] font-black text-slate-900 leading-none">{totalNotes}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Clinical Notes</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[20px] font-black text-slate-900 leading-none">3</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">Medical Specialties</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[20px] font-black text-emerald-700 leading-none">100%</div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">HIPAA Compliant</div>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Patient Cards (Netflix/Linear Style) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[12px] text-slate-500 font-medium">
          <span>{sorted ? `${sorted.length} Patient Case Records Available` : 'Loading patients...'}</span>
          {filter && <span className="text-blue-600">Filtered by "{filter}"</span>}
        </div>

        {!patients && !err && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {sorted && (
          sorted.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <div className="text-3xl">🔍</div>
              <div className="text-[15px] font-bold text-slate-800">No Patient Records Match "{filter}"</div>
              <p className="text-[12px] text-slate-500">Try searching for Eleanor, Marcus, Hannah, or Devon.</p>
              <button
                onClick={() => setFilter('')}
                className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[12px] font-semibold hover:bg-blue-100 transition-colors"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {sorted.map((p, i) => (
                <PremiumPatientCard
                  key={p.id}
                  p={p}
                  index={i}
                  onClick={() => navigate(`/patient/${p.id}`)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
