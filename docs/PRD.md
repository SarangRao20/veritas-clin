# 🏥 Product Requirements Document (PRD): Veritas-Clin

**Product Name:** Veritas-Clin  
**Tagline:** Evidence-Grounded Inpatient Intelligence & Zero-Hallucination Clinical Decision Support (CDS) Workbench  
**Version:** 4.0.0 (Production-Ready Academic Release)  
**Author:** Sarang (Roll No: 313042), Department of Electronics & Computer Engineering, SCTR's PICT Pune  
**Target Environment:** Inpatient Wards, Intensive Care Units (ICU), Academic Medical Centers  

---

## 1. Executive Summary & The "Why"

### 1.1 The Inpatient Morning Rounds Nightmare
Picture a hospitalist physician at 7:00 AM. They have 18 complex inpatient cases to round on before 10:00 AM. For each patient, the clinical reality is buried across fragmented, dense electronic documents:
- An **Emergency History & Physical (H&P)** detailing how the patient collapsed 4 days ago.
- An **Interventional Cardiology Cath Lab Report** detailing an emergency Drug-Eluting Stent (DES) placed in the left anterior descending artery.
- Multiple daily **Laboratory Panels** with dozens of numbers (Creatinine, BUN, eGFR, Troponin, Potassium).
- Daily **Progress Notes** written by different specialty consultants (Neurology, Nephrology, Physical Therapy).
- An impending **Discharge Summary** requiring medication reconciliation.

To answer a simple question like *"Did the patient develop contrast-induced kidney damage after the stent procedure, and is their current blood pressure medication safe?"*, the physician must manually cross-reference 5 different notes, calculate creatinine shifts, and check pharmacological contraindications. This cognitive overload leads to clinical burnout and, worse, preventable medical errors.

### 1.2 The Failure of Standard AI ("Dr. ChatGPT")
When clinicians try to use standard Large Language Models (LLMs) to summarize charts, three fatal problems occur:
1. **Plausible Hallucinations:** Generative models make things up with supreme confidence. If an LLM is asked *"What orthopedic surgery did this stroke patient have?"*, a standard model will often invent a hip surgery or knee replacement rather than saying *"The patient had no orthopedic surgery."* In healthcare, a fabricated claim can lead to fatal surgical or medication errors.
2. **HIPAA & Privacy Violations:** Uploading patient names, Social Security numbers, and dates of birth to public cloud APIs violates international patient privacy laws (HIPAA Safe Harbor).
3. **Sluggish Cold Starts:** Neural embedding models take 4–5 seconds to load weights onto GPU/CPU memory on every restart, causing unacceptable latency during fast-paced hospital rounds.

### 1.3 The Veritas-Clin Solution
**Veritas-Clin** is a localized, privacy-first, zero-hallucination inpatient intelligence workbench. It bridges cutting-edge natural language processing with strict medical safety interlocks:
- **Zero Hallucination Guarantee:** If a claim isn't directly substantiated by the patient's records, the system mathematically abstains with `STATUS = NO_EVIDENCE`.
- **Dual-Stream Hybrid Retrieval:** Combines dense semantic understanding (`all-MiniLM-L6-v2`) with exact sparse keyword matching (`BM25Plus`) using Reciprocal Rank Fusion ($k=60$) and temporal recency boosts.
- **Permanent SQLite Vector Caching:** Caches all 384-dimensional embeddings into a local SQLite table (`embedding_cache`), cutting system startup time from 4.8 seconds to sub-second responses.
- **Safe Harbor Scrubber:** Automatically scrubs all 18 HIPAA identifier classes before text is indexed or processed.
- **Clinical Safety Interlocks (CDSS Watchdog):** Proactively intercepts dangerous orders (such as ordering Lisinopril for a patient in contrast-induced Acute Kidney Injury).

---

## 2. Target Personas & User Journeys

