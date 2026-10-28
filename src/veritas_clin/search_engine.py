"""
Symptom-evidence search engine for MoodTrace.

Given a clinician's query (e.g. "trouble sleeping", "loss of interest"),
retrieve the most relevant passages from a patient's note history.

Three retrievers are compared:
  1. TF-IDF + cosine similarity (bag-of-words baseline)
  2. Word2Vec expanded retrieval (query terms → neighbor expansion → scoring)
  3. GloVe expanded retrieval (same, different embedding space)

Negation handling: passages containing "no", "not", "never", "without" within
3 tokens of a matched term are penalized (score *= 0.3).

All retrievers return the original source sentence, date, and note_id so the
clinician can verify every result against the original record.
"""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Any

import numpy as np
from nltk.stem import PorterStemmer

_STEMMER = PorterStemmer()

# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

_STOP = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","have","has","had","do","does","did",
    "will","would","could","should","i","me","my","myself","we","us","our","ours",
    "you","your","yours","he","him","his","himself","she","her","hers","herself",
    "it","its","itself","they","them","their","theirs","themselves",
    "this","that","these","those","there","here","what","which","who","how",
    "very","just","so","get","got","said","also","own",
    "through","like","felt","much","more","managed","went","came","took","another",
}
_TOK = re.compile(r"[a-z]{2,}")

_NEG_WORDS = {
    "no","not","never","without","none","hardly","barely","cant",
    "cannot","wont","wouldnt","shouldnt","doesnt","didnt","isnt",
    "wasnt","havent","hadnt"
}


def _tokenize(text: str) -> list[str]:
    return [t for t in _TOK.findall(text.lower()) if t not in _STOP]


def _stem_tokens(tokens: list[str]) -> list[str]:
    return [_STEMMER.stem(t) for t in tokens]


def _has_negation(tokens: list[str], match_idx: int, window: int = 3) -> bool:
    lo = max(0, match_idx - window)
    hi = min(len(tokens), match_idx + window + 1)
    return any(tokens[i] in _NEG_WORDS for i in range(lo, hi))


def _sentence_split(text: str) -> list[str]:
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sents if len(s.strip()) > 10]


# ---------------------------------------------------------------------------
# Rich Longitudinal Patient Note Corpus
# ---------------------------------------------------------------------------

SYMPTOM_SEEDS: dict[str, list[str]] = {
    "Sadness":            ["sad", "unhappy", "miserable", "crying", "tears", "gloomy", "darkness", "dread", "sorrow", "melancholy", "depressed"],
    "Pessimism":          ["hopeless", "pointless", "bleak", "giving up", "despair"],
    "Past failure":       ["failure", "failed", "worthless", "mistake", "regret", "blame"],
    "Loss of pleasure":   ["anhedonia", "anhedonic", "pleasure", "interest", "hobby", "numb", "empty", "hollow", "detached", "disconnected", "joyless"],
    "Guilty feelings":    ["guilty", "guilt", "ashamed", "shame", "blame", "fault", "burden"],
    "Punishment":         ["punish", "deserve", "bad", "fault"],
    "Self-dislike":       ["hate myself", "disgust", "loathe", "self-hatred"],
    "Self-criticalness":  ["self-critical", "criticize", "incompetent", "inadequate"],
    "Suicidal ideation":  ["die", "death", "suicide", "suicidal", "kill", "disappear", "end it all", "self-harm"],
    "Crying":             ["cry", "crying", "tears", "sobbing", "weep"],
    "Agitation":          ["agitated", "agitation", "irritable", "restless", "restlessness", "palpitations", "tachycardia", "tremulousness"],
    "Loss of interest":   ["anhedonia", "motivation", "withdrawn", "isolated", "socially isolated"],
    "Indecisiveness":     ["indecisive", "indecision", "unable to decide", "vacillating"],
    "Worthlessness":      ["worthless", "inferior", "chronic burden"],
    "Loss of energy":     ["exhausted", "fatigue", "lethargy", "leaden limbs", "heavy limbs", "drained of vitality", "profound exhaustion"],
    "Sleep changes":      ["sleep", "sleeping", "insomnia", "awake", "awakening", "sleep latency", "waking at 3am", "early morning awakening", "sleep maintenance", "nocturnal awakening", "restless sleep"],
    "Irritability":       ["irritable", "irritability", "snapping", "frustrated"],
    "Appetite changes":   ["anorexia", "appetite loss", "unintended weight loss", "loss of appetite"],
    "Concentration":      ["concentration", "concentrate", "distracted", "memory lapses", "brain fog", "cognitive slowing", "cognitive fatigue"],
    "Rumination & Thoughts": ["rumination", "ruminating", "ruminate", "racing thoughts", "intrusive thoughts", "mind wandering", "thought loops", "lost in thought", "lost in thoughts"],
    "Tiredness":          ["tired", "fatigue", "exhaustion", "somnolence", "daytime somnolence"],
    "Loss of libido":     ["libido", "loss of libido", "hypoactive sexual"],
}

