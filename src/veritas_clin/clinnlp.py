"""Clinical NLP core: corpus generation, preprocessing, Word2Vec, GloVe, evaluation.

All training is deterministic under a fixed seed. No network access required after install.
"""
from __future__ import annotations

import json
import math
import re
import string
from collections import Counter, defaultdict
from pathlib import Path
from random import Random
from typing import Any

import numpy as np

# ---------------------------------------------------------------------------
# Corpus generation
# ---------------------------------------------------------------------------

DOMAINS = ["cardiac", "respiratory", "endocrine", "renal"]

_DOMAIN_VOCAB: dict[str, list[str]] = {
    "cardiac": [
        "chest pain", "palpitations", "hypertension", "heart failure", "arrhythmia",
        "amlodipine", "metoprolol", "atorvastatin", "echocardiogram", "troponin",
        "atrial fibrillation", "coronary artery disease", "angioplasty", "stent",
        "ejection fraction", "furosemide", "lisinopril", "cardiomegaly",
    ],
    "respiratory": [
        "shortness of breath", "wheezing", "pneumonia", "asthma", "copd",
        "salbutamol", "budesonide", "tiotropium", "chest x-ray", "oxygen saturation",
        "bronchodilator", "spirometry", "pleural effusion", "bronchitis",
        "sputum culture", "prednisone", "inhaler", "dyspnea",
    ],
    "endocrine": [
        "diabetes mellitus", "hyperglycemia", "hypoglycemia", "thyroid nodule",
        "metformin", "insulin", "glipizide", "hba1c", "fasting glucose", "polydipsia",
        "polyuria", "hypothyroidism", "levothyroxine", "adrenal insufficiency",
        "cortisol", "pituitary", "goiter", "endocrinology referral",
    ],
    "renal": [
        "acute kidney injury", "creatinine elevation", "proteinuria", "hematuria",
        "nephrology", "hemodialysis", "furosemide", "hydration", "renal ultrasound",
        "electrolyte imbalance", "hyponatremia", "hyperkalemia", "urinalysis",
        "glomerulonephritis", "fosfomycin", "chronic kidney disease", "bun",
    ],
}

_NOTE_TEMPLATES = [
    "Patient presents with {symptom1} and {symptom2}. Assessment: {condition}. "
    "Prescribed {medication1} and {medication2}. Follow-up with {specialty} in two weeks.",

    "Chief complaint: {symptom1}. History of {condition}. Current medications include "
    "{medication1}. Ordered {test}. Plan: continue {medication2}, monitor closely.",

    "{specialty} consultation requested for {condition}. Patient reports {symptom1}. "
    "Labs show {test} abnormality. Initiating {medication1}.",

    "Admitted with {symptom1} and {symptom2}. Diagnosed with {condition}. "
    "Started on {medication1} {dose}. {test} performed. Stable on discharge.",
]

_DOSES = ["10 mg", "20 mg", "40 mg", "500 mg", "5 mg daily", "twice daily", "as needed"]
_SPECIALTY = ["cardiology", "pulmonology", "endocrinology", "nephrology",
              "internal medicine", "general practice"]


def _pick(rng: Random, lst: list, k: int = 1):
    if k == 1:
        return rng.choice(lst)
    chosen = rng.sample(lst, min(k, len(lst)))
    return chosen if len(chosen) > 1 else chosen[0]


def _make_note(rng: Random, domain: str, note_id: str) -> dict:
    vocab = _DOMAIN_VOCAB[domain]
    # split vocab into rough symptom / condition / medication / test groups by position
    symptoms    = vocab[:4]
    conditions  = vocab[4:8]
    medications = vocab[8:13]
    tests       = vocab[13:]

    template = _pick(rng, _NOTE_TEMPLATES)
    text = template.format(
        symptom1   = _pick(rng, symptoms),
        symptom2   = _pick(rng, symptoms),
        condition  = _pick(rng, conditions),
        medication1= _pick(rng, medications),
        medication2= _pick(rng, medications),
        test       = _pick(rng, tests) if tests else "lab work",
        specialty  = _pick(rng, _SPECIALTY),
        dose       = _pick(rng, _DOSES),
    )
    return {"note_id": note_id, "domain": domain, "text": text}


