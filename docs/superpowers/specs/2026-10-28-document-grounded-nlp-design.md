# Document-Grounded Clinical NLP Workbench

## Status

Design approved conversationally; implementation has not started. This document is for user review.

## Goal

Make Veritas-Clin a focused NLP project for searching reports and prescriptions. A user uploads a document, asks a question, and receives passages retrieved from that document with source citations. The system must demonstrate lexical retrieval and semantic embeddings; an LLM is not the retrieval system and is optional for response phrasing.

## Scope

### In scope

- Upload PDF and plain-text reports/prescriptions with bounded size and content validation. Scanned/image-only documents are explicitly unsupported in the first version.
- Extract text, split it into searchable passages, and persist document metadata, text/passages, and generated embeddings in SQLite.
- Run lexical BM25 retrieval and semantic vector retrieval over the same passages, combine/rank evidence, and return passage text with document/page or passage references.
- Show a concise, evidence-grounded answer assembled from retrieved evidence. An optional configured LLM may phrase the response, but it must cite supplied passages, abstain when evidence is insufficient, and remain disabled by default. No uploaded content is sent to an external service unless the operator explicitly enables/configures that path.
- Include a small set of clearly labeled synthetic example reports and prescriptions, seeded into the same database/search pipeline as uploads.
- Provide document listing and deletion so stored uploads can be removed from SQLite and the retrieval index.
- Remove unrelated depression classification/training workflows, synthetic longitudinal patient-dashboard workflows, and obsolete UI/API features after confirming no dependencies remain. Retain only shared NLP/retrieval code needed by the document workflow.
- Remove fixed confidence percentages. Retrieval similarity/rank may be shown as a retrieval signal, clearly labeled and never presented as calibrated clinical confidence.

### Out of scope

- OCR for scanned PDFs or image uploads.
- MIMIC/PhysioNet ingestion, external corpora, user accounts, multi-tenant access control, production clinical use, diagnosis/treatment recommendations, and cloud LLM use by default.
- Claiming HIPAA compliance or validated clinical performance.

## User workflow

1. User opens the document workbench and sees synthetic examples clearly marked as demo data.
2. User uploads a PDF or TXT document; the server validates it, extracts text, chunks it, generates embeddings, and persists it in SQLite.
3. User asks a question and may scope search to one uploaded/demo document or all documents.
4. BM25 and semantic retrieval return ranked passages. Results include the source document and page when available, plus the passage text used as evidence.
5. The deterministic default response summarizes only the retrieved passages. If optional LLM synthesis is configured, only the selected evidence is supplied; output is treated as untrusted and displayed with the same citations. Insufficient evidence produces an explicit abstention.
6. User can delete a document; its stored text, chunks, and embeddings are deleted and it no longer appears in retrieval.

## Architecture

### Ingestion and persistence

- Use a small SQLite-backed document repository as the source of truth. Store a generated document ID, original display filename, media type, creation time, extracted text, and processing status.
- Store passage/chunk rows linked to a document, with stable passage IDs, text, and page/index metadata where extractable.
- Generate embeddings using a real local embedding model. Store vectors in a versioned representation alongside the embedding model identifier so they can be rebuilt when the model changes. Do not persist uploaded files to an unbounded temporary directory or log document contents.
- Keep request validation at the upload boundary: allowlisted format, byte-size cap, safe filename handling, and PDF/text extraction errors reported without tracebacks.
- Seed synthetic sample documents idempotently and mark them as synthetic in the database/UI. They must not be mixed with claims of real patient data.

### Retrieval

- BM25 operates on tokenized passage text.
- Vector retrieval embeds the query with the same model and ranks stored passage vectors by cosine similarity.
- Combine the two ranked candidate lists using a documented, deterministic fusion method. Return source passages, stable identifiers, and retrieval scores/ranks. Keep all displayed ranking values distinct from confidence or clinical truth.
- Restrict candidate retrieval to the requested document scope when supplied.

### Response generation

- The default response path is local and deterministic: organize selected evidence passages into a concise answer with citations, or abstain if no relevant evidence passes the retrieval threshold.
- Optional LLM synthesis is a separate adapter/configuration, disabled by default. It receives the question and retrieved passages only, cannot expand the evidence set, and must return citations referring to supplied passage IDs. Invalid/unsupported citations fall back to deterministic evidence output.
- Do not return a numeric confidence percentage unless a future calibrated evaluation defines and validates one.

### UI/API

- One primary workbench supports upload, document selection/listing, question entry, evidence display, answer display, and document deletion.
- API surface is limited to document upload/list/delete, question/evidence search, and health/configuration needed by this workflow.
- Avoid exposing document contents through unrelated endpoints. Do not send documents or derived PHI to telemetry.

## Data and privacy behavior

- SQLite persistence is intentional: uploads survive application restarts until deleted.
- Deleting a document removes its extracted text, passage rows, and embeddings transactionally.
- No external LLM call occurs unless explicitly configured. The UI must make that setting visible before content can leave the local process.
- This is an academic/research prototype, not a clinical decision system; synthetic examples are not clinical evidence.

## Failure handling

- Reject unsupported media types, oversized files, empty/unextractable PDFs, and invalid text with actionable client errors.
- A PDF with no extractable text is identified as likely scanned and rejected with an OCR-not-supported message.
- A failed embedding/index operation must not leave a document appearing searchable; use a transaction or explicit processing status and clean rollback.
- If optional synthesis fails, return deterministic cited evidence rather than fabricate an answer.
- If retrieval finds no adequate evidence, return an abstention without an invented confidence value.

## Verification and acceptance criteria

- Unit tests cover chunking, embedding serialization/deserialization, BM25 ranking, vector ranking, fusion, citation mapping, and abstention.
- API tests cover valid TXT/PDF ingestion, invalid/oversized/empty files, persistence across repository/app reload, document scoping, deletion from both database and search, synthetic seed idempotency, and optional-synthesis failure fallback.
- A focused integration test uploads a fixture, queries for a fact, and verifies the response cites the source passage and does not cite unrelated documents.
- The frontend builds and the primary workflow can be exercised end-to-end.
- Tests must not depend on network or GPU. Use a deterministic local embedding implementation/model fixture for offline tests; the application path must support a real embedding model.
- The project no longer displays a hardcoded confidence percentage or describes similarity as calibrated confidence.
- The final tree contains only the document-grounded NLP application and shared code required for it; README/docs/tests describe the actual supported workflow and clearly state limitations.

## Implementation boundary

This design does not authorize deleting files immediately. During implementation, map legacy files to imports, routes, tests, scripts, and user-facing routes first; remove only the unrelated paths confirmed by that dependency review. Preserve unrelated uncommitted work and do not overwrite user changes.