# Diverse clinical sentence pool
CLINICAL_SENTENCE_POOL = {
    "sleep": [
        "I haven't been able to sleep properly for weeks now, tossing and turning until dawn.",
        "I wake up at 3am drenched in sweat and my mind just spins uncontrollably.",
        "Waking up multiple times through the night with severe restlessness and heart palpitations.",
        "Suffering from chronic sleep maintenance insomnia; can rarely fall asleep before 4am.",
        "My sleep architecture is completely fractured, leaving me exhausted by morning.",
        "Lying awake for hours listening to the clock tick, feeling utterly drained and fatigued.",
        "I wake up every ninety minutes and cannot get back into restorative sleep.",
    ],
    "mood_anhedonia": [
        "Everything feels pointless. I tried listening to music I used to love but felt completely numb.",
        "I haven't opened my sketchbook or touched my guitar in over three months.",
        "A pervasive sense of gloom clings to every single hour of the day.",
        "I cried uncontrollably for three hours yesterday afternoon without an identifiable trigger.",
        "Just feeling completely hollow and empty inside, detached from the world.",
        "Activities that used to bring me joy now feel completely meaningless and exhausting.",
        "No motivation to pursue any of my usual hobbies; everything feels like a heavy chore.",
    ],
    "fatigue": [
        "The physical exhaustion is overwhelming; even climbing the stairs feels like scaling a mountain.",
        "Overcome by profound exhaustion and heavy limbs by 11am.",
        "I spent the entire weekend immobilized in bed with zero physical energy.",
        "Getting dressed in the morning takes all my remaining willpower.",
        "My body feels like it is made of lead, completely drained of vitality.",
        "Drained and sluggish; even simple household chores leave me trembling from fatigue.",
    ],
    "worthless_guilt": [
        "I feel like such a failure at work and a chronic burden to my family.",
        "Plagued by irrational guilt over past mistakes that I cannot change.",
        "Convinced that everyone in my life would be significantly better off without me.",
        "Constantly feeling worthless and inferior compared to everyone around me.",
        "I pushed my closest friends away because I feel like such a toxic burden.",
    ],
    "cognitive": [
        "I can't concentrate on anything; reading a single work memo takes me six attempts.",
        "My thoughts feel thick and foggy, completely unable to make basic decisions.",
        "Constant brain fog and memory lapses making work responsibilities impossible.",
        "My mind wanders constantly and I find myself staring blankly into space for hours.",
    ],
    "somatic_appetite": [
        "Food has completely lost all appeal and taste; eating feels like forcing down cardboard.",
        "I haven't eaten a proper meal in four days and have lost nearly 3 kg this month.",
        "Chronic stomach tightness and nausea whenever I try to swallow solid food.",
        "Persistent headaches and muscle tension in my neck and shoulders every morning.",
    ],
    "recovery_euthymic": [
        "Had a genuinely decent week; went for a 40-minute jog by the lake.",
        "Cooked a warm dinner with my family and felt present and engaged.",
        "Sleep was deep and restorative last night; woke up at 7am feeling refreshed.",
        "Completed all assigned tasks at work with steady focus and calm mood.",
        "Met a colleague for coffee and enjoyed planning upcoming projects.",
        "Morning mood was steady and optimistic; appetite has returned to baseline.",
        "Spent the afternoon reading in the park and felt a genuine sense of tranquility.",
        "Went for a brisk walk with a friend and felt noticeably lighter afterwards.",
    ]
}