def generate_corpus(n: int = 400, seed: int = 42) -> list[dict]:
    rng = Random(seed)
    notes = []
    per_domain = n // len(DOMAINS)
    remainder  = n % len(DOMAINS)
    for di, domain in enumerate(DOMAINS):
        count = per_domain + (1 if di < remainder else 0)
        for i in range(count):
            nid = f"{domain[:3]}_{i:03d}"
            notes.append(_make_note(rng, domain, nid))
    rng.shuffle(notes)
    return notes


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","being","have","has","had","do","does",
    "did","will","would","could","should","may","might","shall","can","need",
    "this","that","these","those","it","its","we","our","you","your","he","she",
    "they","their","i","my","me","him","her","us","by","from","up","about",
    "into","through","during","patient","presents","history","current","plan",
    "ordered","initiated","performing","performed","report","reports","stable",
    "monitor","closely","continue","show","shows","include","includes","two",
    "weeks","follow","referral","consultation","requested","admitted","discharge",
    # template structural words
    "chief","complaint","medications","diagnosed","started","labs","abnormality",
    "initiating","assessment","prescribed","assessment","initiating","started",
    "lab","work","general","practice","internal","medicine","cardiology",
    "pulmonology","endocrinology","nephrology","close","closely","weeks",
}


def preprocess(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    tokens = text.split()
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]


# ---------------------------------------------------------------------------
# Split
# ---------------------------------------------------------------------------

def stratified_split(
    notes: list[dict],
    train_frac: float = 0.70,
    val_frac: float   = 0.10,
    seed: int = 42,
) -> tuple[list[dict], list[dict], list[dict]]:
    rng = Random(seed)
    by_domain: dict[str, list[dict]] = defaultdict(list)
    for n in notes:
        by_domain[n["domain"]].append(n)

    train, val, test = [], [], []
    for domain, items in by_domain.items():
        shuffled = list(items)
        rng.shuffle(shuffled)
        n_train = round(len(shuffled) * train_frac)
        n_val   = round(len(shuffled) * val_frac)
        train  += shuffled[:n_train]
        val    += shuffled[n_train:n_train + n_val]
        test   += shuffled[n_train + n_val:]

    return train, val, test


# ---------------------------------------------------------------------------
# Word2Vec (skip-gram + negative sampling, NumPy)
# ---------------------------------------------------------------------------

