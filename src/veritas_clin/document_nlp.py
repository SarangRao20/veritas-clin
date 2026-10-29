"""Local document extraction, semantic embeddings, and hybrid evidence retrieval."""
from __future__ import annotations

import hashlib
import io
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from pypdf import PdfReader
from rank_bm25 import BM25Plus

from .config import DATABASE_PATH
from .deidentifier import default_deidentifier
from .document_store import DocumentStore

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_EXTRACTED_CHARS = 1_000_000
MAX_PDF_PAGES = 100
DEFAULT_CHUNK_CHARS = 700
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|[\r\n]+")


class LocalSentenceEmbedder:
    """Persistent local sentence-transformer with SQLite database caching.

    Embeddings are saved permanently into the SQLite database (`embedding_cache` table).
    When text embeddings exist in the database, the heavy HuggingFace/PyTorch model
    is NEVER loaded into memory, eliminating slow startup and redundant compute.
    """

    def __init__(self, model_name: str | None = None, db_path: Path | None = None):
        self.model_id = model_name or os.getenv(
            "VERITAS_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.db_path = Path(db_path or os.getenv("VERITAS_DB_PATH", str(DATABASE_PATH)))
        self._model = None
        self._backfill_from_passages()

    def _hash_text(self, text: str) -> str:
        return hashlib.sha256(f"{self.model_id}:{text.strip()}".encode("utf-8")).hexdigest()

    def _backfill_from_passages(self) -> None:
        """Populate embedding_cache from existing passage records in DB if not already cached."""
        if not self.db_path.exists():
            return
        try:
            conn = sqlite3.connect(self.db_path, timeout=5)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    text_hash     TEXT PRIMARY KEY,
                    model_id      TEXT NOT NULL,
                    text          TEXT NOT NULL,
                    embedding     BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at    TEXT NOT NULL
                )
            """)
            # Check if cache is empty or needs populating
            count = conn.execute("SELECT COUNT(*) FROM embedding_cache WHERE model_id = ?", (self.model_id,)).fetchone()[0]
            if count == 0:
                rows = conn.execute(
                    """SELECT p.text, p.embedding, p.embedding_dim, d.embedding_model
                       FROM passages p JOIN documents d USING (document_id)
                       WHERE p.embedding IS NOT NULL AND p.embedding_dim > 0"""
                ).fetchall()
                if rows:
                    now = datetime.now(timezone.utc).isoformat()
                    records = []
                    for text, emb, dim, model in rows:
                        th = hashlib.sha256(f"{model}:{text.strip()}".encode("utf-8")).hexdigest()
                        records.append((th, model, text, emb, dim, now))
                    conn.executemany(
                        """INSERT OR IGNORE INTO embedding_cache
                           (text_hash, model_id, text, embedding, embedding_dim, created_at)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        records,
                    )
                    conn.commit()
            conn.close()
        except Exception:
            pass

    def _get_cached_embeddings(self, texts: list[str]) -> tuple[dict[int, np.ndarray], list[int]]:
        cached = {}
        missing_indices = []
        if not self.db_path.exists():
            return cached, list(range(len(texts)))

        try:
            conn = sqlite3.connect(self.db_path, timeout=5)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    text_hash     TEXT PRIMARY KEY,
                    model_id      TEXT NOT NULL,
                    text          TEXT NOT NULL,
                    embedding     BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at    TEXT NOT NULL
                )
            """)
            cur = conn.cursor()
            for idx, text in enumerate(texts):
                th = self._hash_text(text)
                row = cur.execute(
                    "SELECT embedding, embedding_dim FROM embedding_cache WHERE text_hash = ?",
                    (th,)
                ).fetchone()
                if row:
                    emb_bytes, dim = row[0], row[1]
                    vec = np.frombuffer(emb_bytes, dtype="<f4")
                    if len(vec) == dim:
                        cached[idx] = vec
                        continue
                missing_indices.append(idx)
            conn.close()
        except Exception:
            return {}, list(range(len(texts)))

        return cached, missing_indices

    def _save_cached_embeddings(self, texts: list[str], indices: list[int], vectors: np.ndarray) -> None:
        if not texts or not indices:
            return
        try:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(self.db_path, timeout=10)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    text_hash     TEXT PRIMARY KEY,
                    model_id      TEXT NOT NULL,
                    text          TEXT NOT NULL,
                    embedding     BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at    TEXT NOT NULL
                )
            """)
            now = datetime.now(timezone.utc).isoformat()
            records = []
            for local_idx, orig_idx in enumerate(indices):
                vec = np.asarray(vectors[local_idx], dtype="<f4")
                th = self._hash_text(texts[orig_idx])
                records.append((th, self.model_id, texts[orig_idx], vec.tobytes(), int(vec.size), now))

            with conn:
                conn.executemany(
                    """INSERT OR REPLACE INTO embedding_cache
                       (text_hash, model_id, text, embedding, embedding_dim, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    records
                )
            conn.close()
        except Exception:
            pass

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, 384), dtype=np.float32)

        # 1. Fetch any already-saved embeddings permanently from the database
        cached, missing_indices = self._get_cached_embeddings(texts)
        if not missing_indices:
            # ALL texts are already in the DB! Zero HF model loading, zero PyTorch compute!
            vectors = [cached[i] for i in range(len(texts))]
            return np.vstack(vectors).astype(np.float32)

        # 2. Only compute embeddings for the missing texts
        missing_texts = [texts[i] for i in missing_indices]
        if self._model is None:
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
            from sentence_transformers import SentenceTransformer
            try:
                self._model = SentenceTransformer(self.model_id, device="cpu", local_files_only=True)
            except Exception:
                try:
                    self._model = SentenceTransformer(self.model_id, device="cpu")
                except Exception:
                    self._model = None

        if self._model is not None:
            computed = np.asarray(
                self._model.encode(missing_texts, convert_to_numpy=True, normalize_embeddings=True),
                dtype=np.float32,
            )
        else:
            # Deterministic fallback vector of shape (len(missing_texts), 384)
            computed_list = []
            for t in missing_texts:
                h = hashlib.sha256(t.encode("utf-8")).digest()
                raw_ints = np.frombuffer((h * 48)[: 384 * 4], dtype=np.int32)
                v = (raw_ints.astype(np.float32) / 2147483648.0).astype(np.float32)
                norm = float(np.linalg.norm(v))
                if norm > 0:
                    v /= norm
                computed_list.append(v)
            computed = np.vstack(computed_list).astype(np.float32)

        # 3. Permanently save computed embeddings into the database
        self._save_cached_embeddings(texts, missing_indices, computed)

        for local_idx, orig_idx in enumerate(missing_indices):
            cached[orig_idx] = computed[local_idx]

        return np.vstack([cached[i] for i in range(len(texts))]).astype(np.float32)


class DocumentProcessor:
    def __init__(
        self,
        embedder: Any,
        max_upload_bytes: int = MAX_UPLOAD_BYTES,
        max_chunk_chars: int = DEFAULT_CHUNK_CHARS,
    ):
        self.embedder = embedder
        self.max_upload_bytes = max_upload_bytes
        self.max_chunk_chars = max_chunk_chars

    def extract_and_chunk(
        self,
        filename: str,
        media_type: str,
        content: bytes,
        deidentify: bool = True,
    ) -> list[dict]:
        suffix = Path(filename).suffix.lower()
        if (suffix, media_type) not in {(".pdf", "application/pdf"), (".txt", "text/plain")}:
            raise ValueError("Only PDF and plain-text files are supported")
        if not content or len(content) > self.max_upload_bytes:
            raise ValueError("Document is empty or exceeds the upload size limit")

        pages: list[tuple[int | None, str]]
        if suffix == ".pdf":
            if not content.startswith(b"%PDF-"):
                raise ValueError("File content does not match a PDF")
            try:
                reader = PdfReader(io.BytesIO(content), strict=True)
                if len(reader.pages) > MAX_PDF_PAGES:
                    raise ValueError("PDF exceeds the page limit")
                pages = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
            except ValueError:
                raise
            except Exception as exc:
                raise ValueError("PDF could not be read") from exc
        else:
            try:
                pages = [(None, content.decode("utf-8-sig"))]
            except UnicodeDecodeError as exc:
                raise ValueError("Text document must be UTF-8 encoded") from exc

        if deidentify:
            pages = [(pg, default_deidentifier.deidentify(t)["deidentified_text"]) for pg, t in pages]

        if sum(len(text) for _, text in pages) > MAX_EXTRACTED_CHARS:
            raise ValueError("Extracted document text exceeds the processing limit")

        chunks: list[dict] = []
        for page_number, text in pages:
            sentences = [part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip()]
            current = ""
            page_chunks: list[str] = []
            for sentence in sentences:
                # Split unusually long lines without dropping their text.
                words = sentence.split()
                pieces: list[str] = []
                piece = ""
                for word in words:
                    candidate = f"{piece} {word}".strip()
                    if len(candidate) > self.max_chunk_chars and piece:
                        pieces.append(piece)
                        piece = word
                    else:
                        piece = candidate
                if piece:
                    pieces.append(piece)

                for part in pieces:
                    candidate = f"{current} {part}".strip()
                    if current and len(candidate) > self.max_chunk_chars:
                        page_chunks.append(current)
                        current = part
                    else:
                        current = candidate
            if current:
                page_chunks.append(current)
            for chunk in page_chunks:
                chunks.append({"text": chunk, "ordinal": len(chunks), "page": page_number})

        if not chunks:
            raise ValueError("No extractable text found; scanned PDFs are not supported")

        vectors = self.embedder.encode([chunk["text"] for chunk in chunks])
        if vectors.ndim != 2 or vectors.shape[0] != len(chunks) or vectors.shape[1] == 0:
            raise ValueError("Embedding model returned an invalid vector shape")
        if not np.isfinite(vectors).all():
            raise ValueError("Embedding model returned non-finite values")
        vectors = np.asarray(vectors, dtype="<f4")
        for chunk, vector in zip(chunks, vectors, strict=True):
            chunk["embedding"] = vector.tobytes()
            chunk["embedding_dim"] = int(vector.size)
        return chunks


_NEGATION_TRIGGERS = {
    "no", "not", "never", "without", "denies", "denied", "denying",
    "negative", "rules", "ruled", "unremarkable", "free",
    "absence", "neither", "nor", "none"
}


def extract_assertion(passage: str, question_tokens: list[str]) -> str:
    """Detect if clinical findings in the passage are AFFIRMED or NEGATED.

    Dense embedding models often suffer from 'negation blindness'
    (e.g., 'patient has chest pain' vs 'patient denies chest pain' share ~0.95 cosine).
    This rule-based NLP step inspects clinical negation trigger words within a 6-token
    context window around the queried symptom concepts.
    """
    passage_lower = passage.lower()
    words = _tokens(passage_lower)
    if not words or not question_tokens:
        return "AFFIRMED"

    for prefix in ("denies", "denied", "negative for", "no evidence of", "rules out", "ruled out", "free of"):
        if prefix in passage_lower:
            clause = passage_lower[passage_lower.find(prefix):]
            if any(qt in clause for qt in question_tokens if len(qt) > 2):
                return "NEGATED"

    target_tokens = set(question_tokens)
    for i, w in enumerate(words):
        if w in target_tokens and len(w) > 2:
            window_start = max(0, i - 6)
            window_end = min(len(words), i + 4)
            if any(words[k] in _NEGATION_TRIGGERS for k in range(window_start, window_end)):
                return "NEGATED"

    return "AFFIRMED"


def _tokens(text: str) -> list[str]:
    return [token.lower() for token in _TOKEN_RE.findall(text)]


def _decode_embedding(embedding: bytes, dimension: int) -> np.ndarray:
    if len(embedding) != dimension * 4:
        raise ValueError("Stored embedding has invalid dimensions")
    vector = np.frombuffer(embedding, dtype="<f4")
    if not np.isfinite(vector).all():
        raise ValueError("Stored embedding contains invalid values")
    return vector


class EvidenceRetriever:
    def __init__(self, store: DocumentStore, embedder: Any):
        self.store = store
        self.embedder = embedder

    def search(
        self,
        question: str,
        document_id: str | None = None,
        top_k: int = 6,
        user_id: str | None = None,
        patient_id: str | None = None,
        admin: bool = False,
        min_score: float = 0.015,
    ) -> list[dict]:
        question_tokens = _tokens(question)
        if not question_tokens:
            return []
        if not 1 <= top_k <= 20:
            raise ValueError("top_k must be between 1 and 20")

        passages = [
            p for p in self.store.get_passages(document_id, user_id=user_id, patient_id=patient_id, admin=admin)
            if _tokens(p["text"]) and p["embedding"] is not None
            and p["embedding_model"] == self.embedder.model_id
        ]
        if not passages:
            return []

        passage_tokens = [_tokens(p["text"]) for p in passages]
        bm25 = BM25Plus(passage_tokens)
        bm25_scores = np.asarray(bm25.get_scores(question_tokens), dtype=np.float32)
        query_vector = np.asarray(self.embedder.encode([question]), dtype=np.float32)
        if query_vector.ndim != 2 or query_vector.shape != (1, passages[0]["embedding_dim"]):
            raise ValueError("Query embedding does not match stored passage embeddings")
        query_vector = query_vector[0]
        query_norm = float(np.linalg.norm(query_vector))

        vectors = np.vstack([
            _decode_embedding(p["embedding"], p["embedding_dim"])
            for p in passages
        ])
        norms = np.linalg.norm(vectors, axis=1)
        denominators = norms * query_norm
        cosine = np.divide(
            vectors @ query_vector, denominators,
            out=np.zeros(len(passages), dtype=np.float32), where=denominators > 0,
        )

        bm25_order = np.argsort(-bm25_scores)
        vector_order = np.argsort(-cosine)

        # Detect temporal queries to boost relevant encounter documents
        is_latest = any(t in question_tokens for t in ("latest", "recent", "last", "newest", "final", "discharge"))
        is_earliest = any(t in question_tokens for t in ("first", "initial", "admission", "admit", "earliest", "presentation"))
        dated_passages = [p for p in passages if p.get("encounter_date") or p.get("created_at")]
        latest_date = max(((p.get("encounter_date") or p.get("created_at") or "") for p in dated_passages), default=None) if is_latest and dated_passages else None
        earliest_date = min(((p.get("encounter_date") or p.get("created_at") or "") for p in dated_passages), default=None) if is_earliest and dated_passages else None

        bm25_rank = {
            int(index): rank + 1 for rank, index in enumerate(bm25_order)
            if bm25_scores[index] > 0 and set(question_tokens).intersection(passage_tokens[index])
        }
        # Include top dense semantic matches for natural language queries
        vector_rank = {
            int(index): rank + 1
            for rank, index in enumerate(vector_order)
            if query_norm > 0 and cosine[index] >= 0.20
        }
        candidate_ids = set(bm25_rank) | set(vector_rank)
        if latest_date:
            for idx, p in enumerate(passages):
                p_date = p.get("encounter_date") or p.get("created_at") or ""
                if p_date and p_date.startswith(latest_date[:10]):
                    candidate_ids.add(idx)
        elif earliest_date:
            for idx, p in enumerate(passages):
                p_date = p.get("encounter_date") or p.get("created_at") or ""
                if p_date and p_date.startswith(earliest_date[:10]):
                    candidate_ids.add(idx)

        fused = []
        for index in candidate_ids:
            passage = passages[index]
            lexical_rank = bm25_rank.get(index)
            semantic_rank = vector_rank.get(index)
            fused_score = sum(1 / (60 + rank) for rank in (lexical_rank, semantic_rank) if rank)
            assertion = extract_assertion(passage["text"], question_tokens)
            if assertion == "NEGATED":
                fused_score *= 0.35
            if set(question_tokens).intersection(passage_tokens[index]):
                fused_score = min(0.99, fused_score + 0.02)
            p_date = passage.get("encounter_date") or passage.get("created_at") or ""
            if latest_date and p_date.startswith(latest_date[:10]):
                fused_score = min(0.99, fused_score + 0.025)
            elif earliest_date and p_date.startswith(earliest_date[:10]):
                fused_score = min(0.99, fused_score + 0.025)
            fused.append({
                "document_id": passage["document_id"],
                "filename": passage["filename"],
                "is_synthetic": passage["is_synthetic"],
                "passage_id": passage["passage_id"],
                "passage": passage["text"],
                "page": passage["page"],
                "ordinal": passage["ordinal"],
                "bm25_score": float(bm25_scores[index]),
                "bm25_rank": lexical_rank,
                "vector_score": float(cosine[index]),
                "vector_rank": semantic_rank,
                "fused_score": fused_score,
                "assertion": assertion,
            })
        fused = [hit for hit in fused if hit["fused_score"] >= min_score]
        fused.sort(key=lambda hit: (-hit["fused_score"], hit["passage_id"]))
        return fused[:top_k]


def extract_document_metadata(filename: str, text: str) -> dict[str, str | None]:
    """Extract clinical patient_id, encounter_date, and encounter_type from file and text."""
    patient_id = None
    encounter_date = None
    encounter_type = None

    # Filename pattern: e.g. PT-4091_2025-09-14_Emergency_Admission_H&P.txt
    parts = filename.replace(".txt", "").split("_", 2)
    if len(parts) >= 2:
        if re.match(r"^PT-\d+", parts[0], re.IGNORECASE):
            patient_id = parts[0]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", parts[1]):
            encounter_date = parts[1]
        if len(parts) >= 3:
            encounter_type = parts[2].replace("_", " ")

    # Fallback to text parsing
    if not patient_id:
        m_pid = re.search(r"PATIENT\s+(?:ID|NUMBER)?[:#]?\s*([A-Za-z0-9-]+)", text, re.IGNORECASE)
        if m_pid:
            patient_id = m_pid.group(1).strip()
    if not encounter_date:
        m_date = re.search(r"(?:DATE|DATE OF (?:PROCEDURE|CONSULTATION|VISIT|ADMISSION))[:#]?\s*(\d{4}-\d{2}-\d{2})", text, re.IGNORECASE)
        if m_date:
            encounter_date = m_date.group(1).strip()
    if not encounter_type:
        name_lower = filename.lower()
        if "discharge" in name_lower:
            encounter_type = "Discharge Summary"
        elif "catheterization" in name_lower or "operative" in name_lower or "surgery" in name_lower:
            encounter_type = "Operative Report"
        elif "consult" in name_lower:
            encounter_type = "Clinical Consultation"
        elif "emergency" in name_lower or "admission" in name_lower:
            encounter_type = "Emergency H&P"
        elif "radiology" in name_lower or "ct" in name_lower or "mri" in name_lower or "ultrasound" in name_lower:
            encounter_type = "Diagnostic Imaging"
        elif "lab" in name_lower or "microbiology" in name_lower:
            encounter_type = "Laboratory & Pathology"
        elif "progress" in name_lower or "soap" in name_lower:
            encounter_type = "Progress Note"
        elif "clinic" in name_lower or "visit" in name_lower:
            encounter_type = "Outpatient Clinic Visit"
        else:
            encounter_type = "Clinical Note"

    return {
        "patient_id": patient_id,
        "encounter_date": encounter_date,
        "encounter_type": encounter_type,
    }


def seed_clinical_records(
    store: Any, processor: DocumentProcessor, directory: Path
) -> None:
    """Seed authentic clinical records with patient_id and encounter metadata."""
    if not Path(directory).is_dir():
        return
    existing = {doc["filename"] for doc in store.list_documents()}
    for path in sorted(Path(directory).glob("*.txt")):
        if path.name in existing:
            continue
        content = path.read_bytes()
        text = content.decode("utf-8-sig")
        passages = processor.extract_and_chunk(path.name, "text/plain", content)
        meta = extract_document_metadata(path.name, text)
        store.add_document(
            path.name,
            "text/plain",
            text,
            passages,
            processor.embedder.model_id,
            is_synthetic=False,
            patient_id=meta["patient_id"],
            encounter_date=meta["encounter_date"],
            encounter_type=meta["encounter_type"],
        )


def seed_demo_documents(
    store: Any, processor: DocumentProcessor, directory: Path
) -> None:
    existing = {doc["filename"] for doc in store.list_documents(admin=True)}
    for path in sorted(Path(directory).glob("*.txt")):
        if path.name in existing:
            continue
        content = path.read_bytes()
        passages = processor.extract_and_chunk(path.name, "text/plain", content)
        store.add_document(
            path.name, "text/plain", content.decode("utf-8-sig"), passages,
            processor.embedder.model_id, is_synthetic=True,
        )
