"""MoodTrace — FastAPI backend.

Clinician-facing symptom evidence search over longitudinal patient notes.
"""
from __future__ import annotations

import json
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS, ensure_dirs

FRONTEND_DIST = SETTINGS.root / "frontend" / "dist"
ACTIVE_UI_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else SETTINGS.root / "ui"

_ROOT     = SETTINGS.root
_DATA_DIR = _ROOT / "data"
_ART_DIR  = _ROOT / "artifacts"
_RAW_PATH = _DATA_DIR / "depression_raw.json"
_W2V_PATH = _ART_DIR  / "dep_w2v.json"
_GLV_PATH = _ART_DIR  / "dep_glv.json"
_EVAL_PATH= _ART_DIR  / "dep_eval.json"

_STATE: dict[str, Any] = {
    "w2v": None, "glove": None, "clf": {}, "tfidf_vec": None, "eval": None,
    "corpus": None, "patients": None,
    "tfidf_ret": None, "w2v_ret": None, "glv_ret": None, "bilstm_ret": None,
    "dense_ret": None, "hybrid_ret": None,
    "qa_system": None, "deidentifier": None,
}
_LOCK = threading.Lock()


def _ensure_dirs():
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _ART_DIR.mkdir(parents=True, exist_ok=True)


def _load_raw() -> list[dict]:
    if not _RAW_PATH.exists():
        raise FileNotFoundError("depression_raw.json not found.")
    return json.loads(_RAW_PATH.read_text())


def _load_patient_corpus():
    try:
        from .data_ingest import load_or_create_clinical_corpus
        notes, patients = load_or_create_clinical_corpus()
    except Exception:
        from .search_engine import generate_patient_corpus
        notes, patients = generate_patient_corpus(seed=42)
    _STATE["corpus"]   = notes
    _STATE["patients"] = patients
    return notes, patients


def _get_corpus():
    if _STATE["corpus"] is None:
        _load_patient_corpus()
    return _STATE["corpus"], _STATE["patients"]


def _build_retrievers():
    from .search_engine import (
        TFIDFRetriever,
        EmbeddingRetriever,
        BiLSTMRetriever,
        HybridRetriever,
        DenseTransformerRetriever,
    )
    from .clinical_qa import ClinicalQASystem
    from .deidentifier import Deidentifier

    corpus, patients = _get_corpus()
    records = [(s, n["note_id"], n["date"])
               for n in corpus for s in n["sentences"]]
    _STATE["tfidf_ret"] = TFIDFRetriever(records)
    if _STATE["w2v"]:
        _STATE["w2v_ret"] = EmbeddingRetriever(records, _STATE["w2v"], "word2vec")
    if _STATE["glove"]:
        _STATE["glv_ret"] = EmbeddingRetriever(records, _STATE["glove"], "glove")

    # Build Dense Semantic Transformer Retriever
    _STATE["dense_ret"] = DenseTransformerRetriever(records)

    # Build Bidirectional LSTM Contextual Sequence Retriever
    emb_model = _STATE.get("w2v") or _STATE.get("glove")
    _STATE["bilstm_ret"] = BiLSTMRetriever(records, emb_model, hidden_dim=64)

    # Build Consensus Hybrid Retriever (BM25 + Dense Vectors + BiLSTM + Transformers)
    emb_ret = _STATE.get("w2v_ret") or _STATE.get("glv_ret")
    _STATE["hybrid_ret"] = HybridRetriever(
        _STATE["tfidf_ret"],
        emb_ret=emb_ret,
        bilstm_ret=_STATE["bilstm_ret"],
        dense_ret=_STATE["dense_ret"],
    )

    # Build Clinical QA Engine
    active_hybrid = _STATE.get("hybrid_ret") or _STATE.get("dense_ret") or _STATE.get("bilstm_ret") or _STATE["tfidf_ret"]
    _STATE["qa_system"] = ClinicalQASystem(active_hybrid, corpus, patients or [])

    # Build HIPAA Safe Harbor De-identification Engine
    patient_names = [p["name"] for p in (patients or [])]
    _STATE["deidentifier"] = Deidentifier(custom_names=patient_names)


