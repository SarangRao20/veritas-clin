import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check, FileSearch, FileText, Loader2, Pill, PlusCircle,
  ShieldCheck, Upload, Users, X
} from 'lucide-react';
import { api } from '../api';
import { docTypeMeta, fmtDate } from '../utils/clinicalFormatters';

const CLINICAL_TEMPLATES = {
  prescription: {
    title: 'Discharge Prescription & Medication Orders',
    patient_id: 'PT-4091',
    content: `METROHEALTH MEDICAL CENTER — DISCHARGE PRESCRIPTION ORDER
PATIENT NAME: Marcus Vance | PATIENT ID: PT-4091
DATE OF BIRTH: 1957-04-12 | ENCOUNTER DATE: 2025-09-20
PRESCRIBING PHYSICIAN: Eleanor Vance, MD (Cardiology)

DISCHARGE MEDICATIONS:
1. Ticagrelor (Brilinta) 90 mg PO BID
   - Indication: Post-percutaneous coronary intervention (PCI) with drug-eluting stent.
   - Duration: Minimum 12 months dual antiplatelet therapy (DAPT).
   - Refills: 3

2. Aspirin (Ecotrin) 81 mg PO daily
   - Indication: Secondary prevention post-acute STEMI.
   - Duration: Indefinite.

3. Atorvastatin (Lipitor) 80 mg PO daily at bedtime
   - Indication: High-intensity statin therapy post-ACS.

4. Metoprolol Tartrate 25 mg PO BID
   - Indication: Post-STEMI cardioprotection, blood pressure control.

CONTRAINDICATED / HELD MEDICATIONS (STRICT ORDERS):
- Lisinopril 20 mg PO daily is PERMANENTLY HELD.
  Reason: Patient experienced KDIGO Stage 2 Acute Kidney Injury (creatinine surge to 2.38 mg/dL) following iodinated contrast administration during cardiac catheterization. Re-check renal function panel (BUN/Cr) in outpatient clinic in 7 days before considering resumption.`,
  },
  admission: {
    title: 'Emergency Admission History & Physical',
    patient_id: 'PT-3892',
    content: `VALLEY PRESBYTERIAN HOSPITAL — EMERGENCY DEPARTMENT ADMISSION H&P
PATIENT NAME: Robert Sterling | PATIENT ID: PT-3892
DATE OF BIRTH: 1973-09-28 | ENCOUNTER DATE: 2025-10-21 14:15 EDT
ATTENDING PHYSICIAN: Patricia Vargas, MD, FCCP

CHIEF COMPLAINT:
Acute sharp right-sided pleuritic chest pain, sudden dyspnea, and diaphoresis on Post-Operative Day 7.

HISTORY OF PRESENT ILLNESS:
The patient is a 52-year-old male on post-operative day 7 following elective laparoscopic left hemicolectomy for recurrent diverticular stricture. While ambulating in the surgical hallway, he experienced abrupt, sharp pleuritic right chest pain with oxygen desaturation to 88% on ambient air. Tachypneic at 26 breaths/min, heart rate 118 bpm.

PHYSICAL EXAMINATION:
- Lungs: Decreased breath sounds at right lung base, audible pleural friction rub.
- Extremities: Right calf circumference 38 cm vs left 36 cm with mild localized tenderness over the deep muscular calf.
- Wells Score: 6.0 points (High Probability for Acute Pulmonary Embolism).

EMERGENT ORDERS & MANAGEMENT:
1. STAT CT Pulmonary Angiography (CTPA) PE Protocol.
2. STAT Bilateral Lower Extremity Venous Duplex Ultrasound.
3. IV Unfractionated Heparin infusion initiated at weight-based protocol (80 units/kg bolus, 18 units/kg/hr maintenance) after confirming surgical site hemostasis.`,
  },
  lab: {
    title: 'Microbiology & Renal Function Laboratory Report',
    patient_id: 'PT-7215',
    content: `ST. JUDE MEMORIAL HOSPITAL — CLINICAL PATHOLOGY & MICROBIOLOGY REPORT
PATIENT NAME: Brenda Martinez | PATIENT ID: PT-7215
DATE OF BIRTH: 1966-02-18 | ENCOUNTER DATE: 2025-10-12
LAB DIRECTOR: Raymond Foster, MD

SPECIMEN: Urine Culture & Antibiotic Susceptibility Panel
ISOLATE: Escherichia coli > 100,000 CFU/mL
PHENOTYPE: Extended-Spectrum Beta-Lactamase (ESBL) Producer

ANTIMICROBIAL SUSCEPTIBILITY:
- Ampicillin / Sulbactam: RESISTANT
- Cefazolin: RESISTANT
- Ceftriaxone: RESISTANT (MIC >= 64 mcg/mL)
- Ciprofloxacin: RESISTANT (MIC >= 4 mcg/mL)
- Ertapenem: SENSITIVE (MIC <= 0.5 mcg/mL)
- Meropenem: SENSITIVE (MIC <= 0.25 mcg/mL)
- Nitrofurantoin: SENSITIVE (MIC <= 32 mcg/mL)

METABOLIC LAB PANEL HIGHLIGHTS:
- Serum Beta-hydroxybutyrate: 2.1 mmol/L (ELEVATED, reference: 0.0 - 0.5 mmol/L)
- Serum Bicarbonate: 18 mEq/L (LOW)
- Anion Gap: 17 mEq/L (ELEVATED)
- Serum Glucose: 168 mg/dL (EUGYCEMIC DKA SECONDARY TO SGLT2-INHIBITOR THERAPY)
- Blood Urea Nitrogen: 28 mg/dL | Serum Creatinine: 1.42 mg/dL

CLINICAL RECOMMENDATION:
Empagliflozin (Jardiance) immediately discontinued. Escalate antibiotic therapy to IV Ertapenem 1 g daily for ESBL pyelonephritis. Initiate insulin protocol with IV fluid resuscitation.`,
  },
  stroke: {
    title: 'Emergency Neurology Acute Stroke Assessment',
    patient_id: 'PT-5120',
    content: `BAYVIEW MEDICAL CENTER — COMPREHENSIVE STROKE CENTER ADMISSION NOTE
PATIENT NAME: David Chen | PATIENT ID: PT-5120
DATE OF BIRTH: 1961-11-04 | ENCOUNTER DATE: 2025-10-22 09:30 EDT
ATTENDING NEUROLOGIST: Marcus Thorne, MD, PhD

PRESENTATION & TIMELINE:
Patient presented via EMS with sudden onset right-sided faciobrachial paresis and expressive motor aphasia beginning at 07:45 EDT (last known well 07:30 EDT, door-to-needle time: 42 minutes).

NEUROLOGICAL EXAMINATION:
- NIH Stroke Scale (NIHSS): 11 (Moderate-to-Severe Deficit)
  * Level of consciousness: Alert (0)
  * Best gaze: Normal (0)
  * Visual fields: Intact (0)
  * Facial palsy: Complete right lower facial drop (2)
  * Motor Right Arm: Drift and drops before 10 seconds (3)
  * Motor Right Leg: Drift to bed before 5 seconds (2)
  * Language / Aphasia: Severe expressive aphasia, sparse naming (3)
  * Dysarthria: Moderate (1)

IMAGING & DIAGNOSTIC FINDINGS:
1. STAT NCCT Head: No acute intracranial hemorrhage or established hypoattenuation. ASPECTS score: 9.
2. CT Angiogram Head & Neck: 85% proximal stenosis of left internal carotid artery (ICA) bulb with high-grade focal flow restriction.
3. MRI Brain Diffusion-Weighted Imaging: Hyperintense focus in left MCA territory (posterior perisylvian frontal cortex), confirming acute ischemic infarction.

INTERVENTIONS & INPATIENT ORDERS:
1. IV Thrombolysis (Tenecteplase 0.25 mg/kg IV bolus) administered at 08:27 EDT without hemorrhagic conversion.
2. Transfer to Neuro-ICU for continuous Q15-minute blood pressure monitoring (permissive hypertension maintained < 180/105 mmHg).
3. Vascular surgery consultation scheduled for urgent left carotid endarterectomy (CEA) evaluation post-stabilization.
4. Initiate Aspirin 81 mg + Clopidogrel 75 mg loading after 24-hour post-tPA head CT clearance.`,
  },
  nephrology: {
    title: 'Inpatient Nephrology Consult & CA-AKI Trajectory',
    patient_id: 'PT-4091',
    content: `METROHEALTH ACADEMIC MEDICAL CENTER — INPATIENT NEPHROLOGY CONSULTATION
PATIENT NAME: Marcus Vance | PATIENT ID: PT-4091
DATE OF BIRTH: 1957-04-12 | ENCOUNTER DATE: 2025-09-17
CONSULTING NEPHROLOGIST: Jennifer Reynolds, MD

REASON FOR CONSULTATION:
Rapid surge in serum creatinine following emergent cardiac catheterization for acute anteroseptal STEMI on 2025-09-15 (Omnipaque-350 contrast load: 145 mL).

RENAL BIOMARKER TRAJECTORY:
- Baseline Admission Creatinine (09-14): 1.02 mg/dL (eGFR: > 60 mL/min/1.73m²)
- Post-PCI Day 1 Creatinine (09-16): 1.64 mg/dL
- Post-PCI Day 2 Creatinine (09-17): 2.38 mg/dL (PEAK — 133% elevation from baseline)
- eGFR Nadir: 28 mL/min/1.73m² (Diagnostic Criteria met for KDIGO Stage 2 Contrast-Associated AKI)
- Urine Output: Preserved at 0.65 mL/kg/hr (Non-oliguric AKI).
- Fractional Excretion of Sodium (FENa): 0.6% (Consistent with pre-renal / contrast vasoconstrictive state).

NEPHROLOGY ASSESSMENT & ORDERS:
1. Contrast-Associated Acute Kidney Injury (CA-AKI), KDIGO Stage 2, non-oliguric.
2. PERMANENT MEDICATION HOLD: Lisinopril 20 mg PO daily and Metformin indefinitely suspended.
3. Resuscitation: Isotonic intravenous 0.9% normal saline infusion at 75 mL/hr targeted for euvolemia.
4. Avoid all nephrotoxic agents: Strict avoidance of NSAIDs, aminoglycosides, and additional IV radiocontrast.
5. Discharge follow-up: Outpatient basic metabolic panel (BUN/Cr/eGFR) in 7 days.`,
  },
};

