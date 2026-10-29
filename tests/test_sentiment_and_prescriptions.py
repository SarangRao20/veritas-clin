import pytest
from veritas_clin.services.clinical_sentiment_service import clinical_sentiment_service
from veritas_clin.services.prescription_tokenizer import prescription_tokenizer


def test_clinical_sentiment_scoring():
    favorable_text = """
    Patient is recovering well on post-operative day 7 following hemicolectomy.
    Vital signs stable. Hemostasis achieved. Denies chest pain or dyspnea.
    Patient is ambulatory in the surgical hallway. Discharged in good condition.
    """
    res_fav = clinical_sentiment_service.analyze_text(favorable_text)
    assert res_fav["trajectory_score"] > 0
    assert "Recovering" in res_fav["sentiment_label"] or "Stable" in res_fav["acuity_level"]

    critical_text = """
    Acute STEMI with 95% thrombotic occlusion of proximal LAD.
    Patient developed acute kidney injury and severe desaturation to 88%.
    Tachypnea, metabolic acidosis, and shock.
    """
    res_crit = clinical_sentiment_service.analyze_text(critical_text)
    assert res_crit["trajectory_score"] < 0
    assert "STAT" in res_crit["acuity_level"] or "Risk" in res_crit["sentiment_label"] or "Guarded" in res_crit["acuity_level"]


def test_prescription_tokenization():
    form_data = {
        "patient_id": "PT-4091",
        "patient_name": "Marcus Vance",
        "prescribing_physician": "Eleanor Vance, MD",
        "encounter_date": "2025-09-20",
        "medications": [
            {
                "name": "Ticagrelor",
                "brand": "Brilinta",
                "dose": "90 mg",
                "route": "PO",
                "frequency": "BID",
                "duration": "12 months",
                "indication": "Post-PCI LAD Stenting",
            },
            {
                "name": "Atorvastatin",
                "brand": "Lipitor",
                "dose": "80 mg",
                "route": "PO",
                "frequency": "QHS",
                "duration": "Indefinite",
                "indication": "High-intensity lipid lowering",
            },
        ],
        "held_medications": [
            {"name": "Lisinopril", "dose": "20 mg", "reason": "Contrast-Associated Acute Kidney Injury"},
        ],
        "allergies": "NKDA",
        "clinical_notes": "Re-check basic metabolic panel in outpatient nephrology in 7 days.",
    }

    res = prescription_tokenizer.tokenize_form(form_data)
    assert res["patient_id"] == "PT-4091"
    assert len(res["medications"]) == 2
    assert res["medications"][0]["drug_name"] == "Ticagrelor (Brilinta)"
    assert res["medications"][0]["route_expanded"] == "Oral (by mouth)"
    assert res["medications"][0]["frequency_expanded"] == "Twice daily"
    assert len(res["held_medications"]) == 1
    assert "HELD" in res["held_medications"][0]["text"]
    assert "CLINICAL PRESCRIPTION & MEDICATION RECONCILIATION ORDER" in res["synthesized_text"]

