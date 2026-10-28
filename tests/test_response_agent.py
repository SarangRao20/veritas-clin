from veritas_clin.response_agent import EvidenceResponseAgent


def _evidence():
    return [{
        "passage_id": "doc1:0",
        "filename": "report.txt",
        "page": None,
        "passage": "The fictional patient reports insomnia.",
    }]


def test_response_agent_uses_only_valid_retrieved_citations():
    agent = EvidenceResponseAgent(
        model="local-model",
        generator=lambda question, evidence, model: {
            "answer": "The report notes insomnia.", "citations": ["doc1:0"]
        },
    )

    response = agent.answer("What does the report say?", _evidence())

    assert response["used_agent"] is True
    assert response["citations"] == ["doc1:0"]
    assert "[doc1:0]" in response["answer"]


def test_response_agent_falls_back_for_unknown_citation_or_failure():
    agent = EvidenceResponseAgent(
        model="local-model",
        generator=lambda question, evidence, model: {
            "answer": "Unsupported claim.", "citations": ["not-retrieved"]
        },
    )

    response = agent.answer("What does the report say?", _evidence())
    failed = EvidenceResponseAgent(
        model="local-model", generator=lambda *args: (_ for _ in ()).throw(RuntimeError())
    ).answer("What does the report say?", _evidence())

    assert response["used_agent"] is False
    assert "insomnia" in response["answer"].lower()
    assert failed["used_agent"] is False
    assert "[doc1:0]" in failed["answer"]


def test_response_agent_is_deterministic_when_disabled_and_abstains_without_evidence():
    agent = EvidenceResponseAgent()

    answer = agent.answer("What does the report say?", _evidence())
    abstention = agent.answer("What does the report say?", [])

    assert answer["used_agent"] is False
    assert answer["citations"] == ["doc1:0"]
    assert abstention["status"] == "NO_EVIDENCE"
    assert abstention["citations"] == []