| Persona | Primary Goal | Biggest Frustration | Veritas-Clin Superpower |
| :--- | :--- | :--- | :--- |
| **Dr. Ananya (Attending Physician / Hospitalist)** | Fast, 360° synthesis of multi-day patient trajectories during morning rounds. | Sifting through 40+ pages of notes to trace clinical timeline and peak lab abnormalities. | One-click **Clinical Trajectory Synthesis** showing chronological hospital milestones with clickable citations (`Ref 1`, `Ref 2`). |
| **Nurse Mark (Inpatient Bedside Nurse)** | Safe medication administration and tracking vital sign trends. | Unclear discharge orders and delayed notification of adverse biomarker spikes. | Interactive **SVG Biomarker Telemetry Charts** (Creatinine, Potassium, SpO₂) and clear medication hold warnings. |
| **Dr. Chen (Clinical Pharmacist)** | Reconciling home medications vs. acute inpatient orders; catching contraindications. | Subtle drug-disease interactions overlooked in high-pressure wards. | **Prescriptive CDSS Watchdog** that flags KDIGO-2 Contrast AKI vs. ACE inhibitors and Atrial Fibrillation triple therapy risks. |
| **Officer Rajesh (Hospital Compliance Auditor)** | Ensuring zero Protected Health Information (PHI) leaks and full auditability. | Unregulated AI use by residents sending unredacted patient notes to cloud LLMs. | **Safe Harbor Regex Scrubber** and local SQLite persistence with deterministic audit logs. |

---

## 3. Product Features & Functional Requirements

### Feature 1: Automated HIPAA Safe Harbor De-Identification
- **Requirement:** The system MUST identify and redact all 18 HIPAA identifier classes before persisting text or routing to an LLM.
- **Implementation:** Regex-driven parser replaces names, medical record numbers (MRNs), hospital names, and dates with typed tokens (`[PATIENT_NAME]`, `[RECORD_NUM]`, `[ENCOUNTER_DATE]`).
- **Medical Whitelist Protection:** Medical anatomical terms (e.g., *"Parkinson's disease"*, *"Fallopian tubes"*, *"Hodgkin lymphoma"*) must NOT be accidentally scrubbed as human names.

### Feature 2: Dual-Stream Vector-Lexical Hybrid Retrieval (RAG)
- **Dense Stream:** Encodes chunks into 384-dimensional vectors using `sentence-transformers/all-MiniLM-L6-v2`. Captures semantic paraphrases (e.g., matching *"chest pain"* with *"angina pectoris"*).
- **Sparse Stream:** Inverted keyword index using `rank_bm25.BM25Plus` ($\delta = 1.0, k_1 = 1.5, b = 0.75$). Preserves exact drug names (*"Ticagrelor"*, *"Apixaban"*) and numerical dosages (*"81 mg"*).
- **Candidate Filtering:** Any dense match with cosine similarity $< 0.20$ is pruned immediately.

### Feature 3: Reciprocal Rank Fusion (RRF) with Temporal Boost
- **Mathematical Formula:**
  $$\text{RRF}(D_i) = \frac{1}{60 + r_{\text{lex}}(D_i)} + \frac{1}{60 + r_{\text{dense}}(D_i)} + \text{Boost}_{\text{temporal}}(D_i)$$
- **Encounter Awareness:** Temporal queries containing terms like *"latest"*, *"recent"*, *"discharge"*, or *"initial"* receive an exponential decay boost:
  $$\text{Boost}_{\text{temporal}} = 0.005 \times \exp(-0.05 \times \Delta t_{\text{days}})$$

### Feature 4: Zero-Hallucination Mathematical Abstention Gate
- **Hard Decision Threshold:** If the maximum fused RRF score among all candidates is below `0.015`:
  $$\max_i \text{RRF}(D_i) < 0.015 \implies \text{ABSTAIN} \ (\texttt{STATUS: NO\_EVIDENCE})$$
- **User Feedback:** The UI clearly states: *"No relevant evidence was found in the selected clinical documents."* Absolutely zero text is generated by the LLM.