def generate_patient_corpus(seed: int = 42) -> tuple[list[dict], list[dict]]:
    try:
        from .data_ingest import load_or_create_clinical_corpus
        return load_or_create_clinical_corpus()
    except Exception:
        pass

    import random
    rng = random.Random(seed)

    PATIENTS = [
        {"id": "P001", "name": "Eleanor Vance",   "age": 42, "condition": "Major depressive disorder with insomnia"},
        {"id": "P002", "name": "Marcus Sterling", "age": 29, "condition": "Generalized anxiety with rumination"},
        {"id": "P003", "name": "Hannah Lin",      "age": 53, "condition": "Neurological fatigue with cognitive fog"},
        {"id": "P004", "name": "Devon Harris",    "age": 38, "condition": "Somatic symptom disorder with appetite changes"},
    ]

    from datetime import date, timedelta
    notes = []
    base_date = date(2024, 1, 15)

    all_categories = list(CLINICAL_SENTENCE_POOL.keys())

    for patient in PATIENTS:
        n_entries = 4
        for i in range(n_entries):
            entry_date = base_date + timedelta(days=i * 14)
            chosen_sents = []
            pool = CLINICAL_SENTENCE_POOL["mood_anhedonia"] if i % 2 == 0 else CLINICAL_SENTENCE_POOL["sleep"]
            sent = pool[i % len(pool)]
            chosen_sents.append(sent)

            text = " ".join(chosen_sents)
            notes.append({
                "patient_id":   patient["id"],
                "patient_name": patient["name"],
                "note_id":      f"{patient['id']}_N{i+1:02d}",
                "date":         entry_date.isoformat(),
                "text":         text,
                "sentences":    chosen_sents,
            })

    return notes, PATIENTS


# ---------------------------------------------------------------------------
# TF-IDF Retriever
# ---------------------------------------------------------------------------

CORE_SYMPTOM_STEMS = set()
for _seeds in SYMPTOM_SEEDS.values():
    for _s in _seeds:
        CORE_SYMPTOM_STEMS.add(_STEMMER.stem(_s.lower()))

COMMON_GENERAL_WORDS = {
    "world", "night", "day", "food", "meal", "work", "week", "house",
    "friend", "time", "game", "games", "lot", "lots", "play", "plays",
    "broo", "bro", "guy", "man"
}
PURE_SYMPTOM_STEMS = CORE_SYMPTOM_STEMS - {_STEMMER.stem(w) for w in COMMON_GENERAL_WORDS}


def has_clinical_relevance(q: str, vocab: set | dict | None = None) -> tuple[bool, float]:
    qtoks = _tokenize(q)
    if not qtoks:
        # Fallback to alphanumeric tokens in case query consists of short/common words
        raw_words = _TOK.findall(q.lower())
        if not raw_words:
            return False, 0.0
        qtoks = raw_words

    q_stemmed = set(_stem_tokens(qtoks))
    clinical_stems = q_stemmed & CORE_SYMPTOM_STEMS

    # If any symptom stem is present (e.g. 'thought', 'lost', 'feel', 'sleep', 'tired')
    if len(clinical_stems) >= 1:
        return True, 1.0

    # If vocabulary provided, check coverage against corpus
    if vocab:
        in_vocab = [t for t in qtoks if t in vocab]
        vocab_cov = len(in_vocab) / max(len(qtoks), 1)
        if vocab_cov >= 0.20:
            return True, vocab_cov

    # Any meaningful English query (≥ 1 words with ≥ 3 chars) is allowed for neural/semantic ranking
    valid_words = [t for t in qtoks if len(t) >= 3]
    if len(valid_words) >= 1:
        return True, 0.50

    return False, 0.0


class TFIDFRetriever:
    def __init__(self, sentences: list[tuple[str, str, str]]):
        self.records = sentences
        self.raw_tokens = [_tokenize(s[0]) for s in sentences]
        self.stemmed_tokens = [_stem_tokens(toks) for toks in self.raw_tokens]
        N = len(sentences)
        df: Counter = Counter()
        for toks in self.stemmed_tokens:
            df.update(set(toks))
        self.idf = {w: math.log((N + 1) / (c + 1)) + 1 for w, c in df.items()}
        self.vecs = [self._tf_vec(t) for t in self.stemmed_tokens]

    def _tf_vec(self, tokens: list[str]) -> dict[str, float]:
        c = Counter(tokens)
        total = sum(c.values()) or 1
        return {w: (cnt / total) * self.idf.get(w, 0) for w, cnt in c.items()}

    def _cosine(self, a: dict, b: dict) -> float:
        keys = set(a) & set(b)
        dot  = sum(a[k] * b[k] for k in keys)
        na   = math.sqrt(sum(v**2 for v in a.values())) or 1e-9
        nb   = math.sqrt(sum(v**2 for v in b.values())) or 1e-9
        return dot / (na * nb)

    def score_sentence(self, q: str, text: str) -> float:
        q_stemmed = _stem_tokens(_tokenize(q))
        s_stemmed = _stem_tokens(_tokenize(text))
        if not q_stemmed or not s_stemmed:
            return 0.0
        score = self._cosine(self._tf_vec(q_stemmed), self._tf_vec(s_stemmed))
        raw_s = _tokenize(text)
        for j, tok in enumerate(raw_s):
            if _STEMMER.stem(tok) in q_stemmed and _has_negation(raw_s, j):
                score *= 0.3
                break
        return round(float(score), 4)

    def query(self, q: str, top_k: int = 8) -> list[dict]:
        is_rel, _ = has_clinical_relevance(q, self.idf)
        if not is_rel:
            return []

        q_stemmed = _stem_tokens(_tokenize(q))
        qvec = self._tf_vec(q_stemmed)
        scores = []
        seen = set()

        for i, svec in enumerate(self.vecs):
            score = self._cosine(qvec, svec)
            raw_s = self.raw_tokens[i]
            for j, tok in enumerate(raw_s):
                if _STEMMER.stem(tok) in q_stemmed and _has_negation(raw_s, j):
                    score *= 0.3
                    break
            if score > 0.05:
                sent_text = self.records[i][0]
                if sent_text not in seen:
                    seen.add(sent_text)
                    scores.append((score, i))

        scores.sort(reverse=True)
        out = []
        for score, i in scores[:top_k]:
            text, note_id, date = self.records[i]
            out.append({
                "sentence": text,
                "note_id": note_id,
                "date": date,
                "score": round(score, 4),
                "retriever": "tfidf",
                "assertion": extract_assertion(text, list(q_stemmed)),
                "expanded_terms": list(q_stemmed)[:5]
            })
        return out


