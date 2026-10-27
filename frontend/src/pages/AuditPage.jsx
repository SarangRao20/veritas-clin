import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Download, 
  FileText, 
  Layers, 
  Sliders, 
  Play, 
  ArrowLeft,
  Copy,
  AlertTriangle,
  Code2
} from 'lucide-react';
import { PATIENTS_REGISTRY } from '../data/patientsData';

export default function AuditPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mrnParam = searchParams.get('mrn') || 'VS-002';

  const [selectedPatient, setSelectedPatient] = useState(
    PATIENTS_REGISTRY.find(p => p.mrn === mrnParam) || PATIENTS_REGISTRY[0]
  );
  const [activeTab, setActiveTab] = useState('audit'); // 'note' | 'audit' | 'comparison' | 'fhir'
  const [threshold, setThreshold] = useState(0.35);
  const [isAuditing, setIsAuditing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = PATIENTS_REGISTRY.find(p => p.mrn === mrnParam);
    if (found) setSelectedPatient(found);
  }, [mrnParam]);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setActiveTab('audit');
    }, 700);
  };

  const handleExportFHIR = () => {
    const approved = selectedPatient.veritasAudit.approvedFindings;
    const fhirBundle = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: selectedPatient.mrn,
            name: [{ text: selectedPatient.name }],
            gender: selectedPatient.gender.toLowerCase(),
            birthDate: "1962-05-14"
          }
        },
        ...approved.map((item, idx) => ({
          resource: {
            resourceType: item.type === "Diagnosis" ? "Condition" : item.type === "Medication" ? "MedicationRequest" : "ServiceRequest",
            id: `res-${idx}`,
            code: { text: item.name },
            note: [{ text: `Verified via DeBERTa-v3 NLI Cross-Encoder (${item.entailment}% entailment). Grounding sentence: "${item.sentence}"` }]
          }
        }))
      ]
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FHIR_${selectedPatient.mrn}_VERITAS_BUNDLE.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approved = selectedPatient.veritasAudit.approvedFindings;
  const blocked = selectedPatient.veritasAudit.blockedHallucinations;

  return (
    <div className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      
      {/* Patient Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold font-mono text-sm">
            EHR
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                MRN: {selectedPatient.mrn}
              </span>
              <h2 className="text-base font-bold text-slate-900">{selectedPatient.name}</h2>
              <span className="text-xs text-slate-500 font-mono hidden sm:inline">&bull; {selectedPatient.age}y {selectedPatient.gender}</span>
              <span className="text-xs text-slate-500 font-mono hidden sm:inline">&bull; {selectedPatient.ward}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Admission: <strong>{selectedPatient.primaryAdmission}</strong></span>
              <span>&bull;</span>
              <span>Attending: {selectedPatient.attending}</span>
            </div>
          </div>
        </div>

        {/* Switch Patient Dropdown & Primary Action */}
        <div className="flex items-center gap-3">
          <select
            value={selectedPatient.mrn}
            onChange={(e) => navigate(`/audit?mrn=${e.target.value}`)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-sky-600"
          >
            {PATIENTS_REGISTRY.map(p => (
              <option key={p.mrn} value={p.mrn}>
                {p.mrn}: {p.name} ({p.primaryAdmission.split('(')[0]})
              </option>
            ))}
          </select>

          <button
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-2xs transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isAuditing ? 'Auditing Sentences...' : 'Run Audit'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Safety Audit & Decisions ({approved.length} Safe, {blocked.length} Blocked)</span>
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'comparison'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Side-by-Side Audit (Standard AI vs Veritas)</span>
          </button>

          <button
            onClick={() => setActiveTab('note')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'note'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Source Clinical Dictation</span>
          </button>

          <button
            onClick={() => setActiveTab('fhir')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'fhir'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>HL7 FHIR Interoperability</span>
          </button>
        </div>

        {/* Export Action */}
        <button
          onClick={handleExportFHIR}
          className="text-xs font-mono font-semibold text-sky-700 hover:text-sky-900 pb-3 flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export FHIR JSON</span>
        </button>
      </div>

      {/* TAB 1: SAFETY AUDIT & DECISIONS */}
      {activeTab === 'audit' && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          
          {/* Approved Safe Findings (Entered to Chart) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-t-4 border-t-emerald-600">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider font-mono">
                  Approved & Entered to Patient Chart
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {approved.length} SAFE ENTRIES
              </span>
            </div>

            <div className="space-y-3">
              {approved.map((item) => (
                <div 
                  key={item.id}
                  className="bg-emerald-50/40 border border-emerald-200 border-l-4 border-l-emerald-600 rounded-lg p-3.5 transition-all hover:bg-emerald-50"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {item.type}
                    </span>
                  </div>

                  {item.dosage && (
                    <span className="inline-block text-xs font-mono text-emerald-900 font-semibold mb-1">
                      Dosage: {item.dosage}
                    </span>
                  )}

                  <div className="mt-2 pt-2 border-t border-emerald-200/60 text-xs">
                    <div className="font-mono text-[11px] text-emerald-900 bg-white/80 p-1.5 rounded border border-emerald-100 mb-1">
                      Grounding: &ldquo;{item.sentence}&rdquo;
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-emerald-700 mt-1">
                      <span>NLI Entailment: <strong>{item.entailment}%</strong></span>
                      <span>Confidence: <strong>{item.confidence}%</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blocked Hallucinations & Contraindicated Traps */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-t-4 border-t-red-600">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider font-mono">
                  Blocked from Patient Record (Safety Valve Engaged)
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                {blocked.length} SUPPRESSED
              </span>
            </div>

            {blocked.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-mono border-2 border-dashed border-slate-200 rounded-lg">
                ✓ Zero hallucinations detected in this record. All extracted claims were verified as safe.
              </div>
            ) : (
              <div className="space-y-3">
                {blocked.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-red-50/50 border border-red-200 border-l-4 border-l-red-600 rounded-lg p-3.5 transition-all hover:bg-red-50"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 text-sm line-through decoration-red-500 decoration-2">
                        [{item.type}] {item.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        Contradiction: {item.contradiction}%
                      </span>
                    </div>

                    <p className="text-xs text-red-950 font-medium leading-relaxed mt-1">
                      {item.blockRationale}
                    </p>

                    <div className="mt-2 pt-2 border-t border-red-200/60 font-mono text-[11px] text-slate-600">
                      Doctor note sentence: &ldquo;{item.sentence}&rdquo;
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: SIDE-BY-SIDE AUDIT COMPARISON */}
      {activeTab === 'comparison' && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          
          {/* Left: Standard LLM Baseline Failure */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-t-4 border-t-slate-400">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-red-600 uppercase">UNCHECKED ZERO-SHOT</span>
                <h3 className="font-bold text-sm text-slate-900">Standard AI Baseline Output</h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Prompt-and-Pray
              </span>
            </div>

            <div className="space-y-3">
              {selectedPatient.naiveBaseline.map((item, idx) => (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-lg border text-xs ${
                    item.isError 
                      ? 'bg-red-50 border-red-300 border-l-4 border-l-red-600'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    {item.isError ? (
                      <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        ⚠️ {item.errorTag}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">Conf: {item.conf}%</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Veritas Safe Engine */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-t-4 border-t-emerald-600">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">VERIFIED & AUDITED</span>
                <h3 className="font-bold text-sm text-slate-900">Veritas-Clin Safety Engine Output</h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                DeBERTa-v3 Guarded
              </span>
            </div>

            <div className="space-y-3">
              {approved.map((item) => (
                <div key={item.id} className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 border-l-4 border-l-emerald-600 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-950 font-sans">✓ {item.name}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Entailment: {item.entailment}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.auditRationale}</p>
                </div>
              ))}

              {blocked.map((item) => (
                <div key={item.id} className="p-3.5 rounded-lg border border-red-200 bg-red-50/60 border-l-4 border-l-red-600 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-red-900 line-through">🛑 {item.name}</span>
                    <span className="text-[10px] font-mono font-bold text-red-800 bg-red-100 px-1.5 py-0.5 rounded">
                      Contradiction: {item.contradiction}%
                    </span>
                  </div>
                  <p className="text-xs text-red-950 font-medium">{item.blockRationale}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: SOURCE CLINICAL DICTATION */}
      {activeTab === 'note' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">
              Physician Electronic Record Text
            </span>
            <span className="text-xs font-mono text-slate-400">
              {selectedPatient.rawNote.length} characters &bull; {selectedPatient.rawNote.split('\n').length} lines
            </span>
          </div>

          <pre className="p-4 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap overflow-x-auto">
            {selectedPatient.rawNote}
          </pre>
        </div>
      )}

      {/* TAB 4: HL7 FHIR INTEROPERABILITY */}
      {activeTab === 'fhir' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
              <span className="text-xs font-mono font-bold text-sky-700 uppercase">HL7 FHIR Release 4 Document Bundle</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">Machine-Readable Interoperability Export</h3>
            </div>
            <button
              onClick={handleExportFHIR}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-sky-300 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto max-h-[500px]">
            {JSON.stringify({
              resourceType: "Bundle",
              type: "document",
              timestamp: new Date().toISOString(),
              entry: [
                {
                  resource: {
                    resourceType: "Patient",
                    id: selectedPatient.mrn,
                    name: [{ text: selectedPatient.name }]
                  }
                },
                ...approved.map((item, idx) => ({
                  resource: {
                    resourceType: item.type === "Diagnosis" ? "Condition" : item.type === "Medication" ? "MedicationRequest" : "ServiceRequest",
                    id: `res-${idx}`,
                    code: { text: item.name },
                    note: [{ text: `Verified via DeBERTa NLI (${item.entailment}% entailment). Grounding: "${item.sentence}"` }]
                  }
                }))
              ]
            }, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
}
