/**
 * Veritas-Clin: Interactive 3D Clinical Evidence Manifold & Telemetry Studio
 * Built with Three.js, Google Fonts, and Calibrated Selective Abstention Logic.
 */

// --- 1. Clinical Preset Corpus with Planted Traps -----------------------------
const CLINICAL_PRESETS = {
  preset_aki_trap: {
    id: "VS-002",
    title: "Acute Kidney Injury (Planted Rule-Out Trap)",
    description: "Features COPD as an explicit 'ruled out' distractor and father's history.",
    text: `DISCHARGE SUMMARY
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
    claims: [
      {
        id: "c1",
        type: "diagnosis",
        value: "Acute Kidney Injury",
        dosage: null,
        span_text: "1. Acute Kidney Injury",
        token_conf: 0.989,
        p_entail: 0.994,
        p_contra: 0.001,
        sentence: "1. Acute Kidney Injury"
      },
      {
        id: "c2",
        type: "diagnosis",
        value: "Chronic Obstructive Pulmonary Disease - ruled out",
        dosage: null,
        span_text: "2. Chronic Obstructive Pulmonary Disease - ruled out.",
        token_conf: 0.985,
        p_entail: 0.082,
        p_contra: 0.884,
        sentence: "2. Chronic Obstructive Pulmonary Disease - ruled out."
      },
      {
        id: "c3",
        type: "medication",
        value: "Losartan 50 mg once daily",
        dosage: "50 mg once daily",
        span_text: "1. Losartan 50 mg once daily",
        token_conf: 0.991,
        p_entail: 0.988,
        p_contra: 0.002,
        sentence: "1. Losartan 50 mg once daily"
      },
      {
        id: "c4",
        type: "followup",
        value: "Cardiology in 2 weeks",
        dosage: null,
        span_text: "FOLLOW-UP: Cardiology in 2 weeks.",
        token_conf: 0.982,
        p_entail: 0.976,
        p_contra: 0.005,
        sentence: "FOLLOW-UP: Cardiology in 2 weeks."
      }
    ]
  },
  preset_chf: {
    id: "VS-014",
    title: "Congestive Heart Failure (Polypharmacy)",
    description: "Multi-drug cardiology intake with Furosemide and Atorvastatin.",
    text: `DISCHARGE SUMMARY
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
    claims: [
      {
        id: "c5",
        type: "diagnosis",
        value: "Congestive Heart Failure",
        dosage: null,
        span_text: "1. Congestive Heart Failure",
        token_conf: 0.995,
        p_entail: 0.996,
        p_contra: 0.001,
        sentence: "1. Congestive Heart Failure"
      },
      {
        id: "c6",
        type: "diagnosis",
        value: "Hypertension",
        dosage: null,
        span_text: "2. Hypertension",
        token_conf: 0.990,
        p_entail: 0.989,
        p_contra: 0.002,
        sentence: "2. Hypertension"
      },
      {
        id: "c7",
        type: "medication",
        value: "Furosemide 40 mg once daily",
        dosage: "40 mg once daily",
        span_text: "1. Furosemide 40 mg once daily",
        token_conf: 0.994,
        p_entail: 0.991,
        p_contra: 0.001,
        sentence: "1. Furosemide 40 mg once daily"
      },
      {
        id: "c8",
        type: "medication",
        value: "Atorvastatin 20 mg at night",
        dosage: "20 mg at night",
        span_text: "2. Atorvastatin 20 mg at night",
        token_conf: 0.988,
        p_entail: 0.985,
        p_contra: 0.003,
        sentence: "2. Atorvastatin 20 mg at night"
      },
      {
        id: "c9",
        type: "followup",
        value: "Primary Care in 7 days",
        dosage: null,
        span_text: "FOLLOW-UP: Primary Care in 7 days.",
        token_conf: 0.987,
        p_entail: 0.979,
        p_contra: 0.004,
        sentence: "FOLLOW-UP: Primary Care in 7 days."
      }
    ]
  },
  preset_allergy_trap: {
    id: "VS-029",
    title: "Pneumonia (Allergy & Resolved Trap)",
    description: "Features Penicillin in allergy line only and resolved Iron Deficiency.",
    text: `DISCHARGE SUMMARY
Patient ID: VS-029
Allergies: Penicillin (anaphylaxis)
The patient presents with productive cough and fever.
Family history: None significant.

ASSESSMENT:
1. Community-acquired Pneumonia
2. Iron Deficiency Anemia - resolved.

MEDICATIONS ON DISCHARGE:
1. Amoxicillin 875 mg twice daily for 7 days

FOLLOW-UP: Pulmonology in 3 weeks.`,
    claims: [
      {
        id: "c10",
        type: "diagnosis",
        value: "Community-acquired Pneumonia",
        dosage: null,
        span_text: "1. Community-acquired Pneumonia",
        token_conf: 0.992,
        p_entail: 0.991,
        p_contra: 0.002,
        sentence: "1. Community-acquired Pneumonia"
      },
      {
        id: "c11",
        type: "diagnosis",
        value: "Iron Deficiency Anemia - resolved",
        dosage: null,
        span_text: "2. Iron Deficiency Anemia - resolved.",
        token_conf: 0.981,
        p_entail: 0.124,
        p_contra: 0.812,
        sentence: "2. Iron Deficiency Anemia - resolved."
      },
      {
        id: "c12",
        type: "medication",
        value: "Amoxicillin 875 mg twice daily for 7 days",
        dosage: "875 mg twice daily",
        span_text: "1. Amoxicillin 875 mg twice daily for 7 days",
        token_conf: 0.993,
        p_entail: 0.987,
        p_contra: 0.002,
        sentence: "1. Amoxicillin 875 mg twice daily for 7 days"
      },
      {
        id: "c13",
        type: "followup",
        value: "Pulmonology in 3 weeks",
        dosage: null,
        span_text: "FOLLOW-UP: Pulmonology in 3 weeks.",
        token_conf: 0.985,
        p_entail: 0.981,
        p_contra: 0.003,
        sentence: "FOLLOW-UP: Pulmonology in 3 weeks."
      }
    ]
  }
};