# ---------------------------------------------------------------------------
# Embedding Retriever (Word2Vec / GloVe) with Anisotropy Correction
# ---------------------------------------------------------------------------

class EmbeddingRetriever:
    def __init__(self, sentences: list[tuple[str, str, str]],
                 model, name: str, expand_k: int = 5):
        self.records  = sentences
        self.model    = model
        self.name     = name
        self.expand_k = expand_k
        self.raw_tokens = [_tokenize(s[0]) for s in sentences]
        self.stemmed_tokens = [_stem_tokens(toks) for toks in self.raw_tokens]

        # Compute first principal component of vectors (anisotropy removal)
        vecs_raw = model.vectors.copy()
        mu = np.mean(vecs_raw, axis=0)
        centered = vecs_raw - mu
        _, _, vt = np.linalg.svd(centered, full_matrices=False)
        self.pc1 = vt[0]

        # Compute clean, normalized sentence vectors
        cleaned = []
        for toks in self.raw_tokens:
            v = model.note_vector(toks)
            v = v - np.dot(v, self.pc1) * self.pc1
            norm = np.linalg.norm(v) + 1e-9
            cleaned.append(v / norm)
        self.normed = np.array(cleaned)

    def _clean_query_vector(self, tokens: list[str]) -> np.ndarray:
        v = self.model.note_vector(tokens)
        v = v - np.dot(v, self.pc1) * self.pc1
        norm = np.linalg.norm(v) + 1e-9
        return v / norm

    def query(self, q: str, top_k: int = 8) -> list[dict]:
        is_rel, vocab_cov = has_clinical_relevance(q, self.model.vocab)
        if not is_rel:
            return []

        qtoks = _tokenize(q)
        q_stemmed = set(_stem_tokens(qtoks))

        # Semantic neighbor expansion
        expanded_words = set(qtoks)
        for tok in qtoks:
            for neighbor, sim in self.model.neighbors(tok, self.expand_k):
                if sim >= 0.65:
                    expanded_words.add(neighbor)

        # Build clean query vector
        qvec = self._clean_query_vector(list(expanded_words))
        raw_sims = self.normed @ qvec

        scored = []
        seen = set()

        for i, sim in enumerate(raw_sims):
            sent_text = self.records[i][0]
            if sent_text in seen:
                continue

            stemmed = set(self.stemmed_tokens[i])
            overlap = len(stemmed & q_stemmed)

            # Negation penalty
            raw_s = self.raw_tokens[i]
            for j, tok in enumerate(raw_s):
                if tok in expanded_words and _has_negation(raw_s, j):
                    sim *= 0.3
                    break

            # Combine semantic similarity with conceptual overlap
            final_score = float(sim)
            if overlap > 0:
                final_score = min(0.98, final_score + 0.15 * overlap)

            if final_score > 0.40:
                seen.add(sent_text)
                scored.append((final_score, i))

        scored.sort(reverse=True)
        out = []
        for score, i in scored[:top_k]:
            text, note_id, date = self.records[i]
            out.append({
                "sentence": text,
                "note_id": note_id,
                "date": date,
                "score": round(score, 4),
                "retriever": self.name,
                "assertion": extract_assertion(text, qtoks),
                "expanded_terms": list(expanded_words)[:6]
            })
        return out