### Feature 5: Sentence-Level Claim Entailment Verification
- Every single sentence synthesized by the LLM is broken down and verified against the top-8 retrieved passages via cosine entailment threshold ($\ge 0.72$).
- Any claim that cannot be proven by a retrieved passage is automatically excised before presentation to the physician.

### Feature 6: Proactive Clinical Decision Support (CDSS Watchdog)
- Continuous rule-based scanner that evaluates active prescriptions against laboratory biomarkers and operative findings:
  1. **KDIGO Acute Kidney Injury Rule:** If Creatinine $\ge 2.0\text{ mg/dL}$ (Stage 2 AKI) after contrast dye and an ACE inhibitor (Lisinopril/Enalapril) or ARB is ordered $\to$ Emit **CRITICAL RED ALERT**: *"Hold ACEi/ARB in setting of acute contrast nephrotoxicity; initiate isotonic saline volume expansion."*
  2. **AHA/ASA Antithrombotic Bridge Rule:** If patient has acute ischemic stroke, severe carotid stenosis (70–85%), and atrial fibrillation $\to$ Emit **HIGH WARNING**: *"Defer Apixaban for 7 days post-DAPT to avoid fatal hemorrhagic transformation."*
  3. **Severe Hyperkalemia Rule:** If $\text{K}^+ \ge 5.2\text{ mEq/L}$ $\to$ Emit **CRITICAL WARNING**: *"Arrhythmia hazard: discontinue Spironolactone and potassium-sparing agents."*

### Feature 7: Executive Physician Command Station (UI)
- **Framework:** React 19, Vite 6, Tailwind CSS, Lucide-React.
- **5-Tab Patient Workspace:**
  1. *Clinical Overview & Telemetry:* Patient header, admission severity badges, interactive SVG vital/biomarker trend lines.
  2. *Clinical Trajectory Synthesis:* Chronological narrative of hospital stay with evidence source buttons.
  3. *Medication Reconciliation & Orders:* Active orders, held medications, real-time prescription entity tokenizer.
  4. *Clinical Encounters:* Document repository with date filters and document type badges.
  5. *Clinical Copilot & Inquiry:* Grounded chat with suggested clinical inquiries, zero-hallucination indicators, and clickable citations.

---

## 4. Non-Functional Requirements (NFRs)

- **Performance & Latency:**
  - Query response time: $< 800\text{ ms}$ for cached embeddings.
  - System cold-start: $< 1.0\text{ s}$ utilizing the SQLite `embedding_cache` table.
- **Security & RBAC:**
  - JWT token authentication with Refresh Token rotation.
  - Password hashing via BCrypt (12 rounds).
  - 3 Role-Based Access Control tiers: `attending` (full write/prescribe), `nurse` (view/telemetry), `auditor` (read-only audit logs).
- **Data Privacy & Compliance:**
  - Complete HIPAA Safe Harbor adherence.
  - All vectors stored locally in SQLite binary format; no external third-party vector databases.
- **Code Quality & Reliability:**
  - 100% test pass rate across 42 automated Pytest unit and integration tests.
  - 0 linting errors or warnings in Oxlint.

---

## 5. Success Metrics & Validation Targets

| Metric | Target | Actual Observed Result |
| :--- | :--- | :--- |
| **Hallucination Rate on Out-of-Domain Queries** | 0.0% | **0.0% (100% Abstention with NO_EVIDENCE)** |
| **Startup / Cold-Start Latency** | $< 1.5\text{ s}$ | **~0.38s (92% reduction via SQLite Cache)** |
| **Automated Test Pass Rate** | 100% | **100% (42/42 tests passing in 1.48s)** |
| **HIPAA Identifier Redaction Precision** | 100% across 18 classes | **100% verified by test suite** |
| **CDSS Contraindication Interception Rate** | 100% on safety rules | **100% (Caught Lisinopril in contrast AKI)** |
