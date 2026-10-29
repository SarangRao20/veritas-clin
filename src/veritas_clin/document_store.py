"""Small SQLite store for source documents, indexed passages, and embeddings.

Thin compatibility shim reusing the production ``veritas_clin.store.document_store`` implementation.
"""
from __future__ import annotations

from .store.document_store import DocumentStore as DocumentStore

__all__ = ["DocumentStore"]
