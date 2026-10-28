# Document-Grounded Clinical NLP Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized synthetic-patient app with a focused report/prescription ingestion and evidence-retrieval workbench.

**Architecture:** SQLite is the source of truth for documents, passages, and serialized local embeddings. A BM25 ranker and local sentence embedding model retrieve passages, fuse their rankings, and return citations; deterministic evidence phrasing is the default and optional LLM synthesis is disabled unless explicitly configured. The UI only exposes this document workflow and labeled synthetic examples.

**Tech Stack:** Python 3.10+, FastAPI, SQLite (`sqlite3`), pypdf, rank-bm25, sentence-transformers (local model, configurable), React/Vite, pytest.

**Spec:** `docs/superpowers/specs/2026-10-28-document-grounded-nlp-design.md`

## Global Constraints

- PDF and plain text only; scanned/image-only PDFs are unsupported.
- Uploaded documents persist in SQLite until explicitly deleted.
- LLM response phrasing is optional and disabled by default; no document content leaves the local process by default.
- Retrieval scores/ranks are not calibrated clinical confidence; do not display a confidence percentage.
- Synthetic examples are labeled as synthetic and seeded idempotently.
- Tests do not require network or GPU; application embeddings use a real local model.
- Preserve unrelated uncommitted work; remove legacy features only after checking their imports, routes, tests, and UI references.

## Review Focus

- Spoofed file extension/MIME or malformed PDFs: reject before indexing; cover in upload validation tests.
- Very large uploads or text expansion from PDFs: enforce a byte limit and bound extracted text/pages; cover in upload API tests.
- Interrupted extraction/embedding/database writes: leave no searchable partial rows; cover transaction rollback.
- Vector size/model changes or corrupted serialized vectors: detect incompatibility and rebuild/fail safely; cover repository/model tests.
- Prompt injection or unsupported citations in document text/LLM output: treat source and generated text as untrusted; test that only retrieved evidence IDs can be cited and default path is deterministic.

---

### Task 1: Persist documents and passages in SQLite

**Files:**
- Create: `src/veritas_clin/document_store.py`
- Test: `tests/test_document_store.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces `DocumentStore(db_path: Path)`, `add_document(filename: str, media_type: str, extracted_text: str, passages: list[dict], embedding_model: str) -> str`, `list_documents() -> list[dict]`, `get_passages(document_id: str | None = None) -> list[dict]`, `delete_document(document_id: str) -> bool`.
- Passage dict includes `text: str`, `ordinal: int`, `page: int | None`, `embedding: bytes | None`, and `embedding_dim: int | None`.

- [ ] Write tests for insert/list/reload persistence, passage scoping, transactional rollback, idempotent demo seed, delete cascade, and invalid/corrupt vector dimensions.
- [ ] Run `./.venv/bin/pytest -q tests/test_document_store.py`; confirm the new interface/tests fail before implementation.
- [ ] Implement schema with documents, passages, and a foreign key with cascade delete; store vectors as versioned float32 blobs and include model ID/dimension. Keep SQLite path configurable and ignored by git.
- [ ] Run the focused tests and verify persistence after closing/reopening the store.

### Task 2: Build ingestion, local embeddings, and hybrid evidence retrieval

**Files:**
- Create: `src/veritas_clin/document_nlp.py`
- Create: `data/demo_documents/` with a small set of labeled synthetic report/prescription fixtures
- Create: `tests/test_document_nlp.py`
- Modify: `pyproject.toml`

**Interfaces:**
- Consumes `DocumentStore` from Task 1.
- Produces `DocumentProcessor(embedder)` with `extract_and_chunk(filename: str, media_type: str, content: bytes) -> list[dict]` and `EvidenceRetriever(store, embedder)` with `search(question: str, document_id: str | None = None, top_k: int = 6) -> list[dict]`.
- Evidence results include `document_id`, filename, `passage_id`, passage text, page, and BM25/vector/fused ranking signals.

- [ ] Write tests for PDF/TXT extraction, page-aware chunking, empty/scanned PDF rejection, size/text bounds, stable passage metadata, BM25 ranking, vector ranking, reciprocal-rank fusion, document filters, citations, and abstention on empty retrieval.
- [ ] Run `./.venv/bin/pytest -q tests/test_document_nlp.py`; verify failures before implementation.
- [ ] Add `rank-bm25`, `pypdf`, and `sentence-transformers` dependencies; implement a configurable local sentence-transformer embedder and an injectable deterministic test embedder. Ensure embedding calls use the same model for stored passages and queries.
- [ ] Implement bounded extraction/chunking and hybrid retrieval over stored passages; seed demo fixtures through the same processing/store path and mark them synthetic.
- [ ] Run focused NLP tests with no network or GPU.

### Task 3: Replace legacy API flows with document APIs

**Files:**
- Create: `tests/test_document_api.py`
- Modify: `src/veritas_clin/serve.py`

**Interfaces:**
- Consumes `DocumentStore`, `DocumentProcessor`, and `EvidenceRetriever` from Tasks 1–2.
- Provides `POST /api/documents` multipart upload, `GET /api/documents`, `DELETE /api/documents/{document_id}`, and `POST /api/search` JSON `{question, document_id?, top_k?}`.
- Search response contains deterministic evidence-grounded answer, abstention status, and cited evidence records; no confidence percentage.

- [ ] Add API tests for valid upload, wrong media/content, malformed/oversized/empty documents, persistence across app lifespan, scoped/unscoped search, delete removing hits, and no numeric confidence field.
- [ ] Run `./.venv/bin/pytest -q tests/test_document_api.py`; confirm failing behavior first.
- [ ] Wire SQLite store/processor/retriever into FastAPI lifespan. Keep extraction and indexing transactional; return sanitized errors.
- [ ] Implement deterministic response assembly from retrieved evidence. If optional LLM synthesis is retained, gate it behind explicit configuration disabled by default, validate cited passage IDs, and fall back on deterministic output.
- [ ] Run focused API tests; verify saved uploads remain searchable after app reload and deleted uploads do not.

### Task 4: Make the frontend a single document workbench

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/pages/WorkbenchPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/components/Shell.jsx`, `frontend/src/pages/*` only as required to remove obsolete routes/navigation
- Test/build: frontend existing npm scripts

