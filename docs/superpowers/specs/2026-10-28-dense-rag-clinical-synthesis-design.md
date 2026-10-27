# Design Spec: Dense Clinical RAG with Real Transcribed Notes & Generative Synthesis

**Status:** Approved for Implementation  
**Date:** 2026-10-28  
**Scope:** Veritas-Clin / MoodTrace RAG Engine  

---

## 1. Problem & Objectives

Currently, `veritas-clin` uses hardcoded sentence templates (`CLINICAL_SENTENCE_POOL`) and 5 synthetic longitudinal patients (`generate_patient_corpus()`). While the multi-retriever framework (TF-IDF, Word2Vec, GloVe, BiLSTM) and assertion detection function well, the project lacks:
1. **Real Clinical Data:** Clinician-dictated clinical notes containing authentic clinical terminology, abbreviations, and real-world syntactic variance.
2. **Dense Semantic Embeddings:** State-of-the-art dense sentence-transformer representations to handle clinical paraphrasing without requiring exact token matching.
3. **Generative Evidence Synthesis:** The "G" in RAG — transforming retrieved evidence citations into a structured, clinician-grade SBAR consultation note (Situation, Background, Assessment, Recommendation) with strict citation anchoring.

The objective of this design is to implement all three capabilities while keeping the system robust, reproducible, and runnable fully offline with automated fallbacks.

---

## 2. Architecture & Components

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Data Ingestion: MTSamples Clinical Corpus                          │
│    - Real doctor dictations (Psychiatry, Neurology, General Medicine) │
│    - Schema: patient_id, note_id, date, specialty, sentences, text    │
│    - Fallback: Local cached JSON / synthetic patient corpus           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Dense Semantic Retrieval: DenseTransformerRetriever                │
│    - Model: sentence-transformers (all-MiniLM-L6-v2 / BGE-small)       │
│    - Fast cosine similarity on normalized sentence vectors             │
│    - Clinical Negation & Family History penalization (0.3x score)     │
│    - Consensus Hybrid Fusion with BM25/TF-IDF and BiLSTM              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                          [Retrieved Citations]
                          [Assertion Metadata]
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Generative Clinical Synthesis: LLMSynthesizer / ClinicalQASystem   │
│    - SBAR Format: Situation, Background, Assessment, Recommendation    │
│    - Fact-checking & Grounding: Every claim cites [Note ID - Date]    │
│    - Dual Execution: Local LLM / Ollama API + Deterministic Fallback │
│    - API & UI: Exposed via /api/qa and rendered in ClinicalQACard      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1 Data Ingestion (`src/veritas_clin/data_ingest.py`)
- **Dataset:** MTSamples (`tomaarsen/mtsamples-clinical-notes` on Hugging Face / Kaggle).
- **Filtering:** Filters for psychiatric evaluations, psychological consultations, neurology notes, and general medicine summaries.
- **Preprocessing:** 
  - Segments text into clean clinical sentences (stripping header noise like `PREOPERATIVE DIAGNOSIS:` when standalone).
  - Assigns longitudinal dates and structured patient IDs (`P001` through `P025`).
- **Storage:** Persisted locally as `data/mtsamples_corpus.json` (~200 KB - 1 MB), ensuring the project can start instantly and run 100% offline without re-downloading.

### 3.2 Dense Embedding Retriever (`src/veritas_clin/search_engine.py`)
- **Class:** `DenseTransformerRetriever`
- **Embedding Backend:** `sentence-transformers` (`all-MiniLM-L6-v2` or `BAAI/bge-small-en-v1.5`).
- **Vector Operations:** Pre-computes normalized sentence vectors $V \in \mathbb{R}^{N \times d}$. At query time, encodes query $q \in \mathbb{R}^d$ and calculates $S = V q^T$.
- **Negation Penalty:** Matches terms against negated contexts (`extract_assertion`) and penalizes negated sentences by $0.3\times$.
- **Consensus Fusion:** Added to `HybridRetriever`, which performs Reciprocal Rank Fusion (RRF) across:
  1. Lexical (TF-IDF / BM25)
  2. Sequential / Contextual (BiLSTM)
  3. Dense Semantic (`DenseTransformerRetriever`)
