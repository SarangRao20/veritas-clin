"""
Depression screening NLP pipeline.

Real problem: detect depressive language in patient-written text.
Dataset: 7731 Reddit posts labelled depressive (1) / non-depressive (0).

Pipeline
--------
1. Preprocess  – tokenize, lowercase, remove stopwords & punctuation
2. Split       – stratified 70/15/15 train/val/test, seeded
3. Word2Vec    – skip-gram with negative sampling, NumPy only
4. GloVe       – co-occurrence weighted least-squares, NumPy only
5. Represent   – mean word vector per post
6. Classify    – logistic regression (same for all 3 representations)
7. Evaluate    – accuracy, precision, recall, F1 on held-out test set
8. Explain     – top contributing tokens per class via LR weights
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
# 1. Preprocessing
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "i","me","my","myself","we","our","ours","ourselves","you","your","yours",
    "yourself","he","him","his","himself","she","her","hers","herself","it",
    "its","itself","they","them","their","theirs","themselves","what","which",
    "who","whom","this","that","these","those","am","is","are","was","were",
    "be","been","being","have","has","had","having","do","does","did","doing",
    "a","an","the","and","but","if","or","because","as","until","while","of",
    "at","by","for","with","about","against","between","into","through",
    "during","before","after","above","below","to","from","up","down","in",
    "out","on","off","over","under","again","further","then","once","here",
    "there","when","where","why","how","all","both","each","few","more","most",
    "other","some","such","no","nor","not","only","own","same","so","than",
    "too","very","s","t","can","will","just","don","should","now","d","ll",
    "m","o","re","ve","y","ain","aren","couldn","didn","doesn","hadn","hasn",
    "haven","isn","ma","mightn","mustn","needn","shan","shouldn","wasn",
    "weren","won","wouldn","like","get","got","going","know","think","want",
    "would","could","really","even","still","back","go","see","one","also",
    "us","im","ive","ive","dont","cant","im","its","thats","https","www",
    "com","reddit","post","edit","deleted","removed","gt","amp",
}

_TOKEN_RE = re.compile(r"[a-zA-Z]{2,}")


def preprocess(text: str) -> list[str]:
    """Lowercase, keep alphabetic tokens ≥2 chars, remove stopwords."""
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if t not in _STOPWORDS]


# ---------------------------------------------------------------------------
# 2. Stratified split
# ---------------------------------------------------------------------------

def split_dataset(
    rows: list[dict],
    train_frac: float = 0.70,
    val_frac: float   = 0.15,
    seed: int = 42,
) -> tuple[list[dict], list[dict], list[dict]]:
    rng = Random(seed)
    pos = [r for r in rows if r["label"] == 1]
    neg = [r for r in rows if r["label"] == 0]
    train, val, test = [], [], []
    for group in (pos, neg):
        g = list(group)
        rng.shuffle(g)
        n_tr = round(len(g) * train_frac)
        n_va = round(len(g) * val_frac)
        train += g[:n_tr]
        val   += g[n_tr:n_tr + n_va]
        test  += g[n_tr + n_va:]
    rng.shuffle(train)
    return train, val, test


# ---------------------------------------------------------------------------
# 3. Word2Vec (skip-gram + negative sampling)
# ---------------------------------------------------------------------------

class Word2Vec:
    def __init__(self, dim: int = 100, window: int = 5, neg: int = 5,
                 epochs: int = 5, lr: float = 0.025, seed: int = 42):
        self.dim = dim; self.window = window; self.neg = neg
        self.epochs = epochs; self.lr = lr; self.seed = seed
        self.vocab: dict[str, int] = {}
        self.vectors: np.ndarray | None = None

    def fit(self, sentences: list[list[str]], min_count: int = 3) -> "Word2Vec":
        rng = np.random.default_rng(self.seed)
        freq = Counter(w for s in sentences for w in s)
        words = sorted(w for w, c in freq.items() if c >= min_count)
        self.vocab = {w: i for i, w in enumerate(words)}
        V = len(words)

        W_in  = (rng.random((V, self.dim)).astype(np.float32) - 0.5) / self.dim
        W_out = np.zeros((V, self.dim), dtype=np.float32)

        counts = np.array([freq[w] for w in words], dtype=np.float64)
        noise  = counts ** 0.75;  noise /= noise.sum()

        for epoch in range(self.epochs):
            lr = max(self.lr * (1 - epoch / self.epochs), 1e-4)
            for sent in sentences:
                idx = [self.vocab[w] for w in sent if w in self.vocab]
                for pos, tgt in enumerate(idx):
                    lo = max(0, pos - self.window)
                    hi = min(len(idx), pos + self.window + 1)
                    ctx = [idx[j] for j in range(lo, hi) if j != pos]
                    if not ctx:
                        continue
                    negs = rng.choice(V, size=self.neg, p=noise)
                    for c in ctx:
                        for label, other in [(1, c)] + [(0, int(n)) for n in negs]:
                            x = float(np.dot(W_in[tgt], W_out[other]))
                            x = max(-10.0, min(10.0, x))
                            g = lr * (label - 1.0 / (1.0 + math.exp(-x)))
                            tmp = W_in[tgt].copy()
                            W_in[tgt]    += g * W_out[other]
                            W_out[other] += g * tmp
        self.vectors = W_in.astype(np.float64)
        return self

    def vec(self, word: str) -> np.ndarray | None:
        i = self.vocab.get(word)
        return None if i is None else self.vectors[i]

    def note_vector(self, tokens: list[str]) -> np.ndarray:
        vs = [self.vectors[self.vocab[t]] for t in tokens if t in self.vocab]
        return np.mean(vs, axis=0) if vs else np.zeros(self.dim)

    def neighbors(self, word: str, top_n: int = 10) -> list[tuple[str, float]]:
        v = self.vec(word)
        if v is None: return []
        norms  = np.linalg.norm(self.vectors, axis=1) + 1e-9
        scores = (self.vectors @ v) / (norms * (np.linalg.norm(v) + 1e-9))
        best   = np.argsort(-scores)
        words  = list(self.vocab.keys())
        return [(words[i], float(scores[i])) for i in best if words[i] != word][:top_n]

    def to_dict(self) -> dict:
        return {"dim": self.dim, "vocab": self.vocab,
                "vectors": self.vectors.tolist()}

    @classmethod
    def from_dict(cls, d: dict) -> "Word2Vec":
        m = cls(dim=d["dim"])
        m.vocab = d["vocab"]
        m.vectors = np.array(d["vectors"])
        return m


# ---------------------------------------------------------------------------
# 4. GloVe
# ---------------------------------------------------------------------------

class GloVe:
    def __init__(self, dim: int = 100, window: int = 5, epochs: int = 15,
                 lr: float = 0.05, x_max: int = 100, alpha: float = 0.75,
                 seed: int = 42):
        self.dim = dim; self.window = window; self.epochs = epochs
        self.lr = lr; self.x_max = x_max; self.alpha = alpha; self.seed = seed
        self.vocab: dict[str, int] = {}
        self.vectors: np.ndarray | None = None

    def fit(self, sentences: list[list[str]], min_count: int = 3) -> "GloVe":
        rng = np.random.default_rng(self.seed)
        freq = Counter(w for s in sentences for w in s)
        words = sorted(w for w, c in freq.items() if c >= min_count)
        self.vocab = {w: i for i, w in enumerate(words)}
        V = len(words)

        cooc: dict[tuple[int, int], float] = defaultdict(float)
        for sent in sentences:
            idx = [self.vocab[w] for w in sent if w in self.vocab]
            for pos, tgt in enumerate(idx):
                lo = max(0, pos - self.window)
                hi = min(len(idx), pos + self.window + 1)
                for j in range(lo, hi):
                    if j != pos:
                        cooc[(tgt, idx[j])] += 1.0 / abs(pos - j)

        ii = np.array([k[0] for k in cooc], dtype=np.int32)
        jj = np.array([k[1] for k in cooc], dtype=np.int32)
        xx = np.array(list(cooc.values()), dtype=np.float32)
        log_x    = np.log(xx + 1e-8)
        f_weight = np.where(xx < self.x_max, (xx / self.x_max) ** self.alpha, 1.0)

        W  = (rng.random((V, self.dim)).astype(np.float32) - 0.5) / self.dim
        W_ = (rng.random((V, self.dim)).astype(np.float32) - 0.5) / self.dim
        b  = np.zeros(V, np.float32)
        b_ = np.zeros(V, np.float32)
        Wg = np.ones((V, self.dim), np.float32)
        Wg_= np.ones((V, self.dim), np.float32)
        bg = np.ones(V, np.float32)
        bg_= np.ones(V, np.float32)

        n = len(ii)
        for _ in range(self.epochs):
            perm = rng.permutation(n)
            for k in perm:
                a, b_idx = int(ii[k]), int(jj[k])
                diff = float(W[a] @ W_[b_idx]) + b[a] + b_[b_idx] - float(log_x[k])
                fw   = float(f_weight[k])
                gi   = fw * diff * W_[b_idx]
                gj   = fw * diff * W[a]
                gb   = fw * diff
                Wg[a]    += gi**2;  W[a]     -= self.lr * gi / np.sqrt(Wg[a])
                Wg_[b_idx]+= gj**2; W_[b_idx]-= self.lr * gj / np.sqrt(Wg_[b_idx])
                bg[a]    += gb**2;  b[a]     -= self.lr * gb / math.sqrt(float(bg[a]))
                bg_[b_idx]+= gb**2; b_[b_idx]-= self.lr * gb / math.sqrt(float(bg_[b_idx]))

        self.vectors = ((W + W_) / 2.0).astype(np.float64)
        return self

    def vec(self, word: str) -> np.ndarray | None:
        i = self.vocab.get(word)
        return None if i is None else self.vectors[i]

    def note_vector(self, tokens: list[str]) -> np.ndarray:
        vs = [self.vectors[self.vocab[t]] for t in tokens if t in self.vocab]
        return np.mean(vs, axis=0) if vs else np.zeros(self.dim)

    def neighbors(self, word: str, top_n: int = 10) -> list[tuple[str, float]]:
        v = self.vec(word)
        if v is None: return []
        norms  = np.linalg.norm(self.vectors, axis=1) + 1e-9
        scores = (self.vectors @ v) / (norms * (np.linalg.norm(v) + 1e-9))
        best   = np.argsort(-scores)
        words  = list(self.vocab.keys())
        return [(words[i], float(scores[i])) for i in best if words[i] != word][:top_n]

    def to_dict(self) -> dict:
        return {"dim": self.dim, "vocab": self.vocab,
                "vectors": self.vectors.tolist()}

    @classmethod
    def from_dict(cls, d: dict) -> "GloVe":
        m = cls(dim=d["dim"])
        m.vocab = d["vocab"]
        m.vectors = np.array(d["vectors"])
        return m


# ---------------------------------------------------------------------------
# 5. Evaluation
# ---------------------------------------------------------------------------

def _lr_fit(X_tr, y_tr, X_te, y_te, labels):
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
    clf = LogisticRegression(max_iter=1000, random_state=42, C=1.0)
    clf.fit(X_tr, y_tr)
    yp = clf.predict(X_te)
    acc = accuracy_score(y_te, yp)
    p, r, f, s = precision_recall_fscore_support(y_te, yp, average=None,
                                                  labels=[0, 1], zero_division=0)
    cm = confusion_matrix(y_te, yp, labels=[0, 1]).tolist()
    return {
        "accuracy":   float(acc),
        "precision":  float(p[1]),   # positive class
        "recall":     float(r[1]),
        "f1":         float(f[1]),
        "macro_f1":   float((f[0] + f[1]) / 2),
        "per_class":  {labels[i]: {"precision": float(p[i]), "recall": float(r[i]),
                                    "f1": float(f[i]), "support": int(s[i])} for i in range(2)},
        "confusion_matrix": cm,
        "clf": clf,
    }


def evaluate_all(train: list[dict], test: list[dict],
                 w2v: Word2Vec, glv: GloVe) -> dict:
    from sklearn.feature_extraction.text import TfidfVectorizer

    labels = ["non-depressive", "depressive"]
    tr_tok = [preprocess(r["text"]) for r in train]
    te_tok = [preprocess(r["text"]) for r in test]
    y_tr   = [r["label"] for r in train]
    y_te   = [r["label"] for r in test]

    # TF-IDF
    tfidf = TfidfVectorizer(max_features=8000)
    X_tr_tf = tfidf.fit_transform([" ".join(t) for t in tr_tok]).toarray()
    X_te_tf = tfidf.transform([" ".join(t) for t in te_tok]).toarray()
    res_tf  = _lr_fit(X_tr_tf, y_tr, X_te_tf, y_te, labels)

    # Word2Vec mean
    X_tr_w = np.array([w2v.note_vector(t) for t in tr_tok])
    X_te_w = np.array([w2v.note_vector(t) for t in te_tok])
    res_w  = _lr_fit(X_tr_w, y_tr, X_te_w, y_te, labels)

    # GloVe mean
    X_tr_g = np.array([glv.note_vector(t) for t in tr_tok])
    X_te_g = np.array([glv.note_vector(t) for t in te_tok])
    res_g  = _lr_fit(X_tr_g, y_tr, X_te_g, y_te, labels)

    # TF-IDF top words per class (LR coefficients)
    feature_names = tfidf.get_feature_names_out()
    coef = res_tf["clf"].coef_[0]
    top_dep    = [feature_names[i] for i in np.argsort(-coef)[:15]]
    top_nondep = [feature_names[i] for i in np.argsort(coef)[:15]]

    results = []
    for name, res in [("TF-IDF", res_tf), ("Word2Vec", res_w), ("GloVe", res_g)]:
        r = {k: v for k, v in res.items() if k != "clf"}
        r["model"] = name
        results.append(r)

    return {
        "labels": labels,
        "n_train": len(train),
        "n_test":  len(test),
        "results": results,
        "top_depressive_words":     top_dep,
        "top_non_depressive_words": top_nondep,
    }


# ---------------------------------------------------------------------------
# 6. Predict single text
# ---------------------------------------------------------------------------

def predict_text(text: str, model_name: str, clf_store: dict, w2v: Word2Vec | None,
                 glv: GloVe | None, tfidf_vec=None) -> dict:
    tokens = preprocess(text)
    if not tokens:
        return {"error": "No usable tokens after preprocessing."}

    if model_name == "tfidf":
        if tfidf_vec is None:
            return {"error": "TF-IDF not trained."}
        X = tfidf_vec.transform([" ".join(tokens)]).toarray()
    elif model_name == "word2vec":
        if w2v is None:
            return {"error": "Word2Vec not trained."}
        X = w2v.note_vector(tokens).reshape(1, -1)
    elif model_name == "glove":
        if glv is None:
            return {"error": "GloVe not trained."}
        X = glv.note_vector(tokens).reshape(1, -1)
    else:
        return {"error": f"Unknown model: {model_name}"}

    clf = clf_store.get(model_name)
    if clf is None:
        return {"error": f"Classifier for {model_name} not trained yet."}

    proba = clf.predict_proba(X)[0]
    pred  = int(clf.predict(X)[0])
    return {
        "label":      pred,
        "label_name": "depressive" if pred == 1 else "non-depressive",
        "confidence": round(float(proba[pred]), 4),
        "p_depressive":     round(float(proba[1]), 4),
        "p_non_depressive": round(float(proba[0]), 4),
        "tokens_used": len([t for t in tokens if t in (
            w2v.vocab if model_name == "word2vec" and w2v else
            glv.vocab if model_name == "glove" and glv else {}
        )]),
        "token_count": len(tokens),
    }
