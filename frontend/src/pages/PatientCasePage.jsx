import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeft,
  CheckCircle2, Clock, Copy, Download,
  FileSearch, FileText, HeartPulse,
  Loader2, MessageSquare, Pill, PlusCircle,
  Send, ShieldAlert, ShieldCheck, Sparkles, Upload,
  X
} from 'lucide-react';
import { api } from '../api';
import { docTypeMeta, fmtDate, getAlertBadgeStyles } from '../utils/clinicalFormatters';

export function getSuggestedQueries(condition = '', patientId = '') {
  const c = String(condition || '').toLowerCase();
  const pid = String(patientId || '').toUpperCase();
  if (c.includes('stroke') || c.includes('mca') || c.includes('carotid') || pid === 'PT-5120') {
    return [
      'What was the initial NIHSS score and neurological presentation?',
      'What did carotid duplex Doppler and brain MRI reveal?',
      'What antithrombotic therapy and CEA surgical plan was ordered?',
      'What was the discharge rehabilitation and follow-up plan?',
    ];
  }
  if (c.includes('stemi') || c.includes('cardiac') || c.includes('pci') || c.includes('coronary') || pid === 'PT-4091') {
    return [
      'Summarize the cardiac catheterization findings and stent placement',
      'What was the peak creatinine during contrast-induced AKI?',
      'What medications were permanently held or contraindicated and why?',
      'What is the discharge dual antiplatelet therapy (DAPT) protocol?',
    ];
  }
  if (c.includes('embolism') || c.includes('pulmonary') || c.includes('pe') || pid === 'PT-3892') {
    return [
      'What triggered the rapid response activation on post-op day 7?',
      'What were the CT pulmonary angiogram and echocardiogram findings?',
      'How was anticoagulation managed from heparin to oral apixaban?',
      'What were the peak vital abnormalities and discharge SpO2?',
    ];
  }
  return [
    'Summarize the chronological clinical trajectory',
    'What medications were changed, held, or initiated?',
    'What were the abnormal lab findings and peaks?',
    'What discharge plan and follow-up was ordered?',
  ];
}

