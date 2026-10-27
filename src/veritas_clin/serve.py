"""FastAPI service for the ClinNLP project.

New endpoints (/api/*) serve the Word2Vec / GloVe frontend.
The old /health and /extract routes are kept for backward-compatibility with tests.
"""
from __future__ import annotations

import json
import os
import threading
from collections import Counter
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS, ensure_dirs

FRONTEND_DIST = SETTINGS.root / "frontend" / "dist"
LEGACY_UI_DIR = SETTINGS.root / "ui"
ACTIVE_UI_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else LEGACY_UI_DIR

# ---------------------------------------------------------------------------
# Artifact paths for the NLP project
# ---------------------------------------------------------------------------
_DATA_DIR  = SETTINGS.root / "data"
_ART_DIR   = SETTINGS.root / "artifacts"
_CORPUS_PATH    = _DATA_DIR  / "clinnlp_corpus.json"
_W2V_PATH       = _ART_DIR   / "w2v.json"
_GLOVE_PATH     = _ART_DIR   / "glove.json"
_EVAL_PATH      = _ART_DIR   / "clinnlp_eval.json"

# In-memory model cache (loaded once per process)
_MODELS: dict[str, Any] = {}
_TRAIN_LOCK = threading.Lock()


def _ensure_dirs():
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _ART_DIR.mkdir(parents=True, exist_ok=True)


def _load_corpus() -> list[dict]:
    if not _CORPUS_PATH.exists():
        from .clinnlp import generate_corpus
        notes = generate_corpus(n=400, seed=42)
        _CORPUS_PATH.write_text(json.dumps(notes), encoding="utf-8")
    return json.loads(_CORPUS_PATH.read_text(encoding="utf-8"))


def _get_model(name: str):
    if name in _MODELS:
        return _MODELS[name]
    path = _W2V_PATH if name == "word2vec" else _GLOVE_PATH
    if not path.exists():
        return None
    from .clinnlp import Word2Vec, GloVe
    d = json.loads(path.read_text(encoding="utf-8"))
    model = Word2Vec.from_dict(d) if name == "word2vec" else GloVe.from_dict(d)
    _MODELS[name] = model
    return model


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dirs()
    _ensure_dirs()
    # Lazy-load old extraction pipeline only when needed (keeps startup fast)
    yield


app = FastAPI(
    title="ClinNLP",
    description="Clinical note classification with Word2Vec and GloVe",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health (kept for tests)
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "extractor": "heuristic",
        "models_loaded": True,
        "word2vec_trained": _W2V_PATH.exists(),
        "glove_trained":    _GLOVE_PATH.exists(),
    }


# ---------------------------------------------------------------------------
# /api/overview
# ---------------------------------------------------------------------------

@app.get("/api/overview")
def api_overview():
    from .clinnlp import generate_corpus, stratified_split, preprocess, DOMAINS
    notes = _load_corpus()
    train, val, test = stratified_split(notes, seed=42)
    vocab: Counter = Counter()
    for n in train:
        vocab.update(preprocess(n["text"]))

    result: dict[str, Any] = {
        "n_notes":     len(notes),
        "seed":        42,
        "n_domains":   len(DOMAINS),
        "domains":     DOMAINS,
        "vocab_size":  len(vocab),
        "split_train": len(train),
        "split_val":   len(val),
        "split_test":  len(test),
    }

    if _EVAL_PATH.exists():
        ev = json.loads(_EVAL_PATH.read_text(encoding="utf-8"))
        result["results"] = [
            {"model": r["model"], "accuracy": r["accuracy"], "macro_f1": r["macro_f1"]}
            for r in ev.get("results", [])
        ]

    return result


# ---------------------------------------------------------------------------
# /api/corpus
# ---------------------------------------------------------------------------

@app.get("/api/corpus")
def api_corpus():
    from .clinnlp import stratified_split, preprocess, DOMAINS
    notes = _load_corpus()
    train, val, test = stratified_split(notes, seed=42)
    split_map = {n["note_id"]: "train" for n in train}
    split_map.update({n["note_id"]: "val"   for n in val})
    split_map.update({n["note_id"]: "test"  for n in test})

    out = []
    for n in notes:
        tokens = preprocess(n["text"])
        out.append({
            "note_id":     n["note_id"],
            "domain":      n["domain"],
            "split":       split_map.get(n["note_id"], "?"),
            "text":        n["text"],
            "tokens":      tokens,
            "token_count": len(tokens),
        })

    return {"notes": out, "domains": DOMAINS, "seed": 42}


# ---------------------------------------------------------------------------
# /api/train  (POST)
# ---------------------------------------------------------------------------

