# Veritas-Clin

Veritas-Clin is a local, document-grounded NLP workbench for searching clinical reports and prescriptions. Upload PDF or UTF-8 TXT files, retrieve relevant passages with BM25 lexical ranking and local sentence-transformer embeddings, and inspect the source citations. This academic prototype is not for clinical use.

## Features

- PDF and plain-text extraction with page-aware PDF passages.
- SQLite persistence for document metadata, passages, and float32 embeddings.
- Hybrid BM25 and cosine-similarity retrieval combined with deterministic reciprocal-rank fusion.
- Clearly labeled fictional report and prescription examples.
- Deterministic evidence output by default. Optional phrasing through a local Ollama instance is disabled unless `VERITAS_OLLAMA_MODEL` is set. Retrieval remains NLP-based; generated citations must refer to retrieved passages or deterministic evidence is used instead.
- Bounded uploads and processing; scanned/image-only PDFs are unsupported.

## Run locally

Python 3.10+ and Node.js are required.

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
cd frontend && npm install && npm run build && cd ..
uvicorn veritas_clin.serve:app --reload
```

The first indexing operation downloads/loads the configured sentence-transformers model locally (default `sentence-transformers/all-MiniLM-L6-v2`). Set `VERITAS_EMBEDDING_MODEL` to choose another compatible model. Inference runs on CPU; model weights are not included in the repository.

The UI and API are served at `http://127.0.0.1:8000`. Main endpoints: `GET /health`, `GET/POST /api/documents`, `DELETE /api/documents/{document_id}`, and `POST /api/search`.

## Persistence and privacy

The default database is `data/documents.sqlite3`; override it with `VERITAS_DB_PATH`. Uploaded documents/passages remain stored until deleted through the UI/API or by removing the database. Deletion cascades to passages. This prototype has no authentication, encryption-at-rest, multi-user isolation, or production PHI safeguards; do not upload real patient information.

When configured, optional response phrasing uses Ollama at the fixed loopback endpoint `127.0.0.1:11434` and sends only the question and retrieved passages to that local service. Leave `VERITAS_OLLAMA_MODEL` unset for deterministic phrasing and no LLM transmission. Ollama output is untrusted, citations are validated against retrieved passage IDs, and invalid output falls back to deterministic evidence.

## Checks

```bash
./.venv/bin/pytest -q
cd frontend && npm run lint && npm run build
```

Fixtures in `data/demo_documents/` are synthetic examples only. Retrieval ranks/similarities are not clinical confidence, diagnosis, or treatment advice.
