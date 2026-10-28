# Product Requirements — Veritas-Clin Document Workbench

## Purpose

Provide a small local NLP application that indexes reports and prescriptions and returns relevant, cited source passages. The system demonstrates lexical retrieval and semantic embeddings without treating an LLM as the search engine.

## Users and safety boundary

Intended for students and evaluators exploring document ingestion and retrieval. This academic prototype is not for diagnosis, treatment, or clinical workflow use. It has no authentication or production PHI safeguards; users should not upload real patient information.

## Requirements

1. Accept PDF and UTF-8 plain-text uploads with bounded size and validate extensions/content. Scanned/image-only PDFs are unsupported and must be rejected when no text is extractable.
2. Extract text, split it into passages, create local sentence-transformer embeddings, and persist documents, passages, and embedding metadata in SQLite.
3. Search passages using BM25 and cosine similarity, combine rankings deterministically using reciprocal-rank fusion, and return citations and component ranking signals.
4. Support listing and deleting documents; deletion removes passages through a foreign-key cascade.
5. Include fictional report and prescription fixtures marked synthetic in storage and UI. Never present retrieval scores as clinical confidence.
6. Construct deterministic evidence-based output by default and abstain when no evidence is retrieved.
7. Optionally phrase answers through a locally hosted Ollama model only when explicitly configured. The model receives the question and retrieved passages; citations are restricted to retrieved passage IDs, with deterministic fallback on failure or invalid output.

## Non-goals

- Clinical decision support, diagnosis, treatment recommendations, or validated clinical performance.
- OCR, scanned document support, cloud LLMs, remote model APIs, authentication, multi-user access, or production PHI handling.
- Depression screening, longitudinal patient records, NLI verification, calibrated confidence, or benchmark claims.

## Acceptance checks

- Offline unit/API tests cover persistence, ingestion, retrieval, citations, abstention, upload validation, and deletion.
- Frontend lint and production build succeed.
- A local smoke test can upload, restart the application, search the persisted document, and delete it.
