"""FastAPI service — Depression Screening NLP project."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS, ensure_dirs

FRONTEND_DIST = SETTINGS.root / "frontend" / "dist"
ACTIVE_UI_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else SETTINGS.root / "ui"

_ROOT      = SETTINGS.root
_DATA_DIR  = _ROOT / "data"
_ART_DIR   = _ROOT / "artifacts"
_RAW_PATH  = _DATA_DIR / "depression_raw.json"
_W2V_PATH  = _ART_DIR  / "dep_w2v.json"
_GLV_PATH  = _ART_DIR  / "dep_glv.json"
_EVAL_PATH = _ART_DIR  / "dep_eval.json"
_TFIDF_PATH = _ART_DIR / "dep_tfidf.json"

# In-memory cache
_STATE: dict[str, Any] = {
    "w2v": None, "glove": None,
    "clf": {},   "tfidf_vec": None,
    "eval": None,
}
_LOCK = threading.Lock()


def _ensure_dirs():
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _ART_DIR.mkdir(parents=True, exist_ok=True)


def _load_raw() -> list[dict]:
    if not _RAW_PATH.exists():
        raise FileNotFoundError("Dataset not found. Run: python -m veritas_clin.fetch_data")
    return json.loads(_RAW_PATH.read_text())


def _load_models():
    """Load cached embedding models from disk, then rebuild classifiers."""
    from .depression_nlp import Word2Vec, GloVe
    if _STATE["w2v"] is None and _W2V_PATH.exists():
        _STATE["w2v"] = Word2Vec.from_dict(json.loads(_W2V_PATH.read_text()))
    if _STATE["glove"] is None and _GLV_PATH.exists():
        _STATE["glove"] = GloVe.from_dict(json.loads(_GLV_PATH.read_text()))
    if _STATE["eval"] is None and _EVAL_PATH.exists():
        _STATE["eval"] = json.loads(_EVAL_PATH.read_text())
    # Rebuild classifiers whenever at least one embedding model is loaded
    if _STATE["w2v"] or _STATE["glove"]:
        _rebuild_classifiers()


def _rebuild_classifiers():
    """Rebuild all classifiers from disk models — called on startup and after training."""
    if not _RAW_PATH.exists():
        return
    try:
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from .depression_nlp import split_dataset, preprocess

        rows = _load_raw()
        train, _, _ = split_dataset(rows, seed=42)
        tr_tok = [preprocess(r["text"]) for r in train]
        y_tr   = [r["label"] for r in train]

        tfidf = TfidfVectorizer(max_features=8000)
        X_tf  = tfidf.fit_transform([" ".join(t) for t in tr_tok]).toarray()
        _STATE["tfidf_vec"]    = tfidf
        _STATE["clf"]["tfidf"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_tf, y_tr)

        if _STATE["w2v"]:
            X_w = np.array([_STATE["w2v"].note_vector(t) for t in tr_tok])
            _STATE["clf"]["word2vec"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_w, y_tr)

        if _STATE["glove"]:
            X_g = np.array([_STATE["glove"].note_vector(t) for t in tr_tok])
            _STATE["clf"]["glove"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_g, y_tr)
    except Exception as exc:
        print(f"[warn] classifier rebuild failed: {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dirs()
    _ensure_dirs()
    _load_models()
    yield


app = FastAPI(title="Depression Screening NLP", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "dataset":       _RAW_PATH.exists(),
        "word2vec":      _W2V_PATH.exists(),
        "glove":         _GLV_PATH.exists(),
        "evaluated":     _EVAL_PATH.exists(),
        "extractor":     "heuristic",   # kept for test compat
        "models_loaded": True,
    }


# ---------------------------------------------------------------------------
# /api/dataset  – basic stats
# ---------------------------------------------------------------------------

@app.get("/api/dataset")
def api_dataset():
    rows = _load_raw()
    from .depression_nlp import split_dataset, preprocess
    from collections import Counter
    train, val, test = split_dataset(rows, seed=42)
    sample_tokens = preprocess(rows[0]["text"])
    label_dist = Counter(r["label"] for r in rows)
    return {
        "total":       len(rows),
        "depressive":  label_dist[1],
        "non_depressive": label_dist[0],
        "split_train": len(train),
        "split_val":   len(val),
        "split_test":  len(test),
        "source":      "Reddit (mrjunos/depression-reddit-cleaned)",
        "sample_text": rows[42]["text"][:180],
        "sample_tokens": sample_tokens[:12],
    }


# ---------------------------------------------------------------------------
# /api/train  – train Word2Vec or GloVe (POST {"model": "word2vec"|"glove"|"all"})
# ---------------------------------------------------------------------------

@app.post("/api/train")
def api_train(body: dict):
    model_name = body.get("model", "word2vec").lower()
    if model_name not in ("word2vec", "glove", "all"):
        raise HTTPException(400, "model must be word2vec / glove / all")

    if not _LOCK.acquire(blocking=False):
        raise HTTPException(409, "Training already in progress")

    try:
        from .depression_nlp import split_dataset, preprocess, Word2Vec, GloVe
        rows  = _load_raw()
        train, _, _ = split_dataset(rows, seed=42)
        sents = [preprocess(r["text"]) for r in train]

        trained = []
        if model_name in ("word2vec", "all"):
            m = Word2Vec(dim=100, window=5, neg=5, epochs=5, seed=42)
            m.fit(sents, min_count=3)
            _W2V_PATH.write_text(json.dumps(m.to_dict()))
            _STATE["w2v"] = m
            trained.append(f"word2vec (vocab {len(m.vocab)})")

        if model_name in ("glove", "all"):
            m = GloVe(dim=100, window=5, epochs=15, seed=42)
            m.fit(sents, min_count=3)
            _GLV_PATH.write_text(json.dumps(m.to_dict()))
            _STATE["glove"] = m
            trained.append(f"glove (vocab {len(m.vocab)})")

        # Rebuild all classifiers so /predict works immediately
        _rebuild_classifiers()

        return {"status": "ok", "trained": trained,
                "message": "Trained " + ", ".join(trained)}
    finally:
        _LOCK.release()


# ---------------------------------------------------------------------------
# /api/train-status
# ---------------------------------------------------------------------------

@app.get("/api/train-status")
def api_train_status():
    return {
        "word2vec":      _W2V_PATH.exists(),
        "glove":         _GLV_PATH.exists(),
        "evaluated":     _EVAL_PATH.exists(),
        "word2vec_vocab": len(_STATE["w2v"].vocab) if _STATE["w2v"] else None,
        "glove_vocab":    len(_STATE["glove"].vocab) if _STATE["glove"] else None,
    }


# ---------------------------------------------------------------------------
# /api/evaluate  – run full evaluation (GET triggers re-run)
# ---------------------------------------------------------------------------

@app.get("/api/evaluate")
def api_evaluate():
    from .depression_nlp import split_dataset, preprocess, evaluate_all
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.feature_extraction.text import TfidfVectorizer

    w2v = _STATE["w2v"]
    glv = _STATE["glove"]
    if w2v is None or glv is None:
        raise HTTPException(400, "Train both Word2Vec and GloVe first")

    rows = _load_raw()
    train, _, test = split_dataset(rows, seed=42)
    ev = evaluate_all(train, test, w2v, glv)

    # Store classifiers in memory for /api/predict
    tr_tok = [preprocess(r["text"]) for r in train]
    y_tr   = [r["label"] for r in train]

    tfidf = TfidfVectorizer(max_features=8000)
    X_tf  = tfidf.fit_transform([" ".join(t) for t in tr_tok]).toarray()
    clf_tf = LogisticRegression(max_iter=1000, random_state=42).fit(X_tf, y_tr)
    _STATE["tfidf_vec"] = tfidf
    _STATE["clf"]["tfidf"] = clf_tf

    X_w = np.array([w2v.note_vector(t) for t in tr_tok])
    _STATE["clf"]["word2vec"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_w, y_tr)

    X_g = np.array([glv.note_vector(t) for t in tr_tok])
    _STATE["clf"]["glove"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_g, y_tr)

    # Persist (without clf objects — they are not serialisable simply)
    serialisable = {k: v for k, v in ev.items()}
    _EVAL_PATH.write_text(json.dumps(serialisable))
    _STATE["eval"] = serialisable
    return serialisable


# ---------------------------------------------------------------------------
# /api/results  – return cached evaluation
# ---------------------------------------------------------------------------

@app.get("/api/results")
def api_results():
    if _STATE["eval"]:
        return _STATE["eval"]
    if _EVAL_PATH.exists():
        ev = json.loads(_EVAL_PATH.read_text())
        _STATE["eval"] = ev
        return ev
    return {"results": None}


# ---------------------------------------------------------------------------
# /api/neighbors  (POST {"model": "word2vec"|"glove", "word": "...", "top_n": 10})
# ---------------------------------------------------------------------------

@app.post("/api/neighbors")
def api_neighbors(body: dict):
    model_name = body.get("model", "word2vec").lower()
    word       = (body.get("word") or "").strip().lower()
    top_n      = int(body.get("top_n", 10))
    if not word:
        raise HTTPException(400, "word is required")
    m = _STATE["w2v"] if model_name == "word2vec" else _STATE["glove"]
    if m is None:
        raise HTTPException(404, f"{model_name} not trained yet")
    results = m.neighbors(word, top_n)
    return {
        "model": model_name, "word": word,
        "in_vocab": word in m.vocab,
        "neighbors": [{"word": w, "similarity": round(s, 4)} for w, s in results],
    }


# ---------------------------------------------------------------------------
# /api/predict  (POST {"text": "...", "model": "tfidf|word2vec|glove"})
# ---------------------------------------------------------------------------

@app.post("/api/predict")
def api_predict(body: dict):
    from .depression_nlp import predict_text
    text  = (body.get("text") or "").strip()
    model = (body.get("model") or "word2vec").lower()
    if not text:
        raise HTTPException(400, "text is required")
    result = predict_text(
        text, model,
        _STATE["clf"],
        _STATE["w2v"],
        _STATE["glove"],
        _STATE["tfidf_vec"],
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ---------------------------------------------------------------------------
# Legacy /extract for existing tests
# ---------------------------------------------------------------------------

@app.post("/extract")
def extract_legacy(body: dict):
    from .extract import HeuristicExtractor
    from .pipeline import extract_and_verify, assign_decisions
    claims = extract_and_verify(HeuristicExtractor(), None, body.get("note_text", ""))
    assign_decisions(claims, threshold=0.8, low_frac=0.8)
    return {"claims": [c.__dict__ for c in claims]}


# ---------------------------------------------------------------------------
# Static + SPA fallback
# ---------------------------------------------------------------------------

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")
if _ART_DIR.exists():
    app.mount("/artifacts", StaticFiles(directory=str(_ART_DIR)), name="artifacts")

@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def favicon(): return Response(status_code=204)

@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=FileResponse)
def spa(full_path: str):
    if full_path:
        f = ACTIVE_UI_DIR / full_path
        if f.is_file(): return FileResponse(f)
    idx = ACTIVE_UI_DIR / "index.html"
    if idx.exists(): return FileResponse(idx)
    raise HTTPException(404, "index.html not found")
