# Premium Clinical RAG Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Veritas-Clin into a premium, professional Full-Stack Clinical RAG Platform with cloud LLM synthesis (no local LLMs), streamlined single-engine architecture, and a Netflix/Linear-grade UI.

**Architecture:** A unified full-stack platform: (1) Cloud-based / lightweight HTTP LLM synthesis in `clinical_qa.py` with strict evidence citations and zero-hallucination fallback; (2) Streamlined backend in `serve.py` removing obsolete benchmark comparisons and running the consensus dense retriever; (3) Premium React/Vite UI with glassmorphic styling, conversational RAG copilot, longitudinal patient chart, slide-out HIPAA scrubber, and cloud provider settings.

**Tech Stack:** Python 3.14, FastAPI, httpx, React (Vite), Tailwind CSS, Framer Motion, Lucide icons, pytest.

**Spec:** `docs/superpowers/specs/2026-10-28-premium-rag-platform-design.md`

## Global Constraints

- No local LLM weights or heavy GPU requirements; all generative synthesis must run via lightweight cloud HTTP calls or the built-in deterministic clinical synthesis engine.
- All tests must run 100% offline without requiring internet access or mandatory API keys.
- The UI must remove redundant benchmark comparisons and manual retriever dropdowns.
- Every clinical claim in generated answers must be linked to its source citation `[Note ID - Date]`.

## Review Focus

1. **No API key provided:** Falls back cleanly to the built-in evidence synthesizer without raising errors or stalling.
2. **Invalid API key / HTTP error:** Gracefully catches network/auth errors and falls back to deterministic synthesis with a friendly notification.
3. **Clinical Negation:** A clinical answer on a negated symptom must explicitly state that the symptom was denied or ruled out.
4. **Clean UI State:** Eliminating obsolete retriever dropdowns does not break any search or QA functionality.
5. **Vite Build:** `npm run build` in `frontend/` must compile with 0 errors.

---

### Task 1: Cloud LLM Synthesis Engine (`clinical_qa.py`)

**Files:**
- Modify: `src/veritas_clin/clinical_qa.py`
- Modify: `tests/test_qa_and_deid.py`

**Interfaces:**
- `LLMSynthesizer`: adds `call_cloud_llm(prompt: str, provider: str, api_key: str) -> str | None`.
- Supports providers: `"groq"`, `"openai"`, `"gemini"`.
- Uses `httpx.post()` with a 10s timeout and clean error trapping.

- [ ] **Step 1: Write failing test in `tests/test_qa_and_deid.py`**
```python
def test_llm_synthesizer_cloud_interface_mock():
    from veritas_clin.clinical_qa import LLMSynthesizer
    syn = LLMSynthesizer(llm_callable=lambda p: "Clinical synthesis: Patient sleep is disturbed [NOTE_01].")
    res = syn.synthesize("sleep query", "Eleanor Vance", "AFFIRMED", [], [{"note_id": "NOTE_01", "date": "2024-01-15", "sentence": "Sleep disturbed."}])
    assert "Clinical synthesis" in res["grounded_narrative"]
    assert "[NOTE_01]" in res["assessment"] or "[NOTE_01]" in res["grounded_narrative"]
```

- [ ] **Step 2: Run test to verify it runs and check requirements**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py -k test_llm_synthesizer_cloud_interface_mock`

- [ ] **Step 3: Implement Cloud API caller in `src/veritas_clin/clinical_qa.py`**
Add `call_cloud_llm(prompt, provider, api_key)` supporting Groq, OpenAI, and Gemini with `httpx`. Ensure `synthesize()` calls cloud LLM when key is present, and falls back to deterministic synthesis if key is absent or request fails.

- [ ] **Step 4: Run test to verify it passes**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py`

- [ ] **Step 5: Commit**
```bash
git add src/veritas_clin/clinical_qa.py tests/test_qa_and_deid.py
git commit -m "feat(rag): add cloud LLM provider integration with graceful fallback"
```

---

### Task 2: Backend API Streamlining (`serve.py`)

