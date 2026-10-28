"""Small SQLite store for source documents, indexed passages, and embeddings."""
from __future__ import annotations

import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


_SCHEMA_VERSION = 1


class DocumentStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, _SCHEMA_VERSION):
                raise RuntimeError(f"Unsupported document database schema version: {version}")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    document_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    media_type TEXT NOT NULL,
                    extracted_text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    embedding_model TEXT NOT NULL,
                    is_synthetic INTEGER NOT NULL DEFAULT 0 CHECK (is_synthetic IN (0, 1))
                );
                CREATE TABLE IF NOT EXISTS passages (
                    passage_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
                    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
                    page INTEGER,
                    text TEXT NOT NULL,
                    embedding BLOB,
                    embedding_dim INTEGER,
                    UNIQUE (document_id, ordinal),
                    CHECK ((embedding IS NULL AND embedding_dim IS NULL) OR
                           (embedding IS NOT NULL AND embedding_dim > 0))
                );
                CREATE INDEX IF NOT EXISTS passages_document_id ON passages(document_id);
                """
            )
            connection.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @staticmethod
    def _validate_vector(embedding: bytes | None, dimension: int | None) -> None:
        if embedding is None and dimension is None:
            return
        if not isinstance(embedding, bytes) or not isinstance(dimension, int) or dimension <= 0:
            raise ValueError("Embedding bytes and a positive embedding dimension are required")
        if len(embedding) != dimension * 4:
            raise ValueError("Embedding byte length does not match its dimension")

    def add_document(
        self,
        filename: str,
        media_type: str,
        extracted_text: str,
        passages: list[dict[str, Any]],
        embedding_model: str,
        is_synthetic: bool = False,
    ) -> str:
        document_id = uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat()
        for passage in passages:
            self._validate_vector(passage.get("embedding"), passage.get("embedding_dim"))

        connection = self._connect()
        try:
            with connection:
                connection.execute(
                    """INSERT INTO documents
                       (document_id, filename, media_type, extracted_text, created_at, embedding_model, is_synthetic)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (document_id, filename, media_type, extracted_text, created_at,
                     embedding_model, int(is_synthetic)),
                )
                for passage in passages:
                    ordinal = passage["ordinal"]
                    passage_id = f"{document_id}:{ordinal}"
                    connection.execute(
                        """INSERT INTO passages
                           (passage_id, document_id, ordinal, page, text, embedding, embedding_dim)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (passage_id, document_id, ordinal, passage.get("page"), passage["text"],
                         passage.get("embedding"), passage.get("embedding_dim")),
                    )
        finally:
            connection.close()
        return document_id

    def list_documents(self) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            rows = connection.execute(
                """SELECT d.document_id, d.filename, d.media_type, d.created_at,
                          d.embedding_model, d.is_synthetic, COUNT(p.passage_id) AS passage_count
                   FROM documents d LEFT JOIN passages p USING (document_id)
                   GROUP BY d.document_id ORDER BY d.created_at, d.document_id"""
            ).fetchall()
            return [dict(row) | {"is_synthetic": bool(row["is_synthetic"])} for row in rows]
        finally:
            connection.close()

    def get_passages(self, document_id: str | None = None) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            query = """SELECT p.passage_id, p.document_id, d.filename, d.media_type,
                              d.embedding_model, d.is_synthetic, p.ordinal, p.page, p.text,
                              p.embedding, p.embedding_dim
                       FROM passages p JOIN documents d USING (document_id)"""
            params: tuple[Any, ...] = ()
            if document_id is not None:
                query += " WHERE p.document_id = ?"
                params = (document_id,)
            query += " ORDER BY d.created_at, p.ordinal"
            passages = [dict(row) for row in connection.execute(query, params).fetchall()]
            for passage in passages:
                passage["is_synthetic"] = bool(passage["is_synthetic"])
                self._validate_vector(passage["embedding"], passage["embedding_dim"])
            return passages
        finally:
            connection.close()

    def delete_document(self, document_id: str) -> bool:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "DELETE FROM documents WHERE document_id = ?", (document_id,)
                )
                return cursor.rowcount > 0
        finally:
            connection.close()

    def close(self) -> None:
        """Provided for predictable caller cleanup; this store keeps no open connection."""
