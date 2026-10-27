# Dense Clinical RAG with Real Transcribed Notes & Generative Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest real transcribed clinical notes (MTSamples), implement dense sentence-transformer embeddings with negation-aware consensus retrieval, and add evidence-grounded generative clinical synthesis (SBAR consultation notes) in `veritas-clin`.

**Architecture:** A three-stage clinical RAG architecture: (1) Ingest real transcribed notes into standardized patient histories; (2) Semantic retrieval via `DenseTransformerRetriever` fused with lexical (TF-IDF) and sequential (BiLSTM) signals via Reciprocal Rank Fusion; (3) Generative clinical synthesis via `LLMSynthesizer` transforming verified citations and assertion tags into structured, citation-anchored SBAR consultation notes with deterministic fallbacks.

**Tech Stack:** Python 3.14, FastAPI, PyTorch / Sentence-Transformers (with NumPy fallback), scikit-learn, spaCy, NLTK, pytest, React (Vite).

**Spec:** `docs/superpowers/specs/2026-10-28-dense-rag-clinical-synthesis-design.md`

## Global Constraints

- Must run 100% offline without mandatory internet access or external API keys; all tests must pass offline.
- Real clinical data format must adhere to schema: `patient_id`, `patient_name`, `note_id`, `date`, `text`, `sentences`, `specialty`.
- Pre-trained sentence transformer must fall back gracefully to dense word-vector/TF-IDF representations if weights cannot be downloaded.
- Every claim in the synthesized clinical report must carry a citation tag format `[Note ID - Date]`.
- Negated symptoms must be explicitly identified and never reported as active confirmed diagnoses.

## Review Focus

1. **Empty / missing real corpus:** Falls back immediately to the deterministic synthetic corpus without raising unhandled exceptions.
2. **Missing `sentence-transformers` package or model weights:** `DenseTransformerRetriever` detects availability and falls back cleanly without crashing the API or search engine.
3. **Clinical Negation:** A query for "insomnia" on a note stating "denies insomnia" must yield `NEGATED` assertion and penalized score.
4. **SBAR Structure Completeness:** `ClinicalQASystem.answer_question()` returns all 5 fields (`situation`, `background`, `assessment`, `recommendation`, `grounded_narrative`).
5. **No Evidence / Abstain handling:** When evidence is absent or query is irrelevant, the synthesizer produces an explicit `NO_EVIDENCE` or `ABSTAINED` status with zero hallucinations.

---

### Task 1: Real Clinical Data Ingestion (`data_ingest.py`)

**Files:**
- Create: `src/veritas_clin/data_ingest.py`
- Create: `tests/test_data_ingest.py`
- Modify: `src/veritas_clin/config.py`

**Interfaces:**
- Produces: `load_or_create_clinical_corpus(cache_path: Path | None = None) -> tuple[list[dict], list[dict]]`
- Schema: Returns `(notes, patients)` where each note has `{"patient_id", "patient_name", "note_id", "date", "text", "sentences", "specialty"}`.

- [ ] **Step 1: Write failing test for data ingestion in `tests/test_data_ingest.py`**
```python
def test_load_or_create_clinical_corpus():
    from veritas_clin.data_ingest import load_or_create_clinical_corpus
    notes, patients = load_or_create_clinical_corpus()
    assert len(notes) >= 10
    assert len(patients) >= 3
    sample = notes[0]
    for key in ("patient_id", "patient_name", "note_id", "date", "text", "sentences", "specialty"):
        assert key in sample
    assert len(sample["sentences"]) > 0
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./.venv/bin/pytest tests/test_data_ingest.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'veritas_clin.data_ingest'`

- [ ] **Step 3: Implement `src/veritas_clin/data_ingest.py`**
Implement `load_or_create_clinical_corpus`. Load from `data/mtsamples_corpus.json` if it exists. If not present, download or synthesize a high-fidelity psychiatric/clinical transcribed corpus based on MTSamples categories (Psychiatry, Neurology, General Medicine) with longitudinal visit dates and save to `data/mtsamples_corpus.json`.

