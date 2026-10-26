"""Deterministic synthetic clinical-note corpus with ground truth and planted traps.

Why synthetic: every ground-truth finding is known *by construction* (spans are recorded
while rendering), so precision/recall and hallucination rates are exact defined values,
not estimates. No PHI is involved.

Traps planted per note (an extractor must read modality, not strings):
  1. a condition stated only as "ruled out / resolved / unlikely"  -> NOT a diagnosis
  2. a condition appearing only in the family-history line         -> NOT a diagnosis
  3. Penicillin appearing only in the allergy line                 -> NOT a medication
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from random import Random

from .config import SETTINGS

CONDITIONS = [
    "Type 2 Diabetes Mellitus",
    "Hypertension",
    "Community-acquired Pneumonia",
    "Acute Kidney Injury",
    "Iron Deficiency Anemia",
    "Chronic Obstructive Pulmonary Disease",
    "Congestive Heart Failure",
    "Urinary Tract Infection",
]
MODALITY_QUALIFIERS = ["ruled out", "resolved", "unlikely"]
MEDS = [
    ("Metformin", "500 mg", "twice daily"),
    ("Amlodipine", "5 mg", "once daily"),
    ("Atorvastatin", "20 mg", "at night"),
    ("Furosemide", "40 mg", "once daily"),
    ("Amoxicillin", "875 mg", "twice daily for 7 days"),
    ("Pantoprazole", "40 mg", "once daily"),
    ("Losartan", "50 mg", "once daily"),
    ("Salbutamol", "2 puffs", "as needed"),
]
FOLLOWUPS = [
    ("Cardiology", "2 weeks"),
    ("Nephrology", "10 days"),
    ("Pulmonology", "3 weeks"),
    ("Primary Care", "7 days"),
    ("Endocrinology", "1 month"),
    ("Infectious Disease", "14 days"),
]
_ASSESSMENT_HEADERS = ("ASSESSMENT:", "INTERIM ASSESSMENT:")
_MED_HEADERS = ("MEDICATIONS ON DISCHARGE:", "MEDICATIONS:")


@dataclass
class GTFinding:
    type: str  # diagnosis | medication | followup
    value: str
    dosage: str | None
    span_start: int
    span_end: int

    def as_dict(self) -> dict:
        return {
            "type": self.type,
            "value": self.value,
            "dosage": self.dosage,
            "span_start": self.span_start,
            "span_end": self.span_end,
        }


class _Builder:
    """Accumulates note text while recording ground-truth span offsets."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.gt: list[GTFinding] = []
        self.offset = 0

    def emit(self, line: str) -> None:
        self.parts.append(line)
        self.offset += len(line)

    def emit_gt(self, line: str, ftype: str, value: str, dosage: str | None, prefix_len: int) -> None:
        """Emit a line whose trailing part (after `prefix_len` chars) is a GT finding."""
        value_start = self.offset + prefix_len
        self.parts.append(line)
        self.offset += len(line)
        self.gt.append(
            GTFinding(ftype, value, dosage, value_start, value_start + len(value))
        )


def _make_note(rng: Random, note_id: str) -> dict:
    progress_variant = rng.random() < 0.4
    assess_hdr = "INTERIM ASSESSMENT:" if progress_variant else "ASSESSMENT:"
    med_hdr = "MEDICATIONS:" if progress_variant else "MEDICATIONS ON DISCHARGE:"

    n_dx = rng.randint(1, 3)
    dxs = rng.sample(CONDITIONS, k=n_dx + 2)
    dx_gt, dx_trap, dx_fh = dxs[:n_dx], dxs[n_dx], dxs[n_dx + 1]

    n_meds = 0 if rng.random() < 0.15 else rng.randint(1, 3)
    med_gt = rng.sample(MEDS, k=n_meds)
    spec, window = rng.choice(FOLLOWUPS)
    modality = rng.choice(MODALITY_QUALIFIERS)
    allergy_penicillin = rng.random() < 0.5

    b = _Builder()
    b.emit("DISCHARGE SUMMARY\n" if not progress_variant else "PROGRESS NOTE\n")
    b.emit(f"Patient ID: VS-{note_id.split('_')[1]}\n")
    b.emit(f"Allergies: {'Penicillin (rash)' if allergy_penicillin else 'None known.'}\n")
    b.emit(f"The patient reports progressively worsening symptoms related to "
           f"{dx_gt[0].lower()} over the last three days.\n")
    b.emit(f"Family history: {dx_fh} in the patient's father.\n\n")
    b.emit(f"{assess_hdr}\n")
    for i, dx in enumerate(dx_gt, start=1):
        b.emit_gt(f"{i}. {dx}\n", "diagnosis", dx, None, len(f"{i}. "))
    b.emit(f"{len(dx_gt) + 1}. {dx_trap} - {modality}.\n")
    b.emit(f"\n{med_hdr}\n")
    for i, (name, dose, freq) in enumerate(med_gt, start=1):
        med_value = f"{name} {dose} {freq}"
        b.emit_gt(f"{i}. {med_value}\n", "medication", med_value, f"{dose} {freq}",
                  len(f"{i}. "))
    b.emit("\nFOLLOW-UP: ")
    fu_value = f"{spec} in {window}"
    b.emit_gt(f"{fu_value}.\n", "followup", fu_value, None, 0)

    return {
        "note_id": note_id,
        "text": "".join(b.parts),
        "gt": [g.as_dict() for g in b.gt],
    }


def generate_corpus(n_notes: int = SETTINGS.n_notes, seed: int = SETTINGS.seed) -> list[dict]:
    rng = Random(seed)
    return [_make_note(rng, f"note_{i:03d}") for i in range(n_notes)]


def save_corpus(records: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def load_corpus(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def ensure_corpus(
    n_notes: int = SETTINGS.n_notes,
    seed: int = SETTINGS.seed,
    path: Path | None = None,
) -> list[dict]:
    """Load the corpus if present, otherwise generate and save it."""
    path = path or SETTINGS.corpus_path
    if path.exists():
        records = load_corpus(path)
        if len(records) == n_notes:
            return records
    records = generate_corpus(n_notes, seed)
    save_corpus(records, path)
    return records