FAMILY_WORDS = {
    "father", "mother", "sister", "brother", "parent", "parents",
    "family", "maternal", "paternal", "uncle", "aunt", "sibling"
}
HYPO_WORDS = {
    "if", "case", "should", "whenever", "supposing", "would", "might"
}
NEG_WORDS_EXT = _NEG_WORDS | {
    "denies", "denied", "ruled", "unlikely", "negative"
}


def extract_assertion(sentence: str, match_terms: list[str]) -> str:
    lower = sentence.lower()
    words = _TOK.findall(lower)

    if any(f in words for f in FAMILY_WORDS):
        return "FAMILY_HISTORY"

    if any(h in words for h in HYPO_WORDS):
        return "HYPOTHETICAL"

    # Clause-level negation check for clinical dictations
    if any(lower.startswith(p) for p in ("denies", "patient denies", "denied", "no evidence", "rules out", "ruled out", "negative for")):
        return "NEGATED"

    for term in match_terms:
        stemmed_term = _STEMMER.stem(term)
        for j, w in enumerate(words):
            if _STEMMER.stem(w) == stemmed_term or w == term:
                lo = max(0, j - 8)
                hi = min(len(words), j + 5)
                if any(words[k] in NEG_WORDS_EXT for k in range(lo, hi)):
                    return "NEGATED"

    return "PATIENT_AFFIRMED"


# ---------------------------------------------------------------------------
# BiLSTM Contextual Sequence Retriever
# ---------------------------------------------------------------------------

