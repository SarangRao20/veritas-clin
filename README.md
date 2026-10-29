# Veritas-Clin

Veritas-Clin is an evidence-grounded Clinical Decision Support (CDS) platform and Inpatient Intelligence Workbench. It couples **offline, privacy-preserving extraction & embeddings** with **strict-citation frontier reasoning models (Groq / Claude 3.5 / local Ollama)** under a **Zero-Hallucination Guarantee**.

---

## Key Capabilities

- **Evidence-Grounded Inpatient Hub**: Case review across multi-encounter patient histories (Emergency Admission, Cath Lab / Operative Notes, Imaging Reports, Consults, Discharge Summaries).
- **Executive Physician Station**: 5 specialized clinical tabs per patient:
  1. *Clinical Overview & Telemetry*: Real-time acuity scoring, vital/biomarker SVG trajectories, and care stages.
  2. *Clinical Trajectory Synthesis*: Chronological hospital course narrative citing verified passages.
  3. *Medication Reconciliation & Orders*: Active vs. permanently held medications with contraindication rationales.
  4. *Clinical Encounters & Reports*: Chronological document index with document reader modal and PDF/TXT upload.
  5. *Clinical Copilot & Inquiry*: Natural language clinical Q&A with grounded passage references and strict zero-hallucination abstention.
- **Proactive CDSS Safety Watchdog**: Real-time cross-checking of clinical state vs. medication orders (e.g., flagging ACE inhibitors like Lisinopril during KDIGO Stage 2 Acute Kidney Injury, or warning on DAPT + DOAC bleeding risks).
- **Prescription Tokenizer & NLP Entity Extraction**: Structured prescription form extracting drug names, doses, routes, frequencies, indications, and held orders into indexed clinical passages.
- **Permanent SQLite Embedding Cache**: Pre-computed MiniLM dense vectors stored permanently in SQLite (`embedding_cache` table), eliminating repetitive PyTorch weight loading and enabling instant sub-second startup.
- **Enterprise Security & HIPAA Safe Harbor**:
  - Full JWT authentication with access token rotation, bcrypt passwords, and three RBAC roles: `admin`, `clinician`, and `viewer`.
  - Local regex-based Safe Harbor PHI de-identification before any prompt transmission.
  - Multi-user record isolation with admin oversight.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

### One-Command Quickstart

To launch the full stack (FastAPI backend + Vite production UI) with automatic database seeding:

```bash
./run.sh
```

Or for development mode with hot-reloading (Vite on `5173` + FastAPI backend on `8000`):

```bash
./run.sh --dev
```

The application will be accessible at:
- **Web UI & Case Hub**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### Manual Setup

```bash
# 1. Backend environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'

# 2. Frontend compilation
cd frontend
npm install
npm run lint
npm run build
cd ..

# 3. Start server
uvicorn veritas_clin.serve:app --host 127.0.0.1 --port 8000 --reload
```

---

## System Architecture & Retrieval Pipeline

```
                                      ┌───────────────────────────────┐
                                      │   Clinician Inquiry / Query   │
                                      └──────────────┬────────────────┘
                                                     │
                                      ┌──────────────▼────────────────┐
                                      │ Local PHI Safe Harbor De-ID   │
                                      └──────────────┬────────────────┘
                                                     │
                        ┌────────────────────────────┴───────────────────────────┐
                        │                                                        │
           ┌────────────▼──────────────┐                           ┌─────────────▼────────────┐
           │ BM25Plus Lexical Matcher  │                           │ Dense Cosine Embedder    │
           │ (Exact clinical tokens)   │                           │ (MiniLM SQLite Cache)    │
           └────────────┬──────────────┘                           └─────────────┬────────────┘
                        │                                                        │
                        └────────────────────────────┬───────────────────────────┘
                                                     │
                                      ┌──────────────▼────────────────┐
                                      │ Reciprocal Rank Fusion (RRF)  │
                                      │  + Temporal Encounter Boost   │
                                      │  + Negation Assertion Filter  │
                                      └──────────────┬────────────────┘
                                                     │
                                      ┌──────────────▼────────────────┐
                                      │ Top-8 Grounded Evidence Hits  │
                                      └──────────────┬────────────────┘
                                                     │
                        ┌────────────────────────────┴───────────────────────────┐
                        │                                                        │
           ┌────────────▼──────────────┐                           ┌─────────────▼────────────┐
           │ Groq / Claude 3.5 Engine  │                           │ Deterministic Fallback   │
           │ (Verified Passage Claims) │                           │ (Zero-Cloud Mode)        │
           └───────────────────────────┘                           └──────────────────────────┘
```

---

## Test Suite & Code Quality

Run tests and linting suites:

```bash
# Backend unit & integration test suite (41 tests)
./.venv/bin/pytest tests/

# Frontend linter & production bundle compilation
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## Changelog & Version History

- **v4.0.0**: Overhauled UI into Executive Inpatient Command Station; eliminated cramped sidebar chat layout; added interactive SVG biomarker trajectory charts; fixed RRF thresholding (`min_score=0.015`) and temporal encounter filtering; introduced full-screen shimmer skeleton states; unified shared formatters and cleaned dead imports.
- **v3.0.0**: Added JWT authentication, bcrypt passwords, refresh token rotation, and RBAC (`admin`, `clinician`, `viewer`); implemented HIPAA Safe Harbor PHI scrubbing.
- **v2.0.0**: Introduced multi-encounter patient store with SQLite persistence; added Proactive Clinical Decision Support Watchdog and Prescription Entity Tokenizer.
- **v1.0.0**: Initial prototype featuring BM25 + dense MiniLM vector hybrid retrieval with deterministic citation fallback.

---

## Disclaimer

Fixtures in `data/demo_documents/` and `data/clinical_records/` are synthetic clinical examples only. Retrieval ranks and generated syntheses are designed for clinical decision support demonstration and do not constitute autonomous medical advice.