def _rebuild_classifiers():
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
        tfidf  = TfidfVectorizer(max_features=8000)
        X_tf   = tfidf.fit_transform([" ".join(t) for t in tr_tok]).toarray()
        _STATE["tfidf_vec"]    = tfidf
        _STATE["clf"]["tfidf"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_tf, y_tr)
        if _STATE["w2v"]:
            X_w = np.array([_STATE["w2v"].note_vector(t) for t in tr_tok])
            _STATE["clf"]["word2vec"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_w, y_tr)
        if _STATE["glove"]:
            X_g = np.array([_STATE["glove"].note_vector(t) for t in tr_tok])
            _STATE["clf"]["glove"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_g, y_tr)
    except Exception as e:
        print(f"[warn] classifiers: {e}")


def _load_models():
    from .depression_nlp import Word2Vec, GloVe
    if _STATE["w2v"] is None and _W2V_PATH.exists():
        _STATE["w2v"] = Word2Vec.from_dict(json.loads(_W2V_PATH.read_text()))
    if _STATE["glove"] is None and _GLV_PATH.exists():
        _STATE["glove"] = GloVe.from_dict(json.loads(_GLV_PATH.read_text()))
    if _STATE["eval"] is None and _EVAL_PATH.exists():
        _STATE["eval"] = json.loads(_EVAL_PATH.read_text())
    if _STATE["w2v"] or _STATE["glove"]:
        _rebuild_classifiers()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dirs()
    _ensure_dirs()
    _load_models()
    _load_patient_corpus()
    _build_retrievers()
    yield


app = FastAPI(title="MoodTrace", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":    "ok",
        "word2vec":  _W2V_PATH.exists(),
        "glove":     _GLV_PATH.exists(),
        "evaluated": _EVAL_PATH.exists(),
        "corpus_loaded": _STATE["corpus"] is not None,
        "extractor": "heuristic", "models_loaded": True,
    }


# ── Patients ─────────────────────────────────────────────────────────────────

@app.get("/api/patients")
def api_patients():
    corpus, patients = _get_corpus()
    result = []
    for p in patients:
        p_notes = [n for n in corpus if n["patient_id"] == p["id"]]
        dates = sorted(n["date"] for n in p_notes)
        result.append({
            **p,
            "note_count":    len(p_notes),
            "last_entry":    dates[-1] if dates else None,
            "first_entry":   dates[0]  if dates else None,
        })
    return result


@app.get("/api/patients/{patient_id}")
def api_patient_detail(patient_id: str):
    corpus, patients = _get_corpus()
    patient = next((p for p in patients if p["id"] == patient_id), None)
    if not patient:
        raise HTTPException(404, "Patient not found")
    notes = sorted(
        [n for n in corpus if n["patient_id"] == patient_id],
        key=lambda n: n["date"]
    )
    return {**patient, "notes": notes}


# ── Symptom search ───────────────────────────────────────────────────────────