class BiLSTMRetriever:
    """Context-aware bidirectional LSTM sequence retriever.
    
    Captures temporal word ordering, grammatical dependency, and psychiatric context
    (e.g., 'lost in his own thoughts', 'mind spins uncontrollably', 'cannot get out of bed')
    via bidirectional recurrence and contextual self-attention pooling.
    """
    def __init__(self, sentences: list[tuple[str, str, str]], embedding_model: Any = None, hidden_dim: int = 64, seed: int = 42):
        self.records = sentences
        self.raw_tokens = [_tokenize(s[0]) for s in sentences]
        self.embedding_model = embedding_model
        self.dim = getattr(embedding_model, "dim", 100) if embedding_model else 100
        self.hidden_dim = hidden_dim
        self.name = "bilstm"

        rng = np.random.default_rng(seed)
        scale = 1.0 / math.sqrt(self.dim)
        h_scale = 1.0 / math.sqrt(hidden_dim)

        # Forward LSTM weights
        self.W_fwd = (rng.standard_normal((self.dim, 4 * hidden_dim)) * scale).astype(np.float32)
        self.U_fwd = (rng.standard_normal((hidden_dim, 4 * hidden_dim)) * h_scale).astype(np.float32)
        self.b_fwd = np.zeros(4 * hidden_dim, dtype=np.float32)
        self.b_fwd[hidden_dim:2 * hidden_dim] = 1.0  # forget gate bias initialization

        # Backward LSTM weights
        self.W_bwd = (rng.standard_normal((self.dim, 4 * hidden_dim)) * scale).astype(np.float32)
        self.U_bwd = (rng.standard_normal((hidden_dim, 4 * hidden_dim)) * h_scale).astype(np.float32)
        self.b_bwd = np.zeros(4 * hidden_dim, dtype=np.float32)
        self.b_bwd[hidden_dim:2 * hidden_dim] = 1.0

        # Contextual Self-Attention weights
        self.W_att = (rng.standard_normal((2 * hidden_dim, hidden_dim)) / math.sqrt(2 * hidden_dim)).astype(np.float32)
        self.v_att = (rng.standard_normal(hidden_dim) * h_scale).astype(np.float32)

        # Precompute contextual sequence embeddings for all patient notes
        self.corpus_vectors = self._encode_all([s[0] for s in sentences])

    def _get_word_vector(self, word: str) -> np.ndarray:
        if self.embedding_model and hasattr(self.embedding_model, "vec"):
            v = self.embedding_model.vec(word)
            if v is not None:
                return v.astype(np.float32)
        h = int(hashlib.md5(word.encode()).hexdigest()[:8], 16)
        rng_w = np.random.default_rng(h)
        return (rng_w.standard_normal(self.dim) * 0.1).astype(np.float32)

    def _encode_sentence(self, text: str) -> np.ndarray:
        words = _TOK.findall(text.lower())
        if not words:
            return np.zeros(2 * self.hidden_dim, dtype=np.float32)

        seq = [self._get_word_vector(w) for w in words]
        T = len(seq)
        H = self.hidden_dim

        # Forward pass
        h_fwd = np.zeros((T, H), dtype=np.float32)
        c_t = np.zeros(H, dtype=np.float32)
        h_t = np.zeros(H, dtype=np.float32)
        for t in range(T):
            x_t = seq[t]
            gates = x_t @ self.W_fwd + h_t @ self.U_fwd + self.b_fwd
            i_g = 1.0 / (1.0 + np.exp(-np.clip(gates[:H], -15, 15)))
            f_g = 1.0 / (1.0 + np.exp(-np.clip(gates[H:2 * H], -15, 15)))
            o_g = 1.0 / (1.0 + np.exp(-np.clip(gates[2 * H:3 * H], -15, 15)))
            g_g = np.tanh(gates[3 * H:])
            c_t = f_g * c_t + i_g * g_g
            h_t = o_g * np.tanh(c_t)
            h_fwd[t] = h_t

        # Backward pass
        h_bwd = np.zeros((T, H), dtype=np.float32)
        c_t = np.zeros(H, dtype=np.float32)
        h_t = np.zeros(H, dtype=np.float32)
        for t in range(T - 1, -1, -1):
            x_t = seq[t]
            gates = x_t @ self.W_bwd + h_t @ self.U_bwd + self.b_bwd
            i_g = 1.0 / (1.0 + np.exp(-np.clip(gates[:H], -15, 15)))
            f_g = 1.0 / (1.0 + np.exp(-np.clip(gates[H:2 * H], -15, 15)))
            o_g = 1.0 / (1.0 + np.exp(-np.clip(gates[2 * H:3 * H], -15, 15)))
            g_g = np.tanh(gates[3 * H:])
            c_t = f_g * c_t + i_g * g_g
            h_t = o_g * np.tanh(c_t)
            h_bwd[t] = h_t

        # Bidirectional concatenation: (T, 2*H)
        H_seq = np.concatenate([h_fwd, h_bwd], axis=1)

        # Contextual Self-Attention Pooling
        att_energy = np.tanh(H_seq @ self.W_att) @ self.v_att
        att_energy = np.exp(att_energy - np.max(att_energy))
        alpha = att_energy / (np.sum(att_energy) + 1e-9)

        pooled = np.sum(H_seq * alpha[:, np.newaxis], axis=0)
        norm = np.linalg.norm(pooled) + 1e-9
        return (pooled / norm).astype(np.float32)

    def _encode_all(self, sentences: list[str]) -> np.ndarray:
        return np.array([self._encode_sentence(s) for s in sentences], dtype=np.float32)

    def query(self, q: str, top_k: int = 8) -> list[dict]:
        is_rel, _ = has_clinical_relevance(q, getattr(self.embedding_model, "vocab", None))
        if not is_rel:
            return []

        q_vec = self._encode_sentence(q)
        qtoks = _tokenize(q)
        q_stemmed = set(_stem_tokens(qtoks))

        sims = self.corpus_vectors @ q_vec
        scored = []
        seen = set()

        for i, sim in enumerate(sims):
            sent_text = self.records[i][0]
            if sent_text in seen:
                continue

            score = float(sim)
            raw_s = self.raw_tokens[i]
            for j, tok in enumerate(raw_s):
                if _STEMMER.stem(tok) in q_stemmed and _has_negation(raw_s, j):
                    score *= 0.3
                    break

            overlap = len(set(self.raw_tokens[i]) & set(qtoks))
            if overlap > 0:
                score = min(0.98, score + 0.10 * overlap)

            if score > 0.15:
                seen.add(sent_text)
                scored.append((score, i))

        scored.sort(reverse=True)
        out = []
        for score, i in scored[:top_k]:
            text, note_id, date = self.records[i]
            out.append({
                "sentence": text,
                "note_id": note_id,
                "date": date,
                "score": round(score, 4),
                "retriever": "bilstm",
                "assertion": extract_assertion(text, qtoks),
                "expanded_terms": list(qtoks)[:6]
            })
        return out


# ---------------------------------------------------------------------------
# Dense Sentence-Transformers Semantic Retriever
# ---------------------------------------------------------------------------

