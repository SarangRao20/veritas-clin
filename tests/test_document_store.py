import sqlite3

import pytest

from veritas_clin.document_store import DocumentStore


def test_documents_and_passages_survive_store_reopen(tmp_path):
    db_path = tmp_path / "docs.sqlite3"
    store = DocumentStore(db_path)
    document_id = store.add_document(
        "report.txt", "text/plain", "Example report text.",
        [{"text": "Patient reports fatigue.", "ordinal": 0, "page": None}],
        embedding_model="test-embedder",
    )
    store.close()

    reopened = DocumentStore(db_path)
    documents = reopened.list_documents()
    passages = reopened.get_passages(document_id)
    assert documents[0]["document_id"] == document_id
    assert documents[0]["is_synthetic"] is False
    assert passages[0]["text"] == "Patient reports fatigue."
    assert passages[0]["document_id"] == document_id
    reopened.close()


def test_document_store_scopes_and_cascades_passages(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    first_id = store.add_document(
        "one.txt", "text/plain", "one", [{"text": "one passage", "ordinal": 0}], "test"
    )
    second_id = store.add_document(
        "two.txt", "text/plain", "two", [{"text": "two passage", "ordinal": 0}], "test"
    )

    assert [p["text"] for p in store.get_passages(first_id)] == ["one passage"]
    assert len(store.get_passages()) == 2
    assert store.delete_document(first_id) is True
    assert store.delete_document(first_id) is False
    assert [p["text"] for p in store.get_passages()] == ["two passage"]
    assert [d["document_id"] for d in store.list_documents()] == [second_id]
    store.close()


def test_add_document_rolls_back_on_duplicate_passage_ordinal(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    with pytest.raises(sqlite3.IntegrityError):
        store.add_document(
            "broken.txt", "text/plain", "body", [
                {"text": "first", "ordinal": 0},
                {"text": "duplicate ordinal", "ordinal": 0},
            ], "test"
        )

    assert store.list_documents() == []
    assert store.get_passages() == []
    store.close()


def test_embedding_dimensions_are_validated_on_read(tmp_path):
    db_path = tmp_path / "docs.sqlite3"
    store = DocumentStore(db_path)
    document_id = store.add_document(
        "report.txt", "text/plain", "body", [{
            "text": "Evidence passage", "ordinal": 0, "embedding": b"\x00\x00\x80?",
            "embedding_dim": 1,
        }], "test-embedder"
    )
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE passages SET embedding_dim = 2 WHERE document_id = ?", (document_id,)
        )

    with pytest.raises(ValueError, match="(?i)embedding"):
        store.get_passages(document_id)
    store.close()


def test_synthetic_documents_are_marked_in_listing(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    document_id = store.add_document(
        "sample.txt", "text/plain", "synthetic text",
        [{"text": "Synthetic evidence passage", "ordinal": 0}], "test",
        is_synthetic=True,
    )

    assert next(d for d in store.list_documents() if d["document_id"] == document_id)["is_synthetic"] is True
    store.close()