@app.post("/api/search")
def api_search(body: dict):
    query      = (body.get("query") or "").strip()
    patient_id = body.get("patient_id")      # None = search all
    retriever  = (body.get("retriever") or "hybrid").lower()
    top_k      = int(body.get("top_k", 8))

    if not query:
        raise HTTPException(400, "query is required")
    if not 1 <= top_k <= 50:
        raise HTTPException(400, "top_k must be between 1 and 50")

    ret_map = {
        "hybrid":      _STATE.get("hybrid_ret") or _STATE.get("dense_ret") or _STATE.get("bilstm_ret") or _STATE.get("w2v_ret") or _STATE["tfidf_ret"],
        "dense":       _STATE.get("dense_ret") or _STATE.get("hybrid_ret"),
        "transformer": _STATE.get("dense_ret") or _STATE.get("hybrid_ret"),
        "bilstm":      _STATE.get("bilstm_ret") or _STATE.get("hybrid_ret"),
        "lstm":        _STATE.get("bilstm_ret") or _STATE.get("hybrid_ret"),
        "context":     _STATE.get("bilstm_ret") or _STATE.get("hybrid_ret"),
        "tfidf":       _STATE["tfidf_ret"],
        "word2vec":    _STATE.get("w2v_ret"),
        "glove":       _STATE.get("glv_ret"),
    }
    ret = ret_map.get(retriever)
    if ret is None:
        raise HTTPException(400, f"Retriever '{retriever}' not available. Train models first.")

    results = ret.query(query, top_k=len(ret.records))

    # Filter to patient if specified
    if patient_id:
        corpus, _ = _get_corpus()
        valid_ids  = {n["note_id"] for n in corpus if n["patient_id"] == patient_id}
        if not valid_ids:
            raise HTTPException(404, "Patient not found")
        results    = [r for r in results if r["note_id"] in valid_ids]

    # Attach patient info
    corpus, _ = _get_corpus()
    note_map   = {n["note_id"]: n for n in corpus}
    for r in results:
        note = note_map.get(r["note_id"], {})
        r["patient_id"]   = note.get("patient_id", "?")
        r["patient_name"] = note.get("patient_name", "?")

    return {
        "query":     query,
        "retriever": retriever,
        "results":   results[:top_k],
        "expanded_terms": results[0].get("expanded_terms") if results else [],
    }


# ── Compare all retrievers ───────────────────────────────────────────────────

@app.post("/api/search/compare")
def api_search_compare(body: dict):
    query      = (body.get("query") or "").strip()
    patient_id = body.get("patient_id")
    top_k      = int(body.get("top_k", 5))

    if not query:
        raise HTTPException(400, "query is required")
    if not 1 <= top_k <= 50:
        raise HTTPException(400, "top_k must be between 1 and 50")

    corpus, _ = _get_corpus()
    valid_ids  = (
        {n["note_id"] for n in corpus if n["patient_id"] == patient_id}
        if patient_id else None
    )
    if patient_id and not valid_ids:
        raise HTTPException(404, "Patient not found")
    note_map   = {n["note_id"]: n for n in corpus}

    def run(name, ret):
        if ret is None:
            return {"retriever": name, "available": False, "results": []}
        raw = ret.query(query, top_k=len(ret.records))
        if valid_ids:
            raw = [r for r in raw if r["note_id"] in valid_ids]
        for r in raw:
            note = note_map.get(r["note_id"], {})
            r["patient_name"] = note.get("patient_name", "?")
        return {
            "retriever": name,
            "available": True,
            "results":   raw[:top_k],
            "expanded_terms": raw[0].get("expanded_terms", []) if raw else [],
        }

    return {
        "query":       query,
        "hybrid":      run("hybrid",      _STATE.get("hybrid_ret")),
        "dense":       run("dense",       _STATE.get("dense_ret")),
        "bilstm":      run("bilstm",      _STATE.get("bilstm_ret")),
        "word2vec":    run("word2vec",    _STATE.get("w2v_ret")),
        "glove":       run("glove",       _STATE.get("glv_ret")),
        "tfidf":       run("tfidf",       _STATE["tfidf_ret"]),
    }


# ── Clinical Question Answering (0525) ───────────────────────────────────────

@app.post("/api/qa")
def api_clinical_qa(body: dict):
    question   = (body.get("question") or body.get("query") or "").strip()
    patient_id = body.get("patient_id")
    top_k      = int(body.get("top_k", 6))

    if not question:
        raise HTTPException(400, "question is required")

    qa_sys = _STATE.get("qa_system")
    if qa_sys is None:
        from .clinical_qa import ClinicalQASystem
        corpus, patients = _get_corpus()
        active_hybrid = _STATE.get("hybrid_ret") or _STATE.get("bilstm_ret") or _STATE["tfidf_ret"]
        qa_sys = ClinicalQASystem(active_hybrid, corpus, patients or [])
        _STATE["qa_system"] = qa_sys

    return qa_sys.answer_question(question, patient_id=patient_id, top_k=top_k)


