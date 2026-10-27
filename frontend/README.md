# Veritas-Clin frontend

React + Vite + Tailwind v4 SPA served statically by the FastAPI backend (`src/veritas_clin/serve.py`,
which serves `frontend/dist` and falls back to `index.html` for client-side routes).

## Design contract

Written down so every page stays consistent. Violations are bugs.

- **Feel**: serious clinical software, not a dashboard demo. Dense, quiet, data-first.
- **Color**: zinc neutrals for all chrome; one blue accent (`blue-600/700`) for primary actions and
  active navigation; semantic color (emerald / amber / red) only for clinical decisions
  (auto-accepted / physician review / blocked). No gradients, no per-card accent bars.
- **Typography**: system UI stack (no downloaded fonts). Type scale: 11 (fine print) / 12 (labels,
  meta) / 13 (data & body) / 16 / 20 (page title). Uppercase tracking only for table column
  headers. Mono is reserved for identifiers and numeric scores.
- **Layout**: single content column, `max-w-6xl`, 24px page padding. Top app bar navigation; no
  fixed sidebar (mobile devices collapse cleanly).
- **Components**: `src/components/ui.jsx` — Chip, Panel, Stat, ScoreBar, PageHeader, ErrorNote,
  Spinner. Pages compose these rather than restyling.
- **Data honesty**: every number shown comes from a live API call (`/api/notes`, `/extract`,
  `/api/metrics`, `/api/nlp/*`) or an artifact asset — no hardcoded results anywhere. The
  `p(entail)` column is only rendered when the backend reports NLI is loaded
  (`nli_enabled` in the `/extract` response).

## Structure

```
src/
  api.js               # fetch layer, single error convention
  App.jsx              # router
  components/AppShell.jsx  # top bar + engine status probe
  components/ui.jsx        # primitives + formatters
  pages/…              # one file per route
```

## Build

```sh
npm run build     # outputs to dist/ (committed — FastAPI serves it)
```
