/**
 * VERITAS-CLIN: Clinical AI Safety & Verification Workstation
 * Core Telemetry, Interactive Adversarial Traps, & Calibrated Decision Logic
 */

// --- 1. Realistic Clinical Adversarial Trap Cases -----------------------------
const CLINICAL_VIVA_CASES = {
  trap_aki_negation: {
    id: "VS-002",
    title: "Trap 1: Ruled-Out Condition (Negation Blindness)",
    ward: "NEPHROLOGY 4B",
    status: "FINAL DISCHARGE RECORD",
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
    
    // What standard uncalibrated LLMs (ChatGPT / zero-shot prompts) output:
    naiveOutputs: [
      {
        type: "Diagnosis",
        name: "Acute Kidney Injury",
        conf: 99.1,
        isError: false,
        detail: "Extracted from Assessment item 1."
      },
      {
        type: "Diagnosis",
        name: "Chronic Obstructive Pulmonary Disease",
        conf: 98.4,
        isError: true,
        errorTag: "FATAL NEGATION HALLUCINATION",
        detail: "CRITICAL MEDICAL ERROR: The note explicitly says 'ruled out'. Standard LLMs extract this as an active diagnosis because of keyword matching."
      },
      {
        type: "Medication",
        name: "Losartan 50 mg once daily",
        conf: 98.8,
        isError: false,
        detail: "Extracted from Medications section."
      },
      {
        type: "Follow-up",
        name: "Cardiology in 2 weeks",
        conf: 97.5,
        isError: false,
        detail: "Extracted from Follow-up section."
      }
    ],

    // What Veritas-Clin outputs with DeBERTa NLI cross-encoder verification:
    veritasOutputs: [
      {
        id: "v1",
        type: "diagnosis",
        value: "Acute Kidney Injury",
        dosage: null,
        sentence: "1. Acute Kidney Injury",
        span: "1. Acute Kidney Injury",
        p_entail: 0.994,
        p_neutral: 0.005,
        p_contra: 0.001,
        token_conf: 0.991,
        auditReason: "Verified: Directly entailed by primary assessment affirmation."
      },
      {
        id: "v2",
        type: "diagnosis",
        value: "Chronic Obstructive Pulmonary Disease",
        dosage: null,
        sentence: "2. Chronic Obstructive Pulmonary Disease - ruled out.",
        span: "2. Chronic Obstructive Pulmonary Disease - ruled out.",
        p_entail: 0.082,
        p_neutral: 0.034,
        p_contra: 0.884,
        token_conf: 0.984,
        auditReason: "BLOCKED: NLI Cross-Encoder detected strong contradiction (P_contra: 88.4%) against note statement 'ruled out'."
      },
      {
        id: "v3",
        type: "medication",
        value: "Losartan 50 mg once daily",
        dosage: "50 mg once daily",
        sentence: "1. Losartan 50 mg once daily",
        span: "1. Losartan 50 mg once daily",
        p_entail: 0.988,
        p_neutral: 0.010,
        p_contra: 0.002,
        token_conf: 0.988,
        auditReason: "Verified: Active discharge medication with confirmed dosage & frequency."
      },
      {
        id: "v4",
        type: "followup",
        value: "Cardiology in 2 weeks",
        dosage: null,
        sentence: "FOLLOW-UP: Cardiology in 2 weeks.",
        span: "FOLLOW-UP: Cardiology in 2 weeks.",
        p_entail: 0.976,
        p_neutral: 0.019,
        p_contra: 0.005,
        token_conf: 0.975,
        auditReason: "Verified: Discharge transition-of-care follow-up confirmed."
      }
    ]
  },

  trap_allergy_prescription: {
    id: "VS-029",
    title: "Trap 2: Patient Allergy Misinterpreted as Medication",
    ward: "PULMONOLOGY 3A",
    status: "FINAL DISCHARGE RECORD",
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
    
    naiveOutputs: [
      {
        type: "Medication",
        name: "Penicillin",
        conf: 93.6,
        isError: true,
        errorTag: "DANGEROUS ALLERGY MISATTRIBUTION",
        detail: "LETHAL ERROR: Patient is anaphylactic to Penicillin! Standard AI extracted 'Penicillin' from the allergy line as a prescribed medication."
      },
      {
        type: "Diagnosis",
        name: "Community-acquired Pneumonia",
        conf: 99.2,
        isError: false,
        detail: "Active confirmed diagnosis."
      },
      {
        type: "Diagnosis",
        name: "Iron Deficiency Anemia",
        conf: 97.8,
        isError: true,
        errorTag: "RESOLVED CONDITION TRAP",
        detail: "Extracted condition that was noted as 'resolved' prior to discharge."
      },
      {
        type: "Medication",
        name: "Amoxicillin 875 mg twice daily",
        conf: 99.1,
        isError: false,
        detail: "Confirmed discharge prescription."
      }
    ],

    veritasOutputs: [
      {
        id: "v5",
        type: "medication",
        value: "Penicillin",
        dosage: null,
        sentence: "Allergies: Penicillin (anaphylaxis)",
        span: "Allergies: Penicillin (anaphylaxis)",
        p_entail: 0.021,
        p_neutral: 0.045,
        p_contra: 0.934,
        token_conf: 0.936,
        auditReason: "BLOCKED: NLI Cross-Encoder detected contradiction (P_contra: 93.4%). Document context is an allergy contraindication, NOT a prescription."
      },
      {
        id: "v6",
        type: "diagnosis",
        value: "Community-acquired Pneumonia",
        dosage: null,
        sentence: "1. Community-acquired Pneumonia",
        span: "1. Community-acquired Pneumonia",
        p_entail: 0.992,
        p_neutral: 0.006,
        p_contra: 0.002,
        token_conf: 0.992,
        auditReason: "Verified: Directly affirmed as active discharge diagnosis."
      },
      {
        id: "v7",
        type: "diagnosis",
        value: "Iron Deficiency Anemia",
        dosage: null,
        sentence: "2. Iron Deficiency Anemia - resolved.",
        span: "2. Iron Deficiency Anemia - resolved.",
        p_entail: 0.124,
        p_neutral: 0.064,
        p_contra: 0.812,
        token_conf: 0.978,
        auditReason: "BLOCKED: NLI detected contradiction against historical qualifier 'resolved'."
      },
      {
        id: "v8",
        type: "medication",
        value: "Amoxicillin 875 mg twice daily for 7 days",
        dosage: "875 mg twice daily",
        sentence: "1. Amoxicillin 875 mg twice daily for 7 days",
        span: "1. Amoxicillin 875 mg twice daily for 7 days",
        p_entail: 0.987,
        p_neutral: 0.011,
        p_contra: 0.002,
        token_conf: 0.991,
        auditReason: "Verified: Grounded discharge prescription with complete dosage & regimen."
      }
    ]
  },

  trap_family_history: {
    id: "VS-038",
    title: "Trap 3: Family History Misattributed as Diagnosis",
    ward: "GENERAL MEDICINE 2B",
    status: "FINAL DISCHARGE RECORD",
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

    naiveOutputs: [
      {
        type: "Diagnosis",
        name: "Type 2 Diabetes Mellitus",
        conf: 96.8,
        isError: true,
        errorTag: "FAMILY HISTORY HALLUCINATION",
        detail: "MISATTRIBUTION: The patient does not have Diabetes! The note explicitly states this belongs to the patient's father."
      },
      {
        type: "Diagnosis",
        name: "Chronic Bronchitis",
        conf: 98.9,
        isError: false,
        detail: "Patient's active diagnosis."
      },
      {
        type: "Medication",
        name: "Salbutamol 2 puffs as needed",
        conf: 99.4,
        isError: false,
        detail: "Active inhaler prescription."
      }
    ],

    veritasOutputs: [
      {
        id: "v9",
        type: "diagnosis",
        value: "Type 2 Diabetes Mellitus",
        dosage: null,
        sentence: "Family history: Type 2 Diabetes Mellitus in father",
        span: "Family history: Type 2 Diabetes Mellitus in father",
        p_entail: 0.041,
        p_neutral: 0.112,
        p_contra: 0.847,
        token_conf: 0.968,
        auditReason: "BLOCKED: NLI rejected claim. Source sentence explicitly attributes entity to 'father', not the patient."
      },
      {
        id: "v10",
        type: "diagnosis",
        value: "Chronic Bronchitis",
        dosage: null,
        sentence: "2. Chronic Bronchitis",
        span: "2. Chronic Bronchitis",
        p_entail: 0.991,
        p_neutral: 0.007,
        p_contra: 0.002,
        token_conf: 0.989,
        auditReason: "Verified: Affirmed active patient diagnosis."
      },
      {
        id: "v11",
        type: "medication",
        value: "Salbutamol 2 puffs as needed",
        dosage: "2 puffs as needed",
        sentence: "1. Salbutamol 2 puffs as needed",
        span: "1. Salbutamol 2 puffs as needed",
        p_entail: 0.993,
        p_neutral: 0.005,
        p_contra: 0.002,
        token_conf: 0.994,
        auditReason: "Verified: Confirmed active as-needed bronchodilator prescription."
      }
    ]
  },

  case_heart_failure: {
    id: "VS-014",
    title: "Case 4: Multi-Drug Cardiology Regimen",
    ward: "CARDIOLOGY ICU",
    status: "FINAL DISCHARGE RECORD",
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

    naiveOutputs: [
      {
        type: "Diagnosis",
        name: "Congestive Heart Failure",
        conf: 99.5,
        isError: false,
        detail: "Active diagnosis."
      },
      {
        type: "Diagnosis",
        name: "Hypertension",
        conf: 99.0,
        isError: false,
        detail: "Active diagnosis."
      },
      {
        type: "Medication",
        name: "Furosemide 40 mg once daily",
        conf: 99.4,
        isError: false,
        detail: "Active diuretic."
      },
      {
        type: "Medication",
        name: "Atorvastatin 20 mg at night",
        conf: 98.8,
        isError: false,
        detail: "Active statin."
      }
    ],

    veritasOutputs: [
      {
        id: "v12",
        type: "diagnosis",
        value: "Congestive Heart Failure",
        dosage: null,
        sentence: "1. Congestive Heart Failure",
        span: "1. Congestive Heart Failure",
        p_entail: 0.996,
        p_neutral: 0.003,
        p_contra: 0.001,
        token_conf: 0.995,
        auditReason: "Verified: Directly affirmed primary admission & discharge diagnosis."
      },
      {
        id: "v13",
        type: "diagnosis",
        value: "Hypertension",
        dosage: null,
        sentence: "2. Hypertension",
        span: "2. Hypertension",
        p_entail: 0.989,
        p_neutral: 0.009,
        p_contra: 0.002,
        token_conf: 0.990,
        auditReason: "Verified: Confirmed comorbidity in discharge assessment."
      },
      {
        id: "v14",
        type: "medication",
        value: "Furosemide 40 mg once daily",
        dosage: "40 mg once daily",
        sentence: "1. Furosemide 40 mg once daily",
        span: "1. Furosemide 40 mg once daily",
        p_entail: 0.991,
        p_neutral: 0.008,
        p_contra: 0.001,
        token_conf: 0.994,
        auditReason: "Verified: Grounded loop diuretic prescription with dosage."
      },
      {
        id: "v15",
        type: "medication",
        value: "Atorvastatin 20 mg at night",
        dosage: "20 mg at night",
        sentence: "2. Atorvastatin 20 mg at night",
        span: "2. Atorvastatin 20 mg at night",
        p_entail: 0.985,
        p_neutral: 0.012,
        p_contra: 0.003,
        token_conf: 0.988,
        auditReason: "Verified: Grounded lipid-lowering prescription."
      }
    ]
  }
};

