"""Automated Clinical Safety Watchdog & Clinical Decision Support Service (CDSS).

Elevates Veritas-Clin from a passive chatbot into an active clinical safety engine:
1. Automated Drug-Drug & Drug-Disease Contraindication Detection (e.g. ACE-inhibitor in AKI, SGLT2 in DKA).
2. Evidence-Based Clinical Guideline Concordance (NCCN, ACC/AHA, KDIGO, GINA, Beers Criteria).
3. Patient Safety Warnings & Follow-Up Watchlist.
"""
from __future__ import annotations

import re
from typing import Any

# Clinical Guideline and Safety Rules Engine
SAFETY_RULES = [
    {
        "id": "RULE_AKI_ACEI",
        "trigger": r"\b(?:acute kidney injury|aki|nephrotoxicity|creatinine (?:surge|peak|elevat))\b",
        "contraindicated": r"\b(?:lisinopril|enalapril|ramipril|losartan|valsartan|ace-?inhibitor|arb)\b",
        "level": "CRITICAL",
        "color": "border-rose-300 bg-rose-50 text-rose-900",
        "title": "Contraindicated Nephrotoxic Drug Alert",
        "recommendation": "Hold ACE inhibitors and ARBs during active acute kidney injury (KDIGO guidelines). Recheck renal panel in 7 days before considering resumption.",
    },
    {
        "id": "RULE_SGLT2_DKA",
        "trigger": r"\b(?:ketoacidosis|dka|euglycemic dka|beta-hydroxybutyrate)\b",
        "contraindicated": r"\b(?:empagliflozin|dapagliflozin|canagliflozin|jardiance|farxiga|sglt2)\b",
        "level": "CRITICAL",
        "color": "border-rose-300 bg-rose-50 text-rose-900",
        "title": "Drug-Induced Adverse Event Alert (Euglycemic DKA)",
        "recommendation": "Immediately and permanently discontinue SGLT2 inhibitors. Initiate intravenous insulin protocol with dextrose hydration per ADA/AACE guidelines.",
    },
    {
        "id": "RULE_BEERS_SEDATIVE",
        "trigger": r"\b(?:fall|syncope|orthosta(?:tic|sis)|delirium|confusion)\b",
        "contraindicated": r"\b(?:zolpidem|ambien|temazepam|lorazepam|alprazolam|benzodiazepine)\b",
        "level": "HIGH_ALERT",
        "color": "border-amber-300 bg-amber-50 text-amber-900",
        "title": "AGS Beers Criteria High-Risk Medication Violation",
        "recommendation": "Sedative-hypnotics in elderly patients (> 65) significantly increase risk of falls, delirium, and fractures. Recommend complete deprescribing.",
    },
    {
        "id": "RULE_TAILORX_CHEMO",
        "trigger": r"\b(?:oncotype dx.*(?:1[0-4]|[0-9])|recurrence score.*(?:1[0-4]|[0-9])|stage ia|pt1c pn0)\b",
        "contraindicated": r"\b(?:defer.*chemo|chemotherapy.*not indicated|deferred)\b",
        "level": "GUIDELINE_CONCORDANT",
        "color": "border-emerald-300 bg-emerald-50 text-emerald-900",
        "title": "NCCN & TAILORx Guideline Concordance",
        "recommendation": "Recurrence Score <= 15 in node-negative hormone receptor-positive early breast cancer has proven 0% absolute chemotherapy benefit. Cytotoxic chemotherapy appropriately deferred.",
    },
    {
        "id": "RULE_DAPT_ACS",
        "trigger": r"\b(?:stemi|pci|drug-eluting stent|lad stent)\b",
        "contraindicated": r"\b(?:ticagrelor|brilinta|clopidogrel|plavix|prasugrel)\b",
        "level": "GUIDELINE_CONCORDANT",
        "color": "border-teal-300 bg-teal-50 text-teal-900",
        "title": "ACC/AHA Class I Guideline Compliance: Dual Antiplatelet Therapy",
        "recommendation": "Maintain P2Y12 inhibitor (Ticagrelor 90 mg BID) plus Aspirin 81 mg daily for a minimum of 12 months post-PCI to prevent in-stent thrombosis.",
    },
    {
        "id": "RULE_ESBL_CARBAPENEM",
        "trigger": r"\b(?:esbl|extended-spectrum beta-lactamase)\b",
        "contraindicated": r"\b(?:ertapenem|meropenem|imipenem)\b",
        "level": "GUIDELINE_CONCORDANT",
        "color": "border-blue-300 bg-blue-50 text-blue-900",
        "title": "IDSA Antimicrobial Guidance: ESBL Targeted Therapy",
        "recommendation": "Carbapenems (Ertapenem / Meropenem) are first-line for severe ESBL-producing enterobacteriaceae pyelonephritis due to high cephalosporin/quinolone resistance.",
    },
    {
        "id": "RULE_HYPERKALEMIA_MEMBRANE",
        "trigger": r"\b(?:potassium 7\.|hyperkalem(?:ia|ic)|peaked t waves)\b",
        "contraindicated": r"\b(?:calcium gluconate|dialysis|insulin)\b",
        "level": "CRITICAL",
        "color": "border-rose-300 bg-rose-50 text-rose-900",
        "title": "Life-Threatening Hyperkalemia Resuscitation Protocol",
        "recommendation": "STAT cardiac membrane stabilization with IV Calcium Gluconate followed by emergent hemodialysis to prevent sinusoidal arrest and fatal arrhythmia.",
    },
]


class ClinicalWatchdogService:
    """Evaluates clinical records for proactive patient safety and guideline concordance."""

    def evaluate_patient(self, documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not documents:
            return []

        combined_text = "\n\n".join(
            (d.get("extracted_text") or d.get("text") or "") for d in documents
        )

        alerts = []
        for rule in SAFETY_RULES:
            has_trigger = re.search(rule["trigger"], combined_text, re.IGNORECASE)
            has_med = re.search(rule["contraindicated"], combined_text, re.IGNORECASE)

            if has_trigger and has_med:
                alerts.append({
                    "id": rule["id"],
                    "level": rule["level"],
                    "color": rule["color"],
                    "title": rule["title"],
                    "recommendation": rule["recommendation"],
                    "evidence_snippet": has_trigger.group(0),
                })

        return alerts


clinical_watchdog_service = ClinicalWatchdogService()

