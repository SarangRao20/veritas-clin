"""Tests for Clinical QA RAG System (0525) and HIPAA De-identifier (0528)."""
from __future__ import annotations

import pytest
from veritas_clin.deidentifier import Deidentifier, MEDICAL_WHITELIST
from veritas_clin.search_engine import (
    generate_patient_corpus,
    TFIDFRetriever,
    BiLSTMRetriever,
    HybridRetriever,
    DenseTransformerRetriever,
)
from veritas_clin.clinical_qa import ClinicalQASystem


# ── 1. Deidentifier Tests ───────────────────────────────────────────────────

def test_deidentify_names_and_dates():
    deid = Deidentifier(custom_names=["Aiden Sharma", "Maya Patel"])
    sample = "Patient Aiden Sharma was examined by Dr. Gregory House on 2024-03-15."
    res = deid.deidentify(sample, mode="mask")
    
    assert "[PATIENT_NAME]" in res["deidentified_text"]
    assert any(tag in res["deidentified_text"] for tag in ("[CLINICIAN_NAME]", "[CLINICIAN]", "[NAME]"))
    assert "[DATE]" in res["deidentified_text"]
    assert "Aiden Sharma" not in res["deidentified_text"]
    assert "2024-03-15" not in res["deidentified_text"]
    assert res["scrubbed_count"] >= 3


def test_deidentify_contact_and_identifiers():
    deid = Deidentifier()
    sample = "Contact patient at 555-123-4567 or email john.doe@health.org. Record ID: MRN-998812, P001_N04."
    res = deid.deidentify(sample, mode="mask")

    assert "[PHONE]" in res["deidentified_text"]
    assert "[EMAIL]" in res["deidentified_text"]
    assert "[ID]" in res["deidentified_text"] or "[PATIENT_ID]" in res["deidentified_text"]
    assert "555-123-4567" not in res["deidentified_text"]
    assert "john.doe@health.org" not in res["deidentified_text"]


def test_deidentify_preserves_medical_terms():
    deid = Deidentifier(custom_names=["Aiden Sharma"])
    sample = "Patient Aiden Sharma was diagnosed with Parkinson's disease and severe insomnia on PHQ-9 scale."
    res = deid.deidentify(sample, mode="mask")

    # Patient name should be scrubbed
    assert "Aiden Sharma" not in res["deidentified_text"]
    # Medical terms must NEVER be scrubbed
    assert "Parkinson's" in res["deidentified_text"] or "parkinson" in res["deidentified_text"].lower()
    assert "insomnia" in res["deidentified_text"]
    assert "PHQ-9" in res["deidentified_text"]


# ── 2. Clinical QA System Tests ──────────────────────────────────────────────

@pytest.fixture(scope="module")
def qa_system():
    corpus, patients = generate_patient_corpus(seed=42)
    records = [(s, n["note_id"], n["date"]) for n in corpus for s in n["sentences"]]
    tf_ret = TFIDFRetriever(records)
    lstm_ret = BiLSTMRetriever(records, None, hidden_dim=32)
    hybrid_ret = HybridRetriever(tf_ret, lstm_ret, lstm_ret)
    return ClinicalQASystem(hybrid_ret, corpus, patients)


def test_clinical_qa_affirms_known_symptom(qa_system):
    # Aiden Sharma (P001) has sleep insomnia entries
    ans = qa_system.answer_question("Has the patient had severe trouble sleeping?", patient_id="P001")
    
    assert ans["clinical_status"] in ("AFFIRMED", "PARTIALLY_AFFIRMED")
    assert len(ans["findings"]) > 0
    assert len(ans["citations"]) > 0
    assert "Sleep" in ans["findings"][0]["category"] or "Insomnia" in ans["findings"][0]["category"] or "Clinical Observation" in ans["findings"][0]["category"]
    assert ans["confidence"] >= 0.50


def test_clinical_qa_abstains_on_absent_symptom(qa_system):
    # Check for completely unmentioned condition
    ans = qa_system.answer_question("Does the patient have broken femur or asthma attacks?", patient_id="P001")
    
    assert ans["clinical_status"] == "NO_EVIDENCE"
    assert "No documented clinical evidence" in ans["answer_summary"]
    assert len(ans["findings"]) == 0


def test_dense_transformer_retriever_query():
    records = [
        ("Patient suffers from profound chronic insomnia and midnight waking.", "NOTE_01", "2024-01-10"),
        ("Patient denies any sleep disturbance or fatigue.", "NOTE_02", "2024-01-17"),
        ("Cardiovascular exam shows normal sinus rhythm.", "NOTE_03", "2024-01-24"),
    ]
    ret = DenseTransformerRetriever(records)
    results = ret.query("trouble sleeping at night", top_k=2)
    assert len(results) > 0
    assert results[0]["note_id"] == "NOTE_01"
    assert results[0]["score"] > 0.20
    assert "assertion" in results[0]


def test_clinical_qa_generates_sbar_synthesis(qa_system):
    ans = qa_system.answer_question("Has the patient had severe trouble sleeping?", patient_id="P001")
    assert "sbar" in ans
    sbar = ans["sbar"]
    assert "situation" in sbar and len(sbar["situation"]) > 0
    assert "assessment" in sbar and len(sbar["assessment"]) > 0
    assert "recommendation" in sbar and len(sbar["recommendation"]) > 0
    assert "grounded_narrative" in sbar and len(sbar["grounded_narrative"]) > 0
    # Every assessment must cite at least one Note ID
    assert "[" in sbar["assessment"] or "[" in sbar["grounded_narrative"]


