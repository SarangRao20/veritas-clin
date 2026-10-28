"""Local document extraction, semantic embeddings, and hybrid evidence retrieval."""
from __future__ import annotations

import io
import os
import re
from pathlib import Path
from typing import Any

import numpy as np
from pypdf import PdfReader
from rank_bm25 import BM25Plus

from .document_store import DocumentStore

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_EXTRACTED_CHARS = 1_000_000
MAX_PDF_PAGES = 100
DEFAULT_CHUNK_CHARS = 700
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|[\r\n]+")


class LocalSentenceEmbedder:
    """Lazy local sentence-transformer; model weights are loaded only on first use."""

    def __init__(self, model_name: str | None = None):
        self.model_id = model_name or os.getenv(
            "VERITAS_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self._model = None

    def encode(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_id, device="cpu")
        return np.asarray(
            self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True),
            dtype=np.float32,
        )


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

    def extract_and_chunk(self, filename: str, media_type: str, content: bytes) -> list[dict]:
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
        self, question: str, document_id: str | None = None, top_k: int = 6
    ) -> list[dict]:
        question_tokens = _tokens(question)
        if not question_tokens:
            return []
        if not 1 <= top_k <= 20:
            raise ValueError("top_k must be between 1 and 20")

        passages = [p for p in self.store.get_passages(document_id)
                    if _tokens(p["text"]) and p["embedding"] is not None
                    and p["embedding_model"] == self.embedder.model_id]
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
        bm25_rank = {
            int(index): rank + 1 for rank, index in enumerate(bm25_order)
            if bm25_scores[index] > 0 and set(question_tokens).intersection(passage_tokens[index])
        }
        vector_rank = {int(index): rank + 1 for rank, index in enumerate(vector_order) if cosine[index] >= 0.25}
        candidate_ids = set(bm25_rank) | set(vector_rank)
        fused = []
        for index in candidate_ids:
            passage = passages[index]
            lexical_rank = bm25_rank.get(index)
            semantic_rank = vector_rank.get(index)
            fused_score = sum(1 / (60 + rank) for rank in (lexical_rank, semantic_rank) if rank)
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
            })
        fused.sort(key=lambda hit: (-hit["fused_score"], hit["passage_id"]))
        return fused[:top_k]


def seed_demo_documents(
    store: DocumentStore, processor: DocumentProcessor, directory: Path
) -> None:
    existing = {doc["filename"] for doc in store.list_documents() if doc["is_synthetic"]}
    for path in sorted(Path(directory).glob("*.txt")):
        if path.name in existing:
            continue
        content = path.read_bytes()
        passages = processor.extract_and_chunk(path.name, "text/plain", content)
        store.add_document(
            path.name, "text/plain", content.decode("utf-8-sig"), passages,
            processor.embedder.model_id, is_synthetic=True,
        )