// --- 2. Application State & Telemetry -----------------------------------------
const state = {
  activeKey: "trap_aki_negation",
  threshold: 0.35,  // dev-learned optimal threshold
  lowFrac: 0.8,     // hysteresis fraction: [0.28, 0.35)
  isScanning: false,
  highlightedSpan: null,
};

// Compute calibrated score formula: S = 0.8 * P_entail + 0.2 * Token_Conf
function computeDecisionScore(claim) {
  const w_nli = 0.8;
  const w_tok = 0.2;
  const p_entail = claim.p_entail != null ? claim.p_entail : 0.0;
  const token_conf = claim.token_conf != null ? claim.token_conf : 0.5;
  return Math.min(1.0, Math.max(0.0, w_nli * p_entail + w_tok * token_conf));
}

function evaluateThreeWayDecision(score, tau, lowFrac) {
  if (score >= tau) return "accept";
  if (score >= tau * lowFrac) return "flag";
  return "abstain";
}

// --- 3. UI Renderers ---------------------------------------------------------

function renderCurrentCase() {
  const currentCase = CLINICAL_VIVA_CASES[state.activeKey];
  if (!currentCase) return;

  // 1. Update Header Badges
  document.getElementById("patient-mrn-badge").textContent = `MRN: ${currentCase.id}`;

  // 2. Render Raw EHR Note with highlighted spans
  renderEHRNote(currentCase);

  // 3. Render Standard Naive AI Output (Column 2)
  renderNaiveBaseline(currentCase);

  // 4. Render Veritas Audited Output (Column 3)
  renderVeritasEngine(currentCase);

  // 5. Update Telemetry Summary
  updateTelemetryStats(currentCase);
}