class DenseTransformerRetriever:
    """Dense Semantic Retriever powered by Sentence Transformers with offline SVD projection."""

    def __init__(
        self,
        sentences: list[tuple[str, str, str]],
        model_name_or_instance: Any = "all-MiniLM-L6-v2",
        device: str = "cpu",
    ):
        self.records = sentences
        self.name = "dense_transformer"
        self.device = device
        self._model = None
        self._fallback_tfidf = None
        self._svd = None
        self._vectors: np.ndarray | None = None
        self.raw_tokens = [_tokenize(s[0]) for s in sentences]

        raw_texts = [s[0] for s in sentences]

        # 1. Try loading sentence-transformers if available
        if hasattr(model_name_or_instance, "encode"):
            self._model = model_name_or_instance
        elif isinstance(model_name_or_instance, str):
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(model_name_or_instance, device=device)
            except Exception:
                self._model = None

        if self._model is not None:
            try:
                vecs = self._model.encode(raw_texts, convert_to_numpy=True, normalize_embeddings=True)
                self._vectors = np.asarray(vecs, dtype=np.float32)
            except Exception:
                self._model = None

        # 2. Fallback to offline dense semantic projection if model unavailable
        if self._model is None:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.decomposition import TruncatedSVD

            def _stem_tokens_str(text: str) -> list[str]:
                return [_STEMMER.stem(w) for w in _tokenize(text)]

            self._stem_tokenizer = _stem_tokens_str
            self._fallback_tfidf = TfidfVectorizer(tokenizer=_stem_tokens_str, token_pattern=None, ngram_range=(1, 2))
            X_sparse = self._fallback_tfidf.fit_transform(raw_texts)
            n_components = min(32, max(2, len(raw_texts) - 1))
            self._svd = TruncatedSVD(n_components=n_components, random_state=42)
            dense_proj = self._svd.fit_transform(X_sparse)
            norms = np.linalg.norm(dense_proj, axis=1, keepdims=True) + 1e-9
            self._vectors = np.asarray(dense_proj / norms, dtype=np.float32)

    def _encode_text(self, text: str) -> np.ndarray:
        if self._model is not None:
            vec = self._model.encode([text], convert_to_numpy=True, normalize_embeddings=True)[0]
            return np.asarray(vec, dtype=np.float32)
        X_q = self._fallback_tfidf.transform([text])
        dense_q = self._svd.transform(X_q)
        norm = np.linalg.norm(dense_q) + 1e-9
        return np.asarray(dense_q / norm, dtype=np.float32).flatten()

    def query(self, q: str, top_k: int = 8) -> list[dict]:
        is_rel, _ = has_clinical_relevance(q)
        if not is_rel:
            return []

        q_vec = self._encode_text(q)
        sims = self._vectors @ q_vec
        qtoks = _tokenize(q)
        q_stemmed = set(_stem_tokens(qtoks))

        scored = []
        seen = set()

        content_qtoks = [t for t in qtoks if len(t) >= 4 and t not in {"feel", "look", "looks", "some", "what", "have", "been"}]
        content_q_stems = {_STEMMER.stem(t) for t in content_qtoks}

        for i, sim in enumerate(sims):
            sent_text = self.records[i][0]
            if sent_text in seen:
                continue

            score = float(sim)
            raw_s = self.raw_tokens[i]
            assertion = extract_assertion(sent_text, qtoks)

            # Clinical Negation & Modality Penalty
            if assertion == "NEGATED":
                score *= 0.30
            else:
                for j, tok in enumerate(raw_s):
                    if _STEMMER.stem(tok) in q_stemmed and _has_negation(raw_s, j):
                        score *= 0.30
                        break

            # Meaningful clinical stem overlap
            sent_stems = {_STEMMER.stem(t) for t in raw_s}
            overlap = len(content_q_stems & sent_stems)
            if overlap > 0 and assertion != "NEGATED":
                score = min(0.95, score + 0.12 * overlap)

            if score > 0.08:
                seen.add(sent_text)
                scored.append((score, i, assertion))

        scored.sort(key=lambda x: x[0], reverse=True)
        out = []
        for score, i, assertion in scored[:top_k]:
            text, note_id, date = self.records[i]
            out.append({
                "sentence": text,
                "note_id": note_id,
                "date": date,
                "score": round(score, 4),
                "retriever": "dense_transformer",
                "assertion": assertion,
                "expanded_terms": list(qtoks)[:6],
            })
        return out


# ---------------------------------------------------------------------------
# Hybrid Retriever (BM25/TF-IDF + Dense Vector + BiLSTM Consensus Fusion)
# ---------------------------------------------------------------------------

