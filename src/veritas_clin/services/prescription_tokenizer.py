"""Clinical Prescription Tokenizer & Entity Extraction Service.

Extracts, tokenizes, and validates clinical pharmacology components:
- Drug Entities (generic & brand names)
- Dosage & Strength (amount + units)
- Delivery Route (PO, IV, SC, Inhalation, Topical, etc.)
- Frequency / Sig (QD, BID, TID, QID, PRN, Q8H)
- Duration
- Indication / Clinical Rationale
- Held / Contraindicated Medications
"""
from __future__ import annotations

import re
from typing import Any

# Frequency expansions
FREQ_MAP = {
    "QD": "Once daily",
    "DAILY": "Once daily",
    "BID": "Twice daily",
    "TID": "Three times daily",
    "QID": "Four times daily",
    "Q4H": "Every 4 hours",
    "Q6H": "Every 6 hours",
    "Q8H": "Every 8 hours",
    "Q12H": "Every 12 hours",
    "PRN": "As needed",
    "STAT": "Immediately",
    "QHS": "Nightly at bedtime",
    "QAM": "Every morning",
}

ROUTE_MAP = {
    "PO": "Oral (by mouth)",
    "ORAL": "Oral (by mouth)",
    "IV": "Intravenous",
    "SC": "Subcutaneous",
    "SQ": "Subcutaneous",
    "IM": "Intramuscular",
    "SL": "Sublingual",
    "INHALATION": "Inhalation",
    "TOPICAL": "Topical",
    "PR": "Rectal",
}

DOSE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|mEq|mmol|%)", re.IGNORECASE)
FREQ_RE = re.compile(r"\b(QD|DAILY|BID|TID|QID|Q4H|Q6H|Q8H|Q12H|PRN|STAT|QHS|QAM)\b", re.IGNORECASE)
ROUTE_RE = re.compile(r"\b(PO|ORAL|IV|SC|SQ|IM|SL|INHALATION|TOPICAL|PR)\b", re.IGNORECASE)


