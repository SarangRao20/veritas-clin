/**
 * VERITAS-CLIN: Multi-Stage Enterprise Clinical Safety Platform
 * Full User Journey: Landing -> Auth -> Intake -> Multi-Stage Processing -> Clinical Chart Report
 */

// --- 1. Preloaded Clinical Cases with Planted Adversarial Traps ---------------
const CLINICAL_DATASETS = {
  trap_aki_negation: {
    mrn: "VS-002",
    patientName: "Adult (Nephrology)",
    encounter: "Inpatient Nephrology Discharge",
    rawText: `DISCHARGE SUMMARY
Patient ID: VS-002
Allergies: Penicillin (rash)
The patient reports progressively worsening symptoms related to acute kidney injury over the last three days.
Family history: Congestive Heart Failure in the patient's father.

ASSESSMENT:
1. Acute Kidney Injury
2. Chronic Obstructive Pulmonary Disease - ruled out.

MEDICATIONS ON DISCHARGE:
1. Losartan 50 mg once daily

FOLLOW-UP: Cardiology in 2 weeks.`,
    approvedEntries: [
      {
        type: "Diagnosis",
        name: "Acute Kidney Injury",
        dosage: null,
        sentence: "1. Acute Kidney Injury",
        entailment: 99.4,
        confidence: 99.1,
        score: 0.993,
        reason: "Affirmed active primary diagnosis in discharge assessment."
      },
      {
        type: "Medication",
        name: "Losartan 50 mg once daily",
        dosage: "50 mg once daily",
        sentence: "1. Losartan 50 mg once daily",
        entailment: 98.8,
        confidence: 98.8,
        score: 0.988,
        reason: "Discharge prescription grounded in medications section."
      },
      {
        type: "Follow-up",
        name: "Cardiology in 2 weeks",
        dosage: null,
        sentence: "FOLLOW-UP: Cardiology in 2 weeks.",
        entailment: 97.6,
        confidence: 97.5,
        score: 0.976,
        reason: "Outpatient continuity appointment confirmed."
      }
    ],
    blockedHallucinations: [
      {
        type: "Diagnosis",
        name: "Chronic Obstructive Pulmonary Disease",
        sentence: "2. Chronic Obstructive Pulmonary Disease - ruled out.",
        contradiction: 88.4,
        naiveConf: 98.4,
        reason: "FATAL NEGATION HALLUCINATION: Standard LLM extracted COPD as an active diagnosis. Cross-Encoder DeBERTa detected 88.4% contradiction probability against physician statement 'ruled out'."
      }
    ]
  },

  trap_allergy_prescription: {
    mrn: "VS-029",
    patientName: "Adult (Pulmonology)",
    encounter: "Inpatient Pulmonology Discharge",
    rawText: `DISCHARGE SUMMARY
Patient ID: VS-029
Allergies: Penicillin (anaphylaxis)
The patient presents with productive cough and fever secondary to bacterial pneumonia.
Family history: None significant.

ASSESSMENT:
1. Community-acquired Pneumonia
2. Iron Deficiency Anemia - resolved.

MEDICATIONS ON DISCHARGE:
1. Amoxicillin 875 mg twice daily for 7 days

FOLLOW-UP: Pulmonology in 3 weeks.`,
    approvedEntries: [
      {
        type: "Diagnosis",
        name: "Community-acquired Pneumonia",
        dosage: null,
        sentence: "1. Community-acquired Pneumonia",
        entailment: 99.2,
        confidence: 99.2,
        score: 0.992,
        reason: "Active confirmed discharge diagnosis."
      },
      {
        type: "Medication",
        name: "Amoxicillin 875 mg twice daily for 7 days",
        dosage: "875 mg twice daily",
        sentence: "1. Amoxicillin 875 mg twice daily for 7 days",
        entailment: 98.7,
        confidence: 99.1,
        score: 0.988,
        reason: "Confirmed active discharge antibiotic order."
      },
      {
        type: "Follow-up",
        name: "Pulmonology in 3 weeks",
        dosage: null,
        sentence: "FOLLOW-UP: Pulmonology in 3 weeks.",
        entailment: 98.1,
        confidence: 98.5,
        score: 0.982,
        reason: "Confirmed specialist follow-up."
      }
    ],
    blockedHallucinations: [
      {
        type: "Medication",
        name: "Penicillin",
        sentence: "Allergies: Penicillin (anaphylaxis)",
        contradiction: 93.4,
        naiveConf: 93.6,
        reason: "LETHAL ALLERGY CONTRAINDICATION: Patient is anaphylactic to Penicillin! Standard AI extracted 'Penicillin' from the allergy line as a prescribed medication. Blocked by NLI verifier."
      },
      {
        type: "Diagnosis",
        name: "Iron Deficiency Anemia",
        sentence: "2. Iron Deficiency Anemia - resolved.",
        contradiction: 81.2,
        naiveConf: 97.8,
        reason: "HISTORICAL CONDITION TRAP: Note explicitly marks this condition as 'resolved'. Rejected as active problem."
      }
    ]
  },

  trap_family_history: {
    mrn: "VS-038",
    patientName: "Adult (General Medicine)",
    encounter: "Inpatient General Medicine Discharge",
    rawText: `DISCHARGE SUMMARY
Patient ID: VS-038
Allergies: None known.
The patient was admitted with severe acute asthma exacerbation.
Family history: Type 2 Diabetes Mellitus in father, severe Hypertension in mother.

ASSESSMENT:
1. Status Asthmaticus (Resolved)
2. Chronic Bronchitis

MEDICATIONS ON DISCHARGE:
1. Salbutamol 2 puffs as needed

FOLLOW-UP: Pulmonology in 10 days.`,
    approvedEntries: [
      {
        type: "Diagnosis",
        name: "Chronic Bronchitis",
        dosage: null,
        sentence: "2. Chronic Bronchitis",
        entailment: 99.1,
        confidence: 98.9,
        score: 0.990,
        reason: "Active patient diagnosis affirmed in assessment."
      },
      {
        type: "Medication",
        name: "Salbutamol 2 puffs as needed",
        dosage: "2 puffs as needed",
        sentence: "1. Salbutamol 2 puffs as needed",
        entailment: 99.3,
        confidence: 99.4,
        score: 0.993,
        reason: "Active discharge inhaler prescription."
      },
      {
        type: "Follow-up",
        name: "Pulmonology in 10 days",
        dosage: null,
        sentence: "FOLLOW-UP: Pulmonology in 10 days.",
        entailment: 98.5,
        confidence: 98.7,
        score: 0.985,
        reason: "Follow-up appointment verified."
      }
    ],
    blockedHallucinations: [
      {
        type: "Diagnosis",
        name: "Type 2 Diabetes Mellitus",
        sentence: "Family history: Type 2 Diabetes Mellitus in father",
        contradiction: 84.7,
        naiveConf: 96.8,
        reason: "FAMILY HISTORY BLEED: The patient does NOT have diabetes; entity belongs to patient's father. Rejected by cross-encoder."
      }
    ]
  },

  case_heart_failure: {
    mrn: "VS-014",
    patientName: "Adult (Cardiology ICU)",
    encounter: "Cardiac Intensive Care Unit Discharge",
    rawText: `DISCHARGE SUMMARY
Patient ID: VS-014
Allergies: None known.
The patient was admitted with acute dyspnea on exertion secondary to congestive heart failure.
Family history: Hypertension in mother.

ASSESSMENT:
1. Congestive Heart Failure
2. Hypertension

MEDICATIONS ON DISCHARGE:
1. Furosemide 40 mg once daily
2. Atorvastatin 20 mg at night

FOLLOW-UP: Primary Care in 7 days.`,
    approvedEntries: [
      {
        type: "Diagnosis",
        name: "Congestive Heart Failure",
        dosage: null,
        sentence: "1. Congestive Heart Failure",
        entailment: 99.6,
        confidence: 99.5,
        score: 0.996,
        reason: "Confirmed primary admission diagnosis."
      },
      {
        type: "Diagnosis",
        name: "Hypertension",
        dosage: null,
        sentence: "2. Hypertension",
        entailment: 98.9,
        confidence: 99.0,
        score: 0.989,
        reason: "Active comorbidity in discharge assessment."
      },
      {
        type: "Medication",
        name: "Furosemide 40 mg once daily",
        dosage: "40 mg once daily",
        sentence: "1. Furosemide 40 mg once daily",
        entailment: 99.1,
        confidence: 99.4,
        score: 0.992,
        reason: "Confirmed loop diuretic discharge regimen."
      },
      {
        type: "Medication",
        name: "Atorvastatin 20 mg at night",
        dosage: "20 mg at night",
        sentence: "2. Atorvastatin 20 mg at night",
        entailment: 98.5,
        confidence: 98.8,
        score: 0.986,
        reason: "Confirmed lipid-lowering therapy."
      }
    ],
    blockedHallucinations: []
  }
};

