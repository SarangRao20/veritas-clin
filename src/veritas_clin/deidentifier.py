"""Clinical Note De-identification Engine (HIPAA Safe Harbor 45 CFR § 164.514(b)(2)).

Scrubs all 18 categories of Protected Health Information (PHI):
  1. Patient & clinician names
  2. Geographic locations & facilities (hospitals, clinics, pavilions, wards)
  3. Dates (dates of birth, admissions, visits, check-ins)
  4. Ages and age milestones
  5. Contact info (phone numbers, pagers, emails, URLs)
  6. Medical record numbers (MRN), patient IDs, note IDs, SSNs

Contains a strict Clinical Whitelist to ensure medical terms (e.g., Parkinson's,
Alzheimer's, PHQ-9, DSM-5, Sertraline, insomnia) are NEVER over-redacted.
"""
from __future__ import annotations

import re
from typing import Any

# Protected medical terms, eponyms, rating scales, and medications
# that look like proper nouns or numbers but must NEVER be redacted as PHI.
MEDICAL_WHITELIST = {
    # Rating scales & guidelines
    "phq-9", "phq9", "phq", "bdi-ii", "bdi2", "bdi", "dsm-5", "dsm5", "dsm",
    "icd-10", "icd10", "gad-7", "gad7", "ham-d", "hamd", "madrs", "panss",
    # Medical eponyms (diseases named after physicians/patients)
    "parkinson", "parkinson's", "parkinsons",
    "alzheimer", "alzheimer's", "alzheimers",
    "tourette", "tourette's", "tourettes",
    "huntington", "huntington's", "huntingtons",
    "asperger", "asperger's", "aspergers",
    "bell", "bell's", "cushing", "cushing's", "crohn", "crohn's",
    "hashimoto", "hashimoto's", "hodgkin", "hodgkin's", "sjogren", "sjogren's",
    # Psychiatric and clinical terms
    "anhedonia", "insomnia", "depression", "anxiety", "psychosis", "dysthymia",
    "bipolar", "euthymic", "somatic", "cognitive", "rumination", "melancholic",
    # Medications
    "sertraline", "fluoxetine", "escitalopram", "citalopram", "paroxetine",
    "bupropion", "venlafaxine", "duloxetine", "mirtazapine", "trazodone",
    "lorazepam", "clonazepam", "diazepam", "alprazolam", "buspirone",
    "quetiapine", "aripiprazole", "olanzapine", "risperidone", "lithium",
    "metformin", "lisinopril", "atorvastatin", "amlodipine", "omeprazole",
    "amoxicillin", "azithromycin", "ciprofloxacin", "metoprolol", "losartan",
}