export default function WorkbenchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'upload' | 'browse'
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [patientId, setPatientId] = useState('PT-4091');
  const [docTitle, setDocTitle] = useState(CLINICAL_TEMPLATES.prescription.title);
  const [docContent, setDocContent] = useState(CLINICAL_TEMPLATES.prescription.content);
  const [saving, setSaving] = useState(false);

  // Upload file states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [uploading, setUploading] = useState(false);

  // Document reader modal
  const [inspectDoc, setInspectDoc] = useState(null);
  const [filterPatient, setFilterPatient] = useState('ALL');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await api.documents();
      setDocuments(docs || []);
    } catch (err) {
      setError(err.message || 'Could not load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Load a pre-defined template
  const applyTemplate = (key) => {
    const tmpl = CLINICAL_TEMPLATES[key];
    if (!tmpl) return;
    setPatientId(tmpl.patient_id);
    setDocTitle(tmpl.title);
    setDocContent(tmpl.content);
    setSuccess(`Loaded "${tmpl.title}" template.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Save new typed note
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!docContent.trim() || !patientId.trim() || saving) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const filename = `${patientId}_${new Date().toISOString().slice(0, 10)}_${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      const blob = new Blob([docContent], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });

      await api.upload(file, patientId);
      setSuccess(`Successfully indexed "${filename}" into patient ${patientId}'s record!`);
      await loadDocuments();

      setTimeout(() => {
        navigate(`/patients/${encodeURIComponent(patientId)}`);
      }, 1200);
    } catch (err) {
      setError(`Failed to save note: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Upload external file
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      await api.upload(selectedFile, uploadPatientId || null);
      setSuccess(`Successfully uploaded and indexed "${selectedFile.name}".`);
      setSelectedFile(null);
      await loadDocuments();
      setActiveTab('browse');
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (filterPatient === 'ALL') return true;
    return d.patient_id === filterPatient;
  });

  const uniquePatients = Array.from(new Set(documents.map((d) => d.patient_id).filter(Boolean)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-700 text-white">
              <FileSearch className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
              Clinical Document & Note Studio
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clinical Records & Note Ingestion
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-1">
            Create new doctor notes or prescriptions, upload diagnostic reports, and manage all indexed medical documents.
          </p>
        </div>

        <Link
          to="/patients"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors self-start md:self-auto shrink-0"
        >
          <Users className="h-3.5 w-3.5 text-teal-700" />
          View Patient Workspaces →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
            activeTab === 'create'
              ? 'bg-teal-50 text-teal-900 border border-teal-200'
              : 'text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Pill className="h-3.5 w-3.5 text-teal-700" />
          Write Clinical Note / Prescription
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
            activeTab === 'upload'
              ? 'bg-teal-50 text-teal-900 border border-teal-200'
              : 'text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Upload className="h-3.5 w-3.5 text-teal-700" />
          Upload Document (PDF/TXT)
        </button>
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
            activeTab === 'browse'
              ? 'bg-teal-50 text-teal-900 border border-teal-200'
              : 'text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-teal-700" />
          All Indexed Records ({documents.length})
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: Clinical Note & Prescription Composer */}
      {activeTab === 'create' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Compose Clinical Record or Prescription
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved records are automatically de-identified, chunked into passages, embedded permanently into the database, and reflected in the patient's analysis.
              </p>
            </div>

            {/* Template Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Sample Templates:</span>
              <button
                type="button"
                onClick={() => applyTemplate('prescription')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-200 transition-colors"
              >
                Cardiology Rx
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('admission')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-200 transition-colors"
              >
                Acute PE H&P
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('lab')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-200 transition-colors"
              >
                Microbiology Lab
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('stroke')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-200 transition-colors"
              >
                Stroke H&P
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('nephrology')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-200 transition-colors"
              >
                Nephrology Consult
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveNote} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Patient ID
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="PT-4091">PT-4091 (Marcus Vance · Cardiology)</option>
                    <option value="PT-7215">PT-7215 (Brenda Martinez · Endocrinology)</option>
                    <option value="PT-3892">PT-3892 (Robert Sterling · Pulmonology)</option>
                    <option value="PT-5120">PT-5120 (Arthur Pendelton · Neurology)</option>
                    <option value="PT-CUSTOM">Custom Patient ID</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document / Note Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Inpatient Nephrology Consult & Medication Orders"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Content & Findings
              </label>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                rows={12}
                placeholder="Type or paste physician notes, lab findings, vitals, or prescription orders here..."
                className="w-full rounded-xl border border-slate-200 p-3.5 font-mono text-xs text-slate-900 leading-relaxed focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Automatic HIPAA de-identification & persistent embedding cache applied.</span>
              </div>

              <button
                type="submit"
                disabled={saving || !docContent.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Embedding & Indexing Note...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Save & Index Note into Patient Chart
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Upload Document */}
      {activeTab === 'upload' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Upload Clinical Document File
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any external PDF or TXT clinical record. It will be parsed, chunked, and searchable in the patient's record.
            </p>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign to Patient (Optional)
              </label>
              <select
                value={uploadPatientId}
                onChange={(e) => setUploadPatientId(e.target.value)}
                className="w-full sm:max-w-md rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
              >
                <option value="">Auto-detect from file content</option>
                <option value="PT-4091">PT-4091 (Marcus Vance)</option>
                <option value="PT-7215">PT-7215 (Brenda Martinez)</option>
                <option value="PT-3892">PT-3892 (Robert Sterling)</option>
                <option value="PT-5120">PT-5120 (Arthur Pendelton)</option>
              </select>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center hover:border-teal-500/50 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                {selectedFile ? selectedFile.name : 'Select a PDF or TXT file to upload'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Max 5 MB · Automated clinical text extraction & embedding
              </p>
              <input
                type="file"
                accept=".txt,.pdf"
                onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                className="mt-4 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading & Indexing...
                  </>
                ) : (
                  'Upload & Index Document'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: All Indexed Records */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Patient Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filter Patient:</span>
            <button
              onClick={() => setFilterPatient('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors border ${
                filterPatient === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Records ({documents.length})
            </button>
            {uniquePatients.map((pid) => (
              <button
                key={pid}
                onClick={() => setFilterPatient(pid)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors border ${
                  filterPatient === pid
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {pid}
              </button>
            ))}
          </div>

          {/* Document Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-slate-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map((doc) => {
                const meta = docTypeMeta(doc.filename);
                const Icon = meta.icon;
                return (
                  <div
                    key={doc.document_id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate max-w-xs">
                            {doc.filename}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Patient: <span className="font-semibold text-slate-700">{doc.patient_id || 'Shared'}</span>
                            {doc.encounter_date && ` · ${fmtDate(doc.encounter_date)}`}
                          </p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <span>{doc.passage_count} indexed passages</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const full = await api.getDocument(doc.document_id);
                            setInspectDoc(full);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800"
                        >
                          <FileSearch className="h-3.5 w-3.5" />
                          Read Note
                        </button>
                        {doc.patient_id && (
                          <Link
                            to={`/patients/${encodeURIComponent(doc.patient_id)}`}
                            className="font-semibold text-slate-500 hover:text-slate-800 ml-2"
                          >
                            Case Station &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Document Modal */}
          {inspectDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{inspectDoc.filename}</h3>
                    <p className="text-xs text-slate-400">
                      Patient: {inspectDoc.patient_id || 'Unassigned'} · Encounter: {inspectDoc.encounter_type || 'Clinical Record'}
                    </p>
                  </div>
                  <button
                    onClick={() => setInspectDoc(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200">
                  {inspectDoc.extracted_text}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setInspectDoc(null)}
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
    </div>
  );
}