class Word2Vec:
    """Skip-gram model with negative sampling trained from scratch."""

    def __init__(self, dim: int = 100, window: int = 5, neg: int = 5,
                 epochs: int = 10, lr: float = 0.025, seed: int = 42):
        self.dim = dim
        self.window = window
        self.neg = neg
        self.epochs = epochs
        self.lr = lr
        self.seed = seed
        self.vocab: dict[str, int] = {}
        self.vectors: np.ndarray | None = None

    def fit(self, sentences: list[list[str]], min_count: int = 2) -> "Word2Vec":
        rng = np.random.default_rng(self.seed)
        freq = Counter(w for s in sentences for w in s)
        words = [w for w, c in freq.items() if c >= min_count]
        self.vocab = {w: i for i, w in enumerate(words)}
        V = len(words)

        W_in  = (rng.random((V, self.dim)) - 0.5) / self.dim
        W_out = np.zeros((V, self.dim))

        # Unigram^0.75 noise distribution
        counts = np.array([freq[w] for w in words], dtype=np.float64)
        noise  = counts ** 0.75
        noise /= noise.sum()

        for epoch in range(self.epochs):
            lr = self.lr * (1 - epoch / self.epochs) + 1e-4
            idxs = np.arange(V)
            rng.shuffle(idxs)
            for sent in sentences:
                s_idx = [self.vocab[w] for w in sent if w in self.vocab]
                for pos, tgt in enumerate(s_idx):
                    start = max(0, pos - self.window)
                    end   = min(len(s_idx), pos + self.window + 1)
                    ctx   = [s_idx[i] for i in range(start, end) if i != pos]
                    if not ctx:
                        continue
                    # negative samples drawn once per target
                    negs = rng.choice(V, size=self.neg, p=noise)
                    for c in ctx:
                        for label, other in [(1, c)] + [(0, n) for n in negs]:
                            x = float(np.dot(W_in[tgt], W_out[other]))
                            # clip for numerical stability
                            x = max(-10.0, min(10.0, x))
                            p = 1.0 / (1.0 + math.exp(-x))
                            g = lr * (label - p)
                            W_in[tgt]     += g * W_out[other]
                            W_out[other]  += g * W_in[tgt]

        self.vectors = W_in
        return self

    def get(self, word: str) -> np.ndarray | None:
        idx = self.vocab.get(word)
        return None if idx is None else self.vectors[idx]

    def neighbors(self, word: str, top_n: int = 10) -> list[tuple[str, float]]:
        vec = self.get(word)
        if vec is None or self.vectors is None:
            return []
        norms = np.linalg.norm(self.vectors, axis=1, keepdims=True) + 1e-9
        normed = self.vectors / norms
        q = vec / (np.linalg.norm(vec) + 1e-9)
        sims = normed @ q
        best = np.argsort(-sims)
        words = list(self.vocab.keys())
        results = []
        for i in best:
            w = words[i]
            if w != word:
                results.append((w, float(sims[i])))
            if len(results) >= top_n:
                break
        return results

    def note_vector(self, tokens: list[str]) -> np.ndarray:
        vecs = [self.vectors[self.vocab[t]] for t in tokens if t in self.vocab]
        if not vecs:
            return np.zeros(self.dim)
        return np.mean(vecs, axis=0)

    def to_dict(self) -> dict:
        return {
            "vocab": self.vocab,
            "vectors": self.vectors.tolist() if self.vectors is not None else [],
            "dim": self.dim,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Word2Vec":
        obj = cls(dim=d["dim"])
        obj.vocab = d["vocab"]
        obj.vectors = np.array(d["vectors"])
        return obj


# ---------------------------------------------------------------------------
# GloVe (co-occurrence matrix + weighted least-squares, NumPy)
# ---------------------------------------------------------------------------

class GloVe:
    """GloVe trained from a co-occurrence matrix."""

    def __init__(self, dim: int = 100, window: int = 5, epochs: int = 25,
                 lr: float = 0.05, x_max: int = 100, alpha: float = 0.75,
                 seed: int = 42):
        self.dim = dim
        self.window = window
        self.epochs = epochs
        self.lr = lr
        self.x_max = x_max
        self.alpha = alpha
        self.seed = seed
        self.vocab: dict[str, int] = {}
        self.vectors: np.ndarray | None = None

    def fit(self, sentences: list[list[str]], min_count: int = 2) -> "GloVe":
        rng = np.random.default_rng(self.seed)
        freq = Counter(w for s in sentences for w in s)
        words = [w for w, c in freq.items() if c >= min_count]
        self.vocab = {w: i for i, w in enumerate(words)}
        V = len(words)

        # Build sparse co-occurrence as three parallel arrays (stays out of RAM)
        cooc_dict: dict[tuple[int, int], float] = defaultdict(float)
        for sent in sentences:
            idxs = [self.vocab[w] for w in sent if w in self.vocab]
            for pos, tgt in enumerate(idxs):
                start = max(0, pos - self.window)
                end   = min(len(idxs), pos + self.window + 1)
                for j in range(start, end):
                    if j == pos:
                        continue
                    cooc_dict[(tgt, idxs[j])] += 1.0 / abs(pos - j)

        ii = np.array([k[0] for k in cooc_dict], dtype=np.int32)
        jj = np.array([k[1] for k in cooc_dict], dtype=np.int32)
        xx = np.array(list(cooc_dict.values()), dtype=np.float32)
        log_x = np.log(xx + 1e-8)
        f_weight = np.where(xx < self.x_max,
                            (xx / self.x_max) ** self.alpha,
                            np.ones_like(xx))

        W  = (rng.random((V, self.dim)).astype(np.float32) - 0.5) / self.dim
        W_ = (rng.random((V, self.dim)).astype(np.float32) - 0.5) / self.dim
        b  = np.zeros(V, dtype=np.float32)
        b_ = np.zeros(V, dtype=np.float32)
        Wg  = np.ones((V, self.dim), dtype=np.float32)
        W_g = np.ones((V, self.dim), dtype=np.float32)
        bg  = np.ones(V, dtype=np.float32)
        b_g = np.ones(V, dtype=np.float32)

        n_pairs = len(ii)
        for _ in range(self.epochs):
            perm = rng.permutation(n_pairs)
            for k in perm:
                i, j = int(ii[k]), int(jj[k])
                diff = float(W[i] @ W_[j]) + b[i] + b_[j] - float(log_x[k])
                cost = float(f_weight[k]) * diff
                grad_i  = cost * W_[j]
                grad_j  = cost * W[i]
                Wg[i]  += grad_i  ** 2;  W[i]  -= self.lr * grad_i  / np.sqrt(Wg[i])
                W_g[j] += grad_j  ** 2;  W_[j] -= self.lr * grad_j  / np.sqrt(W_g[j])
                bg[i]  += cost ** 2;     b[i]  -= self.lr * cost / math.sqrt(float(bg[i]))
                b_g[j] += cost ** 2;     b_[j] -= self.lr * cost / math.sqrt(float(b_g[j]))

        self.vectors = ((W + W_) / 2.0).astype(np.float64)
        return self

    def get(self, word: str) -> np.ndarray | None:
        idx = self.vocab.get(word)
        return None if idx is None else self.vectors[idx]

    def neighbors(self, word: str, top_n: int = 10) -> list[tuple[str, float]]:
        vec = self.get(word)
        if vec is None or self.vectors is None:
            return []
        norms = np.linalg.norm(self.vectors, axis=1, keepdims=True) + 1e-9
        normed = self.vectors / norms
        q = vec / (np.linalg.norm(vec) + 1e-9)
        sims = normed @ q
        best = np.argsort(-sims)
        words = list(self.vocab.keys())
        results = []
        for i in best:
            w = words[i]
            if w != word:
                results.append((w, float(sims[i])))
            if len(results) >= top_n:
                break
        return results

    def note_vector(self, tokens: list[str]) -> np.ndarray:
        vecs = [self.vectors[self.vocab[t]] for t in tokens if t in self.vocab]
        if not vecs:
            return np.zeros(self.dim)
        return np.mean(vecs, axis=0)

    def to_dict(self) -> dict:
        return {
            "vocab": self.vocab,
            "vectors": self.vectors.tolist() if self.vectors is not None else [],
            "dim": self.dim,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "GloVe":
        obj = cls(dim=d["dim"])
        obj.vocab = d["vocab"]
        obj.vectors = np.array(d["vectors"])
        return obj


# ---------------------------------------------------------------------------
# Evaluation (logistic regression via scikit-learn)
# ---------------------------------------------------------------------------

def _vectorize_tfidf(
    train_texts: list[list[str]], test_texts: list[list[str]]
) -> tuple[np.ndarray, np.ndarray]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    joined_train = [" ".join(t) for t in train_texts]
    joined_test  = [" ".join(t) for t in test_texts]
    vec = TfidfVectorizer(max_features=5000)
    X_tr = vec.fit_transform(joined_train).toarray()
    X_te = vec.transform(joined_test).toarray()
    return X_tr, X_te


def _mean_vector(model, token_lists: list[list[str]]) -> np.ndarray:
    return np.array([model.note_vector(t) for t in token_lists])


def _eval_model(
    X_train: np.ndarray, y_train: list[int],
    X_test:  np.ndarray, y_test:  list[int],
    labels:  list[str],
) -> dict:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score, precision_recall_fscore_support, confusion_matrix
    )
    clf = LogisticRegression(max_iter=1000, random_state=42)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    prec, rec, f1, sup = precision_recall_fscore_support(
        y_test, y_pred, labels=list(range(len(labels))), zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred, labels=list(range(len(labels)))).tolist()

    per_class = {
        labels[i]: {
            "precision": float(prec[i]),
            "recall":    float(rec[i]),
            "f1":        float(f1[i]),
            "support":   int(sup[i]),
        }
        for i in range(len(labels))
    }
    return {
        "accuracy":        float(acc),
        "precision":       float(prec.mean()),
        "recall":          float(rec.mean()),
        "f1":              float(f1.mean()),
        "macro_f1":        float(f1.mean()),
        "per_class":       per_class,
        "confusion_matrix": cm,
    }


def evaluate_all(
    train: list[dict], test: list[dict],
    w2v: Word2Vec, glv: GloVe,
    seed: int = 42,
) -> dict:
    labels = DOMAINS
    label2id = {l: i for i, l in enumerate(labels)}

    tr_tok = [preprocess(n["text"]) for n in train]
    te_tok = [preprocess(n["text"]) for n in test]
    y_tr   = [label2id[n["domain"]] for n in train]
    y_te   = [label2id[n["domain"]] for n in test]

    # TF-IDF
    X_tr_tf, X_te_tf = _vectorize_tfidf(tr_tok, te_tok)
    res_tfidf = _eval_model(X_tr_tf, y_tr, X_te_tf, y_te, labels)

    # Word2Vec mean vectors
    X_tr_w2v = _mean_vector(w2v, tr_tok)
    X_te_w2v = _mean_vector(w2v, te_tok)
    res_w2v  = _eval_model(X_tr_w2v, y_tr, X_te_w2v, y_te, labels)

    # GloVe mean vectors
    X_tr_glv = _mean_vector(glv, tr_tok)
    X_te_glv = _mean_vector(glv, te_tok)
    res_glv  = _eval_model(X_tr_glv, y_tr, X_te_glv, y_te, labels)

    return {
        "domains": labels,
        "results": [
            {"model": "TF-IDF",   **res_tfidf},
            {"model": "Word2Vec", **res_w2v},
            {"model": "GloVe",    **res_glv},
        ],
    }
