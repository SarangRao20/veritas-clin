import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Download, 
  Copy, 
  ArrowLeft, 
  Layers, 
  ShieldCheck, 
  AlertTriangle,
  FileCheck2,
  Share2
} from 'lucide-react';
import { CLINICAL_CASES } from '../data/clinicalCases';

export default function OutputReportView({ selectedCaseKey, threshold, onBackToIntake }) {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'verified_only'
  const [copied, setCopied] = useState(false);
  const currentCase = CLINICAL_CASES[selectedCaseKey] || CLINICAL_CASES.trap_aki_negation;

  const approved = currentCase.veritasOutput.approvedEntries;
  const blocked = currentCase.veritasOutput.blockedHallucinations;

  const handleExportFHIR = () => {
    const fhirBundle = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: currentCase.mrn,
            name: [{ text: currentCase.patientName }]
          }
        },
        ...approved.map((item, idx) => {
          if (item.type === "Diagnosis") {
            return {
              resource: {
                resourceType: "Condition",
                id: `cond-${idx}`,
                clinicalStatus: { coding: [{ code: "active" }] },
                verificationStatus: { coding: [{ code: "confirmed", system: "veritas-clin/nli" }] },
                code: { text: item.name },
                note: [{ text: `Verified via DeBERTa NLI Cross-Encoder (${item.entailment}% entailment). Grounding sentence: "${item.sentence}"` }]
              }
            };
          } else if (item.type === "Medication") {
            return {
              resource: {
                resourceType: "MedicationRequest",
                id: `med-${idx}`,
                status: "active",
                intent: "order",
                medicationCodeableConcept: { text: item.name },
                dosageInstruction: item.dosage ? [{ text: item.dosage }] : []
              }
            };
          } else {
            return {
              resource: {
                resourceType: "ServiceRequest",
                id: `srv-${idx}`,
                status: "active",
                intent: "plan",
                code: { text: item.name }
              }
            };
          }
        })
      ]
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FHIR_${currentCase.mrn}_VERITAS_EXPORT.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    let text = `VERITAS-CLIN AUDITED CLINICAL DISCHARGE SUMMARY\n`;
    text += `Patient: ${currentCase.patientName} | MRN: ${currentCase.mrn}\n`;
    text += `Encounter: ${currentCase.encounter}\n\n`;
    text += `APPROVED & CHARTED FINDINGS:\n`;
    approved.forEach((a, i) => {
      text += `${i + 1}. [${a.type}] ${a.name} (Entailment: ${a.entailment}% | Grounded: "${a.sentence}")\n`;
    });
    if (blocked.length > 0) {
      text += `\nBLOCKED / CONTRAINDICATED HALLUCINATIONS:\n`;
      blocked.forEach((b, i) => {
        text += `${i + 1}. [${b.type}] ${b.name} (Contradiction: ${b.contradiction}% | Reason: ${b.reason})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Top Report Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>CLINICAL AUDIT COMPLETE &bull; SAFE TO CHART</span>
            </span>
            <span className="text-xs font-mono text-slate-500">MRN: {currentCase.mrn}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Audited Clinical Discharge Summary
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {currentCase.patientName} &bull; {currentCase.ward} &bull; Safety Cutoff &tau;* = {threshold.toFixed(2)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToIntake}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Audit Another Note</span>
          </button>

          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={handleExportFHIR}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export FHIR JSON</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('split')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              viewMode === 'split'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Side-by-Side Audit Comparison
          </button>
          <button
            onClick={() => setViewMode('verified_only')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              viewMode === 'verified_only'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Verified Hospital Chart Only
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500 hidden sm:block">
          Dual-Engine Grounding: Qwen2.5-3B + DeBERTa-v3 NLI
        </div>
      </div>

      {/* Main Comparison Columns */}
      <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* Box 1: Verified Safe Entries (Entered into EHR) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs border-t-4 border-t-emerald-600">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Approved Clinical Findings (Entered to Chart)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {approved.length} SAFE ENTRIES
            </span>
          </div>

          <div className="space-y-3.5">
            {approved.map((item) => (
              <div 
                key={item.id}
                className="bg-emerald-50/40 border border-emerald-200 border-l-4 border-l-emerald-600 rounded-xl p-4 transition-all hover:bg-emerald-50"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wide">
                    ✓ {item.type}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-emerald-700">
                    <span>Entailment: {item.entailment}%</span>
                    <span>&bull;</span>
                    <span>Conf: {item.confidence}%</span>
                  </div>
                </div>

                <div className="text-base font-bold text-slate-900">{item.name}</div>
                {item.dosage && (
                  <span className="inline-block mt-1 text-xs font-mono text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {item.dosage}
                  </span>
                )}

                <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60 text-xs text-slate-600">
                  <div className="font-mono text-[11px] text-emerald-800 bg-white/70 p-1.5 rounded border border-emerald-100 mb-1">
                    Source Grounding: &ldquo;{item.sentence}&rdquo;
                  </div>
                  <p className="text-[11px] text-slate-500">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box 2: Blocked Hallucinations & Contraindicated Traps */}
        {viewMode === 'split' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs border-t-4 border-t-red-600">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-sm text-slate-900">Blocked Hallucinations & Traps</h3>
              </div>
              <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                {blocked.length} BLOCKED
              </span>
            </div>

            {blocked.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-mono border-2 border-dashed border-slate-200 rounded-xl">
                ✓ Zero hallucinations detected in this record. All extracted claims were verified as safe.
              </div>
            ) : (
              <div className="space-y-3.5">
                {blocked.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-red-50/50 border border-red-200 border-l-4 border-l-red-600 rounded-xl p-4 transition-all hover:bg-red-50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono font-bold text-red-700 uppercase tracking-wide">
                        🛑 SUPPRESSED FROM PATIENT RECORD
                      </span>
                      <span className="text-[11px] font-mono font-bold text-red-700">
                        Contradiction: {item.contradiction}%
                      </span>
                    </div>

                    <div className="text-base font-bold text-slate-700 line-through decoration-red-500 decoration-2">
                      {item.name}
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-red-200/60 text-xs">
                      <div className="p-2 rounded bg-white border border-red-200 text-red-900 font-medium text-xs leading-relaxed mb-1.5">
                        {item.reason}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        Physician note statement: &ldquo;{item.sentence}&rdquo;
                      </div>
                    </div>
                  </div>
                ))}

                {/* Educational Banner for Viva */}
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed mt-4">
                  <strong>Examiner Note:</strong> Without the Veritas-Clin cross-encoder verifier, the standard LLM would have chartered the blocked findings above into the permanent electronic record with false confidence.
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