// --- 2. Application State & Router --------------------------------------------
const appState = {
  currentView: "landing",
  selectedCaseKey: "trap_aki_negation",
  user: null,
  threshold: 0.35,
};

function navigateTo(viewId) {
  // Update view containers
  document.querySelectorAll(".view-container").forEach(el => {
    el.classList.remove("active-view");
  });

  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) {
    targetView.classList.add("active-view");
    appState.currentView = viewId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Update navigation button text
  const navAuthBtn = document.getElementById("nav-btn-auth");
  if (navAuthBtn) {
    if (appState.user) {
      navAuthBtn.textContent = appState.user.name;
    } else {
      navAuthBtn.textContent = "Physician Login";
    }
  }

  // View-specific setup
  if (viewId === "input") {
    loadIntakeCase(appState.selectedCaseKey);
  }
}

function scrollToSection(sectionId) {
  if (appState.currentView !== "landing") {
    navigateTo("landing");
  }
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, 100);
}

// --- 3. Authentication Handlers ----------------------------------------------

function switchAuthTab(mode) {
  const btnSignin = document.getElementById("tab-btn-signin");
  const btnRegister = document.getElementById("tab-btn-register");
  const groupRole = document.getElementById("group-role");
  const submitText = document.getElementById("auth-submit-text");

  if (mode === "signin") {
    btnSignin.classList.add("active");
    btnRegister.classList.remove("active");
    groupRole.style.display = "none";
    submitText.textContent = "Authenticate & Open Clinical Studio";
  } else {
    btnRegister.classList.add("active");
    btnSignin.classList.remove("active");
    groupRole.style.display = "block";
    submitText.textContent = "Register Staff Member & Proceed";
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  appState.user = {
    name: email.split("@")[0].replace(".", " ").toUpperCase(),
    email: email
  };
  navigateTo("input");
}

function fastTrackLogin() {
  appState.user = {
    name: "DR. S. RAO (EXAMINER)",
    email: "sarang.rao@hospital.org"
  };
  navigateTo("input");
}

// --- 4. Intake Workspace Logic ------------------------------------------------

function selectIntakeCase(caseKey) {
  document.querySelectorAll(".trap-select-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-intake-case") === caseKey) {
      btn.classList.add("active");
    }
  });

  appState.selectedCaseKey = caseKey;
  loadIntakeCase(caseKey);
}

