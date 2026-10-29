#!/usr/bin/env python3
"""Generate realistic, unlabelled clinical notes for patient-centric testing."""
from __future__ import annotations

import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

try:
    import requests
except Exception:
    requests = None


OUT = Path("/home/sarang/veritas-clin/data/test_patients")
OUT.mkdir(parents=True, exist_ok=True)

PATIENTS = [
    ("P-001", "Office Visit - Hypertension follow up"),
    ("P-002", "Urgent Care - Dysuria evaluation"),
    ("P-003", "Post-operative follow up - Laparoscopic cholecystectomy"),
]


def _ollama(prompt: str, model: str = "llama3.1:8b") -> str:
    if requests is None:
        raise RuntimeError("requests not available")
    resp = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.4}},
        timeout=300,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "")


BASE_PROMPT = """You are generating a realistic clinical document for testing a document-grounded NLP system.

STRICT RULES:
- Do NOT write words like simulation, demo, test, sample, fictional for assignment, example only, synthetic demonstration
- Do NOT mention Veritas, project, or exercise
- Use realistic section headers: CHIEF COMPLAINT, HISTORY OF PRESENT ILLNESS, PAST MEDICAL HISTORY, MEDICATIONS, ALLERGIES, PHYSICAL EXAM, LABS, ASSESSMENT, PLAN, DISCHARGE DIAGNOSES, DISCHARGE MEDICATIONS, FOLLOW UP as appropriate
- Include specific but plausible details (vitals, values with units) without real PHI
- Use dates in context. Include negations like "denies", "no signs of", "rules out" naturally
- Vary the note style slightly. Avoid boilerplate lists repeated verbatim
- Output only the clinical note text. No preamble or explanation.

Patient: {patient_id}
Document type: {doc_type}
Encounter date: {date}
Context: {context}
"""


def main():
    model = os.environ.get("VERITAS_TEST_MODEL", "llama3.1:8b")
    created = []
    for pid, ctx in PATIENTS:
        base = datetime(2025, 10, 1)
        dates = [base + timedelta(days=i * 7 + random.randint(0,2)) for i in range(3)]
        types = ["OfficeVisit", "LabResults", "DischargeSummary"]
        for d, dt in zip(types, dates):
            prompt = BASE_PROMPT.format(patient_id=pid, doc_type=d, date=dt.strftime("%Y-%m-%d"), context=ctx)
            try:
                text = _ollama(prompt, model=model)
            except Exception as e:
                text = f"""CHIEF COMPLAINT:\nFollow up for {ctx.lower()}.\n\nHISTORY OF PRESENT ILLNESS:\nPatient presents for routine follow up. Reports doing reasonably well overall.\n\nPAST MEDICAL HISTORY:\nRelevant comorbidities as clinically indicated.\n\nMEDICATIONS:\nAs directed.\n\nALLERGIES:\nNo known drug allergies.\n\nPHYSICAL EXAM:\nStable exam.\n\nLABS:\nRecent labs reviewed.\n\nASSESSMENT:\nStable.\n\nPLAN:\nContinue current management and follow up as advised.\n"""
                print("FALLBACK:", e)
            fname = OUT / f"{pid}_{dt.strftime('%Y-%m-%d')}_{d}.txt"
            fname.write_text(text.strip() + "\n")
            created.append(str(fname))
            print("WROTE", fname)
    print(json.dumps({"created": created}, indent=2))


if __name__ == "__main__":
    main()
