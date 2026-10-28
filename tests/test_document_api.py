import numpy as np
import pytest
from fastapi.testclient import TestClient

from veritas_clin.serve import create_app


class FakeEmbedder:
    model_id = "api-test-v1"

    def encode(self, texts):
        return np.asarray([
            [float("sleep" in text.lower() or "insomnia" in text.lower()),
             float("mood" in text.lower())]
            for text in texts
        ], dtype=np.float32)


@pytest.fixture
def app_factory(tmp_path):
    demo_dir = tmp_path / "no-demo-documents"
    demo_dir.mkdir()

    def make_app():
        return create_app(
            db_path=tmp_path / "documents.sqlite3",
            embedder=FakeEmbedder(),
            demo_dir=demo_dir,
        )

    return make_app


@pytest.fixture
def client(app_factory):
    with TestClient(app_factory()) as test_client:
        yield test_client


def test_upload_search_and_citations_are_evidence_grounded(client):
    upload = client.post("/api/documents", files={
        "file": ("report.txt", b"Patient reports insomnia and disrupted sleep.", "text/plain")
    })
    assert upload.status_code == 200
    document = upload.json()

    response = client.post("/api/search", json={"question": "insomnia sleep"})
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "EVIDENCE_FOUND"
    assert result["evidence"][0]["document_id"] == document["document_id"]
    assert result["evidence"][0]["passage_id"]
    assert "[" in result["answer"]
    assert "confidence" not in result


@pytest.mark.parametrize("filename,content_type,content", [
    ("report.exe", "application/octet-stream", b"not allowed"),
    ("fake.pdf", "application/pdf", b"not really a PDF"),
    ("blank.txt", "text/plain", b" \n\t"),
])
def test_upload_rejects_invalid_or_unextractable_documents(client, filename, content_type, content):
    response = client.post("/api/documents", files={"file": (filename, content, content_type)})
    assert response.status_code == 400


def test_upload_rejects_oversized_content(client):
    response = client.post("/api/documents", files={
        "file": ("large.txt", b"x" * (5 * 1024 * 1024 + 1), "text/plain")
    })
    assert response.status_code == 400


def test_documents_persist_across_app_lifespan_and_can_be_deleted(app_factory):
    content = b"Patient reports insomnia and disrupted sleep."
    with TestClient(app_factory()) as first_client:
        created = first_client.post("/api/documents", files={
            "file": ("report.txt", content, "text/plain")
        }).json()
        document_id = created["document_id"]

    with TestClient(app_factory()) as second_client:
        documents = second_client.get("/api/documents").json()
        assert any(doc["document_id"] == document_id for doc in documents)
        assert second_client.post("/api/search", json={
            "question": "insomnia", "document_id": document_id,
        }).json()["evidence"]
        assert second_client.delete(f"/api/documents/{document_id}").status_code == 204
        assert second_client.post("/api/search", json={"question": "insomnia"}).json()["evidence"] == []


def test_search_document_scope_and_no_evidence_abstention(client):
    first = client.post("/api/documents", files={
        "file": ("sleep.txt", b"Patient reports insomnia and sleep disruption.", "text/plain")
    }).json()
    client.post("/api/documents", files={
        "file": ("mood.txt", b"Patient reports low mood and reduced interest.", "text/plain")
    })

    scoped = client.post("/api/search", json={
        "question": "insomnia", "document_id": first["document_id"],
    }).json()
    absent = client.post("/api/search", json={"question": "fracture"}).json()

    assert scoped["evidence"]
    assert all(hit["document_id"] == first["document_id"] for hit in scoped["evidence"])
    assert absent["status"] == "NO_EVIDENCE"
    assert absent["evidence"] == []
    assert "confidence" not in absent
