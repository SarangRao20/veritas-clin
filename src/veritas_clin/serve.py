"""FastAPI service: REST API + Multi-Stage Enterprise Clinical Safety Platform."""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS, ensure_dirs
from .eval import FALLBACK_THRESHOLD
from .extract import build_extractor
from .pipeline import ExtractionPipeline
from .schemas import ExtractRequest, ExtractionResponse
from .verify import Verifier

FRONTEND_DIST = SETTINGS.root / "frontend" / "dist"
LEGACY_UI_DIR = SETTINGS.root / "ui"

# Prefer compiled React distribution if built, else fallback to ui/
ACTIVE_UI_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else LEGACY_UI_DIR


def load_policy() -> tuple[float, float]:
    """(threshold, low_frac) from artifacts/policy.json, else honest defaults."""
    if SETTINGS.policy_path.exists():
        data = json.loads(SETTINGS.policy_path.read_text(encoding="utf-8"))
        return float(data["threshold"]), float(data["low_frac"])
    return FALLBACK_THRESHOLD, SETTINGS.low_frac


class _Service:
    def __init__(self) -> None:
        self.pipe: ExtractionPipeline | None = None
        # Default to heuristic on CPU/laptop to prevent hanging on 3B downloads unless explicitly set to 'hf'
        default_kind = "hf" if os.getenv("CUDA_VISIBLE_DEVICES") or os.getenv("VERITAS_DEVICE") == "cuda" else "heuristic"
        self.kind = os.getenv("VERITAS_EXTRACTOR", default_kind)

    def load(self) -> None:
        ensure_dirs()
        threshold, low_frac = load_policy()
        verifier = None
        if self.kind == "hf":
            verifier = Verifier()
        self.pipe = ExtractionPipeline(
            extractor=build_extractor(self.kind),
            verifier=verifier,
            threshold=threshold,
            low_frac=low_frac,
        )


SERVICE = _Service()


@asynccontextmanager
async def lifespan(_: FastAPI):
    SERVICE.load()
    yield


app = FastAPI(
    title="Veritas-Clin",
    description="Evidence-Grounded Clinical Information Extraction with Calibrated Selective Abstention",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "extractor": SERVICE.kind,
        "models_loaded": SERVICE.pipe is not None,
    }


@app.get("/api/metrics")
def get_metrics() -> dict:
    if SETTINGS.metrics_path.exists():
        return json.loads(SETTINGS.metrics_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="Metrics artifact not generated yet.")


# --- NLP Foundations Endpoints (Zipf, BPE, TF-IDF, Word2Vec Negation Paradox) ---

@app.get("/api/nlp/zipf")
def get_zipf_analysis():
    from .data_gen import ensure_corpus
    from .nlp_foundations import analyze_zipfs_law
    corpus = ensure_corpus()
    texts = [r["text"] for r in corpus]
    return analyze_zipfs_law(texts, top_k=25)


@app.get("/api/nlp/bpe")
def get_bpe_tokenization(word: str = "hypercholesterolemia"):
    from .nlp_foundations import get_bpe_tokenizer
    tokenizer, merges_learned = get_bpe_tokenizer()
    subwords = tokenizer.tokenize_subwords(word)
    return {
        "input_word": word,
        "subword_tokens": subwords,
        "token_count": len(subwords),
        "merges_learned": merges_learned,
        "explanation": (
            f"BPE trained on the 40-note corpus learned {merges_learned} merges; "
            f"'{word}' decomposes into {len(subwords)} learned subunits with no OOV entries."
        ),
    }


_HDR_PREFIXES = ("PROGRESS NOTE", "DISCHARGE SUMMARY", "Patient ID:", "Allergies:")


@app.post("/api/nlp/tfidf")
def query_tfidf(query: str = "Acute Kidney Injury", note_text: str = "", top_k: int = 3):
    """Retrieval over the whole benchmark corpus: each hit names its source note."""
    from .nlp_foundations import ClinicalTFIDF
    from .data_gen import ensure_corpus

    docs: list[tuple[str, list[str]]] = []
    for rec in ensure_corpus():
        sents = [
            s for s in sentence_of_text(rec["text"]) if len(s.strip()) >= 20
        ]
        docs.append((rec["note_id"], sents))
    flat = [(nid, s) for nid, sents in docs for s in sents]
    tfidf = ClinicalTFIDF([s for _, s in flat])
    hits = tfidf.query(query, top_k=top_k)
    # Duplicate sentences exist across notes (templated trap lines); match each
    # hit to an unconsumed source index so provenance is never misassigned.
    out = []
    used: set[int] = set()
    for hit in hits:
        src = None
        for i, (nid, s) in enumerate(flat):
            if i not in used and s == hit["sentence"]:
                src, used_add = nid, i
                break
        if src is not None:
            used.add(used_add)
        else:
            src = "unknown"
        out.append({**hit, "note_id": src})
    return {
        "query": query,
        "top_grounding_sentences": out,
        "total_sentences_indexed": len(flat),
    }


def sentence_of_text(text: str) -> list[str]:
    """Sentence split that skips document headers, not clinical prose."""
    from .verify import sentences_of
    return [
        s for s in sentences_of(text)
        if not s.strip().endswith(":")
        and not s.strip().startswith(_HDR_PREFIXES)
        and s.strip() not in ("PROGRESS NOTE", "DISCHARGE SUMMARY")
    ]


@app.get("/api/nlp/negation-paradox")
def get_negation_paradox():
    from .nlp_foundations import explain_negation_paradox
    return explain_negation_paradox()


@app.post("/extract", response_model=ExtractionResponse)
def extract(body: ExtractRequest) -> ExtractionResponse:
    if SERVICE.pipe is None:
        raise HTTPException(status_code=503, detail="models still loading; retry shortly")
    claims = SERVICE.pipe.run(body.note_text)
    return ExtractionResponse(
        note_id=body.note_id,
        claims=claims,
        n_accepted=sum(1 for c in claims if c.decision == "accept"),
        n_flagged=sum(1 for c in claims if c.decision == "flag_for_review"),
        extractor=SERVICE.kind,
        nli_enabled=SERVICE.pipe.verifier is not None,
        threshold=SERVICE.pipe.threshold,
    )


@app.get("/api/notes")
def list_notes() -> list[dict]:
    """The real benchmark corpus: notes with their by-construction ground truth."""
    from .data_gen import ensure_corpus
    corpus = ensure_corpus()
    return [
        {
            "note_id": rec["note_id"],
            "text": rec["text"],
            "gt": rec["gt"],
        }
        for rec in corpus
    ]


# Mount Static Assets & Artifacts
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="react-assets")

if SETTINGS.artifacts_dir.exists():
    app.mount("/artifacts", StaticFiles(directory=str(SETTINGS.artifacts_dir)), name="artifacts")

if LEGACY_UI_DIR.exists():
    app.mount("/legacy-ui", StaticFiles(directory=str(LEGACY_UI_DIR)), name="legacy-ui")


@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def get_favicon():
    return Response(status_code=204)


# SPA Client-Side Routing Fallback (serves index.html for any route not caught above)
@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=FileResponse)
def serve_spa(full_path: str):
    # If explicit file exists in ACTIVE_UI_DIR, serve it
    if full_path:
        requested_file = ACTIVE_UI_DIR / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)
    # Otherwise return index.html for react-router-dom
    index_file = ACTIVE_UI_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="SPA index.html not found.")
