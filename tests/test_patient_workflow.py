"""Test patient cases, timeline, and dynamic workflow trace engine."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from veritas_clin.config import CLINICAL_RECORDS_DIR, DEMO_DOCUMENTS_DIR
from veritas_clin.document_nlp import DocumentProcessor, LocalSentenceEmbedder, seed_clinical_records
from veritas_clin.middleware.auth import get_current_user
from veritas_clin.response_agent import EvidenceResponseAgent
from veritas_clin.serve import create_app
from veritas_clin.store.document_store import DocumentStore
from veritas_clin.store.user_store import UserStore

_FAKE_CLINICIAN = {
    "user_id": "test-clinician-1",
    "email": "clinician@hospital.org",
    "username": "dr_clinician",
    "role": "clinician",
}


class FakeEmbedder:
    model_id = "test-vectors-v1"

    def encode(self, texts):
        import numpy as np
        return np.asarray([
            [1.0, 0.0] for _ in texts
        ], dtype=np.float32)

    def embed_passages(self, texts: list[str]) -> list[bytes]:
        return [b"\x00\x00\x80?\x00\x00\x00\x00"] * len(texts)

    def embed_query(self, query: str) -> bytes:
        return b"\x00\x00\x80?\x00\x00\x00\x00"


def _seed_test_user(db_path: Path) -> None:
    from veritas_clin.models.database import init_schema
    init_schema(db_path)
    store = UserStore(db_path)
    try:
        store.create_user(
            _FAKE_CLINICIAN["email"],
            _FAKE_CLINICIAN["username"],
            "SecurePass123!",
            _FAKE_CLINICIAN["role"],
        )
    except sqlite3.IntegrityError:
        pass


@pytest.fixture
def test_app(tmp_path):
    db_path = tmp_path / "test-patients.sqlite3"
    _seed_test_user(db_path)
    app = create_app(
        db_path=db_path,
        embedder=FakeEmbedder(),
        demo_dir=DEMO_DOCUMENTS_DIR,
        clinical_dir=CLINICAL_RECORDS_DIR,
    )
    app.dependency_overrides[get_current_user] = lambda: _FAKE_CLINICIAN
    return app


def test_clinical_records_seeded_with_authentic_patient_cases(test_app):
    with TestClient(test_app) as client:
        res = client.get("/api/patients")
        assert res.status_code == 200
        data = res.json()
        patient_ids = {p["patient_id"] for p in data.get("patients", [])}
        # Verify our 3 authentic patients are indexed
        assert "PT-4091" in patient_ids
        assert "PT-7215" in patient_ids
        assert "PT-3892" in patient_ids

        # Check document counts
        pt_4091 = next(p for p in data["patients"] if p["patient_id"] == "PT-4091")
        assert pt_4091["document_count"] >= 4
        assert pt_4091["passage_count"] >= 4


def test_patient_timeline_chronological_ordering(test_app):
    with TestClient(test_app) as client:
        res = client.get("/api/patients/PT-4091/timeline")
        assert res.status_code == 200
        data = res.json()
        timeline = data.get("timeline", [])
        assert len(timeline) >= 4

        # Verify chronological ordering by encounter_date
        dates = [ev.get("occurred_at") for ev in timeline if ev.get("occurred_at")]
        assert dates == sorted(dates)

        # Verify authentic document types
        filenames = [ev["filename"] for ev in timeline]
        assert any("Emergency_Admission_H&P" in f for f in filenames)
        assert any("Cardiac_Catheterization" in f for f in filenames)
        assert any("Nephrology_Consult" in f for f in filenames)
        assert any("Discharge_Summary" in f for f in filenames)


def test_dynamic_workflow_trace_progression(test_app):
    with TestClient(test_app) as client:
        res = client.get("/api/patients/PT-4091/workflow-trace")
        assert res.status_code == 200
        data = res.json()
        assert data["patient_id"] == "PT-4091"
        assert data["status"] == "EVIDENCE_FOUND"
        stages = data.get("stages", [])
        assert len(stages) == 5

        stage_keys = [s["stage_key"] for s in stages]
        assert stage_keys == ["baseline", "diagnostic", "flag", "action", "trajectory"]

        # Check that stage 3 is the clinical flag/anomaly
        flag_stage = stages[2]
        assert flag_stage["stage_key"] == "flag"
        assert flag_stage["severity"] == "critical"
        assert len(flag_stage["evidence"]) > 0

        # Check that citations are strictly grounded
        for stage in stages:
            for ev in stage["evidence"]:
                assert "passage_id" in ev
                assert "PT-4091" in ev["filename"]
                assert ev["assertion"] in ("AFFIRMED", "NEGATED")


def test_workflow_trace_contains_no_simulation_or_synthetic_text(test_app):
    with TestClient(test_app) as client:
        # Check all documents for PT-4091, PT-7215, PT-3892
        for pid in ["PT-4091", "PT-7215", "PT-3892"]:
            res = client.get(f"/api/patients/{pid}/documents")
            assert res.status_code == 200
            docs = res.json().get("documents", [])
            for doc in docs:
                assert not doc.get("is_synthetic"), f"{doc['filename']} was marked synthetic"
                full_doc = client.get(f"/api/documents/{doc['document_id']}").json()
                text_lower = full_doc["extracted_text"].lower()
                for forbidden in ["synthetic demonstration", "not a real patient", "this is just a simulation", "fictional provider"]:
                    assert forbidden not in text_lower, f"Forbidden string '{forbidden}' found in {doc['filename']}"


def test_analyse_and_analyze_endpoints(test_app):
    with TestClient(test_app) as client:
        # 1. GET /analyse without params returns overview
        res1 = client.get("/analyse")
        assert res1.status_code == 200
        data1 = res1.json()
        assert "total_patients" in data1
        assert "patients" in data1

        # 2. GET /analyze?patient_id=PT-4091 returns patient synthesis
        res2 = client.get("/analyze?patient_id=PT-4091")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["patient_id"] == "PT-4091"
        assert "summary" in data2
        assert "reports" in data2
        assert len(data2["reports"]) > 0

        # 3. POST /analyse with specific question
        res3 = client.post("/analyse", json={"patient_id": "PT-4091", "question": "What is the peak creatinine?"})
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["patient_id"] == "PT-4091"
        assert "answer" in data3
        assert "citations" in data3


def test_patient_endpoints_are_case_insensitive(test_app):
    with TestClient(test_app) as client:
        # Case insensitive profile check
        res_lower = client.get("/api/patients/pt-4091")
        assert res_lower.status_code == 200
        data_lower = res_lower.json()
        assert data_lower["patient_id"] == "PT-4091"
        assert len(data_lower["active_medications"]) > 0

        # Case insensitive documents check
        res_docs = client.get("/api/patients/pt-4091/documents")
        assert res_docs.status_code == 200
        assert len(res_docs.json()["documents"]) > 0
