import pytest
from veritas_clin.deidentifier import Deidentifier, MEDICAL_WHITELIST
from veritas_clin.document_nlp import extract_assertion
from veritas_clin.response_agent import EvidenceResponseAgent


def test_deidentifier_masks_hipaa_safe_harbor_identifiers():
    engine = Deidentifier(custom_names=["Aiden Sharma", "Maya Patel"])
    raw_note = (
        "Patient Maya Patel (age 42yo, SSN 123-45-6789, MRN-88210) presented on 2024-03-15. "
        "Dr. Aiden Sharma examined her at General Medical Center Hospital. "
        "Contact: 555-234-5678, email maya.patel@example.com."
    )
    result = engine.deidentify(raw_note)

    assert result["scrubbed_count"] >= 5
    deid = result["deidentified_text"]
    assert "Maya Patel" not in deid
    assert "Aiden Sharma" not in deid
    assert "123-45-6789" not in deid
    assert "88210" not in deid
    assert "2024-03-15" not in deid
    assert "555-234-5678" not in deid
    assert "maya.patel@example.com" not in deid
    assert "[PATIENT_NAME]" in deid or "[NAME]" in deid
    assert "[DATE]" in deid
    assert "[PHONE]" in deid
    assert "[EMAIL]" in deid


def test_medical_whitelist_prevents_false_positive_redaction():
    engine = Deidentifier()
    clinical_text = (
        "Patient evaluated for Parkinson's disease, Alzheimer's, and major depression. "
        "Prescribed Sertraline 50 mg for chronic insomnia. Baseline PHQ-9 score was 16."
    )
    result = engine.deidentify(clinical_text)
    deid = result["deidentified_text"]

    # Medical terms and eponyms must remain un-redacted
    assert "Parkinson's" in deid or "parkinson's" in deid.lower()
    assert "Alzheimer's" in deid or "alzheimer's" in deid.lower()
    assert "Sertraline" in deid or "sertraline" in deid.lower()
    assert "insomnia" in deid
    assert "PHQ-9" in deid or "phq-9" in deid.lower()


def test_clinical_assertion_detection_flags_negation():
    affirmed_passage = "Patient presents with active insomnia, fatigue, and severe low mood."
    negated_passage_1 = "Patient denies chest pain or shortness of breath."
    negated_passage_2 = "Exam showed no evidence of acute respiratory distress or fever."
    negated_passage_3 = "Negative for suicidal ideation, denies hallucinations."

    assert extract_assertion(affirmed_passage, ["insomnia", "mood"]) == "AFFIRMED"
    assert extract_assertion(negated_passage_1, ["chest", "pain"]) == "NEGATED"
    assert extract_assertion(negated_passage_2, ["respiratory", "distress"]) == "NEGATED"
    assert extract_assertion(negated_passage_3, ["suicidal", "ideation"]) == "NEGATED"


def test_rag_synthesis_scrubs_pii_before_llm_call():
    intercepted_prompts = []

    def mock_generator(question, evidence, model):
        intercepted_prompts.append({"question": question, "evidence": evidence})
        return {
            "answer": "The patient reports sleep disturbance.",
            "citations": [evidence[0]["passage_id"]],
        }

    agent = EvidenceResponseAgent(
        model="mock-model",
        provider="ollama",
        generator=mock_generator,
    )

    raw_evidence = [{
        "passage_id": "pass-01",
        "filename": "confidential_record.txt",
        "page": 1,
        "passage": "Patient John Doe (DOB 1980-05-12, phone 555-987-6543) reports insomnia.",
    }]

    response = agent.answer("How is John Doe sleeping?", raw_evidence)

    assert response["used_agent"] is True
    assert "pii_audit" in response
    assert response["pii_audit"]["scrubbed_count"] > 0
    assert response["pii_audit"]["hipaa_safe_harbor_applied"] is True

    # Verify that what reached the LLM generator contained ZERO raw PII
    passed_q = intercepted_prompts[0]["question"]
    passed_passage = intercepted_prompts[0]["evidence"][0]["passage"]
    assert "555-987-6543" not in passed_passage
    assert "1980-05-12" not in passed_passage
    assert "[PHONE]" in passed_passage
    assert "[DATE]" in passed_passage