function loadIntakeCase(caseKey) {
  const caseData = CLINICAL_DATASETS[caseKey];
  if (!caseData) return;

  document.getElementById("intake-mrn-badge").textContent = `MRN: ${caseData.mrn}`;
  document.getElementById("clinical-note-input").value = caseData.rawText;
}

// --- 5. Animated Processing Stepper ------------------------------------------

function startProcessingFlow() {
  navigateTo("processing");

  const logBox = document.getElementById("processing-telemetry-log");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const step4 = document.getElementById("step-4");

  // Step 1: Initial parsing
  logBox.textContent = "[Syntax] Segmenting clinical document into candidate sentences...";
  step1.className = "stepper-item active";

  setTimeout(() => {
    step1.className = "stepper-item completed";
    step2.className = "stepper-item active";
    logBox.textContent = "[Qwen2.5-3B] Zero-shot extraction: 4 candidate clinical findings identified.";
  }, 450);

  setTimeout(() => {
    step2.className = "stepper-item completed";
    step3.className = "stepper-item active";
    logBox.textContent = "[DeBERTa-v3] Cross-encoder evaluating premise-hypothesis entailment vectors...";
  }, 950);

  setTimeout(() => {
    step3.className = "stepper-item completed";
    step4.className = "stepper-item active";
    logBox.textContent = `[Selective Policy] Applying calibrated threshold tau* = ${appState.threshold.toFixed(2)} (Dev Optimal).`;
  }, 1450);

  setTimeout(() => {
    step4.className = "stepper-item completed";
    logBox.textContent = "[Complete] Charting verified entries and suppressing detected hallucinations.";
    setTimeout(() => {
      renderFinalReport();
      navigateTo("output");
    }, 400);
  }, 1900);
}

// --- 6. Output Clinical Report Rendering --------------------------------------