@app.post("/api/train")
def api_train(body: dict):
    model_name = body.get("model", "word2vec").lower()
    if model_name not in ("word2vec", "glove"):
        raise HTTPException(400, "model must be 'word2vec' or 'glove'")

    if not _TRAIN_LOCK.acquire(blocking=False):
        raise HTTPException(409, "Training already in progress")

    try:
        from .clinnlp import generate_corpus, stratified_split, preprocess, Word2Vec, GloVe
        notes = _load_corpus()
        train, _, _ = stratified_split(notes, seed=42)
        sentences = [preprocess(n["text"]) for n in train]

        if model_name == "word2vec":
            m = Word2Vec(dim=100, window=5, neg=5, epochs=10, seed=42)
            m.fit(sentences, min_count=2)
            _GLOVE_PATH.parent.mkdir(parents=True, exist_ok=True)
            _W2V_PATH.write_text(json.dumps(m.to_dict()), encoding="utf-8")
            _MODELS["word2vec"] = m
            vocab_size = len(m.vocab)
        else:
            m = GloVe(dim=100, window=5, epochs=25, seed=42)
            m.fit(sentences, min_count=2)
            _GLOVE_PATH.write_text(json.dumps(m.to_dict()), encoding="utf-8")
            _MODELS["glove"] = m
            vocab_size = len(m.vocab)

        return {"status": "ok", "model": model_name, "vocab_size": vocab_size,
                "message": f"Trained {model_name} · vocab {vocab_size}"}
    finally:
        _TRAIN_LOCK.release()


# ---------------------------------------------------------------------------
# /api/train-status
# ---------------------------------------------------------------------------

@app.get("/api/train-status")
def api_train_status():
    status: dict[str, Any] = {
        "word2vec": _W2V_PATH.exists(),
        "glove":    _GLOVE_PATH.exists(),
    }
    for name in ("word2vec", "glove"):
        m = _get_model(name)
        if m:
            status[f"{name}_vocab"] = len(m.vocab)
    return status


# ---------------------------------------------------------------------------
# /api/neighbors  (POST)
# ---------------------------------------------------------------------------

@app.post("/api/neighbors")
def api_neighbors(body: dict):
    model_name = body.get("model", "word2vec").lower()
    word       = (body.get("word") or "").strip().lower()
    top_n      = int(body.get("top_n", 10))

    if not word:
        raise HTTPException(400, "word is required")
    m = _get_model(model_name)
    if m is None:
        raise HTTPException(404, f"{model_name} not trained yet")

    results = m.neighbors(word, top_n=top_n)
    return {
        "model": model_name,
        "word": word,
        "in_vocab": word in m.vocab,
        "neighbors": [{"word": w, "similarity": round(s, 4)} for w, s in results],
    }


# ---------------------------------------------------------------------------
# /api/note-vector  (POST)
# ---------------------------------------------------------------------------

@app.post("/api/note-vector")
def api_note_vector(body: dict):
    from .clinnlp import preprocess
    model_name = body.get("model", "word2vec").lower()
    text       = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text is required")
    m = _get_model(model_name)
    if m is None:
        raise HTTPException(404, f"{model_name} not trained yet")

    tokens = preprocess(text)
    oov    = [t for t in tokens if t not in m.vocab]
    vec    = m.note_vector(tokens)
    return {
        "model":     model_name,
        "dim":       m.dim,
        "tokens":    tokens,
        "oov_count": len(oov),
        "oov":       oov[:10],
        "vector":    [round(float(v), 5) for v in vec],
    }


# ---------------------------------------------------------------------------
# /api/evaluation
# ---------------------------------------------------------------------------

@app.get("/api/evaluation")
def api_evaluation():
    from .clinnlp import DOMAINS, stratified_split, evaluate_all
    w2v  = _get_model("word2vec")
    glv  = _get_model("glove")

    if w2v is None or glv is None:
        # Return structure with no results so UI can show "train first" message
        return {"domains": DOMAINS, "results": None}

    notes = _load_corpus()
    train, _, test = stratified_split(notes, seed=42)
    ev = evaluate_all(train, test, w2v, glv)
    _EVAL_PATH.write_text(json.dumps(ev), encoding="utf-8")
    ev["domains"] = DOMAINS
    return ev


# ---------------------------------------------------------------------------
# Legacy /extract kept for existing tests
# ---------------------------------------------------------------------------

@app.post("/extract")
def extract_legacy(body: dict):
    from .extract import HeuristicExtractor
    from .pipeline import extract_and_verify, assign_decisions
    text = body.get("note_text", "")
    claims = extract_and_verify(HeuristicExtractor(), None, text)
    assign_decisions(claims, threshold=0.8, low_frac=0.8)
    return {"claims": [c.__dict__ for c in claims]}


# ---------------------------------------------------------------------------
# Static assets and SPA fallback
# ---------------------------------------------------------------------------

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

if _ART_DIR.exists():
    app.mount("/artifacts", StaticFiles(directory=str(_ART_DIR)), name="artifacts")


@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def favicon():
    return Response(status_code=204)


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=FileResponse)
def spa(full_path: str):
    if full_path:
        f = ACTIVE_UI_DIR / full_path
        if f.is_file():
            return FileResponse(f)
    idx = ACTIVE_UI_DIR / "index.html"
    if idx.exists():
        return FileResponse(idx)
    raise HTTPException(404, "index.html not found")
