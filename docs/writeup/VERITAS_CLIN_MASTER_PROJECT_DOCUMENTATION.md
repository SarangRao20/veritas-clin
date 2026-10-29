# 📘 Veritas-Clin: Master Project Comprehensive Documentation & Technical Reference

> **Project Title:** Veritas-Clin: Safe Harbor Zero-Hallucination Clinical Inpatient Copilot with Dual-Stream Vector-Lexical RAG and Prescriptive Safety Interlocks  
> **Course:** Artificial Intelligence Laboratory (AIL) [Course Code: 2605MD39] — Experiment No. 9 (Mini Project)  
> **Department:** Department of Electronics & Computer Engineering, SCTR's Pune Institute of Computer Technology (PICT), Pune  
> **Academic Year:** 2026–2027  
> **Candidate Roll No:** 313042  

---

## 1. Executive Summary & Problem Definition

In modern hospital environments, inpatient care is characterized by massive information fragmentation across multiple electronic health record (EHR) encounters. A single patient's hospital stay typically generates emergency admission notes (History & Physical), diagnostic catheterization or operative summaries, daily multi-organ laboratory flowsheets, serial telemetry reports, and detailed discharge instructions.

While contemporary Large Language Models (LLMs) offer unprecedented natural language reasoning capabilities, their deployment into inpatient clinical workflows faces three critical barriers:
1. **The Factual Hallucination Catastrophe:** Standard parametric LLMs fabricate non-existent pharmacological dosages, diagnostic results, and surgical histories when ungrounded.
2. **HIPAA Safe Harbor Compliance:** Regulatory mandates prohibit transmitting Protected Health Information (PHI) to third-party cloud APIs.
3. **Cold-Start Latency & Computation Overhead:** Reloading high-dimensional neural models across recurring clinical inquiries introduces multi-second delays unacceptable during morning hospital rounds.

**Veritas-Clin** solves these challenges by implementing an evidence-grounded Clinical Decision Support (CDS) system architected around dual-stream dense-lexical retrieval, Reciprocal Rank Fusion (RRF), permanent SQLite vector caching, automated Safe Harbor de-identification, and prescriptive clinical watchdog interlocks.

---

## 2. Objectives & Design Principles

- **Zero Factual Hallucination:** Mandate that 100% of generated clinical claims are directly substantiated by retrieved source documents with clickable citation references.
- **Strict Mathematical Abstention:** Enforce hard score thresholding ($RRF < 0.015$) such that questions regarding unmentioned pathologies immediately return `NO_EVIDENCE` rather than fabricating plausibly sounding answers.
- **Persistent Vector Caching:** Cache all 384-dimensional dense sentence embeddings in an indexed SQLite store to eliminate redundant model passes and accelerate startup.
- **Prescriptive Safety Interlocks:** Continuously correlate laboratory biomarker trajectories against active pharmacotherapy to intercept fatal adverse interactions (e.g., contrast-induced nephrotoxicity vs. ACE inhibitors).
- **Safe Harbor PHI Scrubber:** Scrub all 18 HIPAA identifier categories before any data processing.

---

## 3. System Architecture & Component Design

The complete architecture is structured into six pipeline stages:

```
[Raw Inpatient Records (PDF / TXT)]
                │
                ▼
┌───────────────────────────────────────────────┐
│ Stage 1: HIPAA Safe Harbor De-Identifier      │
│ (Regex pattern match: names, MRNs, dates, etc.)│
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Stage 2: Semantic Sliding Window Chunking     │
│ (512 token chunks, 64 token overlap)          │
└───────────────┬───────────────────────────────┘
                │
        ┌───────┴────────────────────────┐
        ▼                                ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Stream A: Dense Vectors │  │ Stream B: Sparse Lexical│
│ (all-MiniLM-L6-v2)      │  │ (Rank-BM25Plus Tokenizer)│
└───────────┬─────────────┘  └───────────┬─────────────┘
            │                            │
            └───────────┬────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Stage 3: Persistent SQLite Vector Store       │
│ (Tables: documents, passages, embedding_cache)│
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Stage 4: Hybrid Reciprocal Rank Fusion (RRF)   │
│ RRF(i) = 1/(60+r_lex) + 1/(60+r_dense) + Boost │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Stage 5: Decision Gate & Claim Entailment     │
│ Gate: max(RRF) >= 0.015 ? Pass : NO_EVIDENCE  │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Stage 6: Executive Physician Station (React)  │
│ (Interactive Telemetry, CDSS Watchdog, Chat)  │
└───────────────────────────────────────────────┘
```