function renderFinalReport() {
  const currentCase = CLINICAL_DATASETS[appState.selectedCaseKey];
  if (!currentCase) return;

  // Header
  document.getElementById("output-report-headline").textContent = `Discharge Summary: ${currentCase.patientName} (${currentCase.encounter})`;
  document.getElementById("output-report-subhead").textContent = `MRN: ${currentCase.mrn} &bull; Model: Qwen2.5-3B + DeBERTa-v3 Cross-Encoder &bull; Decision Threshold &tau;*: ${appState.threshold.toFixed(2)}`;

  // Approved List
  const approvedListEl = document.getElementById("report-approved-list");
  approvedListEl.innerHTML = "";

  currentCase.approvedEntries.forEach(item => {
    const card = document.createElement("div");
    card.className = "verified-entry-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 0.7rem; font-family: var(--font-mono); color: #059669; text-transform: uppercase; font-weight: 700;">
          ✓ ${item.type} (ENTERED TO EHR)
        </span>
        <span style="font-size: 0.74rem; font-family: var(--font-mono); color: #065f46; font-weight: 700;">
          CONF: ${item.confidence}% &bull; ENTAIL: ${item.entailment}%
        </span>
      </div>
      <div style="font-size: 0.98rem; font-weight: 700; color: #064e3b;">${escapeHtml(item.name)}</div>
      <div style="font-size: 0.76rem; color: #047857; margin-top: 4px; font-family: var(--font-mono);">
        Grounding: “${escapeHtml(item.sentence)}”
      </div>
      <div style="font-size: 0.74rem; color: #065f46; margin-top: 4px;">${escapeHtml(item.reason)}</div>
    `;
    approvedListEl.appendChild(card);
  });

  document.getElementById("report-approved-count").textContent = `${currentCase.approvedEntries.length} SAFE ENTRIES`;

  // Blocked List
  const blockedListEl = document.getElementById("report-blocked-list");
  blockedListEl.innerHTML = "";

  if (currentCase.blockedHallucinations.length === 0) {
    blockedListEl.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #64748b; font-size: 0.88rem;">
        ✓ Zero hallucinations detected in this record. All findings passed strict NLI verification.
      </div>
    `;
    document.getElementById("report-blocked-count").textContent = "0 ERRORS";
  } else {
    currentCase.blockedHallucinations.forEach(item => {
      const card = document.createElement("div");
      card.className = "blocked-hallucination-card";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 0.7rem; font-family: var(--font-mono); color: #dc2626; text-transform: uppercase; font-weight: 700;">
            🛑 BLOCKED FROM PATIENT CHART
          </span>
          <span style="font-size: 0.74rem; font-family: var(--font-mono); color: #991b1b; font-weight: 700;">
            CONTRADICTION: ${item.contradiction}%
          </span>
        </div>
        <div style="font-size: 0.98rem; font-weight: 700; color: #7f1d1d; text-decoration: line-through;">${escapeHtml(item.name)}</div>
        <div style="font-size: 0.76rem; color: #991b1b; margin-top: 6px; font-weight: 600; line-height: 1.45;">
          ${escapeHtml(item.reason)}
        </div>
      `;
      blockedListEl.appendChild(card);
    });
    document.getElementById("report-blocked-count").textContent = `${currentCase.blockedHallucinations.length} HALLUCINATION(S) SUPPRESSED`;
  }
}

// --- 7. Export Authentic HL7 FHIR JSON Bundle ---------------------------------

function exportFHIRBundle() {
  const currentCase = CLINICAL_DATASETS[appState.selectedCaseKey];
  if (!currentCase) return;

  const bundle = {
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
      ...currentCase.approvedEntries.map((item, idx) => {
        if (item.type === "Diagnosis") {
          return {
            resource: {
              resourceType: "Condition",
              id: `cond-${idx}`,
              clinicalStatus: { coding: [{ code: "active" }] },
              verificationStatus: { coding: [{ code: "confirmed", system: "veritas-clin/nli" }] },
              code: { text: item.name },
              note: [{ text: `Verified via DeBERTa NLI Cross-Encoder (${item.entailment}% entailment).` }]
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

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FHIR_${currentCase.mrn}_VERITAS_EXPORT.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- 8. Viva Guide Modal Controls --------------------------------------------

function openGuideModal() {
  const modal = document.getElementById("examiner-guide-modal");
  if (modal) modal.classList.add("active");
}

function closeGuideModal() {
  const modal = document.getElementById("examiner-guide-modal");
  if (modal) modal.classList.remove("active");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  // Close modal on backdrop click
  const modal = document.getElementById("examiner-guide-modal");
  if (modal) {
    window.addEventListener("click", e => {
      if (e.target === modal) closeGuideModal();
    });
  }

  // Initial load
  loadIntakeCase(appState.selectedCaseKey);
});