- [ ] **Step 4: Run test to verify it passes**
Run: `./.venv/bin/pytest tests/test_data_ingest.py`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/veritas_clin/data_ingest.py tests/test_data_ingest.py
git commit -m "feat(data): implement real clinical note ingestion and corpus loader"
```

---

### Task 2: Dense Semantic Embeddings Retriever (`DenseTransformerRetriever`)

**Files:**
- Modify: `src/veritas_clin/search_engine.py`
- Modify: `tests/test_qa_and_deid.py`

**Interfaces:**
- Produces: `DenseTransformerRetriever(sentences: list[tuple[str, str, str]], model_name_or_instance: Any = None)`
- Method: `query(q: str, top_k: int = 8) -> list[dict]`
- Modifies: `HybridRetriever` to accept `dense_ret: DenseTransformerRetriever | None`.

- [ ] **Step 1: Write failing test in `tests/test_qa_and_deid.py`**
```python
def test_dense_transformer_retriever_query():
    from veritas_clin.search_engine import DenseTransformerRetriever
    records = [
        ("Patient suffers from profound chronic insomnia and midnight waking.", "NOTE_01", "2024-01-10"),
        ("Patient denies any sleep disturbance or fatigue.", "NOTE_02", "2024-01-17"),
        ("Cardiovascular exam shows normal sinus rhythm.", "NOTE_03", "2024-01-24"),
    ]
    ret = DenseTransformerRetriever(records)
    results = ret.query("trouble sleeping at night", top_k=2)
    assert len(results) > 0
    assert results[0]["note_id"] == "NOTE_01"
    assert results[0]["score"] > 0.30
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_dense_transformer_retriever_query`
Expected: FAIL with `ImportError: cannot import name 'DenseTransformerRetriever'`

- [ ] **Step 3: Implement `DenseTransformerRetriever` in `src/veritas_clin/search_engine.py`**
- Use `sentence_transformers.SentenceTransformer` if installed/loadable.
- If offline/unavailable, implement a normalized semantic projection fallback using in-memory TF-IDF/SVD so that offline unit tests always run smoothly and deterministically.
- Apply `extract_assertion()` and multiply score by 0.3 if `assertion == "NEGATED"`.
- Integrate `DenseTransformerRetriever` into `HybridRetriever` RRF scoring.

- [ ] **Step 4: Run test to verify it passes**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_dense_transformer_retriever_query`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/veritas_clin/search_engine.py tests/test_qa_and_deid.py
git commit -m "feat(rag): add DenseTransformerRetriever with assertion handling and hybrid fusion"
```

---

### Task 3: Evidence-Grounded Generative Synthesis (`LLMSynthesizer` & SBAR Notes)

**Files:**
- Modify: `src/veritas_clin/clinical_qa.py`
- Modify: `tests/test_qa_and_deid.py`

**Interfaces:**
- Produces: `LLMSynthesizer.synthesize(question: str, patient_name: str, findings: list[dict], citations: list[dict]) -> dict[str, str]`
- Returns: `{"situation": str, "background": str, "assessment": str, "recommendation": str, "grounded_narrative": str}`
- Modifies: `ClinicalQASystem.answer_question()` to populate `res["sbar"]`.

- [ ] **Step 1: Write failing test in `tests/test_qa_and_deid.py`**
```python
def test_clinical_qa_generates_sbar_synthesis(qa_system):
    ans = qa_system.answer_question("Has the patient had severe trouble sleeping?", patient_id="P001")
    assert "sbar" in ans
    sbar = ans["sbar"]
    assert "situation" in sbar and len(sbar["situation"]) > 0
    assert "assessment" in sbar and len(sbar["assessment"]) > 0
    assert "recommendation" in sbar and len(sbar["recommendation"]) > 0
    assert "grounded_narrative" in sbar and len(sbar["grounded_narrative"]) > 0
    # Every assessment must cite at least one Note ID
    assert "[" in sbar["assessment"] or "[" in sbar["grounded_narrative"]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_clinical_qa_generates_sbar_synthesis`
Expected: FAIL with `KeyError: 'sbar'`

- [ ] **Step 3: Implement `LLMSynthesizer` and update `ClinicalQASystem` in `src/veritas_clin/clinical_qa.py`**
- Create `LLMSynthesizer` class supporting prompt formation and structured SBAR synthesis.
- Include a built-in clinician-grade deterministic synthesizer fallback that constructs precise SBAR reports referencing `findings`, `citations`, dates, and DSM-5 persistence spans.
- Attach `sbar` dictionary to `answer_question()` return value.

- [ ] **Step 4: Run test to verify it passes**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_clinical_qa_generates_sbar_synthesis`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/veritas_clin/clinical_qa.py tests/test_qa_and_deid.py
git commit -m "feat(qa): add LLMSynthesizer for evidence-grounded SBAR clinical reports"
```

---

### Task 4: API & Frontend Integration (`serve.py` & `ClinicalQACard.jsx`)

**Files:**
- Modify: `src/veritas_clin/serve.py`
- Modify: `frontend/src/components/ClinicalQACard.jsx`
- Modify: `tests/test_qa_and_deid.py`

**Interfaces:**
- `serve.py`: updates `lifespan` to use `load_or_create_clinical_corpus` and build `DenseTransformerRetriever`.
- `POST /api/qa`: accepts optional `generate_sbar` flag and returns SBAR payload.
- `ClinicalQACard.jsx`: renders interactive SBAR tabs/sections with copy functionality.

- [ ] **Step 1: Write integration test for `/api/qa` with SBAR in `tests/test_qa_and_deid.py`**
```python
def test_api_qa_endpoint_with_sbar():
    from fastapi.testclient import TestClient
    from veritas_clin.serve import app
    with TestClient(app) as client:
        resp = client.post("/api/qa", json={"question": "sleep difficulties", "patient_id": "P001"})
        assert resp.status_code == 200
        data = resp.json()
        assert "sbar" in data
        assert "grounded_narrative" in data["sbar"]
```

- [ ] **Step 2: Run test to verify it fails or runs**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_api_qa_endpoint_with_sbar`
Expected: FAIL or missing sbar

- [ ] **Step 3: Update `serve.py` and `ClinicalQACard.jsx`**
- In `serve.py`, initialize corpus via `data_ingest.load_or_create_clinical_corpus()` and configure dense retriever.
- In `ClinicalQACard.jsx`, render the SBAR consultation note with formatted Situation, Background, Assessment, and Recommendation blocks.

- [ ] **Step 4: Run full pytest suite**
Run: `./.venv/bin/pytest`
Expected: All 25+ tests PASS.

- [ ] **Step 5: Commit**
```bash
git add src/veritas_clin/serve.py frontend/src/components/ClinicalQACard.jsx tests/test_qa_and_deid.py
git commit -m "feat(api): integrate real corpus, dense RAG, and SBAR generation into serve and UI"
```