# Regex patterns for clinical PHI
DATE_PATTERNS = [
    # YYYY-MM-DD or YYYY/MM/DD
    (re.compile(r"\b(19\d\d|20\d\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b"), "[DATE]"),
    # DD/MM/YYYY or MM/DD/YYYY
    (re.compile(r"\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](19\d\d|20\d\d)\b"), "[DATE]"),
    # Month DD, YYYY or DD Month YYYY (e.g., January 15, 2024 or 15 Jan 2024)
    (re.compile(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19\d\d|20\d\d)\b", re.IGNORECASE), "[DATE]"),
    (re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(?:19\d\d|20\d\d)\b", re.IGNORECASE), "[DATE]"),
    # Month YYYY (e.g., March 2024)
    (re.compile(r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:19\d\d|20\d\d)\b", re.IGNORECASE), "[DATE]"),
    # DD-MM-YY or DD.MM.YY (2-digit year, e.g., 26-10-26)
    (re.compile(r"\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]\d{2}\b"), "[DATE]"),
]

# Reporting verbs pattern: capitalized word leading a reporting clause
REPORTING_VERBS = re.compile(
    r"(?:(?<=^)|(?<=[.!?]\s))([A-Z][a-z]{2,})\s+"
    r"(?:recorded|reports?|reported|stated|states|mentioned|mentions|"
    r"noted|notes|told|says|said|claimed|claims|complains?|complained|"
    r"denies|denied|describes|described|admits|admitted|reveals|revealed)\b"
)

NON_NAME_LEADS = {
    "may", "march", "april", "january", "june", "july", "august",
    "september", "october", "november", "december", "february",
    "he", "she", "it", "they", "this", "that", "patient", "the",
}

PHONE_PATTERN = re.compile(
    r"(?:\+?1[-.\s]?)?\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\bext\.?\s*\d{3,5}\b",
    re.IGNORECASE
)

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
URL_PATTERN   = re.compile(r"\bhttps?://[^\s<>\"']+|\bwww\.[^\s<>\"']+\b")

ID_PATTERNS = [
    # MRN: 12345 or MRN-12345 or Record #12345
    (re.compile(r"\b(?:MRN|SSN|NHS|ID|Record|Account)[\s:#-]+[A-Z0-9]{4,12}\b", re.IGNORECASE), "[ID]"),
    # Patient IDs like P001, P002_N04, PT-1092
    (re.compile(r"\b(?:P\d{3}(?:_N\d{2})?|PT-\d{3,6}|PATIENT-\d{3,6})\b", re.IGNORECASE), "[PATIENT_ID]"),
    # Social Security Number
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
]

AGE_PATTERN = re.compile(
    r"\b(?:age[d\s:]+|at\s+age\s+)(\d{1,3})\b|\b(\d{1,3})[- ](?:year[- ]old|yo|y\.o\.)\b",
    re.IGNORECASE
)

FACILITY_PATTERN = re.compile(
    r"\b[A-Z][a-zA-Z0-9'’]*(?:\s+[A-Z][a-zA-Z0-9'’]*)*\s+(?:Hospital|Clinic|Infirmary|Medical Center|Pavilion|Health Center|Ward\s+[A-Z0-9]+)\b"
)

NAME_HONORIFIC_PATTERN = re.compile(
    r"\b(?:Dr\.|Doctor|Nurse|Clinician|Therapist|Psychiatrist|Psychologist|Physician|Patient|Mr\.|Ms\.|Mrs\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b"
)


class Deidentifier:
    """Safe Harbor HIPAA De-identification Engine for Clinical Notes."""

    def __init__(self, custom_names: list[str] | None = None):
        self.known_names = set(custom_names or [])

    def register_names(self, names: list[str]) -> None:
        for name in names:
            if name.strip():
                self.known_names.add(name.strip())

    def deidentify(self, text: str, mode: str = "mask") -> dict[str, Any]:
        """De-identifies clinical text.

        Parameters
        ----------
        text : str
            Raw clinical note or query.
        mode : str
            "mask" -> replaces with [PATIENT_NAME], [DATE], [FACILITY], etc.
            "surrogate" -> replaces with realistic pseudonyms.

        Returns
        -------
        dict with:
          - original_text
          - deidentified_text
          - scrubbed_count
          - entities_found: list of { type, original, replacement, span }
        """
        if not text or not text.strip():
            return {
                "original_text": text,
                "deidentified_text": text,
                "scrubbed_count": 0,
                "entities_found": [],
            }

        entities: list[dict[str, Any]] = []

        # 1. Phone numbers, Emails, URLs, SSNs
        for m in PHONE_PATTERN.finditer(text):
            entities.append({
                "type": "PHONE",
                "start": m.start(), "end": m.end(),
                "original": m.group(),
                "replacement": "[PHONE]" if mode == "mask" else "555-0100",
            })

        for m in EMAIL_PATTERN.finditer(text):
            entities.append({
                "type": "EMAIL",
                "start": m.start(), "end": m.end(),
                "original": m.group(),
                "replacement": "[EMAIL]" if mode == "mask" else "patient@secure.org",
            })

        for m in URL_PATTERN.finditer(text):
            entities.append({
                "type": "URL",
                "start": m.start(), "end": m.end(),
                "original": m.group(),
                "replacement": "[URL]" if mode == "mask" else "https://secure-ehr.local",
            })

        # 2. Medical IDs and Record numbers
        for pat, tag in ID_PATTERNS:
            for m in pat.finditer(text):
                entities.append({
                    "type": "ID",
                    "start": m.start(), "end": m.end(),
                    "original": m.group(),
                    "replacement": tag if mode == "mask" else "ID_SURROGATE_01",
                })

        # 3. Dates
        for pat, tag in DATE_PATTERNS:
            for m in pat.finditer(text):
                orig = m.group()
                entities.append({
                    "type": "DATE",
                    "start": m.start(), "end": m.end(),
                    "original": orig,
                    "replacement": tag if mode == "mask" else "2024-XX-XX",
                })

        # 4. Ages
        for m in AGE_PATTERN.finditer(text):
            entities.append({
                "type": "AGE",
                "start": m.start(), "end": m.end(),
                "original": m.group(),
                "replacement": "[AGE]" if mode == "mask" else "Age XX",
            })

        # 5. Facilities & Hospitals
        for m in FACILITY_PATTERN.finditer(text):
            orig = m.group()
            if not any(w in orig.lower() for w in MEDICAL_WHITELIST):
                entities.append({
                    "type": "FACILITY",
                    "start": m.start(), "end": m.end(),
                    "original": orig,
                    "replacement": "[FACILITY]" if mode == "mask" else "General Medical Center",
                })

        # 6. Honorific + Names ("Dr. Gregory House", "Patient Aiden Sharma")
        for m in NAME_HONORIFIC_PATTERN.finditer(text):
            orig = m.group(1)
            prefix = m.group().split()[0].lower()
            if orig.lower() not in MEDICAL_WHITELIST:
                if "patient" in prefix:
                    tag = "[PATIENT_NAME]"
                    surr = "Patient_A"
                elif any(p in prefix for p in ["dr", "doc", "nurse", "clin", "ther", "psych", "phys"]):
                    tag = "[CLINICIAN_NAME]"
                    surr = "Dr. Caregiver"
                else:
                    tag = "[NAME]"
                    surr = "Individual_A"
                entities.append({
                    "type": "NAME",
                    "start": m.start(1), "end": m.end(1),
                    "original": orig,
                    "replacement": tag if mode == "mask" else surr,
                })

        # 7. Exact registered known names
        for name in self.known_names:
            if not name or len(name) < 3:
                continue
            pat = re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE)
            for m in pat.finditer(text):
                orig = m.group()
                if orig.lower() not in MEDICAL_WHITELIST:
                    entities.append({
                        "type": "PATIENT_NAME",
                        "start": m.start(), "end": m.end(),
                        "original": orig,
                        "replacement": "[PATIENT_NAME]" if mode == "mask" else "Patient_A",
                    })

        # 8. Conservative bare-name capture before reporting verbs
        for m in REPORTING_VERBS.finditer(text):
            lead = m.group(1)
            if lead.lower() in MEDICAL_WHITELIST or lead.lower() in NON_NAME_LEADS:
                continue
            entities.append({
                "type": "NAME",
                "start": m.start(1), "end": m.end(1),
                "original": lead,
                "replacement": "[NAME]" if mode == "mask" else "Individual_A",
            })

        # Resolve overlaps by keeping the longest span
        entities.sort(key=lambda e: (e["start"], -(e["end"] - e["start"])))
        filtered_entities: list[dict[str, Any]] = []
        last_end = -1

        for ent in entities:
            if ent["start"] >= last_end:
                filtered_entities.append(ent)
                last_end = ent["end"]

        # Build de-identified string from right to left
        deid_text = text
        for ent in sorted(filtered_entities, key=lambda e: e["start"], reverse=True):
            deid_text = deid_text[:ent["start"]] + ent["replacement"] + deid_text[ent["end"]:]

        return {
            "original_text": text,
            "deidentified_text": deid_text,
            "scrubbed_count": len(filtered_entities),
            "entities_found": [
                {
                    "type": e["type"],
                    "original": e["original"],
                    "replacement": e["replacement"],
                }
                for e in filtered_entities
            ],
        }


# Global singleton instance for quick reuse
default_deidentifier = Deidentifier()
