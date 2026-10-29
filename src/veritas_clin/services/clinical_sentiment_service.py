"""Clinical Sentiment, Trajectory, and Acuity Analysis Service.

In healthcare NLP, standard sentiment analysis (positive vs. negative) is clinical trajectory
and patient acuity analysis. A "positive" lab test may indicate pathology, while a "negative"
biopsy indicates health. This module calculates:
1. Trajectory Polarity Score (-1.0 to +1.0): Deteriorating/Critical -> Guarded -> Recovering/Favorable.
2. Acuity Level: STAT / Emergent, Urgent Attention, Routine / Stable.
3. Patient Distress Sentiment: Severe Distress, Moderate Discomfort, Comfortable / Controlled.
4. Grounded Evidence: Exact clinical phrases driving the assessment.
"""
from __future__ import annotations

import re
from typing import Any

# Domain lexicons tuned specifically for clinical records
FAVORABLE_INDICATORS = [
    r"\brecover(?:ed|ing|y)?\b",
    r"\bresolv(?:ed|ing|ution)\b",
    r"\bhemostasis achieved\b",
    r"\bafebrile\b",
    r"\bvital signs stable\b",
    r"\bstable\b",
    r"\btolerating\b",
    r"\beuvolemi(?:c|a)\b",
    r"\bambulat(?:ing|ory)\b",
    r"\bdischarged in good condition\b",
    r"\bdischarged\b",
    r"\bdenies (?:chest pain|dyspnea|shortness of breath|headache|nausea)\b",
    r"\bpatent\b",
    r"\bno acute distress\b",
    r"\bnormal limits\b",
    r"\buncomplicated\b",
    r"\bimprov(?:ed|ing|ement)\b",
    r"\bcleared\b",
    r"\bintact\b",
    r"\bre-established flow\b",
    r"\btimi-?3 flow\b",
]

CRITICAL_INDICATORS = [
    r"\bacute (?:stemi|myocardial infarction|infarct)\b",
    r"\bthromb(?:osis|otic|us)\b",
    r"\bocclusi(?:on|ve)\b",
    r"\bembol(?:ism|us)\b",
    r"\bsevere desaturation\b",
    r"\bdesaturat(?:ed|ion)\b",
    r"\bshock\b",
    r"\bsepsis\b",
    r"\bketoacidosis\b",
    r"\bnephrotoxici(?:ty|c)\b",
    r"\bacute kidney injury\b",
    r"\bcardiac arrest\b",
    r"\bintractable\b",
    r"\bsevere distress\b",
    r"\bcrushing (?:substernal )?chest pain\b",
    r"\baphasia\b",
    r"\bparesis\b",
    r"\bhemorrhag(?:e|ic)\b",
    r"\bhypotensi(?:on|ve)\b",
    r"\brisk of (?:bleeding|death|failure)\b",
]

GUARDED_INDICATORS = [
    r"\bheld\b",
    r"\bcontraindicat(?:ed|ion)\b",
    r"\bmonitor(?:ing|ed)\b",
    r"\belevat(?:ed|ion)\b",
    r"\bsurge\b",
    r"\bpeak(?:ed)?\b",
    r"\bstage [1-3]\b",
    r"\bresistant\b",
    r"\bpost-operat(?:ive|ion)\b",
    r"\bhigh probability\b",
    r"\bstenosis\b",
    r"\babnormal\b",
]


