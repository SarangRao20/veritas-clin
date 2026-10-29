"""SQLite store for source documents, indexed passages, and embeddings.

This is the store-layer version; it delegates connection/schema management to
models.database and adds user_id ownership support.
"""
from __future__ import annotations

import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models.database import connect


class DocumentStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        from ..models.database import init_schema
        init_schema(self.db_path)

    def _connect(self):
        return connect(self.db_path)

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
        user_id: str | None = None,
        patient_id: str | None = None,
        encounter_date: str | None = None,
        encounter_type: str | None = None,
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
                       (document_id, filename, media_type, extracted_text, created_at,
                        embedding_model, is_synthetic, user_id, patient_id, encounter_date, encounter_type)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (document_id, filename, media_type, extracted_text, created_at,
                     embedding_model, int(is_synthetic), user_id, patient_id, encounter_date, encounter_type),
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

    def list_documents(
        self,
        user_id: str | None = None,
        patient_id: str | None = None,
        include_synthetic: bool = True,
        admin: bool = False,
    ) -> list[dict[str, Any]]:
        """Return documents."""
        connection = self._connect()
        try:
            base = """SELECT d.document_id, d.filename, d.media_type, d.created_at,
                             d.embedding_model, d.is_synthetic, d.user_id, d.patient_id,
                             d.encounter_date, d.encounter_type,
                             COUNT(p.passage_id) AS passage_count
                      FROM documents d LEFT JOIN passages p USING (document_id)"""
            params: list = []
            conditions: list[str] = []
            if not admin and user_id is not None:
                conditions.append("(d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)")
                params.append(user_id)
            if patient_id is not None:
                conditions.append("UPPER(d.patient_id) = UPPER(?)")
                params.append(patient_id)
            if not include_synthetic:
                conditions.append("d.is_synthetic = 0")
            if conditions:
                base += " WHERE " + " AND ".join(conditions)
            base += " GROUP BY d.document_id ORDER BY COALESCE(d.encounter_date, d.created_at), d.document_id"
            rows = connection.execute(base, params).fetchall()
            return [dict(row) | {"is_synthetic": bool(row["is_synthetic"])} for row in rows]
        finally:
            connection.close()

    def get_document(
        self, document_id: str, user_id: str | None = None, patient_id: str | None = None, admin: bool = False
    ) -> dict[str, Any] | None:
        connection = self._connect()
        try:
            query = """SELECT d.document_id, d.filename, d.media_type, d.created_at,
                              d.embedding_model, d.is_synthetic, d.extracted_text, d.user_id, d.patient_id,
                              d.encounter_date, d.encounter_type,
                              COUNT(p.passage_id) AS passage_count
                       FROM documents d LEFT JOIN passages p USING (document_id)
                       WHERE d.document_id = ?"""
            params: list = [document_id]
            if not admin and user_id is not None:
                query += " AND (d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)"
                params.append(user_id)
            if patient_id is not None:
                query += " AND d.patient_id = ?"
                params.append(patient_id)
            query += " GROUP BY d.document_id"
            row = connection.execute(query, params).fetchone()
            if row is None:
                return None
            return dict(row) | {"is_synthetic": bool(row["is_synthetic"])}
        finally:
            connection.close()

    def get_passages(
        self,
        document_id: str | None = None,
        user_id: str | None = None,
        patient_id: str | None = None,
        admin: bool = False,
    ) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            query = """SELECT p.passage_id, p.document_id, d.filename, d.media_type,
                              d.embedding_model, d.is_synthetic, d.user_id, d.patient_id,
                              d.encounter_date, d.encounter_type,
                              p.ordinal, p.page, p.text, p.embedding, p.embedding_dim
                       FROM passages p JOIN documents d USING (document_id)"""
            params: list = []
            conditions: list[str] = []
            if document_id is not None:
                conditions.append("p.document_id = ?")
                params.append(document_id)
            if not admin and user_id is not None:
                conditions.append("(d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)")
                params.append(user_id)
            if patient_id is not None:
                conditions.append("UPPER(d.patient_id) = UPPER(?)")
                params.append(patient_id)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY COALESCE(d.encounter_date, d.created_at), p.ordinal"
            passages = [dict(row) for row in connection.execute(query, params).fetchall()]
            for passage in passages:
                passage["is_synthetic"] = bool(passage["is_synthetic"])
                self._validate_vector(passage["embedding"], passage["embedding_dim"])
            return passages
        finally:
            connection.close()

    def owns_document(self, document_id: str, user_id: str) -> bool:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT user_id FROM documents WHERE document_id = ?", (document_id,)
            ).fetchone()
            return row is not None and row["user_id"] == user_id

    def delete_document(self, document_id: str) -> bool:
        connection = self._connect()
        try:
            with connection:
                connection.execute("PRAGMA foreign_keys = ON")
                connection.execute("DELETE FROM passages WHERE document_id = ?", (document_id,))
                cursor = connection.execute(
                    "DELETE FROM documents WHERE document_id = ?", (document_id,)
                )
                return cursor.rowcount > 0
        finally:
            connection.close()

    def close(self) -> None:
        """Provided for predictable caller cleanup; this store keeps no open connection."""