const PATIENT_BIOMARKER_TRAJECTORIES = {
  'PT-4091': {
    metric: 'Serum Creatinine & eGFR Trajectory',
    primaryUnit: 'mg/dL',
    secondaryUnit: 'mL/min/1.73m²',
    normalThreshold: 1.2,
    warningThreshold: 2.0,
    interpretation: 'Contrast-Associated AKI (KDIGO-2): Post-PCI contrast surge to peak 2.38 mg/dL followed by recovery to 1.51 mg/dL post-hydration.',
    data: [
      { date: '09-14 06:00', label: 'Admission Baseline', primary: 1.02, secondary: 62, phase: 'Baseline' },
      { date: '09-15 14:00', label: 'Post-PCI Cath (145 mL contrast)', primary: 1.25, secondary: 55, phase: 'Post-Procedure' },
      { date: '09-16 08:00', label: 'Post-Cath Day 1', primary: 1.64, secondary: 44, phase: 'Acute Surge' },
      { date: '09-17 07:00', label: 'Nephrology Consult (Peak AKI)', primary: 2.38, secondary: 28, phase: 'Peak Nadir' },
      { date: '09-18 08:00', label: 'Post-Hydration Day 1', primary: 1.84, secondary: 38, phase: 'Recovery' },
      { date: '09-20 12:00', label: 'Hospital Discharge', primary: 1.51, secondary: 49, phase: 'Stabilized' },
    ],
  },
  'PT-3892': {
    metric: 'Oxygen Saturation (SpO2) & Respiratory Rate',
    primaryUnit: '% SpO2',
    secondaryUnit: 'breaths/min',
    normalThreshold: 95,
    warningThreshold: 90,
    interpretation: 'Acute Pulmonary Embolism POD-7: Sudden desaturation to 88% with tachypnea 26 bpm; normalized to 98% on heparin and apixaban.',
    data: [
      { date: '10-18 08:00', label: 'Post-Op Day 4', primary: 98, secondary: 14, phase: 'Baseline' },
      { date: '10-21 13:50', label: 'Rapid Response PE Trigger', primary: 88, secondary: 26, phase: 'Acute Event' },
      { date: '10-21 14:30', label: '4L O2 + Heparin Bolus', primary: 94, secondary: 22, phase: 'Intervention' },
      { date: '10-23 09:00', label: 'Therapeutic Heparin Infusion', primary: 96, secondary: 18, phase: 'Recovery' },
      { date: '10-26 11:00', label: 'Comprehensive Discharge', primary: 98, secondary: 14, phase: 'Stabilized' },
    ],
  },
  'PT-7215': {
    metric: 'Serum Beta-Hydroxybutyrate & Anion Gap',
    primaryUnit: 'mmol/L',
    secondaryUnit: 'mEq/L',
    normalThreshold: 0.5,
    warningThreshold: 2.0,
    interpretation: 'SGLT2-Induced Euglycemic DKA in ESBL Pyelonephritis: Severe ketosis peak at 3.4 mmol/L; full closure to 0.3 mmol/L post-insulin/dextrose.',
    data: [
      { date: '10-04 10:00', label: 'Outpatient Clinic Baseline', primary: 0.2, secondary: 10, phase: 'Baseline' },
      { date: '10-11 14:00', label: 'Urgent Care Presentation', primary: 2.1, secondary: 17, phase: 'Onset' },
      { date: '10-12 09:00', label: 'Inpatient euDKA Peak', primary: 3.4, secondary: 20, phase: 'Acute Peak' },
      { date: '10-14 08:00', label: 'IV Insulin + Ertapenem', primary: 1.1, secondary: 12, phase: 'Resolution' },
      { date: '10-16 12:00', label: 'Inpatient Discharge', primary: 0.3, secondary: 9, phase: 'Stabilized' },
    ],
  },
  'PT-1108': {
    metric: 'Serum Potassium (K+) & Hemodialysis Clearance',
    primaryUnit: 'mEq/L',
    secondaryUnit: 'BUN (mg/dL)',
    normalThreshold: 5.0,
    warningThreshold: 6.5,
    interpretation: 'Emergency Hyperkalemic Crisis: Potassium 7.4 mEq/L with peaked T-waves; stabilized with calcium gluconate and urgent hemodialysis to 4.3 mEq/L.',
    data: [
      { date: '10-19 16:30', label: 'ED Arrival (Missed HD)', primary: 7.4, secondary: 88, phase: 'Critical Emergency' },
      { date: '10-19 17:30', label: 'Calcium + Insulin/D50', primary: 6.5, secondary: 82, phase: 'Membrane Stabilized' },
      { date: '10-20 10:00', label: 'Urgent Hemodialysis #1', primary: 4.8, secondary: 45, phase: 'Dialysis Clearance' },
      { date: '10-22 09:00', label: 'Hemodialysis #2', primary: 4.4, secondary: 38, phase: 'Maintenance' },
      { date: '10-24 11:00', label: 'Maintenance Discharge', primary: 4.3, secondary: 34, phase: 'Stabilized' },
    ],
  },
  'PT-9302': {
    metric: 'Peak Expiratory Flow Rate (PEFR)',
    primaryUnit: 'L/min',
    secondaryUnit: '% Predicted',
    normalThreshold: 240,
    warningThreshold: 150,
    interpretation: 'Status Asthmaticus Exacerbation: Severe bronchospasm (PEFR 110 L/min, 36%); escalated to continuous albuterol and discharge Advair at 280 L/min (93%).',
    data: [
      { date: '10-14 19:15', label: 'ED Arrival (Status Asthmaticus)', primary: 110, secondary: 36, phase: 'Red Zone' },
      { date: '10-15 08:00', label: 'Continuous Albuterol + MgSO4', primary: 180, secondary: 60, phase: 'Yellow Zone' },
      { date: '10-16 09:00', label: 'Oral Prednisolone Burst', primary: 230, secondary: 76, phase: 'Improvement' },
      { date: '10-18 11:00', label: 'Discharge Asthma Action Plan', primary: 280, secondary: 93, phase: 'Green Zone' },
    ],
  },
  'PT-5120': {
    metric: 'NIH Stroke Scale (NIHSS) Neurological Deficit',
    primaryUnit: 'Score (0-42)',
    secondaryUnit: 'Residual Deficit',
    normalThreshold: 4,
    warningThreshold: 10,
    interpretation: 'Acute MCA Ischemic Stroke: Emergent Tenecteplase tPA administered at 42-minute door-to-needle time; NIHSS improved from 11 to 3.',
    data: [
      { date: '10-22 09:30', label: 'Emergency Stroke Arrival', primary: 11, secondary: 80, phase: 'Severe Deficit' },
      { date: '10-22 10:30', label: 'Post-Tenecteplase (tPA)', primary: 7, secondary: 50, phase: 'Reperfusion' },
      { date: '10-23 09:00', label: 'Neuro-ICU Day 1', primary: 5, secondary: 30, phase: 'Improvement' },
      { date: '10-27 12:00', label: 'Discharge Rehab Evaluation', primary: 3, secondary: 15, phase: 'Mild Residual' },
    ],
  },
  'PT-6023': {
    metric: 'Oncotype DX Recurrence Risk & Chemotherapy Benefit',
    primaryUnit: 'Score (0-100)',
    secondaryUnit: '9-Yr Distant Risk %',
    normalThreshold: 15,
    warningThreshold: 25,
    interpretation: 'Stage IA (pT1c pN0) ER+/PR+/HER2- Breast Cancer: Low recurrence score of 14 establishes 0% absolute chemotherapy benefit (TAILORx trial).',
    data: [
      { date: '08-02', label: 'Screening Ultrasound Core Biopsy', primary: 20, secondary: 12, phase: 'Initial Biopsy' },
      { date: '08-18', label: 'Lumpectomy + Sentinel Nodes (0/3)', primary: 15, secondary: 8, phase: 'Surgical Resection' },
      { date: '08-25', label: 'Oncotype DX 21-Gene Assay', primary: 14, secondary: 3, phase: 'Genomic Low-Risk' },
      { date: '09-02', label: 'Tumor Board: Chemo Deferred', primary: 14, secondary: 3, phase: 'Endocrine Regimen' },
    ],
  },
  'PT-8144': {
    metric: 'Intra-Compartmental Pressure (Delta-P)',
    primaryUnit: 'mmHg Pressure',
    secondaryUnit: 'Diastolic Delta-P',
    normalThreshold: 30,
    warningThreshold: 25,
    interpretation: 'Acute Compartment Syndrome: Anterior compartment surged to 48 mmHg (Delta-P 24 mmHg); normalized post-4-compartment fasciotomy.',
    data: [
      { date: '10-05 19:00', label: 'Level 1 Trauma Admission', primary: 18, secondary: 54, phase: 'Pre-Surgical' },
      { date: '10-06 03:30', label: 'Acute Compartment Surge', primary: 48, secondary: 24, phase: 'Ischemic Danger' },
      { date: '10-06 05:00', label: 'Post-Fasciotomy Decompression', primary: 14, secondary: 58, phase: 'Relieved' },
      { date: '10-12 10:00', label: 'STSG Skin Graft & Tibial Nail', primary: 12, secondary: 60, phase: 'Reconstructed' },
      { date: '10-18 12:00', label: 'Discharge Partial Weight Bearing', primary: 10, secondary: 62, phase: 'Recovered' },
    ],
  },
  'PT-2419': {
    metric: 'Orthostatic Blood Pressure (Systolic Drop)',
    primaryUnit: 'Supine SBP (mmHg)',
    secondaryUnit: 'Standing SBP (mmHg)',
    normalThreshold: 130,
    warningThreshold: 100,
    interpretation: 'Polypharmacy Orthostatic Syncope: Standing BP collapsed to 94 mmHg on HCTZ + Zolpidem; restored to 128 mmHg post-deprescribing.',
    data: [
      { date: '09-28 15:40', label: 'ED Fall Syncope (on Ambien/HCTZ)', primary: 148, secondary: 94, phase: 'Severe Orthostasis' },
      { date: '09-30 10:00', label: 'Deprescribing Day 2', primary: 138, secondary: 112, phase: 'Hemodynamic Recovery' },
      { date: '10-02 09:00', label: 'Physical Therapy TUG Test', primary: 132, secondary: 120, phase: 'Functional Mobility' },
      { date: '10-04 11:00', label: 'Discharge without Falls', primary: 128, secondary: 124, phase: 'Euvolemic Normal' },
    ],
  },
};

