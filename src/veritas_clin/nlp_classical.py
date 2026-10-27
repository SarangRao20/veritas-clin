"""Classical NLP utilities for the Veritas‑Clin project.

This file groups the *non‑LLM* pipeline components required by the syllabus:

* **Tokenizer / normalizer** – NLTK ``word_tokenize`` with lower‑casing and punctuation removal.
* **Spelling‑correction** – Levenshtein distance against a frequency‑based vocabulary.
* **Word2Vec (skip‑gram)** – Minimal NumPy implementation trained on the synthetic corpus.
* **N‑gram language model** – raw counts with Laplace and Good‑Turing smoothing.
* **POS‑tagger (HMM)** – trained with NLTK's ``HiddenMarkovModelTrainer`` on spaCy tags.
* **NER (CRF)** – token‑level BIO labels derived from the ground‑truth spans; trained with ``python‑crfsuite``.

All models are **trained once at module import** and cached in module‑level globals so the
FastAPI endpoints can serve them instantly.
"""
import math
import random
import re
import tempfile
from collections import Counter
from typing import List, Tuple, Dict, Any

import numpy as np
import nltk
import spacy
import pycrfsuite
from nltk.util import ngrams
from nltk.metrics import edit_distance

# -----------------------------------------------------------------------------
# 1. Tokenisation / normalisation utilities
# -----------------------------------------------------------------------------
_nlp = spacy.load("en_core_web_sm")

def normalize(text: str) -> str:
    """Lower‑case and strip surrounding whitespace."""
    return text.lower().strip()

def tokenize(text: str) -> List[str]:
    """Return a list of word tokens, punctuation removed.

    Uses NLTK's ``word_tokenize`` because it respects punctuation as separate tokens;
    we then drop tokens that are pure punctuation.
    """
    tokens = nltk.word_tokenize(text)
    return [t.lower() for t in tokens if any(ch.isalnum() for ch in t)]

# -----------------------------------------------------------------------------
# 2. Spelling‑correction via edit distance
# -----------------------------------------------------------------------------
_vocab_counter: Counter[str] = Counter()

def build_vocab(corpus_texts: List[str]) -> None:
    """Populate ``_vocab_counter`` from a list of raw note strings.
    Frequency is used both for candidate ranking and for the edit‑distance
    suggestion heuristic (the classic Norvig approach).
    """
    for txt in corpus_texts:
        for w in tokenize(txt):
            _vocab_counter[w] += 1

def correct_spelling(word: str, max_dist: int = 2) -> str:
    """Return the most frequent dictionary word within ``max_dist`` Levenshtein.
    If nothing within the distance is found, the original word is returned.
    """
    word = normalize(word)
    if word in _vocab_counter:
        return word
    candidates = [w for w in _vocab_counter if edit_distance(w, word) <= max_dist]
    if not candidates:
        return word
    return max(candidates, key=lambda w: _vocab_counter[w])

# -----------------------------------------------------------------------------
# 3. Word2Vec – tiny skip‑gram implementation (negative‑sampling)
# -----------------------------------------------------------------------------
class Word2Vec:
    """Very small skip‑gram model with negative sampling.

    Parameters
    ----------
    vector_size: dimension of the embeddings (default 50).
    window: context window on each side (default 2).
    epochs: training passes over the corpus (default 20).
    min_count: ignore words with total frequency < min_count.
    """
    def __init__(self, vector_size: int = 50, window: int = 2, epochs: int = 20, min_count: int = 2, negative: int = 5, lr: float = 0.025):
        self.vector_size = vector_size
        self.window = window
        self.epochs = epochs
        self.min_count = min_count
        self.negative = negative
        self.lr = lr
        self.vocab: Dict[str, int] = {}
        self.index2word: List[str] = []
        self.word2index: Dict[str, int] = {}
        self.W_in: np.ndarray = np.empty(0)
        self.W_out: np.ndarray = np.empty(0)

    def _build_vocab(self, sentences: List[List[str]]) -> None:
        freq = Counter()
        for sent in sentences:
            freq.update(sent)
        self.vocab = {w: c for w, c in freq.items() if c >= self.min_count}
        self.index2word = list(self.vocab.keys())
        self.word2index = {w: i for i, w in enumerate(self.index2word)}
        vocab_size = len(self.index2word)
        self.W_in = (np.random.rand(vocab_size, self.vector_size) - 0.5) / self.vector_size
        self.W_out = np.zeros((vocab_size, self.vector_size))

    def _negative_sampling_distribution(self) -> np.ndarray:
        freqs = np.array([self.vocab[w] for w in self.index2word], dtype=np.float64)
        probs = freqs ** 0.75
        probs /= probs.sum()
        return probs

    def train(self, sentences: List[List[str]]) -> None:
        self._build_vocab(sentences)
        neg_dist = self._negative_sampling_distribution()
        for epoch in range(self.epochs):
            random.shuffle(sentences)
            for sent in sentences:
                indices = [self.word2index[w] for w in sent if w in self.word2index]
                for pos, target_idx in enumerate(indices):
                    start = max(0, pos - self.window)
                    end = min(len(indices), pos + self.window + 1)
                    context = [indices[i] for i in range(start, end) if i != pos]
                    for ctx_idx in context:
                        self._sgd_step(target_idx, ctx_idx, 1)
                        for _ in range(self.negative):
                            neg_idx = np.random.choice(len(self.index2word), p=neg_dist)
                            self._sgd_step(target_idx, neg_idx, 0)

    def _sgd_step(self, target: int, ctx: int, label: int) -> None:
        x = np.dot(self.W_in[target], self.W_out[ctx])
        pred = 1.0 / (1.0 + math.exp(-x))
        g = self.lr * (label - pred)
        self.W_in[target] += g * self.W_out[ctx]
        self.W_out[ctx] += g * self.W_in[target]

    def most_similar(self, word: str, top_n: int = 5) -> List[Tuple[str, float]]:
        if word not in self.word2index:
            return []
        idx = self.word2index[word]
        vec = self.W_in[idx]
        sims = np.dot(self.W_in, vec)
        norms = np.linalg.norm(self.W_in, axis=1) * np.linalg.norm(vec)
        sims = sims / (norms + 1e-10)
        best = np.argsort(-sims)[: top_n + 1]
        result = []
        for i in best:
            if i == idx:
                continue
            result.append((self.index2word[i], float(sims[i])))
            if len(result) >= top_n:
                break
        return result

