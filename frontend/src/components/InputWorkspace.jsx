import React from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Sliders, 
  ArrowRight, 
  AlertCircle, 
  Sparkles,
  User,
  Building,
  CheckCircle2
} from 'lucide-react';
import { CLINICAL_CASES } from '../data/clinicalCases';

export default function InputWorkspace({ 
  selectedCaseKey, 
  onSelectCase, 
  noteText, 
  onNoteTextChange, 
  threshold, 
  onThresholdChange,
  strictness,
  onStrictnessChange,
  onProceedToAudit,
  onOpenGuide 
}) {
  const currentCase = CLINICAL_CASES[selectedCaseKey] || CLINICAL_CASES.trap_aki_negation;

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Patient Encounter Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-mono font-bold text-xs">
            EHR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                MRN: {currentCase.mrn}
              </span>
              <span className="text-sm font-bold text-slate-900">{currentCase.patientName}</span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">&bull; {currentCase.ward}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{currentCase.encounter}</p>
          </div>
        </div>

        <button
          onClick={onOpenGuide}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-sky-600" />
          <span>Examiner Viva Notes</span>
        </button>
      </div>

      {/* Main Intake Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-6">
        
        {/* Trap Selection Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Select Preloaded Adversarial Clinical Case:</span>
            </label>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">1-Click Live Viva Demos</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.keys(CLINICAL_CASES).map((key) => {
              const item = CLINICAL_CASES[key];
              const isSelected = key === selectedCaseKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectCase(key)}
                  className={`text-left p-3.5 rounded-xl border text-xs transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/60 ring-2 ring-sky-600/20 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <div>
                    <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-sky-200/70 text-sky-900' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.trapType}
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs mt-2 mb-1 line-clamp-1">{item.patientName}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.trapDescription}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical Note Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Physician Discharge Dictation / Progress Note:
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {noteText.length} characters &bull; {noteText.split('\n').filter(Boolean).length} lines
            </span>
          </div>

          <textarea
            value={noteText}
            onChange={(e) => onNoteTextChange(e.target.value)}
            rows={10}
            className="w-full p-4 font-mono text-xs sm:text-sm leading-relaxed text-slate-800 bg-slate-50/50 border border-slate-300 rounded-xl outline-none focus:border-sky-600 focus:bg-white transition-colors resize-y"
            placeholder="Paste clinical note text here..."
          />
        </div>

        {/* Safety Parameters & Controls Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid sm:grid-cols-3 gap-6 items-center">
          
          {/* Threshold Slider */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-600" />
                <span>Calibrated Decision Threshold (&tau;*):</span>
              </span>
              <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                &tau;* = {threshold.toFixed(2)} {threshold === 0.35 ? '(Dev Optimal)' : ''}
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.95"
              step="0.01"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0.10 (High Coverage)</span>
              <span>0.35 (F1-Optimal)</span>
              <span>0.95 (Ultra-Strict)</span>
            </div>
          </div>

          {/* Strictness Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Audit Strictness Protocol:
            </label>
            <select
              value={strictness}
              onChange={(e) => onStrictnessChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-sky-600"
            >
              <option value="inpatient">High Precision (Inpatient Safety)</option>
              <option value="triage">Balanced (Outpatient Triage)</option>
              <option value="research">Permissive (Exploratory / Research)</option>
            </select>
          </div>

        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Dual-Stage Safety Engine Armed (Qwen2.5-3B + DeBERTa-v3)</span>
          </div>

          <button
            onClick={onProceedToAudit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-7 py-3 rounded-xl shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
          >
            <span>Proceed to Clinical Verification Audit</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
