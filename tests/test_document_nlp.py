import io

import numpy as np
import pytest
from pypdf import PdfWriter

from veritas_clin.document_nlp import (
    DocumentProcessor,
    EvidenceRetriever,
    seed_demo_documents,
)
from veritas_clin.document_store import DocumentStore


class FakeEmbedder:
    model_id = "test-vectors-v1"

    def encode(self, texts):
        rows = []
        for text in texts:
            words = set(text.lower().split())
            rows.append([float("sleep" in words or "insomnia" in words), float("mood" in words)])
        return np.asarray(rows, dtype=np.float32)


def _pdf_with_text(text):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_ref = writer._add_object(font)
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
    })
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_processor_extracts_txt_into_passages_and_embeddings():
    processor = DocumentProcessor(FakeEmbedder(), max_chunk_chars=50)
    passages = processor.extract_and_chunk(
        "report.txt", "text/plain",
        b"Patient reports severe insomnia. Sleep remains disrupted during the week.",
    )

    assert len(passages) == 2
    assert passages[0]["ordinal"] == 0
    assert passages[0]["page"] is None
    assert passages[0]["embedding_dim"] == 2
    assert len(passages[0]["embedding"]) == 8


def test_processor_extracts_pdf_text_with_page_metadata():
    processor = DocumentProcessor(FakeEmbedder())
    passages = processor.extract_and_chunk(
        "report.pdf", "application/pdf", _pdf_with_text("Patient reports insomnia today.")
    )

    assert passages[0]["page"] == 1
    assert "insomnia" in passages[0]["text"].lower()


@pytest.mark.parametrize("filename,media_type,content", [
    ("image.pdf", "application/pdf", b"%PDF-1.4\nnot a real pdf"),
    ("scan.pdf", "application/pdf", None),
    ("report.exe", "application/octet-stream", b"content"),
    ("empty.txt", "text/plain", b"  \n"),
])
def test_processor_rejects_invalid_or_unextractable_documents(filename, media_type, content):
    if content is None:
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        output = io.BytesIO()
        writer.write(output)
        content = output.getvalue()
    with pytest.raises(ValueError):
        DocumentProcessor(FakeEmbedder()).extract_and_chunk(filename, media_type, content)


def test_processor_enforces_upload_size_and_chunk_limit():
    processor = DocumentProcessor(FakeEmbedder(), max_upload_bytes=32, max_chunk_chars=24)
    with pytest.raises(ValueError, match="size"):
        processor.extract_and_chunk("large.txt", "text/plain", b"x" * 33)


def test_hybrid_retrieval_returns_citations_and_scopes_to_document(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    processor = DocumentProcessor(FakeEmbedder())
    for filename, body, is_synthetic in [
        ("sleep.txt", "Patient reports insomnia. Sleep remains disrupted.", False),
        ("mood.txt", "Patient reports low mood. Mood remains low.", True),
    ]:
        passages = processor.extract_and_chunk(filename, "text/plain", body.encode())
        store.add_document(filename, "text/plain", body, passages, FakeEmbedder.model_id, is_synthetic)
    sleep_doc = next(d for d in store.list_documents() if d["filename"] == "sleep.txt")

    results = EvidenceRetriever(store, FakeEmbedder()).search("insomnia sleep", top_k=3)
    scoped = EvidenceRetriever(store, FakeEmbedder()).search(
        "insomnia sleep", document_id=sleep_doc["document_id"], top_k=3
    )

    assert results
    assert results[0]["document_id"] == sleep_doc["document_id"]
    assert results[0]["passage_id"]
    assert results[0]["bm25_score"] > 0
    assert results[0]["vector_score"] > 0
    assert results[0]["fused_score"] > 0
    assert all(hit["document_id"] == sleep_doc["document_id"] for hit in scoped)
    store.close()


def test_hybrid_retrieval_abstains_when_no_passage_matches(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    processor = DocumentProcessor(FakeEmbedder())
    body = "Patient reports insomnia and disrupted sleep."
    store.add_document("report.txt", "text/plain", body,
                       processor.extract_and_chunk("report.txt", "text/plain", body.encode()),
                       FakeEmbedder.model_id)

    assert EvidenceRetriever(store, FakeEmbedder()).search("fracture") == []
    store.close()


def test_demo_seed_is_labeled_and_idempotent(tmp_path):
    store = DocumentStore(tmp_path / "docs.sqlite3")
    processor = DocumentProcessor(FakeEmbedder())
    fixture_dir = tmp_path / "demo_documents"
    fixture_dir.mkdir()
    (fixture_dir / "sample_report.txt").write_text(
        "Synthetic example only. Patient reports insomnia and low mood.", encoding="utf-8"
    )
    (fixture_dir / "sample_prescription.txt").write_text(
        "Synthetic example only. Example prescription contains no real patient data.", encoding="utf-8"
    )

    seed_demo_documents(store, processor, fixture_dir)
    seed_demo_documents(store, processor, fixture_dir)

    documents = store.list_documents()
    assert len(documents) == 2
    assert all(document["is_synthetic"] for document in documents)
    store.close()