// --- 2. Application State & Telemetry -----------------------------------------
const state = {
  activePresetKey: "preset_aki_trap",
  currentNoteText: "",
  claims: [],
  threshold: 0.35, // learned on dev split (0.3499)
  lowFrac: 0.8,    // hysteresis band: [0.8 * tau, tau)
  selectedClaimId: null,
  hoveredClaimId: null,
  isLiveServer: false,
};

// --- 3. Calibrated Decision Score Math ----------------------------------------
function computeScore(claim) {
  const w_nli = 0.8;
  const w_tok = 0.2;
  const p_entail = claim.p_entail != null ? claim.p_entail : 0.0;
  const token_conf = claim.token_conf != null ? claim.token_conf : 0.5;
  return Math.min(1.0, Math.max(0.0, w_nli * p_entail + w_tok * token_conf));
}

function evaluateDecision(score, tau, lowFrac) {
  if (score >= tau) return "accept";
  if (score >= tau * lowFrac) return "flag_for_review";
  return "abstain";
}

function updateClaimDecisions() {
  state.claims.forEach(claim => {
    claim.score = computeScore(claim);
    claim.decision = evaluateDecision(claim.score, state.threshold, state.lowFrac);
  });
}

// --- 4. Three.js 3D Evidence & Grounding Manifold -----------------------------
let scene, camera, renderer, raycaster, mouse;
let nodeMeshes = [];
let filamentLines = [];
let centralCoreGroup;
let particleSystem;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function initThreeScene() {
  const container = document.getElementById("three-container");
  if (!container) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a10, 0.035);

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 450;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 5, 13);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("three-canvas"),
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Ambient & Directional Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x22d3ee, 1.2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const backLight = new THREE.PointLight(0x0891b2, 1.5, 30);
  backLight.position.set(-8, -4, -5);
  scene.add(backLight);

  // 1. Central Clinical Note Hologram Core
  buildCentralCore();

  // 2. Clinical Particle Constellation Field
  buildParticleField();

  // 3. ResizeObserver for robust layout (following UI-Pro-Max stack rules)
  const resizeObserver = new ResizeObserver(entries => {
    if (!entries || !entries[0]) return;
    const { width: w, height: h } = entries[0].contentRect;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // 4. Mouse / Touch Orbit Interaction
  setupThreeInteraction(container);

  // Start Animation Loop
  animateThree();
}

function buildCentralCore() {
  centralCoreGroup = new THREE.Group();

  // Stylized cylindrical layered rings
  const ringGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 32, 1, true);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x0891b2,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  centralCoreGroup.add(ringMesh);

  // Core glowing disc
  const discGeo = new THREE.CircleGeometry(1.5, 32);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.rotation.x = Math.PI / 2;
  centralCoreGroup.add(discMesh);

  // Inner pulsing nucleus
  const nucGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const nucMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0891b2,
    emissiveIntensity: 0.5
  });
  const nucMesh = new THREE.Mesh(nucGeo, nucMat);
  centralCoreGroup.add(nucMesh);

  scene.add(centralCoreGroup);
}

