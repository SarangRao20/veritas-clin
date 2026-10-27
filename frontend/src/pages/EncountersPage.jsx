import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Filter, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  FileText,
  AlertTriangle,
  Building,
  Calendar
} from 'lucide-react';
import { PATIENTS_REGISTRY } from '../data/patientsData';

export default function EncountersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('all');

  const filteredPatients = PATIENTS_REGISTRY.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.primaryAdmission.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesWard = 
      wardFilter === 'all' || 
      p.ward.toLowerCase().includes(wardFilter.toLowerCase());

    return matchesSearch && matchesWard;
  });

  return (
    <div className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-700 mb-1">
            Mount Sinai Inpatient &bull; Clinical NLP Registry
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Patient Encounters & Safety Queue
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Real-time audit status of clinical discharge summaries evaluated by dual-stage safety runtime.
          </p>
        </div>

        {/* Global Registry Metrics */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-left">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Accepted Precision</span>
            <span className="text-sm font-bold font-mono text-emerald-600">92.9% (+7.7%)</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-left">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Hallucinations Filtered</span>
            <span className="text-sm font-bold font-mono text-red-600">56.2% Caught</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-left">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Chart Coverage</span>
            <span className="text-sm font-bold font-mono text-sky-700">90.7% Automated</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, MRN, or diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-sky-600 text-slate-800 shadow-2xs"
          />
        </div>

        {/* Ward Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Wards' },
            { id: 'nephrology', label: 'Nephrology' },
            { id: 'pulmonology', label: 'Pulmonology' },
            { id: 'medicine', label: 'General Med' },
            { id: 'cardiology', label: 'Cardiology ICU' }
          ].map(ward => (
            <button
              key={ward.id}
              onClick={() => setWardFilter(ward.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all shrink-0 ${
                wardFilter === ward.id
                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ward.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Encounters Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                <th className="py-3 px-4">Patient / MRN</th>
                <th className="py-3 px-4">Ward & Service</th>
                <th className="py-3 px-4">Primary Admission</th>
                <th className="py-3 px-4">Adversarial Modality Trap</th>
                <th className="py-3 px-4">Safety Audit Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPatients.map((patient) => {
                const isBlocked = patient.status === 'audited_blocked';
                return (
                  <tr 
                    key={patient.mrn}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/audit?mrn=${patient.mrn}`)}
                  >
                    {/* Patient MRN */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {patient.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {patient.mrn} &bull; {patient.age}y {patient.gender}
                      </div>
                    </td>

                    {/* Ward */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{patient.ward}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{patient.admissionDate}</span>
                      </div>
                    </td>

                    {/* Primary Diagnosis */}
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {patient.primaryAdmission}
                    </td>

                    {/* Adversarial Trap */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {patient.trapType}
                      </span>
                    </td>

                    {/* Audit Status */}
                    <td className="py-3.5 px-4">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>{patient.statusLabel}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{patient.statusLabel}</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/audit?mrn=${patient.mrn}`);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 px-3 py-1.5 rounded-md border border-sky-200 hover:border-sky-600 transition-all shadow-2xs"
                      >
                        <span>Audit Record</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