# -----------------------------------------------------------------------------
# 4. N‑gram language model with Laplace & Good‑Turing smoothing
# -----------------------------------------------------------------------------
class NGramLM:
    """Simple n‑gram language model with Laplace and Good‑Turing smoothing."""
    def __init__(self, order: int = 3):
        self.order = order
        self.counts: List[Counter[Tuple[str, ...]]] = [Counter() for _ in range(order)]
        self.total_counts: List[int] = [0] * order
        self.vocab: Counter[str] = Counter()

    def train(self, sentences: List[List[str]]) -> None:
        for sent in sentences:
            padded = ["<s>"] * (self.order - 1) + sent + ["</s>"]
            for n in range(1, self.order + 1):
                for gram in ngrams(padded, n):
                    self.counts[n - 1][gram] += 1
                    self.total_counts[n - 1] += 1
                    if n == 1:
                        self.vocab[gram[0]] += 1
        self.V = len(self.vocab)

    def prob_laplace(self, history: Tuple[str, ...], token: str) -> float:
        n = len(history) + 1
        if n > self.order:
            raise ValueError("History longer than model order")
        gram = history + (token,)
        count = self.counts[n - 1][gram]
        hist_count = self.counts[n - 2][history] if n > 1 else self.total_counts[0]
        return (count + 1) / (hist_count + self.V)

    def _good_turing_counts(self, n: int) -> Tuple[Dict[int, float], float]:
        cnts = self.counts[n - 1]
        N_r = Counter(cnts.values())
        max_r = max(N_r) if N_r else 0
        dr = {}
        for r in range(1, max_r + 1):
            nr = N_r.get(r, 0)
            nr1 = N_r.get(r + 1, 0)
            dr[r] = ((r + 1) * nr1 / nr) if nr else 0.0
        N0 = self.V ** n - len(cnts)
        p0 = N_r.get(1, 0) / (self.total_counts[n - 1] * N0) if N0 > 0 else 0.0
        return dr, p0

    def prob_gt(self, history: Tuple[str, ...], token: str) -> float:
        n = len(history) + 1
        if n > self.order:
            raise ValueError("History longer than model order")
        gram = history + (token,)
        count = self.counts[n - 1][gram]
        dr, p0 = self._good_turing_counts(n)
        if count == 0:
            return p0
        r_star = dr.get(count, count)
        hist_count = self.counts[n - 2][history] if n > 1 else self.total_counts[0]
        return r_star / hist_count if hist_count > 0 else 0.0

# -----------------------------------------------------------------------------
# 5. POS‑tagger (HMM) – trained on spaCy tags
# -----------------------------------------------------------------------------
_pos_tagger = None

def train_pos_hmm(sentences: List[List[str]]) -> None:
    from nltk.tag import HiddenMarkovModelTrainer
    tagged_sents: List[List[Tuple[str, str]]] = []
    for sent in sentences:
        doc = _nlp(" ".join(sent))
        tagged = [(token.text, token.pos_) for token in doc]
        tagged_sents.append(tagged)
    trainer = HiddenMarkovModelTrainer()
    global _pos_tagger
    _pos_tagger = trainer.train_supervised(tagged_sents)

def tag_pos(tokens: List[str]) -> List[Tuple[str, str]]:
    if _pos_tagger is None:
        raise RuntimeError("POS HMM model not trained")
    return _pos_tagger.tag(tokens)

# -----------------------------------------------------------------------------
# 6. NER (CRF) – BIO tags from ground‑truth spans
# -----------------------------------------------------------------------------
_ner_crf = None

