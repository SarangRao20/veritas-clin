"""Tests for Real Clinical Data Ingestion & MTSamples Corpus Loader."""
from __future__ import annotations

import json
from pathlib import Path
import pytest

from veritas_clin.data_ingest import load_or_create_clinical_corpus, MTSAMPLES_CATEGORIES


def test_load_or_create_clinical_corpus_structure(tmp_path: Path):
    test_cache = tmp_path / "test_clinical_corpus.json"
    notes, patients = load_or_create_clinical_corpus(cache_path=test_cache)
    
    assert len(notes) >= 10
    assert len(patients) >= 3
    assert test_cache.exists()
    
    sample = notes[0]
    expected_keys = {
        "patient_id", "patient_name", "note_id", "date",
        "text", "sentences", "specialty"
    }
    for key in expected_keys:
        assert key in sample, f"Missing key {key} in note"
        
    assert len(sample["sentences"]) > 0
    assert isinstance(sample["text"], str)
    assert sample["specialty"] in MTSAMPLES_CATEGORIES or len(sample["specialty"]) > 0


def test_cached_corpus_reloading(tmp_path: Path):
    test_cache = tmp_path / "test_cached_corpus.json"
    notes_1, patients_1 = load_or_create_clinical_corpus(cache_path=test_cache)
    assert test_cache.exists()
    
    # Reload from cache
    notes_2, patients_2 = load_or_create_clinical_corpus(cache_path=test_cache)
    assert len(notes_1) == len(notes_2)
    assert len(patients_1) == len(patients_2)
    assert notes_1[0]["note_id"] == notes_2[0]["note_id"]