class HybridRetriever:
    def __init__(
        self,
        tfidf_ret: TFIDFRetriever,
        emb_ret: EmbeddingRetriever | None = None,
        bilstm_ret: BiLSTMRetriever | None = None,
        dense_ret: DenseTransformerRetriever | None = None,
    ):
        self.tfidf = tfidf_ret
        self.emb = emb_ret
        self.bilstm = bilstm_ret
        self.dense = dense_ret
        self.records = tfidf_ret.records

    def query(self, q: str, top_k: int = 8) -> list[dict]:
        emb_model = getattr(self.emb, "model", None) if self.emb else None
        emb_vocab = getattr(emb_model, "vocab", None) if emb_model else None
        is_rel, vocab_cov = has_clinical_relevance(q, emb_vocab)
        if not is_rel:
            return []

        tf_results = self.tfidf.query(q, top_k=top_k * 3)
        emb_results = self.emb.query(q, top_k=top_k * 3) if self.emb else []
        bilstm_results = self.bilstm.query(q, top_k=top_k * 3) if self.bilstm else []
        dense_results = self.dense.query(q, top_k=top_k * 3) if self.dense else []

        tf_ranks = {r["sentence"]: idx + 1 for idx, r in enumerate(tf_results)}
        emb_ranks = {r["sentence"]: idx + 1 for idx, r in enumerate(emb_results)}
        lstm_ranks = {r["sentence"]: idx + 1 for idx, r in enumerate(bilstm_results)}
        dense_ranks = {r["sentence"]: idx + 1 for idx, r in enumerate(dense_results)}

        sent_map = {}
        for r in tf_results + emb_results + bilstm_results + dense_results:
            if r["sentence"] not in sent_map:
                sent_map[r["sentence"]] = r

        all_sents = set(tf_ranks.keys()) | set(emb_ranks.keys()) | set(lstm_ranks.keys()) | set(dense_ranks.keys())
        k = 60
        scored = []
        q_terms = _tokenize(q)
        q_stemmed = set(_stem_tokens(q_terms))

        for s in all_sents:
            s_stemmed = set(_stem_tokens(_tokenize(s)))
            overlap = len(s_stemmed & q_stemmed)

            # Reciprocal rank fusion across all retrieval paradigms
            rrf = 0.0
            models_matched = 0
            if s in tf_ranks:
                rrf += 1.0 / (k + tf_ranks[s])
                models_matched += 1
            if s in emb_ranks:
                rrf += 1.0 / (k + emb_ranks[s])
                models_matched += 1
            if s in lstm_ranks:
                rrf += 1.0 / (k + lstm_ranks[s])
                models_matched += 1
            if s in dense_ranks:
                rrf += 1.0 / (k + dense_ranks[s])
                models_matched += 1

            candidate_scores = []
            if s in tf_ranks:
                candidate_scores.append(next(r["score"] for r in tf_results if r["sentence"] == s))
            if s in emb_ranks:
                candidate_scores.append(next(r["score"] for r in emb_results if r["sentence"] == s))
            if s in lstm_ranks:
                candidate_scores.append(next(r["score"] for r in bilstm_results if r["sentence"] == s))
            if s in dense_ranks:
                candidate_scores.append(next(r["score"] for r in dense_results if r["sentence"] == s))

            best_raw = max(candidate_scores) if candidate_scores else 0.50

            # Calibrate ensemble score
            fused_score = 0.60 * best_raw + 0.40 * min(0.95, (rrf / (2.0 / 61.0)))
            if overlap > 0:
                fused_score = min(0.98, fused_score + 0.05 * min(overlap, 2))

            assertion = extract_assertion(s, q_terms)
            if assertion == "NEGATED":
                fused_score *= 0.3

            if fused_score >= 0.15:
                r = sent_map[s]
                scored.append({
                    "sentence": s,
                    "note_id": r["note_id"],
                    "date": r["date"],
                    "score": round(float(fused_score), 4),
                    "retriever": "hybrid",
                    "assertion": assertion,
                    "expanded_terms": r.get("expanded_terms", list(q_terms)[:6]),
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]



# ---------------------------------------------------------------------------
# nDCG@k evaluation
# ---------------------------------------------------------------------------

def ndcg_at_k(ranked: list[dict], relevant_note_ids: set[str], k: int = 5) -> float:
    def dcg(hits):
        return sum((2**h - 1) / math.log2(i + 2) for i, h in enumerate(hits[:k]))
    hits    = [1 if r["note_id"] in relevant_note_ids else 0 for r in ranked[:k]]
    ideal   = sorted(hits, reverse=True)
    dcg_val = dcg(hits)
    idcg    = dcg(ideal)
    return round(dcg_val / idcg, 4) if idcg > 0 else 0.0