def _tokens_and_bio(text: str, gt_spans: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    tokens: List[str] = []
    labels: List[str] = []
    span_map = {(s["span_start"], s["span_end"]): s["type"] for s in gt_spans}
    idx = 0
    while idx < len(text):
        if text[idx].isspace():
            idx += 1
            continue
        match = re.match(r"\S+", text[idx:])
        if not match:
            break
        token = match.group(0)
        start = idx
        end = idx + len(token)
        label = "O"
        for (s, e), typ in span_map.items():
            if start >= s and end <= e:
                label = f"B-{typ.upper()}" if start == s else f"I-{typ.upper()}"
                break
        tokens.append(token)
        labels.append(label)
        idx = end
    return tokens, labels

def train_ner_crf(corpus: List[Dict[str, Any]]) -> None:
    trainer = pycrfsuite.Trainer(verbose=False)
    for rec in corpus:
        tokens, labels = _tokens_and_bio(rec["text"], rec["gt"])
        feats = []
        for i, tok in enumerate(tokens):
            f = {
                "bias": 1.0,
                "word.lower()": tok.lower(),
                "word.isupper()": tok.isupper(),
                "word.istitle()": tok.istitle(),
                "word.isdigit()": tok.isdigit(),
                "suffix3": tok[-3:],
                "prefix3": tok[:3],
            }
            if i > 0:
                prev = tokens[i - 1]
                f["-1:word.lower()"] = prev.lower()
                f["-1:word.isupper()"] = prev.isupper()
            else:
                f["BOS"] = True
            if i < len(tokens) - 1:
                nxt = tokens[i + 1]
                f["+1:word.lower()"] = nxt.lower()
                f["+1:word.isupper()"] = nxt.isupper()
            else:
                f["EOS"] = True
            feats.append(f)
        trainer.append(feats, labels)
    trainer.set_params({"c1": 1.0, "c2": 1e-3, "max_iterations": 100})
    global _ner_crf
    _ner_crf = pycrfsuite.Tagger()
    with tempfile.TemporaryDirectory() as directory:
        model_path = f"{directory}/ner_crf.model"
        trainer.train(model_path)
        _ner_crf.open(model_path)

def predict_ner(tokens: List[str]) -> List[str]:
    if _ner_crf is None:
        raise RuntimeError("NER CRF model not trained")
    feats = []
    for i, tok in enumerate(tokens):
        f = {
            "bias": 1.0,
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "suffix3": tok[-3:],
            "prefix3": tok[:3],
        }
        if i > 0:
            prev = tokens[i - 1]
            f["-1:word.lower()"] = prev.lower()
            f["-1:word.isupper()"] = prev.isupper()
        else:
            f["BOS"] = True
        if i < len(tokens) - 1:
            nxt = tokens[i + 1]
            f["+1:word.lower()"] = nxt.lower()
            f["+1:word.isupper()"] = nxt.isupper()
        else:
            f["EOS"] = True
        feats.append(f)
    return _ner_crf.tag(feats)

# -----------------------------------------------------------------------------
# 7. Initialise all models on import (cached globally)
# -----------------------------------------------------------------------------
def _init_all() -> None:
    from .data_gen import ensure_corpus
    corpus = ensure_corpus()
    texts = [rec["text"] for rec in corpus]
    # Build spelling vocab
    build_vocab(texts)
    # Tokenise sentences for training
    sent_tok: List[List[str]] = []
    for txt in texts:
        for s in nltk.sent_tokenize(txt):
            sent_tok.append(tokenize(s))
    # Word2Vec
    global _word2vec_model
    _word2vec_model = Word2Vec(vector_size=50, window=2, epochs=30, min_count=1)
    _word2vec_model.train(sent_tok)
    # N‑gram LM
    global _ngram_lm
    _ngram_lm = NGramLM(order=3)
    _ngram_lm.train(sent_tok)
    # POS HMM
    train_pos_hmm(sent_tok)
    # CRF NER
    train_ner_crf(corpus)

_word2vec_model: Word2Vec = None
_ngram_lm: NGramLM = None
_init_all()

# -----------------------------------------------------------------------------
# 8. Helper wrappers for FastAPI endpoints (imported from ``serve.py``)
# -----------------------------------------------------------------------------
def word2vec_sim(word: str, top_n: int = 5) -> List[Dict[str, Any]]:
    sims = _word2vec_model.most_similar(normalize(word), top_n)
    return [{"neighbor": w, "similarity": round(score, 4)} for w, score in sims]

def ngram_prob(prefix: List[str], next_word: str) -> Dict[str, float]:
    hist = tuple(prefix[-(_ngram_lm.order - 1):]) if prefix else tuple()
    lap = _ngram_lm.prob_laplace(hist, next_word)
    gt = _ngram_lm.prob_gt(hist, next_word)
    return {"laplace": round(lap, 6), "good_turing": round(gt, 6)}

def pos_tag_text(text: str) -> List[Dict[str, str]]:
    toks = tokenize(text)
    tags = tag_pos(toks)
    return [{"token": t, "pos": p} for t, p in tags]

def ner_tag_text(text: str) -> List[Dict[str, str]]:
    toks = tokenize(text)
    labs = predict_ner(toks)
    return [{"token": t, "label": l} for t, l in zip(toks, labs)]

# End of module
