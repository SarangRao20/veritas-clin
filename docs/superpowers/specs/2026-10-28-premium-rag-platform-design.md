# Design Spec: Premium Clinical RAG Platform (Cloud-Model Powered, No Local LLMs)

**Status:** Approved for Implementation  
**Date:** 2026-10-28  
**Scope:** Veritas-Clin / MoodTrace Full Stack Application  

---

## 1. Vision & Architecture

Transform Veritas-Clin from an academic prototype with redundant model comparison tabs into a sleek, production-grade **Clinical RAG Intelligence Platform** with a user experience as polished as **Linear and Netflix**.

### Core Principles
1. **Single Best Engine:** No manual retriever toggles or academic benchmark comparisons (TF-IDF vs GloVe vs Word2Vec). The backend executes a unified, best-in-class **Consensus Dense RAG Pipeline** automatically.
2. **Actual RAG Experience (No Local LLM):** The generative response is synthesized from retrieved evidence using cloud APIs (Groq, OpenAI, or Gemini) with zero local GPU/weight downloads, paired with a rich built-in medical synthesis engine when offline or unconfigured.
3. **Evidence as the Provenance Layer:** Natural conversational answers up front, with interactive 1-click citation verification drawers for clinical audit and medical liability safety.
4. **Netflix / Linear Aesthetic:** Deep slate/zinc palette (`#0B0F17`), subtle hairline borders, backdrop blur, fluid micro-interactions, responsive command palette (`⌘K`), and instant patient switching.

---

## 2. Component Design

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PREMIUM CLINICAL COPILOT                        │
│                                                                        │
│  [Search Bar]: "Has Eleanor shown persistent insomnia or anhedonia?"   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⚡ Clinical RAG Response (Cloud LLM / Evidence Grounded)          │  │
│  │ "Based on Eleanor Vance's records across 4 clinical encounters   │  │
│  │ from Jan 15 to Mar 11, the patient exhibits persistent severe    │  │
│  │ insomnia and anhedonia..."                                       │  │
│  │                                                                  │  │
│  │ • SBAR Clinical Report (Situation, Background, Assessment, Rec)  │  │
│  │ • DSM-5 Persistence Badge (Span: 56 days ≥ 14d threshold)        │  │
│  │ • 1-Click "Copy to EHR Chart"                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Verified Evidence Drawer (4 Source Notes)                     │  │
│  │ [P001_N01 | 2024-01-15] "Sleep architecture is markedly..."     │  │
│  │ [P001_N02 | 2024-01-29] "Follow-up psychiatric consultation..."  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Backend Generative Engine (`clinical_qa.py` & `serve.py`)
- **Cloud LLM Providers:** Supports Groq (`llama-3.3-70b-versatile`), OpenAI (`gpt-4o-mini`), or Google Gemini via standard lightweight HTTP calls (no heavy torch/transformers required for generation).
- **Environment & Header Config:** Reads `GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` from environment or optional request header/body.
- **Evidence-Grounded Prompting:** Forces the cloud model to strictly cite `[Note ID - Date]` and respect negation tags (`NEGATED` vs `AFFIRMED`).
- **Offline / Zero-Key Fallback:** If no API key is configured, uses our built-in deterministic clinical synthesis engine to generate complete, structured SBAR consultation notes with 100% reliability.

### 2.2 Navigation & Page Structure
1. **Clinical Copilot (`/`)**: Unified RAG search, natural conversational response, interactive SBAR cards, patient filtering, and evidence verification drawer.
2. **Patient Directory (`/patients`)**: Netflix-style patient cards with condition tags, note counts, encounter timelines, and 1-click chart access.
3. **Patient Chart (`/patient/:id`)**: Longitudinal clinical timeline, symptom persistence tracker (DSM-5 $\ge 14$ days), and note reader.
4. **HIPAA Safe Harbor Drawer**: Global slide-over to scrub text across all 18 HIPAA identifiers with medical whitelist protection.
5. **Settings / Provider Modal**: Clean slide-over to configure Cloud LLM provider (Groq, OpenAI, Gemini) or use the built-in evidence synthesizer.

---

## 3. Implementation Steps

1. **Backend Cloud LLM Integration:** Enhance `LLMSynthesizer` in `clinical_qa.py` to support cloud API calls (Groq, OpenAI, Gemini) via `httpx` or `urllib3` with evidence grounding prompts.
2. **Backend API Cleanup:** Clean `serve.py` to remove benchmark routes and guarantee clean, robust single-engine RAG execution.
3. **Frontend Shell & Theme Modernization:** Upgrade `Shell.jsx`, `index.css`, and navigation to a premium Linear/Netflix style.
4. **Clinical Copilot Page (`DiscoverPage.jsx`):** Redesign into a dedicated, clean RAG copilot interface.
5. **Patient Directory (`DashboardPage.jsx`):** Modernize into high-contrast, premium cards.
6. **Testing:** Update unit tests to verify cloud client handling, fallback synthesis, and clean API endpoints.