# ── HIPAA Safe Harbor De-Identification (0528) ──────────────────────────────

@app.post("/api/deidentify")
def api_deidentify(body: dict):
    text = (body.get("text") or "").strip()
    mode = (body.get("mode") or "mask").lower()

    if not text:
        raise HTTPException(400, "text is required")

    deid = _STATE.get("deidentifier")
    if deid is None:
        from .deidentifier import Deidentifier
        corpus, patients = _get_corpus()
        patient_names = [p["name"] for p in (patients or [])]
        deid = Deidentifier(custom_names=patient_names)
        _STATE["deidentifier"] = deid

    return deid.deidentify(text, mode=mode)


# ── Symptom timeline with DSM-5 Persistence ──────────────────────────────────

@app.get("/api/patients/{patient_id}/timeline")
def api_timeline(patient_id: str):
    """For each BDI-II symptom, find the top matching sentence per note date and compute DSM-5 persistence."""
    from datetime import date
    from .search_engine import SYMPTOM_SEEDS
    corpus, patients = _get_corpus()
    patient = next((p for p in patients if p["id"] == patient_id), None)
    if not patient:
        raise HTTPException(404, "Patient not found")

    notes = sorted(
        [n for n in corpus if n["patient_id"] == patient_id],
        key=lambda n: n["date"]
    )
    ret = _STATE["tfidf_ret"]
    if ret is None:
        raise HTTPException(503, "Retrievers not yet built")

    timeline = []
    for note in notes:
        entry = {"date": note["date"], "note_id": note["note_id"], "symptoms": {}}
        for symptom, seeds in SYMPTOM_SEEDS.items():
            q = " ".join(seeds)
            best_score = 0.0
            best_sent  = ""
            for sent in note.get("sentences", []):
                s = ret.score_sentence(q, sent)
                if s > best_score:
                    best_score = s
                    best_sent  = sent
            if best_score > 0.05:
                entry["symptoms"][symptom] = {
                    "score":    best_score,
                    "sentence": best_sent,
                }
        timeline.append(entry)

    # Calculate DSM-5 2-week persistence
    persistence = {}
    for symptom in SYMPTOM_SEEDS:
        detected_dates = [
            date.fromisoformat(e["date"])
            for e in timeline
            if symptom in e["symptoms"]
        ]
        if len(detected_dates) >= 2:
            span_days = (max(detected_dates) - min(detected_dates)).days
            persistence[symptom] = {
                "count": len(detected_dates),
                "span_days": span_days,
                "dsm5_persistent": span_days >= 14,
            }
        elif len(detected_dates) == 1:
            persistence[symptom] = {
                "count": 1,
                "span_days": 0,
                "dsm5_persistent": False,
            }

    return {
        "patient":     patient,
        "timeline":    timeline,
        "symptoms":    list(SYMPTOM_SEEDS.keys()),
        "persistence": persistence,
    }


# ── Dataset statistics ───────────────────────────────────────────────────────

@app.get("/api/dataset")
def api_dataset():
    rows = _load_raw()
    from collections import Counter
    from .depression_nlp import split_dataset, preprocess
    train, val, test = split_dataset(rows, seed=42)
    sample_tokens = preprocess(rows[0]["text"])
    label_dist = Counter(r["label"] for r in rows)
    return {
        "total":          len(rows),
        "depressive":     label_dist[1],
        "non_depressive": label_dist[0],
        "split_train":    len(train),
        "split_val":      len(val),
        "split_test":     len(test),
        "source":         "Reddit research corpus (mrjunos/depression-reddit-cleaned)",
        "sample_text":    rows[42]["text"][:180],
        "sample_tokens":  sample_tokens[:12],
    }


# ── PHQ-9 symptom mapping & screening triage ─────────────────────────────────