**Files:**
- Modify: `src/veritas_clin/serve.py`
- Modify: `tests/test_qa_and_deid.py`

**Interfaces:**
- `POST /api/qa`: accepts optional `api_key` and `provider` in body to invoke cloud generation.
- Defaults search and QA to the best Consensus Hybrid Dense pipeline without requiring the user to specify retriever parameters.

- [ ] **Step 1: Write test for `/api/qa` with provider parameters in `tests/test_qa_and_deid.py`**
- [ ] **Step 2: Update `src/veritas_clin/serve.py` to accept provider settings and clean routes**
- [ ] **Step 3: Run test to verify it passes**
Run: `./.venv/bin/pytest tests/test_qa_and_deid.py`
- [ ] **Step 4: Commit**
```bash
git add src/veritas_clin/serve.py tests/test_qa_and_deid.py
git commit -m "feat(api): streamline serve routes for unified consensus RAG"
```

---

### Task 3: Premium UI Shell, Modern Dark Theme & Provider Settings Modal

**Files:**
- Modify: `frontend/src/components/Shell.jsx`
- Create: `frontend/src/components/SettingsModal.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- `Shell.jsx`: sleek top navigation with Clinical Copilot, Patient Directory, Patient Chart, HIPAA Scrub button, and Cloud LLM Settings button.
- `SettingsModal.jsx`: modal to configure Groq, OpenAI, or Gemini API key (stored in `localStorage`), or use Built-in Medical Engine.

- [ ] **Step 1: Create `frontend/src/components/SettingsModal.jsx`**
- [ ] **Step 2: Update `frontend/src/components/Shell.jsx` with modernized navigation and settings trigger**
- [ ] **Step 3: Update `frontend/src/index.css` with sleek dark palette and glassmorphic utilities**
- [ ] **Step 4: Test Vite build**
Run: `cd frontend && npm run build`
- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/Shell.jsx frontend/src/components/SettingsModal.jsx frontend/src/index.css
git commit -m "feat(ui): implement modern Netflix/Linear-style shell and cloud LLM settings"
```

---

### Task 4: Streamlined Clinical Copilot Page (`DiscoverPage.jsx`)

**Files:**
- Modify: `frontend/src/pages/DiscoverPage.jsx`
- Modify: `frontend/src/components/ClinicalQACard.jsx`

**Interfaces:**
- Remove retriever selection pills and model benchmark comparison clutter.
- Elevate search bar with clinical prompt suggestions and instant patient filter.
- Display natural, fluid RAG consultation note with SBAR breakdown, DSM-5 persistence tag, and collapsible verified source note citations.

- [ ] **Step 1: Refactor `DiscoverPage.jsx` to focus 100% on the unified RAG Copilot experience**
- [ ] **Step 2: Polish `ClinicalQACard.jsx` for executive SBAR presentation and 1-click EHR export**
- [ ] **Step 3: Test Vite build**
Run: `cd frontend && npm run build`
- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/DiscoverPage.jsx frontend/src/components/ClinicalQACard.jsx
git commit -m "feat(ui): elevate DiscoverPage into a dedicated clinical RAG copilot"
```

---

### Task 5: Premium Patient Directory & Chart (`DashboardPage.jsx` & `PatientPage.jsx`)

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`
- Modify: `frontend/src/pages/PatientPage.jsx`

**Interfaces:**
- Modernize patient directory into Netflix-style cards with specialty tags, encounter counts, and longitudinal indicators.
- Enhance patient chart with longitudinal clinical timeline and DSM-5 persistence tracking.

- [ ] **Step 1: Redesign `DashboardPage.jsx` into modern visual directory**
- [ ] **Step 2: Refine `PatientPage.jsx` timeline and note viewer**
- [ ] **Step 3: Run full pytest suite and Vite build**
Run: `./.venv/bin/pytest` and `cd frontend && npm run build`
- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/DashboardPage.jsx frontend/src/pages/PatientPage.jsx
git commit -m "feat(ui): polish patient directory and longitudinal chart views"
```