function resolvePatientTrajectory(patientId, profile) {
  if (PATIENT_BIOMARKER_TRAJECTORIES[patientId]) {
    return PATIENT_BIOMARKER_TRAJECTORIES[patientId];
  }
  const cond = String(profile?.condition || '').toLowerCase();
  if (cond.includes('stroke') || cond.includes('mca') || cond.includes('neuro') || patientId === 'PT-5120') {
    return {
      metric: 'Neurological Deficit (NIHSS) & Mean Arterial Pressure (MAP)',
      primaryUnit: 'NIHSS Points',
      secondaryUnit: 'MAP (mmHg)',
      normalThreshold: 1,
      warningThreshold: 6,
      interpretation: 'Acute Cerebral Ischemia: Initial NIHSS presentation of 4 points stabilized post-antiplatelet therapy and statin optimization to discharge NIHSS 1.',
      data: [
        { date: '10-22 08:20', label: 'Emergency Stroke Arrival', primary: 4, secondary: 112, phase: 'Acute Presentation' },
        { date: '10-23 10:00', label: 'Carotid Duplex & MRI DWI', primary: 4, secondary: 104, phase: 'Intervention / DAPT' },
        { date: '10-25 09:00', label: 'Physical & Speech Therapy', primary: 2, secondary: 94, phase: 'Neuro Recovery' },
        { date: '10-27 12:30', label: 'Discharge to Home (CEA Planned)', primary: 1, secondary: 88, phase: 'Stabilized' },
      ],
    };
  }
  return {
    metric: 'Oxygen Saturation (SpO2) & Heart Rate Trajectory',
    primaryUnit: '% SpO2',
    secondaryUnit: 'Heart Rate (bpm)',
    normalThreshold: 95,
    warningThreshold: 90,
    interpretation: 'Clinical Vital Signs Trajectory: Encounter measurements show stabilization across documented hospital stay.',
    data: [
      { date: 'Encounter 1', label: 'Initial Evaluation', primary: 95, secondary: 84, phase: 'Admission' },
      { date: 'Encounter 2', label: 'Clinical Course', primary: 96, secondary: 78, phase: 'Monitoring' },
      { date: 'Encounter 3', label: 'Discharge Phase', primary: 98, secondary: 72, phase: 'Stabilized' },
    ],
  };
}