---

## 4. Mathematical Formulations

### 4.1 Dense Cosine Semantic Similarity
Given a query $Q$ and passage $D_i$, their 384-dimensional dense vector embeddings $\mathbf{e}_q, \mathbf{e}_{d_i} \in \mathbb{R}^{384}$ are generated by Siamese Sentence-BERT (`all-MiniLM-L6-v2`):
$$\text{Sim}_{\text{dense}}(Q, D_i) = \frac{\mathbf{e}_q \cdot \mathbf{e}_{d_i}}{\|\mathbf{e}_q\|_2 \|\mathbf{e}_{d_i}\|_2} = \frac{\sum_{k=1}^{384} e_{q,k} \cdot e_{d_i,k}}{\sqrt{\sum_{k=1}^{384} e_{q,k}^2} \sqrt{\sum_{k=1}^{384} e_{d_i,k}^2}}$$

### 4.2 Sparse Lexical Scoring (BM25Plus)
To prevent extreme document-length penalties on comprehensive discharge summaries, Veritas-Clin implements BM25Plus with calibration parameters $k_1 = 1.5, b = 0.75, \delta = 1.0$:
$$\text{Score}_{\text{BM25+}}(Q, D_i) = \sum_{t \in Q} \text{IDF}(t) \cdot \left[ \frac{f(t, D_i) \cdot (k_1 + 1)}{f(t, D_i) + k_1 \cdot \left(1 - b + b \cdot \frac{|D_i|}{\text{avgdl}}\right)} + \delta \right]$$
$$\text{IDF}(t) = \ln \left( \frac{N - n(t) + 0.5}{n(t) + 0.5} + 1 \right)$$

### 4.3 Reciprocal Rank Fusion with Temporal Boost
Retrieved candidates are sorted by their rank positions in both streams ($r_{\text{lex}}, r_{\text{dense}} \ge 1$):
$$\text{RRF}(D_i) = \frac{1}{k + r_{\text{lex}}(D_i)} + \frac{1}{k + r_{\text{dense}}(D_i)} + \text{Boost}_{\text{temporal}}(D_i)$$
Where $k = 60$ and the encounter recency boost is defined as:
$$\text{Boost}_{\text{temporal}}(D_i) = 0.005 \times \exp\left( -0.05 \times \Delta t_{\text{days}} \right)$$

### 4.4 Strict Zero-Hallucination Gate
$$\text{Decision}(Q) = \begin{cases} 
\text{Proceed to LLM Synthesis with Top-8 Passages}, & \text{if } \max_{i} \text{RRF}(D_i) \ge 0.015 \\
\text{Abstain immediately with } \texttt{STATUS = NO\_EVIDENCE}, & \text{if } \max_{i} \text{RRF}(D_i) < 0.015
\end{cases}$$

---

## 5. Database Schema & Persistence Architecture

The backend utilizes an optimized SQLite database (`veritas_clin.db`) with foreign key constraints and binary blob storage:

1. **`documents` Table:**
   - `id` (TEXT PRIMARY KEY): Unique UUID.
   - `patient_id` (TEXT INDEXED): Foreign patient identifier (e.g. `PT-5120`).
   - `doc_type` (TEXT): `emergency_hp`, `cath_report`, `lab_panel`, `discharge_summary`.
   - `encounter_date` (TEXT): ISO 8601 date.
   - `extracted_text` (TEXT): Safe Harbor sanitized content.
   - `created_at` (DATETIME).

2. **`passages` Table:**
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT).
   - `doc_id` (TEXT REFERENCES documents(id)).
   - `passage_index` (INTEGER).
   - `passage_text` (TEXT): Chunked snippet.
   - `token_count` (INTEGER).

