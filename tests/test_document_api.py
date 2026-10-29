import numpy as np
import pytest
from fastapi.testclient import TestClient

from veritas_clin.config import DEMO_DOCUMENTS_DIR
from veritas_clin.middleware.auth import get_current_user
from veritas_clin.models.database import init_schema
from veritas_clin.serve import create_app
from veritas_clin.store.user_store import UserStore

_FAKE_ADMIN = {"user_id": "test-admin", "role": "admin", "email": "admin@test.local", "username": "testadmin"}


def _seed_test_user(db_path):
    """Insert the fake admin user so FK constraints pass."""
    init_schema(db_path)
    store = UserStore(db_path)
    if not store.get_user_by_id(_FAKE_ADMIN["user_id"]):
        store.create_user(
            email=_FAKE_ADMIN["email"],
            username=_FAKE_ADMIN["username"],
            hashed_pw="hashed",
            role=_FAKE_ADMIN["role"],
            user_id=_FAKE_ADMIN["user_id"],
        )


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
    db_path = tmp_path / "documents.sqlite3"
    _seed_test_user(db_path)

    def make_app():
        app = create_app(
            db_path=db_path,
            embedder=FakeEmbedder(),
            demo_dir=demo_dir,
        )
        app.dependency_overrides[get_current_user] = lambda: _FAKE_ADMIN
        return app

    return make_app


@pytest.fixture
def client(app_factory):
    with TestClient(app_factory()) as test_client:
        yield test_client


def test_upload_search_and_citations_are_evidence_grounded(client):
    upload = client.post("/api/documents", files={
        "file": ("report.txt", b"Patient reports insomnia and disrupted sleep.", "text/plain")
    })
    assert upload.status_code == 201
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


def test_documents_persist_across_app_lifespan_and_can_be_deleted(app_factory, tmp_path):
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


def test_unknown_api_routes_return_json_404_not_spa_html(client):
    response = client.get("/api/not-a-real-endpoint")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "<!doctype" not in response.text.lower()


def test_bundled_synthetic_documents_are_seeded_and_searchable(tmp_path):
    db_path = tmp_path / "demo-documents.sqlite3"
    _seed_test_user(db_path)
    app = create_app(
        db_path=db_path,
        embedder=FakeEmbedder(),
        demo_dir=DEMO_DOCUMENTS_DIR,
    )
    app.dependency_overrides[get_current_user] = lambda: _FAKE_ADMIN
    with TestClient(app) as demo_client:
        documents = demo_client.get("/api/documents").json()
        names = {document["filename"] for document in documents}
        assert {
            "demo_report.txt",
            "demo_prescription.txt",
            "demo_visit_note.txt",
            "demo_lab_report.txt",
            "demo_discharge_summary.txt",
        } <= names
        assert all(document["is_synthetic"] for document in documents)

        results = demo_client.post("/api/search", json={"question": "sleep diary"}).json()
        assert any(hit["filename"] == "demo_visit_note.txt" for hit in results["evidence"])