function buildParticleField() {
  const particleCount = 550;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const baseColor = new THREE.Color(0x0e7490);
  const accentColor = new THREE.Color(0x22d3ee);

  for (let i = 0; i < particleCount; i++) {
    const radius = 4 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;

    positions[i * 3] = radius * Math.cos(phi) * Math.sin(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi);
    positions[i * 3 + 2] = radius * Math.cos(phi) * Math.cos(theta);

    const mixed = baseColor.clone().lerp(accentColor, Math.random());
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
}

function sync3DNodesWithClaims() {
  if (!scene) return;

  // Clear existing nodes and lines
  nodeMeshes.forEach(mesh => scene.remove(mesh));
  filamentLines.forEach(line => scene.remove(line));
  nodeMeshes = [];
  filamentLines = [];

  const claims = state.claims;
  if (!claims || claims.length === 0) return;

  const typeRadii = {
    diagnosis: 4.0,
    medication: 5.2,
    followup: 6.4
  };

  claims.forEach((claim, index) => {
    const angle = (index / claims.length) * Math.PI * 2 - Math.PI / 2;
    const radius = typeRadii[claim.type] || 4.8;

    // Y altitude derived from score: higher score = elevated confident plane
    const altitude = (claim.score - 0.5) * 3.5;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = altitude;

    // Node Sphere
    const nodeColor = getDecisionHex(claim.decision);
    const nodeGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: nodeColor,
      roughness: 0.1,
      metalness: 0.4,
      emissive: nodeColor,
      emissiveIntensity: 0.6
    });
    const mesh = new THREE.Mesh(nodeGeo, nodeMat);
    mesh.position.set(x, y, z);
    mesh.userData = { claimId: claim.id, claim };

    // Outer Halo Ring
    const haloGeo = new THREE.RingGeometry(0.38, 0.46, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: nodeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.lookAt(camera.position);
    mesh.add(halo);

    scene.add(mesh);
    nodeMeshes.push(mesh);

    // Dynamic Entailment Tensor Beam (from central core to claim node)
    const points = [];
    points.push(new THREE.Vector3(0, 0, 0));
    // Midpoint curved spline
    points.push(new THREE.Vector3(x * 0.5, y * 0.8 + 0.5, z * 0.5));
    points.push(new THREE.Vector3(x, y, z));

    const curve = new THREE.CatmullRomCurve3(points);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
    const lineMat = new THREE.LineBasicMaterial({
      color: nodeColor,
      transparent: true,
      opacity: claim.decision === "abstain" ? 0.35 : 0.85,
      linewidth: 2
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    filamentLines.push(line);
  });
}

function getDecisionHex(decision) {
  if (decision === "accept") return 0x10b981;  // emerald
  if (decision === "flag_for_review") return 0xf59e0b; // amber
  return 0xef4444; // crimson abstain
}

function setupThreeInteraction(container) {
  container.addEventListener("mousedown", e => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  container.addEventListener("mousemove", e => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      scene.rotation.y += deltaX * 0.006;
      scene.rotation.x = Math.max(-0.6, Math.min(0.6, scene.rotation.x + deltaY * 0.006));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    // Raycast hover check
    checkHoveredNode();
  });

  // Touch Support (following UI Pro Max Touch & Interaction guidelines)
  container.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  container.addEventListener("touchmove", e => {
    if (isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      scene.rotation.y += deltaX * 0.008;
      scene.rotation.x = Math.max(-0.6, Math.min(0.6, scene.rotation.x + deltaY * 0.008));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  container.addEventListener("touchend", () => {
    isDragging = false;
  });

  container.addEventListener("click", () => {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeMeshes);
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      selectClaim(clickedMesh.userData.claimId);
    }
  });
}

function checkHoveredNode() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(nodeMeshes);

  if (intersects.length > 0) {
    const hoveredMesh = intersects[0].object;
    const claimId = hoveredMesh.userData.claimId;
    if (state.hoveredClaimId !== claimId) {
      highlightClaimInUI(claimId);
    }
  } else if (state.hoveredClaimId && !state.selectedClaimId) {
    clearHighlightInUI();
  }
}

function animateThree() {
  requestAnimationFrame(animateThree);

  const time = performance.now() * 0.001;

  // Subtle breathing rotation of central core
  if (centralCoreGroup) {
    centralCoreGroup.rotation.y += 0.004;
    centralCoreGroup.position.y = Math.sin(time * 1.5) * 0.12;
  }

  // Undulating constellation particles
  if (particleSystem) {
    particleSystem.rotation.y = time * 0.02;
  }

  // Node halo pulsing towards camera
  nodeMeshes.forEach((mesh, i) => {
    const isHovered = mesh.userData.claimId === state.hoveredClaimId || mesh.userData.claimId === state.selectedClaimId;
    const targetScale = isHovered ? 1.4 : 1.0 + Math.sin(time * 3 + i) * 0.05;
    mesh.scale.set(targetScale, targetScale, targetScale);
  });

  renderer.render(scene, camera);
}

// Reset camera view
function resetCameraView() {
  if (!scene) return;
  scene.rotation.set(0, 0, 0);
  camera.position.set(0, 5, 13);
  camera.lookAt(0, 0, 0);
}

// --- 5. UI Rendering & DOM Synchronization ------------------------------------

function renderNoteView() {
  const noteContainer = document.getElementById("note-highlight-display");
  const rawText = state.currentNoteText;

  if (!noteContainer) return;

  // Build annotated HTML with highlighted span pills
  let annotatedHtml = escapeHtml(rawText);

  state.claims.forEach(claim => {
    if (!claim.span_text) return;

    const spanEscaped = escapeHtml(claim.span_text);
    const pillClass = `span-pill ${claim.decision === 'flag_for_review' ? 'flag' : claim.decision}`;
    const isSelected = claim.id === state.selectedClaimId || claim.id === state.hoveredClaimId;
    const extraClass = isSelected ? 'highlighted' : '';

    const pillHtml = `<span class="${pillClass} ${extraClass}" data-claim-id="${claim.id}" onclick="selectClaim('${claim.id}')" title="Decision: ${claim.decision.toUpperCase()} | Score: ${claim.score.toFixed(3)}">${spanEscaped}</span>`;

    annotatedHtml = annotatedHtml.replace(spanEscaped, pillHtml);
  });

  noteContainer.innerHTML = annotatedHtml;
}

function renderClaimsFeed() {
  const listEl = document.getElementById("claims-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  // Summary counts
  let nAccept = 0, nFlag = 0, nAbstain = 0;

  state.claims.forEach(claim => {
    if (claim.decision === "accept") nAccept++;
    else if (claim.decision === "flag_for_review") nFlag++;
    else nAbstain++;

    const card = document.createElement("div");
    card.className = `claim-card ${claim.decision === 'flag_for_review' ? 'flag' : claim.decision} ${claim.id === state.selectedClaimId ? 'selected' : ''}`;
    card.id = `card-${claim.id}`;

    const decisionLabel = claim.decision === "flag_for_review" ? "REVIEW" : claim.decision.toUpperCase();
    const decisionBadgeClass = claim.decision === "flag_for_review" ? "flag" : claim.decision;

    card.innerHTML = `
      <div class="claim-top">
        <span class="claim-type-tag">${claim.type}</span>
        <span class="decision-badge ${decisionBadgeClass}">${decisionLabel}</span>
      </div>
      <div class="claim-title">${escapeHtml(claim.value)}</div>
      ${claim.dosage ? `<div class="claim-dosage">${escapeHtml(claim.dosage)}</div>` : ''}
      
      <div class="metric-bar-group">
        <div class="metric-row">
          <span class="metric-name">Decision Score</span>
          <span class="metric-val">${claim.score.toFixed(3)}</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill score" style="width: ${Math.round(claim.score * 100)}%"></div>
        </div>

        <div class="metric-row" style="margin-top: 4px;">
          <span class="metric-name">NLI Entailment (P<sub>entail</sub>)</span>
          <span class="metric-val">${claim.p_entail.toFixed(3)}</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill entail" style="width: ${Math.round(claim.p_entail * 100)}%"></div>
        </div>
      </div>

      ${claim.sentence ? `<div class="claim-source-sentence" title="${escapeHtml(claim.sentence)}">“${escapeHtml(claim.sentence)}”</div>` : ''}
    `;

    card.addEventListener("mouseenter", () => highlightClaimInUI(claim.id));
    card.addEventListener("mouseleave", () => clearHighlightInUI());
    card.addEventListener("click", () => selectClaim(claim.id));

    listEl.appendChild(card);
  });

  // Update summary chips
  document.getElementById("stat-accept-count").textContent = nAccept;
  document.getElementById("stat-flag-count").textContent = nFlag;
  document.getElementById("stat-abstain-count").textContent = nAbstain;

  // Update bottom telemetry counters
  const total = state.claims.length;
  const coveragePct = total > 0 ? Math.round((nAccept / total) * 100) : 0;
  document.getElementById("deck-coverage-val").textContent = `${coveragePct}% (${nAccept}/${total})`;

  const incorrectEstimated = nAbstain + nFlag;
  document.getElementById("deck-flagged-val").textContent = `${incorrectEstimated} filtered`;
}

function highlightClaimInUI(claimId) {
  state.hoveredClaimId = claimId;

  // Highlight card
  document.querySelectorAll(".claim-card").forEach(c => c.classList.remove("hovered-card"));
  const card = document.getElementById(`card-${claimId}`);
  if (card) card.classList.add("hovered-card");

  // Highlight span pill
  document.querySelectorAll(".span-pill").forEach(p => {
    if (p.getAttribute("data-claim-id") === claimId) {
      p.classList.add("highlighted");
    } else {
      p.classList.remove("highlighted");
    }
  });
}

function clearHighlightInUI() {
  state.hoveredClaimId = null;
  document.querySelectorAll(".claim-card").forEach(c => c.classList.remove("hovered-card"));
  document.querySelectorAll(".span-pill").forEach(p => {
    if (p.getAttribute("data-claim-id") !== state.selectedClaimId) {
      p.classList.remove("highlighted");
    }
  });
}

function selectClaim(claimId) {
  state.selectedClaimId = (state.selectedClaimId === claimId) ? null : claimId;
  renderNoteView();
  renderClaimsFeed();

  // Scroll card into view
  if (state.selectedClaimId) {
    const card = document.getElementById(`card-${claimId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
}

// --- 6. Preset Switching & Live Extraction ------------------------------------

function loadPreset(key) {
  const preset = CLINICAL_PRESETS[key];
  if (!preset) return;

  state.activePresetKey = key;
  state.currentNoteText = preset.text;
  state.claims = JSON.parse(JSON.stringify(preset.claims)); // deep copy

  document.getElementById("note-raw-textarea").value = preset.text;
  document.getElementById("patient-id-display").textContent = preset.id;

  updateClaimDecisions();
  renderNoteView();
  renderClaimsFeed();
  sync3DNodesWithClaims();
}

async function triggerLiveExtraction() {
  const noteText = document.getElementById("note-raw-textarea").value.trim();
  if (!noteText) return;

  state.currentNoteText = noteText;
  const runBtn = document.getElementById("btn-run-extract");
  runBtn.textContent = "Verifying...";
  runBtn.disabled = true;

  try {
    const res = await fetch("/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: "adhoc", note_text: noteText })
    });

    if (res.ok) {
      const data = await res.json();
      state.isLiveServer = true;
      state.claims = data.claims.map((c, i) => ({
        id: `live_${i}`,
        type: c.type,
        value: c.value,
        dosage: c.dosage,
        span_text: c.span_text,
        token_conf: c.token_conf || 0.95,
        p_entail: c.p_entail,
        p_contra: c.p_contra,
        sentence: c.sentence
      }));
    } else {
      throw new Error(`Server returned status ${res.status}`);
    }
  } catch (err) {
    console.warn("Live API not accessible, utilizing deterministic verification fallback:", err);
    // Client-side rule parsing simulation for offline UI demonstration
    simulateOfflineExtraction(noteText);
  } finally {
    runBtn.textContent = "Run Verification";
    runBtn.disabled = false;
    updateClaimDecisions();
    renderNoteView();
    renderClaimsFeed();
    sync3DNodesWithClaims();
  }
}

function simulateOfflineExtraction(text) {
  const generatedClaims = [];
  let idCounter = 1;

  text.split("\n").forEach(line => {
    line = line.trim();
    if (!line) return;

    // Diagnosis rule check
    if (/^\d+\.\s+/.test(line)) {
      const val = line.replace(/^\d+\.\s+/, "").replace(/\.$/, "").trim();
      const isRuledOut = /ruled out|resolved|unlikely/i.test(val);

      if (isRuledOut) {
        generatedClaims.push({
          id: `sim_${idCounter++}`,
          type: "diagnosis",
          value: val,
          dosage: null,
          span_text: line,
          token_conf: 0.985,
          p_entail: 0.091, // NLI verifier contradicts
          p_contra: 0.881,
          sentence: line
        });
      } else if (!/mg|puff|daily|bid|tid/i.test(val)) {
        generatedClaims.push({
          id: `sim_${idCounter++}`,
          type: "diagnosis",
          value: val,
          dosage: null,
          span_text: line,
          token_conf: 0.992,
          p_entail: 0.994,
          p_contra: 0.002,
          sentence: line
        });
      } else {
        generatedClaims.push({
          id: `sim_${idCounter++}`,
          type: "medication",
          value: val,
          dosage: val.match(/\d+.*$/) ? val.match(/\d+.*$/)[0] : null,
          span_text: line,
          token_conf: 0.991,
          p_entail: 0.989,
          p_contra: 0.003,
          sentence: line
        });
      }
    } else if (line.startsWith("FOLLOW-UP:")) {
      const fu = line.replace("FOLLOW-UP:", "").replace(/\.$/, "").trim();
      generatedClaims.push({
        id: `sim_${idCounter++}`,
        type: "followup",
        value: fu,
        dosage: null,
        span_text: line,
        token_conf: 0.988,
        p_entail: 0.978,
        p_contra: 0.005,
        sentence: line
      });
    }
  });

  state.claims = generatedClaims;
}

// --- 7. Modal Dialogs & Telemetry Viewers -------------------------------------

function setupModalListeners() {
  const modal = document.getElementById("telemetry-modal");
  const openBtn = document.getElementById("btn-open-telemetry");
  const closeBtn = document.getElementById("btn-close-modal");

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

// --- 8. Initialization Lifecycle ---------------------------------------------

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Three.js Manifold
  initThreeScene();

  // 2. Setup Threshold Scrubber
  const slider = document.getElementById("tau-slider");
  const tauDisplay = document.getElementById("tau-val-display");

  slider.addEventListener("input", e => {
    const val = parseFloat(e.target.value);
    state.threshold = val;
    tauDisplay.textContent = val.toFixed(2);

    updateClaimDecisions();
    renderNoteView();
    renderClaimsFeed();
    sync3DNodesWithClaims();
  });

  // 3. Preset Switcher
  const presetSelect = document.getElementById("preset-select");
  presetSelect.addEventListener("change", e => {
    loadPreset(e.target.value);
  });

  // 4. Run Verification Button
  const runBtn = document.getElementById("btn-run-extract");
  runBtn.addEventListener("click", triggerLiveExtraction);

  // 5. Reset Camera Button
  const resetCamBtn = document.getElementById("btn-reset-cam");
  if (resetCamBtn) resetCamBtn.addEventListener("click", resetCameraView);

  // 6. Setup Telemetry Modal
  setupModalListeners();

  // 7. Initial Load
  loadPreset(state.activePresetKey);
});