class PrescriptionTokenizer:
    """Tokenizes and parses clinical prescriptions into structured NLP entities."""

    def tokenize_medication_line(self, line: str) -> dict[str, Any]:
        """Tokenize a single prescription line."""
        tokens = []
        doses = []
        routes = []
        freqs = []

        # Find doses
        for m in DOSE_RE.finditer(line):
            val, unit = m.groups()
            doses.append(f"{val} {unit.lower()}")
            tokens.append({
                "type": "DOSE",
                "text": m.group(0),
                "start": m.start(),
                "end": m.end(),
                "normalized": f"{val} {unit.lower()}",
            })

        # Find routes
        for m in ROUTE_RE.finditer(line):
            r = m.group(0).upper()
            routes.append(r)
            tokens.append({
                "type": "ROUTE",
                "text": m.group(0),
                "start": m.start(),
                "end": m.end(),
                "expanded": ROUTE_MAP.get(r, r),
            })

        # Find frequencies
        for m in FREQ_RE.finditer(line):
            f = m.group(0).upper()
            freqs.append(f)
            tokens.append({
                "type": "FREQ",
                "text": m.group(0),
                "start": m.start(),
                "end": m.end(),
                "expanded": FREQ_MAP.get(f, f),
            })

        # Extract probable drug name from start of line
        drug_match = re.match(r"^(?:\d+[\.\)]\s*)?([A-Za-z0-9\-]+(?:\s*\([A-Za-z0-9\-]+\))?)", line.strip())
        drug_name = drug_match.group(1).strip() if drug_match else "Medication"

        return {
            "raw_line": line.strip(),
            "drug_name": drug_name,
            "dose": doses[0] if doses else "Unspecified",
            "route": routes[0] if routes else "PO",
            "route_expanded": ROUTE_MAP.get(routes[0], "Oral") if routes else "Oral",
            "frequency": freqs[0] if freqs else "Daily",
            "frequency_expanded": FREQ_MAP.get(freqs[0], "Daily") if freqs else "Daily",
            "tokens": sorted(tokens, key=lambda x: x["start"]),
        }

    def tokenize_form(self, data: dict[str, Any]) -> dict[str, Any]:
        """Process structured prescription form data."""
        patient_id = data.get("patient_id", "").strip().upper()
        patient_name = data.get("patient_name", "").strip() or f"Patient {patient_id}"
        prescriber = data.get("prescribing_physician", "Attending Clinician, MD")
        encounter_date = data.get("encounter_date") or ""
        medications = data.get("medications", [])
        held_medications = data.get("held_medications", [])
        allergies = data.get("allergies", "No Known Drug Allergies (NKDA)")
        clinical_notes = data.get("clinical_notes", "")

        tokenized_meds = []
        all_tokens = []

        for idx, med in enumerate(medications, start=1):
            if isinstance(med, dict):
                drug = med.get("name", "").strip()
                brand = med.get("brand", "").strip()
                full_drug = f"{drug} ({brand})" if brand else drug
                dose = med.get("dose", "").strip()
                route = med.get("route", "PO").strip().upper()
                freq = med.get("frequency", "Daily").strip().upper()
                duration = med.get("duration", "").strip()
                indication = med.get("indication", "").strip()

                line_text = f"{full_drug} {dose} {route} {freq}".strip()
                if duration:
                    line_text += f" for {duration}"
                if indication:
                    line_text += f" (Indication: {indication})"

                t_info = {
                    "item_number": idx,
                    "drug_name": full_drug,
                    "dose": dose,
                    "route": route,
                    "route_expanded": ROUTE_MAP.get(route, route),
                    "frequency": freq,
                    "frequency_expanded": FREQ_MAP.get(freq, freq),
                    "duration": duration or "Ongoing",
                    "indication": indication or "Standard therapy",
                    "line_text": line_text,
                    "tokens": [
                        {"type": "DRUG", "text": full_drug, "color": "teal"},
                        {"type": "DOSE", "text": dose, "color": "emerald"},
                        {"type": "ROUTE", "text": route, "expanded": ROUTE_MAP.get(route, route), "color": "blue"},
                        {"type": "FREQ", "text": freq, "expanded": FREQ_MAP.get(freq, freq), "color": "purple"},
                    ],
                }
                tokenized_meds.append(t_info)
                all_tokens.extend(t_info["tokens"])
            elif isinstance(med, str):
                t_info = self.tokenize_medication_line(med)
                t_info["item_number"] = idx
                tokenized_meds.append(t_info)
                all_tokens.extend(t_info.get("tokens", []))

        # Tokenize held / contraindicated medications
        tokenized_held = []
        for idx, h in enumerate(held_medications, start=1):
            if isinstance(h, dict):
                h_text = f"{h.get('name', '')} {h.get('dose', '')} - HELD. Rationale: {h.get('reason', 'Clinical contraindication')}".strip()
                tokenized_held.append({
                    "item_number": idx,
                    "text": h_text,
                    "drug": h.get("name"),
                    "reason": h.get("reason"),
                    "tokens": [
                        {"type": "HELD_DRUG", "text": h.get("name", ""), "color": "rose"},
                        {"type": "REASON", "text": h.get("reason", ""), "color": "amber"},
                    ]
                })
            elif isinstance(h, str):
                tokenized_held.append({
                    "item_number": idx,
                    "text": h.strip(),
                    "tokens": [{"type": "HELD_DRUG", "text": h.strip(), "color": "rose"}],
                })

        # Synthesize authoritative clinical prescription note text
        lines = [
            f"CLINICAL PRESCRIPTION & MEDICATION RECONCILIATION ORDER",
            f"PATIENT NAME: {patient_name} | PATIENT ID: {patient_id}",
            f"ENCOUNTER DATE: {encounter_date} | PRESCRIBING CLINICIAN: {prescriber}",
            f"ALLERGIES / SENSITIVITIES: {allergies}",
            "",
            "ACTIVE DISCHARGE MEDICATIONS PRESCRIBED:",
        ]

        for m in tokenized_meds:
            lines.append(f"{m['item_number']}. {m['drug_name']} {m['dose']} {m['route']} {m['frequency']}")
            if m.get("duration"):
                lines.append(f"   - Duration: {m['duration']}")
            if m.get("indication"):
                lines.append(f"   - Indication: {m['indication']}")

        if tokenized_held:
            lines.append("")
            lines.append("CONTRAINDICATED / HELD MEDICATIONS (STRICT CLINICAL ORDERS):")
            for h in tokenized_held:
                lines.append(f"• {h['text']}")

        if clinical_notes:
            lines.append("")
            lines.append("ADDITIONAL CLINICAL INSTRUCTIONS / MONITORING:")
            lines.append(clinical_notes)

        synthesized_text = "\n".join(lines)

        return {
            "patient_id": patient_id,
            "patient_name": patient_name,
            "prescribing_physician": prescriber,
            "encounter_date": encounter_date,
            "synthesized_text": synthesized_text,
            "medications": tokenized_meds,
            "held_medications": tokenized_held,
            "total_tokens_extracted": len(all_tokens),
            "tokens_breakdown": {
                "drugs_count": len(tokenized_meds),
                "held_count": len(tokenized_held),
                "all_tokens": all_tokens,
            },
        }


prescription_tokenizer = PrescriptionTokenizer()