_PHQ9_MAP = {
    "depressed":   "A – Depressed mood",
    "sad":         "A – Depressed mood",
    "hopeless":    "A – Depressed mood",
    "empty":       "A – Depressed mood",
    "lost":        "A – Depressed mood / Directionless",
    "hollow":      "A – Depressed mood",
    "worthless":   "G – Feelings of worthlessness",
    "guilty":      "G – Feelings of worthlessness",
    "failure":     "G – Feelings of worthlessness",
    "burden":      "G – Feelings of worthlessness",
    "sleep":       "C – Sleep disturbance",
    "insomnia":    "C – Sleep disturbance",
    "awake":       "C – Sleep disturbance",
    "tired":       "D – Fatigue or loss of energy",
    "exhausted":   "D – Fatigue or loss of energy",
    "energy":      "D – Fatigue or loss of energy",
    "heavy":       "D – Fatigue or loss of energy",
    "drained":     "D – Fatigue or loss of energy",
    "limbs":       "D – Fatigue or loss of energy",
    "appetite":    "E – Appetite/weight change",
    "eating":      "E – Appetite/weight change",
    "concentrate": "F – Difficulty concentrating",
    "focus":       "F – Difficulty concentrating",
    "thought":     "F – Cognitive Fog / Rumination",
    "thoughts":    "F – Cognitive Fog / Rumination",
    "thinking":    "F – Cognitive Fog / Rumination",
    "mind":        "F – Cognitive Fog / Rumination",
    "fog":         "F – Cognitive Fog / Rumination",
    "foggy":       "F – Cognitive Fog / Rumination",
    "wandering":   "F – Cognitive Fog / Rumination",
    "rumination":  "F – Cognitive Fog / Rumination",
    "ruminating":  "F – Cognitive Fog / Rumination",
    "interest":    "B – Loss of interest (anhedonia)",
    "enjoy":       "B – Loss of interest (anhedonia)",
    "pleasure":    "B – Loss of interest (anhedonia)",
    "die":         "I – Suicidal ideation",
    "death":       "I – Suicidal ideation",
    "suicide":     "I – Suicidal ideation",
    "kill":        "I – Suicidal ideation",
    "disappear":   "I – Suicidal ideation",
    "numb":        "A – Depressed mood",
    "trapped":     "A – Depressed mood",
    "alone":       "A – Depressed mood",
    "isolated":    "A – Depressed mood",
    "crying":      "A – Depressed mood",
    "tears":       "A – Depressed mood",
    "slow":        "H – Psychomotor changes",
    "moving":      "H – Psychomotor changes",
}

def _triage(p_dep: float) -> dict:
    if p_dep >= 0.75:
        return {
            "level":  "Elevated language signal",
            "action": "Prominent depressive themes detected. Detailed clinical assessment suggested.",
            "color":  "red",
        }
    elif p_dep >= 0.50:
        return {
            "level":  "Moderate language signal",
            "action": "Mild to moderate depressive language markers present. Routine screening recommended.",
            "color":  "amber",
        }
    else:
        return {
            "level":  "Baseline language signal",
            "action": "Affective markers consistent with baseline text. Re-screen as clinically indicated.",
            "color":  "emerald",
        }


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