class ClinicalSentimentService:
    """Computes evidence-grounded clinical sentiment, patient trajectory, and acuity."""

    def __init__(self):
        self._fav_patterns = [re.compile(p, re.IGNORECASE) for p in FAVORABLE_INDICATORS]
        self._crit_patterns = [re.compile(p, re.IGNORECASE) for p in CRITICAL_INDICATORS]
        self._guarded_patterns = [re.compile(p, re.IGNORECASE) for p in GUARDED_INDICATORS]

    def analyze_text(self, text: str) -> dict[str, Any]:
        """Analyze raw clinical text or note."""
        if not text or not text.strip():
            return {
                "trajectory_score": 0.0,
                "sentiment_label": "Neutral / Undetermined",
                "acuity_level": "Routine / Stable",
                "acuity_color": "bg-slate-100 text-slate-700 border-slate-200",
                "patient_distress": "Minimal / Controlled",
                "favorable_findings": [],
                "concerning_findings": [],
                "summary": "Insufficient clinical text for sentiment analysis.",
            }

        sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
        favorable_matches = []
        critical_matches = []
        guarded_matches = []

        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) < 10:
                continue

            for pat in self._fav_patterns:
                if pat.search(s_clean):
                    favorable_matches.append(s_clean)
                    break

            for pat in self._crit_patterns:
                if pat.search(s_clean):
                    critical_matches.append(s_clean)
                    break

            for pat in self._guarded_patterns:
                if pat.search(s_clean):
                    guarded_matches.append(s_clean)
                    break

        fav_count = len(favorable_matches)
        crit_count = len(critical_matches)
        guarded_count = len(guarded_matches)

        # Raw Trajectory Score Calculation (-1.0 to +1.0)
        # Weighted: Critical = -2.0, Guarded = -0.5, Favorable = +1.5
        total_weight = (fav_count * 1.5) + (crit_count * 2.0) + (guarded_count * 0.5)
        if total_weight > 0:
            net = (fav_count * 1.5) - (crit_count * 2.0) - (guarded_count * 0.5)
            score = max(-1.0, min(1.0, round(net / total_weight, 2)))
        else:
            score = 0.0

        # Acuity and Distress Determination
        if crit_count >= 2 or score <= -0.4:
            acuity = "STAT / Emergent"
            acuity_color = "bg-rose-100 text-rose-800 border-rose-200"
            distress = "Severe Clinical Distress / High Acuity"
            sentiment_label = "Decompensated / Acute Risk"
            sentiment_color = "text-rose-700 bg-rose-50 border-rose-200"
        elif crit_count >= 1 or guarded_count >= 2 or score < 0.2:
            acuity = "Urgent / Guarded"
            acuity_color = "bg-amber-100 text-amber-800 border-amber-200"
            distress = "Moderate Discomfort / Active Monitoring"
            sentiment_label = "Guarded / Active Complications"
            sentiment_color = "text-amber-800 bg-amber-50 border-amber-200"
        else:
            acuity = "Stable / Routine"
            acuity_color = "bg-emerald-100 text-emerald-800 border-emerald-200"
            distress = "Controlled / Low Distress"
            sentiment_label = "Recovering / Favorable Trajectory"
            sentiment_color = "text-emerald-800 bg-emerald-50 border-emerald-200"

        # Construct summary sentence
        if score > 0.3:
            summary = "Patient demonstrates positive clinical recovery with resolving pathology and stable physiological parameters."
        elif score < -0.3:
            summary = "High clinical acuity with active acute events, organ stress, or significant hemodynamic/metabolic compromise."
        else:
            summary = "Guarded clinical trajectory with ongoing management of secondary complications and tight medical supervision."

        return {
            "trajectory_score": score,
            "sentiment_label": sentiment_label,
            "sentiment_color": sentiment_color,
            "acuity_level": acuity,
            "acuity_color": acuity_color,
            "patient_distress": distress,
            "favorable_count": fav_count,
            "concerning_count": crit_count + guarded_count,
            "favorable_findings": list(dict.fromkeys(favorable_matches))[:4],
            "concerning_findings": list(dict.fromkeys(critical_matches + guarded_matches))[:4],
            "summary": summary,
        }

    def analyze_patient_documents(self, documents: list[dict[str, Any]]) -> dict[str, Any]:
        """Aggregate sentiment across all documents for a patient."""
        if not documents:
            return self.analyze_text("")

        combined_text = "\n\n".join(d.get("extracted_text") or d.get("text") or "" for d in documents)
        result = self.analyze_text(combined_text)
        result["document_count"] = len(documents)
        return result


clinical_sentiment_service = ClinicalSentimentService()