3. **`embedding_cache` Table:**
   - `passage_hash` (TEXT PRIMARY KEY): SHA-256 digest of passage text.
   - `embedding_blob` (BLOB): 384 packed float32 values (1,536 bytes).
   - `created_at` (DATETIME).

4. **`prescriptions` Table:**
   - `id` (TEXT PRIMARY KEY).
   - `patient_id` (TEXT REFERENCES patients(id)).
   - `medication` (TEXT), `dose` (TEXT), `frequency` (TEXT), `route` (TEXT), `status` (TEXT).

5. **`users` Table:**
   - `id` (TEXT PRIMARY KEY).
   - `username` (TEXT UNIQUE), `hashed_password` (TEXT), `role` (`attending`, `nurse`, `auditor`).

---

## 6. Clinical Decision Support (CDSS) Watchdog Rules

Veritas-Clin implements proactive safety checks aligned with international medical guidelines:
1. **KDIGO Acute Kidney Injury Guideline:**
   - *Condition:* Serum Creatinine $\ge 2.0\text{ mg/dL}$ or $\ge 200\%$ baseline after iodinated contrast.
   - *Contraindicated Medication:* ACE Inhibitors (Lisinopril, Enalapril) or Angiotensin Receptor Blockers (Losartan).
   - *Watchdog Action:* Intercept prescription order; emit **Critical Alert**; recommend isotonic saline volume expansion.
2. **AHA/ASA Antithrombotic Bridge Guideline:**
   - *Condition:* Concurrent acute ischemic stroke with severe carotid stenosis (70–85%) and Atrial Fibrillation.
   - *Contraindication:* Immediate initiation of Triple Therapy (DAPT + NOAC).
   - *Watchdog Action:* Mandate 7-day deferral of Apixaban to prevent hemorrhagic transformation.
3. **Severe Hyperkalemia Interlock:**
   - *Condition:* Serum Potassium $\text{K}^+ \ge 5.2\text{ mEq/L}$.
   - *Watchdog Action:* Block potassium-sparing diuretics (Spironolactone) and flag cardiac arrhythmia risk.

---

## 7. Verification Test Suite & Results

The system was evaluated using 42 automated tests via `pytest`:
- **`tests/test_phi_redactor.py`**: Validates scrubbing of names, phone numbers, MRNs, dates, and institutions.
- **`tests/test_retrieval.py`**: Asserts hybrid RRF scoring, ranking accuracy, and temporal decay weights.
- **`tests/test_zero_hallucination.py`**: Verifies abstention on unmentioned clinical conditions.
- **`tests/test_watchdog.py`**: Tests KDIGO AKI and hyperkalemia medication interlocks.
- **`tests/test_auth.py`**: Validates JWT access token generation, refresh rotation, and RBAC permissions.

**Execution Result:**
`42 passed in 1.48s (100% test success rate)`

---

## 8. Visual & Architectural Asset Directory

All architectural diagrams, logos, and rendered artifacts are permanently saved in the project repository:
- **Block Diagram:** [`docs/writeup/block_diagram.png`](file:///home/sarang/veritas-clin/docs/writeup/block_diagram.png)
- **Flowchart Diagram:** [`docs/writeup/flow_diagram.png`](file:///home/sarang/veritas-clin/docs/writeup/flow_diagram.png)
- **PICT College Emblem:** [`docs/writeup/pict_logo.png`](file:///home/sarang/veritas-clin/docs/writeup/pict_logo.png)
- **HTML Lab Report:** [`docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.html`](file:///home/sarang/veritas-clin/docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.html)
- **Compiled PDF Report:** [`docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.pdf`](file:///home/sarang/veritas-clin/docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.pdf)
- **LaTeX Source Code:** [`docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.tex`](file:///home/sarang/veritas-clin/docs/writeup/AIL_EXPT_9_PICT_LAB_REPORT.tex)
- **PDF Page 1 Render:** [`brain/.../page-1.png`](file:///home/sarang/.gemini/antigravity/brain/bcb955fe-5722-4c3b-8d9c-bd3470109f80/page-1.png)
- **PDF Page 2 Render:** [`brain/.../page-2.png`](file:///home/sarang/.gemini/antigravity/brain/bcb955fe-5722-4c3b-8d9c-bd3470109f80/page-2.png)