@app.post("/api/explain")
def api_explain(body: dict):
    from .depression_nlp import preprocess, predict_text
    from .search_engine import _sentence_split, _has_negation
    import numpy as np

    text  = (body.get("text") or "").strip()
    model = (body.get("model") or "word2vec").lower()
    if not text:
        raise HTTPException(400, "text is required")

    clf_model = "word2vec" if model in ("hybrid", "compare") else model
    pred = predict_text(text, clf_model, _STATE["clf"], _STATE["w2v"],
                        _STATE["glove"], _STATE["tfidf_vec"])
    if "error" in pred:
        raise HTTPException(400, pred["error"])

    tokens = preprocess(text)
    sents  = _sentence_split(text)
    if not sents and text:
        sents = [text]

    m = _STATE["w2v"] if model in ("word2vec", "hybrid", "compare") else (_STATE.get("glove") or _STATE["w2v"])
    vec = m.note_vector(tokens) if m else None
    vec_slice = [round(float(x), 4) for x in vec[:12]] if vec is not None else []
    vec_norm  = round(float(np.linalg.norm(vec)), 4) if vec is not None else 0.0

    neg_hits = []
    for j, tok in enumerate(tokens):
        if tok in _PHQ9_MAP and _has_negation(tokens, j):
            neg_hits.append(tok)

    contributions = []
    tfidf_vec  = _STATE["tfidf_vec"]
    clf_tfidf  = _STATE["clf"].get("tfidf")
    if tfidf_vec and clf_tfidf is not None:
        fn    = tfidf_vec.get_feature_names_out()
        coef  = clf_tfidf.coef_[0]
        vocab = {w: i for i, w in enumerate(fn)}
        for tok in tokens:
            if tok in vocab:
                contributions.append({
                    "token": tok,
                    "score": round(float(coef[vocab[tok]]), 4),
                    "phq9":  _PHQ9_MAP.get(tok),
                })
        contributions.sort(key=lambda x: abs(x["score"]), reverse=True)

    phq9_hits: dict[str, list[str]] = {}
    for tok in tokens:
        if tok in _PHQ9_MAP:
            crit = _PHQ9_MAP[tok]
            if crit not in phq9_hits:
                phq9_hits[crit] = []
            if tok not in phq9_hits[crit]:
                phq9_hits[crit].append(tok)

    comparison = []
    for m_name in ("word2vec", "glove", "tfidf"):
        r = predict_text(text, m_name, _STATE["clf"], _STATE["w2v"],
                         _STATE["glove"], _STATE["tfidf_vec"])
        if "error" not in r:
            comparison.append({
                "model":        m_name,
                "label":        r["label_name"],
                "p_depressive": r["p_depressive"],
                "confidence":   r["confidence"],
            })

    labels = [c["label"] for c in comparison]
    disagreement = len(set(labels)) > 1

    return {
        **pred,
        "sentences":     sents,
        "tokens":        tokens,
        "vector_preview": vec_slice,
        "vector_norm":   vec_norm,
        "negation_hits": neg_hits,
        "contributions": contributions[:30],
        "phq9_hits":     phq9_hits,
        "triage":        _triage(pred["p_depressive"]),
        "comparison":    comparison,
        "disagreement":  disagreement,
    }


@app.post("/api/batch")
def api_batch(body: dict):
    from .depression_nlp import preprocess, predict_text
    raw_notes = body.get("notes") or []
    model     = (body.get("model") or "word2vec").lower()
    if not raw_notes:
        raise HTTPException(400, "notes list is required")
    if len(raw_notes) > 50:
        raise HTTPException(400, "maximum 50 notes per batch")

    results = []
    for i, text in enumerate(raw_notes):
        text = (text or "").strip()
        if not text:
            continue
        pred = predict_text(text, model, _STATE["clf"], _STATE["w2v"],
                            _STATE["glove"], _STATE["tfidf_vec"])
        if "error" in pred:
            continue
        tokens = preprocess(text)
        phq9 = list({_PHQ9_MAP[t] for t in tokens if t in _PHQ9_MAP})
        triage = _triage(pred["p_depressive"])
        results.append({
            "index":        i,
            "preview":      text[:90] + ("…" if len(text) > 90 else ""),
            "full_text":    text,
            "label":        pred["label_name"],
            "p_depressive": pred["p_depressive"],
            "triage_level": triage["level"],
            "triage_color": triage["color"],
            "phq9_count":   len(phq9),
            "phq9_hits":    phq9[:3],
        })

    results.sort(key=lambda r: r["p_depressive"], reverse=True)
    return {"model": model, "count": len(results), "results": results}


# ── Train embeddings ─────────────────────────────────────────────────────────

@app.post("/api/train")
def api_train(body: dict):
    model_name = (body.get("model") or "word2vec").lower()
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
            m2 = GloVe(dim=100, window=5, epochs=15, seed=42)
            m2.fit(sents, min_count=3)
            _GLV_PATH.write_text(json.dumps(m2.to_dict()))
            _STATE["glove"] = m2
            trained.append(f"glove (vocab {len(m2.vocab)})")
        _rebuild_classifiers()
        _build_retrievers()
        return {"status": "ok", "trained": trained,
                "message": "Trained " + ", ".join(trained)}
    finally:
        _LOCK.release()