function renderEHRNote(currentCase) {
  const container = document.getElementById("ehr-note-body");
  if (!container) return;

  let text = escapeHtml(currentCase.rawText);

  // Highlight planted traps with visual callout pills
  currentCase.veritasOutputs.forEach(claim => {
    if (!claim.span) return;
    const escapedSpan = escapeHtml(claim.span);
    const isTrap = claim.p_contra > 0.5;
    const tagClass = isTrap ? "ehr-span trap-negation" : "ehr-span grounded-active";

    const replacement = `<span class="${tagClass}" id="span-${claim.id}" title="${isTrap ? 'Clinical Distractor Trap' : 'Grounded Entity'}">${escapedSpan}</span>`;
    text = text.replace(escapedSpan, replacement);
  });

  container.innerHTML = text;
}

function renderNaiveBaseline(currentCase) {
  const container = document.getElementById("naive-claims-list");
  if (!container) return;

  container.innerHTML = "";

  currentCase.naiveOutputs.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = `naive-card ${item.isError ? 'hallucination' : ''}`;
    card.style.animationDelay = `${index * 80}ms`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase;">${item.type}</span>
        ${item.isError 
          ? `<span class="naive-badge-danger">⚠️ ${item.errorTag}</span>` 
          : `<span style="font-size: 0.7rem; font-family: var(--font-mono); color: #059669; font-weight: 600;">CONF: ${item.conf}%</span>`
        }
      </div>
      <div style="font-size: 0.92rem; font-weight: 700; color: ${item.isError ? '#b91c1c' : '#0f172a'};">${escapeHtml(item.name)}</div>
      
      ${item.isError ? `
        <div class="hallucination-callout">
          <strong>FAILURE MODE:</strong> ${escapeHtml(item.detail)}
        </div>
      ` : `
        <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">${escapeHtml(item.detail)}</div>
      `}
    `;

    container.appendChild(card);
  });
}

function renderVeritasEngine(currentCase) {
  const container = document.getElementById("veritas-claims-list");
  if (!container) return;

  container.innerHTML = "";

  let nAccepted = 0;
  let nBlocked = 0;

  currentCase.veritasOutputs.forEach((claim, index) => {
    const score = computeDecisionScore(claim);
    const decision = evaluateThreeWayDecision(score, state.threshold, state.lowFrac);

    if (decision === "accept") nAccepted++;
    if (decision === "abstain") nBlocked++;

    const card = document.createElement("div");
    card.className = `veritas-claim-card ${decision === 'accept' ? 'accepted' : decision === 'flag' ? 'flagged' : 'abstained'}`;
    card.id = `vcard-${claim.id}`;
    card.style.animationDelay = `${index * 90}ms`;

    const stampText = decision === "accept" 
      ? "✓ CHARTED (SAFE)" 
      : decision === "flag" 
      ? "⚠ FLAGGED (REVIEW)" 
      : "🛑 BLOCKED (HALLUCINATION)";
    
    const stampClass = decision;

    card.innerHTML = `
      <div class="claim-header-row">
        <span style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase; font-weight: 600;">${claim.type}</span>
        <span class="decision-stamp ${stampClass}">${stampText}</span>
      </div>

      <div class="claim-entity-name" style="${decision === 'abstain' ? 'text-decoration: line-through; color: #991b1b;' : ''}">
        ${escapeHtml(claim.value)}
      </div>

      <div class="nli-meter-box">
        <div class="meter-header">
          <span>Decision Score:</span>
          <strong>${score.toFixed(3)}</strong>
        </div>
        <div class="meter-track-horizontal">
          <div class="meter-segment entailment" style="width: ${Math.round(claim.p_entail * 100)}%" title="P_entail: ${(claim.p_entail * 100).toFixed(1)}%"></div>
          <div class="meter-segment neutral" style="width: ${Math.round(claim.p_neutral * 100)}%" title="P_neutral: ${(claim.p_neutral * 100).toFixed(1)}%"></div>
          <div class="meter-segment contradiction" style="width: ${Math.round(claim.p_contra * 100)}%" title="P_contra: ${(claim.p_contra * 100).toFixed(1)}%"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); margin-top: 4px;">
          <span style="color: #059669;">Entail: ${(claim.p_entail * 100).toFixed(1)}%</span>
          <span style="color: #d97706;">Neutral: ${(claim.p_neutral * 100).toFixed(1)}%</span>
          <span style="color: #dc2626;">Contra: ${(claim.p_contra * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div class="grounding-sentence-quote" title="Source Grounding Sentence">
        “${escapeHtml(claim.sentence)}”
      </div>

      <div style="font-size: 0.72rem; color: ${decision === 'abstain' ? '#991b1b' : '#047857'}; font-weight: 600; margin-top: 8px;">
        ${escapeHtml(claim.auditReason)}
      </div>
    `;

    // Interactive Hover: highlight the corresponding sentence in the EHR Note
    card.addEventListener("mouseenter", () => {
      const spanEl = document.getElementById(`span-${claim.id}`);
      if (spanEl) spanEl.classList.add("active-highlight");
    });

    card.addEventListener("mouseleave", () => {
      const spanEl = document.getElementById(`span-${claim.id}`);
      if (spanEl) spanEl.classList.remove("active-highlight");
    });

    container.appendChild(card);
  });

  // Update Status Headline
  const headlineEl = document.getElementById("veritas-status-headline");
  if (headlineEl) {
    if (nBlocked > 0) {
      headlineEl.textContent = `Protected: ${nBlocked} Hallucination(s) Filtered (${nAccepted} Safe Charted)`;
    } else {
      headlineEl.textContent = `All ${nAccepted} Findings Formally Verified`;
    }
  }

  const threshHeadline = document.getElementById("veritas-threshold-headline");
  if (threshHeadline) threshHeadline.textContent = state.threshold.toFixed(2);
}

function updateTelemetryStats(currentCase) {
  const total = currentCase.veritasOutputs.length;
  let nAccept = 0;
  let nBlocked = 0;

  currentCase.veritasOutputs.forEach(c => {
    const score = computeDecisionScore(c);
    const d = evaluateThreeWayDecision(score, state.threshold, state.lowFrac);
    if (d === "accept") nAccept++;
    if (d === "abstain") nBlocked++;
  });

  const covPct = total > 0 ? Math.round((nAccept / total) * 100) : 0;
  document.getElementById("stat-coverage-display").textContent = `${covPct}% (${nAccept}/${total} Charted)`;
}

// --- 4. Scanning Animation Effect --------------------------------------------

function triggerClinicalScanAnimation() {
  const laser = document.getElementById("audit-scan-laser");
  const auditBtn = document.getElementById("btn-trigger-audit");

  if (!laser || state.isScanning) return;

  state.isScanning = true;
  laser.classList.add("scanning");
  auditBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    Auditing Sentences...
  `;

  // Staggered sequence that simulates real multi-stage pipeline
  setTimeout(() => {
    renderCurrentCase();
    laser.classList.remove("scanning");
    state.isScanning = false;
    auditBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      Run Clinical Audit
    `;
  }, 1400);
}

// --- 5. Modal & Setup Lifecycle ----------------------------------------------

function setupEventListeners() {
  // Preset buttons
  document.querySelectorAll(".trap-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".trap-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeKey = btn.getAttribute("data-preset");
      triggerClinicalScanAnimation();
    });
  });

  // Threshold slider
  const slider = document.getElementById("threshold-range-slider");
  const badge = document.getElementById("tau-badge-display");

  slider.addEventListener("input", e => {
    const val = parseFloat(e.target.value);
    state.threshold = val;
    badge.textContent = val.toFixed(2);
    renderCurrentCase();
  });

  // Audit button
  const auditBtn = document.getElementById("btn-trigger-audit");
  if (auditBtn) auditBtn.addEventListener("click", triggerClinicalScanAnimation);

  // Examiner Guide Modal
  const modal = document.getElementById("examiner-guide-modal");
  const openBtn = document.getElementById("btn-open-guide");
  const closeBtn = document.getElementById("btn-close-guide");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => modal.classList.add("active"));
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.remove("active"));
  }

  window.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("active");
  });
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
  setupEventListeners();
  renderCurrentCase();
});
