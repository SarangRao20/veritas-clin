# Clinical Note Review Workbench Design

## Goal

Replace the current frontend with a focused, presentation-ready clinical note review workbench that makes the project's real research contribution visible: extract claims, trace each claim to source text, verify assertion/support, and accept, flag, or abstain. Reduce unsupported interpretations and prevent raw identifiers from reaching cloud generation or persistent stores.

This remains an educational/research demo. It is not a medical device, not approved for clinical care, and does not claim HIPAA compliance or certified de-identification.

## Current Evidence

- The shipped patient corpus is generated from hand-authored narratives in `src/veritas_clin/data_ingest.py`; it is not an imported MTSamples dataset.
- The active interface is `frontend/src/components/Shell.jsx` with Copilot, synthetic patient directory, and patient chart routes. It has mixed dark/light styles, small typography, unsupported compliance/data-source claims, and duplicate evidence summaries. Multiple legacy pages/components are not routed.
- Port 8000 serves `frontend/dist` when it exists (`src/veritas_clin/serve.py`); port 5173 serves the same `frontend/src` application through Vite (`frontend/vite.config.js`). Matching screens are expected because they are production and development modes of one frontend.
- The project's documented core pipeline is extraction → source-span anchoring → NLI verification → calibration/policy decision. The newer longitudinal RAG/chat pages are exploratory and make the prototype appear to be a different product.
- `Deidentifier` is currently an optional/manual utility. Its known-name and honorific patterns do not reliably identify arbitrary bare names such as “Sunil”.
- Retrieval uses symptom seed overlap and can attach unrelated categories; the QA synthesis assigns a high minimum confidence and allows generated recommendations.
- The automated baseline is 30 passing Python tests and a successful Vite build; the build reports a large-bundle warning.

## Product and Interaction

- The primary screen is a note-review workbench, not a generic chatbot or fictional EHR. The note is the central input; extracted claims, exact supporting source spans, assertion/verification state, and accept/flag/abstain outcomes are the primary output.
- Show the real pipeline and meaningful limitations using actual backend responses/artifacts. Do not invent patient charts, activity stats, verification badges, model activity, or metrics.
- Use a distinctive, restrained clinical editorial visual language: light neutral canvas, high-contrast ink, muted teal/blue for navigation and evidence, clear typography, compact but legible spacing, purposeful hierarchy, responsive layout, and accessible focus/labels. Reject generic dashboard grids, gradient-heavy hero sections, giant rounded cards, and template-like repetitive surfaces.
- Keep only product surfaces that directly support note review, evidence/methodology, or prototype limitations. Remove dead routes and unused pages/components after confirming they have no imports or runtime consumers. Keep the existing API and backend intact unless a specific defect requires a minimal contract-safe change.
- Do not create a second frontend for port 5173. Port 5173 remains the development server and port 8000 the built production-serving path for the same app; verify both resolve to the intended same workbench.
- Avoid unsupported role/clinical approval language, fabricated performance guarantees, and medical recommendations not directly supported by evidence.
- Label the included corpus synthetic/demo throughout the product. Remove “Real MTSamples”, “HIPAA compliant”, and equivalent claims. Describe de-identification as best-effort prototype masking only.

## Clinical Interpretation

- Treat retrieval as evidence finding, not diagnosis. A candidate finding must be supported by relevant text and correct patient scope.
- Add a general clinical observation/event path so statements such as a hand injury can be reported as an injury observation without being mapped to psychiatric symptoms.
- Preserve negation and uncertainty. If the text does not support a symptom/event or the match is weak, return an explicit “not established in these notes”/abstention rather than an unrelated symptom label or inflated confidence.
- Only show longitudinal persistence when independent dated evidence supports it; do not imply DSM criteria are met merely because retrieval found multiple related sentences.
- Cloud synthesis may summarize the retrieved evidence but cannot add unsupported diagnoses, causation, or care recommendations. Citations remain linked to source passages and are the authoritative record.

## Privacy and Data Flow

- Every QA/chat request is de-identified on the server before retrieval, caching, persistence, or external LLM transmission. Raw request bodies must not be logged or echoed in error/health responses.
- Mask recognizable names, dates, patient identifiers, contact details, and other supported identifiers; test the concrete “Sunil recorded on 26-10-26…” example. Ensure masked text is what retrieval and cloud generation receive.
- Do not store raw inputs or an identifier-to-token mapping. Return only sanitized content, redaction count/types (not originals), and a clear best-effort masking notice.
- Keep masking limitations visible: heuristic masking can miss identifiers; this is not a guarantee of HIPAA Safe Harbor de-identification. Do not send raw user text to Gemini as a fallback if masking fails.
- Validate input length and request fields at the API boundary. Preserve the existing explicit user-selected cloud provider behavior while making defaults consistent.

## Scope

In scope: replace the frontend experience with the note-review workbench, prune unused frontend surfaces, server-side masking for supported input endpoints before retrieval/model transmission, safe event-vs-symptom interpretation, honest evidence/confidence/abstention behavior, accurate project copy, and tests/documentation needed to validate those paths.

Out of scope: claiming clinical readiness or HIPAA compliance, importing or representing a real MTSamples dataset, authentication/production deployment, a generic clinical chatbot as the primary product, changing backend APIs without need, and adding a new LLM, design dependency, or NER dependency without a demonstrated need.

## Failure Handling

- De-identification errors fail closed for cloud calls; never fall back to raw content.
- Provider rate-limit/network errors produce a concise UI notice and a deterministic evidence-only response if available; no claim that Gemini answered unless it did.
- No/weak evidence produces an abstention with an empty or clearly qualified evidence list. Do not fabricate citations.

## Acceptance Criteria

1. The frontend has one clear note-review workflow that visibly represents the actual extraction/verification/decision pipeline; it is not a generic chatbot or fictional patient dashboard.
2. The workbench renders with a distinctive light, high-contrast, responsive clinical design; key body text is comfortably readable and all controls have labels/focus states.
3. Built-in records are explicitly identified as synthetic/demo; no active UI copy claims real MTSamples or HIPAA compliance.
4. “Sunil recorded on 26-10-26 that he got injured his hand of carelessness” is masked before retrieval/model use, retains the injury meaning as a general event when evidence supports it, and is not labeled as an unrelated psychiatric symptom.
5. Unknown or unsupported symptoms, negated findings, patient scoping, and weak retrieval scores produce correct abstention/status and no fabricated diagnosis or recommendation.
6. Automated tests verify the privacy boundary and clinical edge cases; the full backend test suite, frontend lint/build, and focused API checks pass.

## Design Review

- Keep identifiers out of logs, API responses, prompt text, and persisted state; the UI reports only that masking occurred and how many fields were masked.
- Never represent heuristic redaction as certification. A bare name at the start of a sentence is inherently ambiguous; implementation should prefer conservative contextual patterns and clearly disclose remaining risk.
- Evidence-only response remains available when a cloud provider is unavailable or rate-limited.
- Stitch/design plugins are not exposed in this environment (MCP discovery returned no resources). Do not claim to have used them; build from the approved design contract and verify the rendered UI locally.