@app.get("/api/train-status")
def api_train_status():
    return {
        "word2vec":       _W2V_PATH.exists(),
        "glove":          _GLV_PATH.exists(),
        "evaluated":      _EVAL_PATH.exists(),
        "word2vec_vocab": len(_STATE["w2v"].vocab) if _STATE["w2v"] else None,
        "glove_vocab":    len(_STATE["glove"].vocab) if _STATE["glove"] else None,
        "retrievers_ready": _STATE["tfidf_ret"] is not None,
    }


# ── Evaluation ───────────────────────────────────────────────────────────────

@app.get("/api/evaluate")
def api_evaluate():
    from .depression_nlp import split_dataset, preprocess, evaluate_all
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.feature_extraction.text import TfidfVectorizer
    w2v  = _STATE["w2v"]
    glv  = _STATE["glove"]
    if w2v is None or glv is None:
        raise HTTPException(400, "Train both Word2Vec and GloVe first")
    rows = _load_raw()
    train, _, test = split_dataset(rows, seed=42)
    ev = evaluate_all(train, test, w2v, glv)
    tr_tok = [preprocess(r["text"]) for r in train]
    y_tr   = [r["label"] for r in train]
    tfidf  = TfidfVectorizer(max_features=8000)
    X_tf   = tfidf.fit_transform([" ".join(t) for t in tr_tok]).toarray()
    _STATE["tfidf_vec"]    = tfidf
    _STATE["clf"]["tfidf"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_tf, y_tr)
    X_w = np.array([w2v.note_vector(t) for t in tr_tok])
    _STATE["clf"]["word2vec"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_w, y_tr)
    X_g = np.array([glv.note_vector(t) for t in tr_tok])
    _STATE["clf"]["glove"] = LogisticRegression(max_iter=1000, random_state=42).fit(X_g, y_tr)
    _EVAL_PATH.write_text(json.dumps(ev))
    _STATE["eval"] = ev
    return ev


@app.get("/api/results")
def api_results():
    if _STATE["eval"]:
        return _STATE["eval"]
    if _EVAL_PATH.exists():
        ev = json.loads(_EVAL_PATH.read_text())
        _STATE["eval"] = ev
        return ev
    return {"results": None}


# ── Neighbors ────────────────────────────────────────────────────────────────

@app.post("/api/neighbors")
def api_neighbors(body: dict):
    model_name = (body.get("model") or "word2vec").lower()
    word       = (body.get("word") or "").strip().lower()
    top_n      = int(body.get("top_n", 10))
    if not word:
        raise HTTPException(400, "word is required")
    m = _STATE["w2v"] if model_name == "word2vec" else _STATE["glove"]
    if m is None:
        raise HTTPException(404, f"{model_name} not trained")
    return {
        "model": model_name, "word": word, "in_vocab": word in m.vocab,
        "neighbors": [{"word": w, "similarity": round(s, 4)}
                      for w, s in m.neighbors(word, top_n)],
    }


# ── Symptom seeds ─────────────────────────────────────────────────────────────

@app.get("/api/symptoms")
def api_symptoms():
    from .search_engine import SYMPTOM_SEEDS
    return {"symptoms": list(SYMPTOM_SEEDS.keys()),
            "seeds": SYMPTOM_SEEDS}


# ── Legacy ────────────────────────────────────────────────────────────────────

@app.post("/extract")
def extract_legacy(body: dict):
    from .extract import HeuristicExtractor
    from .pipeline import extract_and_verify, assign_decisions
    claims = extract_and_verify(HeuristicExtractor(), None, body.get("note_text", ""))
    assign_decisions(claims, threshold=0.8, low_frac=0.8)
    return {"claims": [c.__dict__ for c in claims]}


# ── Static + SPA ─────────────────────────────────────────────────────────────

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