function ClinicalTrajectoryGraph({ patientId, profile }) {
  const trajectory = resolvePatientTrajectory(patientId, profile);
  if (!trajectory) return null;

  const [activePoint, setActivePoint] = useState(trajectory.data[trajectory.data.length - 1]);
  const [activeMetric, setActiveMetric] = useState('primary');

  const points = trajectory.data;
  const values = points.map((p) => (activeMetric === 'primary' ? p.primary : p.secondary));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const paddingX = 40;
  const paddingY = 25;
  const width = 600;
  const height = 150;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const coords = points.map((p, idx) => {
    const val = activeMetric === 'primary' ? p.primary : p.secondary;
    const x = paddingX + (idx / (points.length - 1)) * chartW;
    const y = paddingY + chartH - ((val - minVal) / range) * chartH;
    return { x, y, point: p, val };
  });

  const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaStr = `${coords[0].x},${height - paddingY + 5} ` + coords.map((c) => `${c.x},${c.y}`).join(' ') + ` ${coords[coords.length - 1].x},${height - paddingY + 5}`;

  const currentUnit = activeMetric === 'primary' ? trajectory.primaryUnit : trajectory.secondaryUnit;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Longitudinal Clinical Biomarker Trajectory
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{trajectory.metric}</p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveMetric('primary');
              setActivePoint(points[points.length - 1]);
            }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              activeMetric === 'primary' ? 'bg-white text-teal-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {trajectory.primaryUnit}
          </button>
          <button
            onClick={() => {
              setActiveMetric('secondary');
              setActivePoint(points[points.length - 1]);
            }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              activeMetric === 'secondary' ? 'bg-white text-teal-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {trajectory.secondaryUnit}
          </button>
        </div>
      </div>

      <div className="relative rounded-xl bg-slate-50/70 p-3 border border-slate-100">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
          <defs>
            <linearGradient id={`grad-${patientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingY + chartH / 2} x2={width - paddingX} y2={paddingY + chartH / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" />

          <polygon points={areaStr} fill={`url(#grad-${patientId})`} />
          <polyline fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polylineStr} />

          {coords.map((c, i) => {
            const isSelected = activePoint === c.point;
            return (
              <g key={i} className="cursor-pointer" onClick={() => setActivePoint(c.point)}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? '#0f766e' : '#ffffff'}
                  stroke="#0d9488"
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all hover:scale-125"
                />
                <text x={c.x} y={height - paddingY + 16} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono">
                  {c.point.date.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {activePoint && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-teal-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800 text-xs font-bold font-mono">
                {activeMetric === 'primary' ? activePoint.primary : activePoint.secondary}
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  {activePoint.label}
                  <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.2 rounded border border-teal-200">
                    {activePoint.phase}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono">Date: {activePoint.date}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-900">
                {activeMetric === 'primary' ? activePoint.primary : activePoint.secondary} {currentUnit}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-teal-50/40 p-3 border border-teal-100 text-xs text-teal-950 flex items-start gap-2">
        <HeartPulse className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          <span className="font-bold text-teal-900">Physician Trajectory Synthesis: </span>
          {trajectory.interpretation}
        </p>
      </div>
    </div>
  );
}

function formatDocName(filename = '') {
  if (!filename) return 'Clinical Record';
  return filename
    .replace(/^PT-\d+_\d{4}-\d{2}-\d{2}_/, '')
    .replace(/\.txt$/, '')
    .replace(/\.pdf$/, '')
    .replace(/_/g, ' ');
}

function FormattedClinicalText({ content, evidence = [], onSelectCitation }) {
  if (!content) return null;

  // Build lookup map for evidence
  const evidenceMap = new Map();
  evidence.forEach((item, idx) => {
    if (item?.passage_id) {
      evidenceMap.set(item.passage_id, { ...item, refIndex: idx + 1 });
    }
  });

  // Clean any trailing raw "Sources: ..." text to avoid duplication
  const cleanContent = content
    .replace(/\n+\s*(\*\*)?Sources( Referenced)?:?(\*\*)?[\s\S]*$/i, '')
    .trim();

  const lines = cleanContent.split('\n');

  const renderInline = (text) => {
    const tokenRegex = /(\[[a-zA-Z0-9_\-:]+\]|\*\*[^*]+\*\*)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, pIdx) => {
      if (!part) return null;

      // Citation tags
      if (part.startsWith('[') && part.endsWith(']')) {
        const tag = part.slice(1, -1);
        const hit = evidenceMap.get(tag);
        if (hit) {
          return (
            <button
              key={pIdx}
              type="button"
              onClick={() => onSelectCitation && onSelectCitation(hit)}
              className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.2 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-mono font-bold hover:bg-teal-100 hover:border-teal-400 transition-colors align-baseline shadow-2xs"
              title={`Source: ${formatDocName(hit.filename)}`}
            >
              Ref {hit.refIndex}
            </button>
          );
        }
        if (/^\d+$/.test(tag)) {
          const numIdx = parseInt(tag, 10);
          const hitByNum = evidence[numIdx - 1];
          if (hitByNum) {
            return (
              <button
                key={pIdx}
                type="button"
                onClick={() => onSelectCitation && onSelectCitation(hitByNum)}
                className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.2 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-mono font-bold hover:bg-teal-100 hover:border-teal-400 transition-colors align-baseline shadow-2xs"
                title={`Source: ${formatDocName(hitByNum.filename)}`}
              >
                Ref {tag}
              </button>
            );
          }
        }
        // Don't format HIPAA tags like [PATIENT_ID], [DATE], [AGE] as citation buttons
        return <span key={pIdx} className="text-slate-500 font-mono text-[11px]">{part}</span>;
      }

      // Bold text
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={pIdx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }

      return <span key={pIdx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-800">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-1" />;

        // Header lines: ### Header or **1. Header**
        if (trimmed.startsWith('###') || (/^\*\*\d+\./.test(trimmed) && trimmed.endsWith('**'))) {
          const title = trimmed.replace(/^###\s*/, '').replace(/^\*\*|\*\*$/g, '');
          return (
            <div key={lIdx} className="pt-2 pb-0.5 text-xs font-bold text-slate-900 border-b border-slate-100 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-600 shrink-0" />
              {title}
            </div>
          );
        }

        // Bullet items: • or * or -
        if (/^[•*-]\s+/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[•*-]\s+/, '');
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-0.5">
              <span className="text-teal-600 font-bold leading-5 select-none shrink-0">•</span>
              <div className="flex-1">{renderInline(bulletText)}</div>
            </div>
          );
        }

        // Standard text
        return <p key={lIdx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function PatientCaseSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-36" />
            <div className="flex items-center gap-3">
              <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              <div className="h-7 w-48 bg-slate-200 rounded-lg" />
              <div className="h-6 w-24 bg-slate-100 rounded-full" />
            </div>
            <div className="h-4 bg-slate-100 rounded w-80" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-slate-100 rounded-xl" />
            <div className="h-9 w-28 bg-slate-100 rounded-xl" />
            <div className="h-9 w-28 bg-slate-900/10 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-32 bg-slate-200 rounded-xl" />
        ))}
      </div>

      {/* KPI Row Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/3" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-5 bg-slate-200 rounded w-64" />
        <div className="h-40 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function PatientCasePage() {
  const { patientId } = useParams();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'synthesis' | 'medications' | 'reports' | 'copilot'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [patientProfile, setPatientProfile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Document chat states
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // File upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Pinned findings & action state
  const [pinnedFindings, setPinnedFindings] = useState([]);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(null);

  // Prescription modal states
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [rxMeds, setRxMeds] = useState([
    { name: 'Ticagrelor', brand: 'Brilinta', dose: '90 mg', route: 'PO', frequency: 'BID', duration: '12 months', indication: 'Dual antiplatelet therapy' },
    { name: 'Aspirin', brand: 'Ecotrin', dose: '81 mg', route: 'PO', frequency: 'QD', duration: 'Indefinite', indication: 'Cardioprotection' },
  ]);
  const [rxHeldName, setRxHeldName] = useState('Lisinopril');
  const [rxHeldReason, setRxHeldReason] = useState('Contrast-Induced Acute Kidney Injury (KDIGO Stage 2)');
  const [rxAllergies, setRxAllergies] = useState('No Known Drug Allergies (NKDA)');
  const [rxPhysician, setRxPhysician] = useState('Attending Clinician, MD');
  const [rxNotes, setRxNotes] = useState('Re-check BUN and Serum Creatinine in outpatient clinic in 7 days before resuming ACE inhibitors.');
  const [tokenizedResult, setTokenizedResult] = useState(null);
  const [tokenizing, setTokenizing] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
  const [rxSuccess, setRxSuccess] = useState('');

  const chatEndRef = useRef(null);

  // Load patient data & initial clinical analysis
  const loadPatientData = async () => {
    setLoading(true);
    setError('');
    try {
      const [docsRes, analysisRes, profileRes] = await Promise.all([
        api.patientDocuments(patientId),
        api.analyse(patientId),
        api.getPatient(patientId).catch(() => null),
      ]);

      setDocuments(docsRes.documents || []);
      setAnalysisData(analysisRes);
      if (profileRes) setPatientProfile(profileRes);

      // Pre-seed chat with the grounded clinical analysis
      if (analysisRes && analysisRes.answer) {
        setMessages([
          {
            role: 'assistant',
            content: analysisRes.answer,
            citations: analysisRes.citations || [],
            evidence: analysisRes.evidence || [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient case');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  // Handle Tokenize Prescription
  const handleTokenize = async () => {
    setTokenizing(true);
    try {
      const payload = {
        patient_id: patientId,
        patient_name: profile.name,
        prescribing_physician: rxPhysician,
        encounter_date: new Date().toISOString().split('T')[0],
        medications: rxMeds.filter((m) => m.name.trim()),
        held_medications: rxHeldName.trim() ? [{ name: rxHeldName, reason: rxHeldReason }] : [],
        allergies: rxAllergies,
        clinical_notes: rxNotes,
      };
      const res = await api.tokenizePrescription(payload);
      setTokenizedResult(res);
    } catch (err) {
      setError(`Tokenization failed: ${err.message}`);
    } finally {
      setTokenizing(false);
    }
  };

  // Handle Save Prescription
  const handleSaveRx = async () => {
    setSavingRx(true);
    setRxSuccess('');
    try {
      const payload = {
        patient_id: patientId,
        patient_name: profile.name,
        prescribing_physician: rxPhysician,
        encounter_date: new Date().toISOString().split('T')[0],
        medications: rxMeds.filter((m) => m.name.trim()),
        held_medications: rxHeldName.trim() ? [{ name: rxHeldName, reason: rxHeldReason }] : [],
        allergies: rxAllergies,
        clinical_notes: rxNotes,
      };
      const res = await api.savePrescription(payload);
      setRxSuccess(`Successfully saved & embedded prescription "${res.filename}" into patient chart!`);
      await loadPatientData();
      setTimeout(() => {
        setShowPrescriptionModal(false);
        setActiveTab('reports');
      }, 1500);
    } catch (err) {
      setError(`Saving prescription failed: ${err.message}`);
    } finally {
      setSavingRx(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Send query to clinical document chat
  const handleSendMessage = async (queryText = chatInput) => {
    const q = queryText.trim();
    if (!q || chatLoading) return;

    const userMsg = {
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.analyse(patientId, q);
      const assistantMsg = {
        role: 'assistant',
        content: res.answer || 'No specific clinical findings documented for this question.',
        citations: res.citations || [],
        evidence: res.evidence || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Clinical Assistant Error: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Upload new document for this patient
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadSuccess('');
    try {
      await api.upload(uploadFile, patientId);
      setUploadSuccess(`Successfully attached "${uploadFile.name}" to patient record.`);
      setUploadFile(null);
      await loadPatientData();
      setActiveTab('reports');
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const profile = patientProfile || {
    name: `Patient ${patientId}`,
    condition: 'Clinical Inpatient Record',
    department: 'General Inpatient Medicine',
    status: 'Active Record',
    status_color: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  if (loading && !patientProfile) {
    return <PatientCaseSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Patient Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to="/patients"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 mb-2 transition-colors print:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Patient Directory
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xl font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {patientId}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${profile.status_color || profile.statusColor || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                {profile.status}
              </span>
              {profile.sentiment?.acuity_level && (
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${profile.sentiment.acuity_color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {profile.sentiment.acuity_level}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-600">
              <span className="font-semibold text-slate-900">Diagnosis / Trajectory: </span>
              {profile.condition}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0 print:hidden">
            <button
              onClick={() => {
                setTokenizedResult(null);
                setRxSuccess('');
                setShowPrescriptionModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 shadow-sm hover:bg-teal-100 transition-colors"
            >
              <Pill className="h-3.5 w-3.5 text-teal-700" />
              Issue Prescription
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5 text-teal-700" />
              Attach Report
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-900 shadow-sm hover:bg-indigo-100 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-700" />
              Clinical Copilot
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export Summary
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Executive Clinical Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3 print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'overview'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Clinical Overview & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('synthesis')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'synthesis'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Clinical Trajectory Synthesis
        </button>
        <button
          onClick={() => setActiveTab('medications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'medications'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          Medication Reconciliation & Orders
          {profile?.active_medications?.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'medications' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {profile.active_medications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'reports'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Clinical Encounters ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'copilot'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Clinical Copilot & Inquiry
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        </button>
      </div>

      {/* ── TAB 1: CLINICAL OVERVIEW & TELEMETRY ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm space-y-3">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600" />
              <p>Synthesizing grounded clinical telemetry and trajectory...</p>
            </div>
          ) : (
            <>
              {/* Executive KPI Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-teal-700 mb-2">
                    <HeartPulse className="h-5 w-5" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${profile?.sentiment?.acuity_color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {profile?.sentiment?.acuity_level || 'Acuity'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-slate-900">
                    {profile?.sentiment?.trajectory_score > 0 ? `+${profile.sentiment.trajectory_score}` : profile?.sentiment?.trajectory_score || '0.00'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{profile?.sentiment?.sentiment_label || 'Trajectory Polarity'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-indigo-700 mb-2">
                    <Pill className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      Reconciled
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {profile?.active_medications?.length || 0} <span className="text-xs font-normal text-slate-500">Active</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-1 font-medium">
                    {profile?.held_medications?.length || 0} Held / Contraindicated
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-blue-700 mb-2">
                    <FileText className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      Evidence
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{documents.length} <span className="text-xs font-normal text-slate-500">Records</span></p>
                  <p className="text-xs text-slate-500 mt-1">
                    {documents.reduce((acc, d) => acc + (d.passage_count || 0), 0)} Grounded Passages
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-teal-700 mb-2">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                      CDSS
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {profile?.watchdog_alerts?.length || 0} <span className="text-xs font-normal text-slate-500">Alerts</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {profile?.watchdog_alerts?.length > 0 ? 'Surveillance Active' : 'Guideline Concordant'}
                  </p>
                </div>
              </div>

              {/* PROACTIVE CLINICAL SAFETY & CDSS WATCHDOG */}
              {profile?.watchdog_alerts && profile.watchdog_alerts.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-teal-700" />
                      <h2 className="text-sm font-bold text-slate-900">
                        Proactive Clinical Decision Support & Safety Watchdog ({profile.watchdog_alerts.length})
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Active Surveillance
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {profile.watchdog_alerts.map((alert, ai) => {
                      const alertStyles = getAlertBadgeStyles(alert.level);
                      return (
                        <div
                          key={ai}
                          className={`rounded-xl border p-4 text-xs space-y-1.5 shadow-2xs ${alertStyles.card}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${alertStyles.dot}`} />
                              {alert.title}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${alertStyles.badge}`}>
                              {alert.level}
                            </span>
                          </div>
                          <p className="leading-relaxed opacity-95">{alert.recommendation}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Longitudinal Biomarker Trajectory Graph */}
              <ClinicalTrajectoryGraph patientId={patientId} profile={profile} />

              {/* Chronological Trajectory Stages */}
              {analysisData?.stages && analysisData.stages.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Clock className="h-4 w-4 text-teal-700" />
                    <h2 className="text-sm font-bold text-slate-900">
                      Chronological Clinical Care Trajectory
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisData.stages.map((stg, i) => (
                      <div
                        key={stg.stage || i}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-teal-300 hover:bg-teal-50/20 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white font-bold">
                              {i + 1}
                            </span>
                            {stg.title}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {stg.sub?.split(':')[0]}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed font-sans">
                          <FormattedClinicalText
                            content={stg.synthesis}
                            evidence={analysisData?.evidence || []}
                            onSelectCitation={setSelectedCitation}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagged Clinical Alerts */}
              {analysisData?.flags && analysisData.flags.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-slate-900">
                      Active Clinical Problem List & Risk Flags ({analysisData.flags.length})
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisData.flags.map((flag) => (
                      <div
                        key={flag.flag_id}
                        className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950">{flag.label}</span>
                          <span className="font-mono text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                            {(flag.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{flag.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: COMPREHENSIVE CLINICAL SYNTHESIS ── */}
      {activeTab === 'synthesis' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Comprehensive Patient Trajectory Synthesis (SBAR Format)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grounded strictly across {patientId}'s {documents.length} clinical records with passage-level evidence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = analysisData?.summary || analysisData?.answer || '';
                    navigator.clipboard.writeText(`CLINICAL PROGRESS NOTE — PATIENT ${patientId}\n\n${text}`);
                    setCopiedMsgIdx(999);
                    setTimeout(() => setCopiedMsgIdx(null), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  {copiedMsgIdx === 999 ? 'Copied to EHR!' : 'Copy as EHR Note'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Print / Export
                </button>
              </div>
            </div>

            <div className="bg-slate-50/60 p-6 rounded-xl border border-slate-100 leading-relaxed text-xs">
              <FormattedClinicalText
                content={analysisData?.summary || analysisData?.answer}
                evidence={analysisData?.evidence || []}
                onSelectCitation={setSelectedCitation}
              />
            </div>
          </div>

          {/* Pinned Clinical Insights */}
          {pinnedFindings.length > 0 && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/20 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Pinned Clinical Actions & Verified Observations ({pinnedFindings.length})
                  </h2>
                </div>
                <button
                  onClick={() => setPinnedFindings([])}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  Clear All Pinned
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pinnedFindings.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>
                    <div className="text-xs text-slate-700 leading-relaxed font-sans">
                      <FormattedClinicalText
                        content={item.content}
                        evidence={analysisData?.evidence || []}
                        onSelectCitation={setSelectedCitation}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: MEDICATION RECONCILIATION & ORDERS ── */}
      {activeTab === 'medications' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="h-4 w-4 text-teal-700" />
                  Inpatient Medication Reconciliation & Orders
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuously reconciled against clinical records, operative notes, and outpatient discharge orders.
                </p>
              </div>

              <button
                onClick={() => {
                  setTokenizedResult(null);
                  setRxSuccess('');
                  setShowPrescriptionModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors shrink-0"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Issue New Prescription Order
              </button>
            </div>

            {/* Contraindicated / Permanently Held Section */}
            {profile?.held_medications && profile.held_medications.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-900">
                    Contraindicated & Permanently Held Medications ({profile.held_medications.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {profile.held_medications.map((hm, hmi) => (
                    <div key={hmi} className="rounded-lg border border-red-200 bg-white p-3 text-xs flex items-start gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-[10px] shrink-0 mt-0.5">
                        ✕
                      </span>
                      <div>
                        <p className="font-bold text-red-950">{hm}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Safety restriction actively monitored by Clinical Watchdog.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Prescriptions List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Active Reconciled Medications ({profile?.active_medications?.length || 0})
              </h3>

              {profile?.active_medications && profile.active_medications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.active_medications.map((med, mi) => (
                    <div
                      key={mi}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 hover:border-teal-300 hover:bg-teal-50/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 text-teal-800 text-xs font-bold">
                            {mi + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{med}</span>
                        </div>
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  No active medications reconciled yet. Click "Issue New Prescription Order" to add medications.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ENCOUNTERS & INDEXED REPORTS ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Indexed Clinical Reports & Encounters
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All clinical documents indexed specifically for patient {patientId}.
                </p>
              </div>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                {documents.length} Files
              </span>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No documents indexed for this patient yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => {
                  const meta = docTypeMeta(doc.filename);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={doc.document_id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:border-teal-400 hover:bg-teal-50/20 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-teal-700" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1">
                            {doc.filename}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                              {meta.label}
                            </span>
                            {doc.encounter_date && (
                              <span>Date: {fmtDate(doc.encounter_date)}</span>
                            )}
                            <span>· {doc.passage_count} passages</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            try {
                              const fullDoc = await api.getDocument(doc.document_id);
                              setSelectedDoc(fullDoc);
                            } catch (err) {
                              setError(`Failed to load document: ${err.message}`);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                        >
                          <FileSearch className="h-3 w-3 text-slate-400" />
                          View Report
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Attach Report Dropzone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Attach New Clinical Encounter Report
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Uploaded files are automatically de-identified, chunked into passages, embedded with dense vectors, and permanently added to the patient's record.
              </p>
            </div>

            {uploadSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
                {uploadSuccess}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center hover:border-teal-500/50 transition-colors">
                <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {uploadFile ? uploadFile.name : 'Select a clinical document (PDF or TXT)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Progress notes, lab sheets, diagnostic radiology reports, or consult notes.
                </p>
                <input
                  type="file"
                  accept=".txt,.pdf"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="mt-4 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      De-identifying & Embedding...
                    </>
                  ) : (
                    'Upload & Index Document'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Inline Document Viewer Modal */}
          {selectedDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-700" />
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                      {selectedDoc.filename}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed">
                    {selectedDoc.extracted_text || selectedDoc.clean_text || selectedDoc.raw_text}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Close Viewer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: CLINICAL COPILOT & INQUIRIES ── */}
      {activeTab === 'copilot' && (
        <div className="space-y-6">
          <div className="flex flex-col h-[750px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Copilot Header */}
            <div className="bg-slate-900 p-4 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold tracking-tight text-white flex items-center gap-2">
                      Veritas Clinical Assistant
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Grounded strictly in {patientId}'s {documents.length} clinical records
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">
                  Zero Hallucination
                </span>
              </div>
            </div>

            {/* Suggested Queries Chips */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 shrink-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                Suggested Clinical Inquiries:
              </p>
              <div className="flex flex-wrap gap-2">
                {getSuggestedQueries(profile.condition, patientId).map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sq)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 transition-colors shadow-2xs"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Messages Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/30">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {m.role === 'user' ? 'Clinician' : 'Clinical AI Assistant'}
                    </span>
                    <span className="text-[9px] text-slate-300">{m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-4 text-xs leading-relaxed shadow-xs ${
                      m.role === 'user'
                        ? 'bg-teal-700 text-white rounded-br-none font-medium'
                        : m.isError
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none font-sans'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <FormattedClinicalText
                        content={m.content}
                        evidence={m.evidence || []}
                        onSelectCitation={setSelectedCitation}
                      />
                    )}

                    {/* Grounded Evidence Sources */}
                    {m.role === 'assistant' && !m.isError && (
                      (() => {
                        const citedSet = new Set(m.citations || []);
                        const cited = (m.evidence || []).filter((e) => citedSet.has(e.passage_id));
                        const displayList = cited.length > 0 ? cited : (m.evidence || []).slice(0, 4);
                        if (!displayList || displayList.length === 0) return null;

                        return (
                          <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Grounded Evidence Sources ({displayList.length}):
                              </span>
                              <span className="text-[10px] text-teal-700 font-medium">Click source to inspect excerpt</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {displayList.map((item, ci) => {
                                const refNum = (m.evidence || []).findIndex((e) => e.passage_id === item.passage_id) + 1;
                                return (
                                  <button
                                    key={ci}
                                    type="button"
                                    onClick={() => setSelectedCitation(item)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition-colors shadow-2xs group"
                                    title={`Click to review exact passage from ${item.filename}`}
                                  >
                                    <span className="font-mono font-bold text-teal-700 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[10px] group-hover:border-teal-300">
                                      Ref {refNum > 0 ? refNum : ci + 1}
                                    </span>
                                    <span className="font-medium truncate max-w-[260px]">
                                      {formatDocName(item.filename)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {/* Clinician Action Toolbar */}
                    {m.role === 'assistant' && !m.isError && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Action on Insight:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const firstLine = m.content.split('\n')[0].replace(/^\*\*|\*\*$/g, '').slice(0, 50) || 'Verified Clinical Finding';
                              setPinnedFindings((prev) => [
                                ...prev,
                                {
                                  id: Date.now(),
                                  title: firstLine,
                                  content: m.content,
                                  timestamp: m.timestamp,
                                },
                              ]);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition-colors shadow-2xs"
                            title="Pin this verified clinical insight into patient's active chart"
                          >
                            <CheckCircle2 className="h-3 w-3 text-teal-700" />
                            Pin to Chart
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`CLINICAL PROGRESS NOTE — PATIENT ${patientId}\n\n${m.content}\n\nSources Referenced: ${(m.citations || []).join(', ')}`);
                              setCopiedMsgIdx(i);
                              setTimeout(() => setCopiedMsgIdx(null), 2000);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                            title="Copy clinical synthesis formatted for EHR progress note"
                          >
                            <Copy className="h-3 w-3 text-slate-500" />
                            {copiedMsgIdx === i ? 'Copied to EHR!' : 'Copy as EHR Note'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 p-3 text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-fit">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
                  <span>Synthesizing evidence-grounded clinical response...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Citation Inspector Popover */}
            {selectedCitation && (
              <div className="bg-white border-t border-teal-200 p-4 shadow-lg text-xs space-y-2 animate-in slide-in-from-bottom-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-100 text-teal-700 font-bold text-[10px]">
                      Ref
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {formatDocName(selectedCitation.filename)}
                    </span>
                    {selectedCitation.page && (
                      <span className="text-[10px] text-slate-400">Page {selectedCitation.page}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCitation(null)}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <blockquote className="border-l-2 border-teal-600 pl-3 py-1.5 text-xs text-slate-700 italic bg-teal-50/40 rounded-r-lg leading-relaxed">
                  "{selectedCitation.passage}"
                </blockquote>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span className="font-mono truncate max-w-[420px]">{selectedCitation.filename}</span>
                  <span>ID: {selectedCitation.passage_id.slice(0, 12)}...</span>
                </div>
              </div>
            )}

            {/* Chat Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Ask anything regarding patient ${patientId}'s clinical history, diagnostics, trajectory, or medications...`}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm hover:bg-teal-800 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PRESCRIPTION COMPOSER & ENTITY TOKENIZER MODAL */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Clinical Prescription & NLP Entity Tokenizer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Compose structured medications for <span className="font-semibold text-slate-900">{profile.name}</span> ({patientId}), extract clinical tokens, and embed into chart.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {rxSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{rxSuccess}</span>
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Prescriber & Patient Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Patient ID & Name</label>
                  <p className="text-xs font-semibold text-slate-900 font-mono">{patientId} · {profile.name}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prescribing Clinician</label>
                  <input
                    type="text"
                    value={rxPhysician}
                    onChange={(e) => setRxPhysician(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Allergies / Sensitivities</label>
                  <input
                    type="text"
                    value={rxAllergies}
                    onChange={(e) => setRxAllergies(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Medication Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Prescribed Medications ({rxMeds.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setRxMeds([...rxMeds, { name: '', brand: '', dose: '', route: 'PO', frequency: 'BID', duration: '', indication: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Medication
                  </button>
                </div>

                {rxMeds.map((med, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-[10px] text-teal-800 font-bold">
                          {idx + 1}
                        </span>
                        Medication #{idx + 1}
                      </span>
                      {rxMeds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRxMeds(rxMeds.filter((_, i) => i !== idx))}
                          className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Generic Drug Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Ticagrelor"
                          value={med.name}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].name = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Brand / Trade Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Brilinta"
                          value={med.brand}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].brand = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Dose & Strength</label>
                        <input
                          type="text"
                          placeholder="e.g. 90 mg"
                          value={med.dose}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].dose = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Route</label>
                        <select
                          value={med.route}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].route = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        >
                          <option value="PO">Oral (PO)</option>
                          <option value="IV">Intravenous (IV)</option>
                          <option value="SC">Subcutaneous (SC)</option>
                          <option value="IM">Intramuscular (IM)</option>
                          <option value="SL">Sublingual (SL)</option>
                          <option value="Inhalation">Inhalation</option>
                          <option value="Topical">Topical</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Frequency (Sig)</label>
                        <select
                          value={med.frequency}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].frequency = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        >
                          <option value="QD">Once daily (QD)</option>
                          <option value="BID">Twice daily (BID)</option>
                          <option value="TID">Three times daily (TID)</option>
                          <option value="QID">Four times daily (QID)</option>
                          <option value="PRN">As needed (PRN)</option>
                          <option value="QHS">At bedtime (QHS)</option>
                          <option value="Q8H">Every 8 hours (Q8H)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 12 months / 10 days"
                          value={med.duration}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].duration = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Clinical Indication</label>
                        <input
                          type="text"
                          placeholder="e.g. Post-PCI LAD Stenting"
                          value={med.indication}
                          onChange={(e) => {
                            const updated = [...rxMeds];
                            updated[idx].indication = e.target.value;
                            setRxMeds(updated);
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Held / Contraindicated Medications */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
                <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Contraindicated / Permanently Held Medication Order
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-rose-800 mb-0.5">Drug Name to Hold</label>
                    <input
                      type="text"
                      placeholder="e.g. Lisinopril 20 mg"
                      value={rxHeldName}
                      onChange={(e) => setRxHeldName(e.target.value)}
                      className="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-rose-800 mb-0.5">Contraindication Rationale</label>
                    <input
                      type="text"
                      placeholder="e.g. Contrast-Associated Acute Kidney Injury"
                      value={rxHeldReason}
                      onChange={(e) => setRxHeldReason(e.target.value)}
                      className="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Instructions & Clinical Notes */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Clinical Instructions & Follow-up Notes</label>
                <textarea
                  rows={2}
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  placeholder="e.g. Re-check BUN and Serum Creatinine in outpatient clinic in 7 days before resuming ACE inhibitors."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* Tokenized NLP Entity Output Preview */}
              {tokenizedResult && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-teal-700" />
                      Extracted NLP Entities ({tokenizedResult.total_tokens_extracted} Tokens)
                    </span>
                    <span className="text-[10px] font-mono text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                      Entity Recognition Active
                    </span>
                  </div>

                  {/* Entity Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tokenizedResult.tokens_breakdown?.all_tokens?.map((tok, ti) => {
                      const colorMap = {
                        teal: 'bg-teal-100 text-teal-900 border-teal-300',
                        emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                        blue: 'bg-blue-100 text-blue-900 border-blue-300',
                        purple: 'bg-purple-100 text-purple-900 border-purple-300',
                        rose: 'bg-rose-100 text-rose-900 border-rose-300',
                        amber: 'bg-amber-100 text-amber-900 border-amber-300',
                      };
                      return (
                        <span
                          key={ti}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold ${colorMap[tok.color] || 'bg-slate-100'}`}
                        >
                          <span className="opacity-60 text-[9px]">[{tok.type}]</span>
                          <span>{tok.text}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Synthesized Note Text Box */}
                  <div className="rounded-lg bg-white p-3 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed border border-teal-200/80">
                    {tokenizedResult.synthesized_text}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTokenize}
                  disabled={tokenizing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors disabled:opacity-50"
                >
                  {tokenizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Tokenizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Tokenize & Preview NLP Entities
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveRx}
                  disabled={savingRx}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors disabled:opacity-50"
                >
                  {savingRx ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving & Indexing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Save & Embed to Patient Record
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