- **Graceful Fallback:** If `sentence-transformers` or PyTorch is unavailable in a constrained environment, `DenseTransformerRetriever` falls back cleanly to the existing Word2Vec/GloVe/TF-IDF models with a clear diagnostic log.

### 3.3 Generative Clinical Synthesis Engine (`src/veritas_clin/clinical_qa.py`)
- **Class:** `LLMSynthesizer`
- **Prompt Structure:**
  - **System:** *"You are an evidence-grounded clinical consultation assistant. You must ONLY state findings directly substantiated by the provided citations. Do not fabricate, hallucinate, or extrapolate beyond the cited records. Explicitly mark negated findings."*
  - **Context:** List of retrieved citations with `[Note ID | Date | Assertion | Sentence]`.
  - **Task:** Formulate a structured SBAR clinical response.
- **Output Schema:**
  - `situation`: Primary clinical question and overall evidence status.
  - `background`: Longitudinal history and symptom duration (DSM-5 persistence check).
  - `assessment`: Categorized affirmed vs negated findings with exact note citations.
  - `recommendation`: Recommended clinical follow-up or monitoring based on identified symptom severity.
  - `grounded_narrative`: The cohesive final physician summary text.
- **Execution Engines:**
  1. `LLMClient` (HuggingFace pipeline or local OpenAI/Ollama compatible endpoint if configured via `SETTINGS.llm_endpoint`).
  2. `DeterministicClinicalSynthesizer` (Built-in expert rule engine that builds compliant SBAR clinical reports directly from structured findings and citations, guaranteeing zero test failures when no GPU/LLM server is running).

---

## 4. API & Interface Contracts

### Updates to `POST /api/qa`
Request:
```json
{
  "question": "Has the patient shown persistent insomnia and depressive mood?",
  "patient_id": "P001",
  "top_k": 6,
  "generate_sbar": true
}
```

Response:
```json
{
  "question": "Has the patient shown persistent insomnia and depressive mood?",
  "patient_id": "P001",
  "patient_name": "Maya Patel",
  "clinical_status": "AFFIRMED",
  "confidence": 0.92,
  "answer_summary": "• Sleep changes: Documented across 4 visits from 2024-01-08 to 2024-02-19...",
  "sbar": {
    "situation": "Patient Maya Patel evaluated for persistent insomnia and depressive mood.",
    "background": "Documented symptom timeline spans 42 days (meets DSM-5 >14 days criterion).",
    "assessment": "Evidence confirms active sleep maintenance insomnia [P001_N02, P001_N04]. Mood anhedonia affirmed [P001_N01].",
    "recommendation": "Recommend formal PHQ-9 tracking and sleep hygiene consultation.",
    "grounded_narrative": "CLINICAL SBAR REPORT...\n..."
  },
  "findings": [...],
  "citations": [...]
}
```

---

## 5. Testing & Verification

1. **Ingestion Test:** Verify `load_clinical_corpus()` parses both real MTSamples notes and synthetic fallback notes, conforming to the note contract.
2. **Dense Retriever Test:** Verify `DenseTransformerRetriever` returns relevant clinical sentences for semantic queries (e.g. "difficulty falling asleep" matching "insomnia"), handles negations, and fuses in `HybridRetriever`.
3. **Clinical QA & SBAR Test:** Verify `ClinicalQASystem` produces non-empty, schema-compliant SBAR structures with valid citations for affirmed questions, and correctly abstains or negates when evidence is absent or denied.
4. **Offline Test Suite:** Run `pytest` to guarantee all existing 23 tests and new tests pass without external network calls.