**Interfaces:**
- UI uses document list/upload/delete and search APIs from Task 3.
- Main flow shows uploaded/demo document labels, passages with source/page citations, deterministic answer/abstention, and retrieval rank/signal without percent confidence.

- [ ] Build accessible upload, document selection/list, query, evidence citations, loading/error, and delete interactions; identify synthetic demo documents visibly.
- [ ] Remove patient-dashboard, timeline, depression screening, and unrelated pipeline navigation/routes from the shipped UI.
- [ ] Run `npm run build` and `npm run lint` in `frontend/`; fix regressions without changing unrelated generated artifacts except required build outputs.

### Task 5: Remove unrelated subsystems and align project documentation

**Files:**
- Remove obsolete modules, data, scripts, routes, and tests only after searching references/imports and confirming they serve no retained document workflow.
- Modify: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `pyproject.toml`, test files as needed.

- [ ] Map every proposed deletion to its importers/routes/tests/UI references; preserve shared NLP and security components used by document ingestion/retrieval.
- [ ] Remove unreferenced depression classifier/model assets and synthetic longitudinal patient workflows; update test configuration and remove obsolete tests only when replacement workflow tests cover required behavior.
- [ ] Rewrite README/PRD/architecture docs to describe actual document-grounded NLP, setup/model download behavior, SQLite persistence/deletion, limitations, synthetic fixtures, and optional LLM privacy behavior.
- [ ] Run full backend tests (`./.venv/bin/pytest -q`), frontend lint/build, and a local upload → restart → search → delete smoke test.
- [ ] Review the final diff, ensure no PHI/demo upload artifacts or generated secrets are tracked, then amend only this task's implementation/spec/plan files into the existing design commit; do not stage other pre-existing working-tree changes.

## Final acceptance

- Uploaded report/prescription persists across restart and can be deleted with its passages/vectors.
- A query retrieves evidence through both BM25 and semantic embeddings, produces traceable citations, and abstains when evidence is absent.
- Synthetic sample documents traverse the same DB and NLP pipeline as user uploads.
- LLMs are not required; any optional LLM feature is off by default and cannot cite outside retrieved evidence.
- No unsupported hardcoded confidence percentage remains; unrelated workflows are removed only after dependency review.
- Offline CPU test suite and frontend checks pass.
