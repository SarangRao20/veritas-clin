#!/usr/bin/env python3
"""Populate rich, realistic entries in Veritas-Clin CRM database.

Entries populated:
1. Clinical Staff Accounts (users table): Attendings, specialists, and residents.
2. Longitudinal Clinical Encounters (encounters table): All hospital & clinic visits.
3. Clinical Risk & Anomaly Flags (patient_flags table): Document-grounded alerts.
4. Compliance & Access Audit Trail (audit_log table): Clinician access logs.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from veritas_clin.config import CLINICAL_RECORDS_DIR, DATABASE_PATH
from veritas_clin.document_nlp import DocumentProcessor, LocalSentenceEmbedder, seed_clinical_records
from veritas_clin.models.database import init_schema
from veritas_clin.services.auth_service import hash_password
from veritas_clin.store.document_store import DocumentStore


CLINICAL_STAFF = [
    {
        "username": "dr_vance",
        "email": "eleanor.vance@metrohealth.org",
        "role": "clinician",
        "password": "ClinicalDoctor2026!",
        "title": "Dr. Eleanor Vance, MD (Chief of Cardiology)",
    },
    {
        "username": "dr_gallagher",
        "email": "siobhan.gallagher@metrohealth.org",
        "role": "clinician",
        "password": "ClinicalDoctor2026!",
        "title": "Dr. Siobhan Gallagher, MD, FASN (Nephrology)",
    },
    {
        "username": "dr_foster",
        "email": "raymond.foster@stjudehealth.org",
        "role": "clinician",
        "password": "ClinicalDoctor2026!",
        "title": "Dr. Raymond Foster, MD (Endocrinology)",
    },
    {
        "username": "dr_vargas",
        "email": "patricia.vargas@valleypres.org",
        "role": "clinician",
        "password": "ClinicalDoctor2026!",
        "title": "Dr. Patricia Vargas, MD, FCCP (Pulmonary Medicine)",
    },
    {
        "username": "dr_brody",
        "email": "david.brody@valleypres.org",
        "role": "clinician",
        "password": "ClinicalDoctor2026!",
        "title": "Dr. David S. Brody, MD, PhD (Stroke Neurology)",
    },
    {
        "username": "nurse_sarah",
        "email": "sarah.jenkins@hospital.org",
        "role": "viewer",
        "password": "ClinicalViewer2026!",
        "title": "Sarah Jenkins, RN (Cardiac ICU Nurse)",
    },
]

PATIENT_ENCOUNTERS = [
    # PT-4091: Acute STEMI -> PCI -> Contrast AKI -> Discharge
    {
        "patient_id": "PT-4091",
        "filename": "PT-4091_2025-09-14_Emergency_Admission_H&P.txt",
        "encounter_type": "Emergency H&P",
        "occurred_at": "2025-09-14",
        "title": "Emergency Department Admission — Acute Anteroseptal STEMI",
        "summary": "Presented with severe crushing substernal chest pain 8/10 radiating to jaw. ECG showed acute ST elevations in V1-V4; troponin-I elevated at 4.82 ng/mL. Baseline creatinine normal at 1.02 mg/dL. Activated emergency cath lab.",
    },
    {
        "patient_id": "PT-4091",
        "filename": "PT-4091_2025-09-15_Cardiac_Catheterization_Operative_Report.txt",
        "encounter_type": "Operative Procedure",
        "occurred_at": "2025-09-15",
        "title": "Cardiac Catheterization & Percutaneous Coronary Intervention",
        "summary": "95% thrombotic proximal LAD stenosis successfully revascularized with 3.5x24mm Synergy DES, restoring TIMI 3 flow. Total contrast volume 145 mL Omnipaque-350. Placed on DAPT (Aspirin + Ticagrelor) and Enoxaparin.",
    },
    {
        "patient_id": "PT-4091",
        "filename": "PT-4091_2025-09-17_Inpatient_Nephrology_Consult_and_Labs.txt",
        "encounter_type": "Specialty Consult",
        "occurred_at": "2025-09-17",
        "title": "Nephrology Consult — KDIGO Stage 2 Contrast Acute Kidney Injury",
        "summary": "Day 2 post-PCI acute creatinine surge from 1.02 to 2.38 mg/dL (>100% elevation) with eGFR dropping to 28 mL/min/1.73m² and oliguria (26 mL/hr). Enoxaparin held due to bleeding risk; Lisinopril held; IV hydration started.",
    },
    {
        "patient_id": "PT-4091",
        "filename": "PT-4091_2025-09-20_Hospital_Discharge_Summary.txt",
        "encounter_type": "Discharge Summary",
        "occurred_at": "2025-09-20",
        "title": "Hospital Discharge Summary — Recovering AKI & Post-PCI Trajectory",
        "summary": "Creatinine recovered to 1.32 mg/dL (eGFR 58). Patient stable and chest pain free. Discharged on Ticagrelor 90mg BID, Aspirin 81mg, Metoprolol 25mg BID, Atorvastatin 80mg. Lisinopril kept strictly held.",
    },

    # PT-7215: T2DM -> ESBL Pyelonephritis -> SGLT2 euDKA -> Discharge
    {
        "patient_id": "PT-7215",
        "filename": "PT-7215_2025-10-04_Outpatient_Endocrinology_Clinic_Note.txt",
        "encounter_type": "Outpatient Clinic Visit",
        "occurred_at": "2025-10-04",
        "title": "Quarterly Diabetes Evaluation — Uncontrolled T2DM",
        "summary": "HbA1c suboptimal at 9.4% on Empagliflozin, Metformin, Glimepiride. Baseline creatinine normal at 0.88 mg/dL. Patient noted mild urinary frequency without fevers.",
    },
    {
        "patient_id": "PT-7215",
        "filename": "PT-7215_2025-10-11_Emergency_Urgent_Care_Evaluation.txt",
        "encounter_type": "Emergency Evaluation",
        "occurred_at": "2025-10-11",
        "title": "Emergency Department Admission — Acute Pyelonephritis & Sepsis",
        "summary": "Presented with fever 38.9°C, rigors, nausea, and severe right costovertebral angle tenderness. Marked leukocytosis 16.8 x 10^3/uL, pyuria with nitrites. Creatinine rose to 1.42 mg/dL. Metformin and glimepiride held.",
    },
    {
        "patient_id": "PT-7215",
        "filename": "PT-7215_2025-10-12_Microbiology_and_Renal_Ultrasound_Report.txt",
        "encounter_type": "Diagnostic Pathology & Imaging",
        "occurred_at": "2025-10-12",
        "title": "Microbiology & Renal Ultrasound — ESBL E. coli & Euglycemic DKA",
        "summary": "Urine culture positive for ESBL E. coli (>100k CFU/mL) resistant to Ceftriaxone & Cipro. Serum beta-hydroxybutyrate elevated at 2.1 mmol/L with anion gap 17 mEq/L (SGLT2 euDKA). Escalated to IV Ertapenem; Empagliflozin stopped.",
    },
    {
        "patient_id": "PT-7215",
        "filename": "PT-7215_2025-10-16_Inpatient_Discharge_Summary.txt",
        "encounter_type": "Discharge Summary",
        "occurred_at": "2025-10-16",
        "title": "Inpatient Discharge Summary — ESBL Resolution & Insulin Transition",
        "summary": "Afebrile for 4 days post IV Ertapenem. Anion gap normalized; transitioned to basal-bolus insulin regimen (Lantus + Humalog) and oral Nitrofurantoin 100mg BID step-down for 5 days. Empagliflozin permanently contraindicated.",
    },

    # PT-3892: Post-op Hemicolectomy -> Pulmonary Embolism -> Anticoagulation -> Discharge
    {
        "patient_id": "PT-3892",
        "filename": "PT-3892_2025-10-18_Surgical_Followup_Progress_Note.txt",
        "encounter_type": "Inpatient Progress Note",
        "occurred_at": "2025-10-18",
        "title": "Post-Operative Day 4 Surgical Review — Left Hemicolectomy",
        "summary": "POD 4 status post elective laparoscopic left hemicolectomy for diverticular stricture. Incisions clean. Flatus passed; delayed hallway ambulation due to soreness. On prophylactic Enoxaparin 40mg SQ daily.",
    },
    {
        "patient_id": "PT-3892",
        "filename": "PT-3892_2025-10-21_Rapid_Response_and_Pulmonary_Evaluation.txt",
        "encounter_type": "Rapid Response Evaluation",
        "occurred_at": "2025-10-21",
        "title": "Rapid Response Activation — Acute Pleuritic Pain & Hypoxia",
        "summary": "POD 7 sudden acute right pleuritic chest pain and hypoxia (SpO2 88% room air). Tachycardia HR 118 bpm, tachypnea RR 26. D-dimer critically elevated at 2,940 ng/mL FEU; Wells score 6.0 (High clinical probability).",
    },
    {
        "patient_id": "PT-3892",
        "filename": "PT-3892_2025-10-21_CT_Pulmonary_Angiogram_Report.txt",
        "encounter_type": "Diagnostic Imaging",
        "occurred_at": "2025-10-21",
        "title": "CT Pulmonary Angiography — Acute Segmental PE Confirmed",
        "summary": "Helical CTPA demonstrated acute occlusive filling defects in right lower lobe segmental and subsegmental pulmonary arteries with wedge pulmonary infarction. RV/LV ratio normal at 0.88 without right heart strain.",
    },
    {
        "patient_id": "PT-3892",
        "filename": "PT-3892_2025-10-26_Comprehensive_Discharge_Summary.txt",
        "encounter_type": "Discharge Summary",
        "occurred_at": "2025-10-26",
        "title": "Hospital Discharge Summary — Provoked VTE Anticoagulation Plan",
        "summary": "Hypoxia completely resolved (SpO2 98% room air). Therapeutic anticoagulation initiated with Enoxaparin transitioned to oral Apixaban 10mg BID through day 7, then 5mg BID for 3-6 months. Surgical wound healed.",
    },

    # PT-5120: TIA / Stroke -> MRI & Carotid Duplex -> Anticoagulation / CEA Plan -> Discharge
    {
        "patient_id": "PT-5120",
        "filename": "PT-5120_2025-10-22_Emergency_Neurology_Admission.txt",
        "encounter_type": "Emergency Stroke Evaluation",
        "occurred_at": "2025-10-22",
        "title": "Emergency Department Admission — Stroke Alert & New Atrial Fibrillation",
        "summary": "Presented with acute left facial droop, left arm weakness, and dysarthria (NIHSS 4). CT head negative for acute hemorrhage. 12-lead EKG revealed newly diagnosed paroxysmal atrial fibrillation (CHA2DS2-VASc = 4). DAPT started.",
    },
    {
        "patient_id": "PT-5120",
        "filename": "PT-5120_2025-10-23_MRI_Brain_and_Carotid_Doppler_Report.txt",
        "encounter_type": "Diagnostic Neuroimaging & Ultrasound",
        "occurred_at": "2025-10-23",
        "title": "Brain MRI & Carotid Duplex — Multifocal Infarcts & 70-85% Right ICA Stenosis",
        "summary": "Brain MRI confirmed acute punctate DWI-positive infarctions in right MCA territory without hemorrhage. Carotid Doppler revealed critical symptomatic 70%-85% right internal carotid artery stenosis (PSV 245 cm/sec).",
    },
    {
        "patient_id": "PT-5120",
        "filename": "PT-5120_2025-10-27_Neurology_Discharge_Summary.txt",
        "encounter_type": "Discharge Summary",
        "occurred_at": "2025-10-27",
        "title": "Neurology Discharge Summary — Carotid Endarterectomy & DOAC Strategy",
        "summary": "Neurological deficits significantly improved (Discharge NIHSS 1: normal arm power, resolved dysarthria). Elective carotid endarterectomy scheduled for 2025-11-08. Transitioning to Apixaban monotherapy on 2025-10-29.",
    },
]

CLINICAL_FLAGS = [
    {
        "flag_id": "FLAG-4091-AKI",
        "patient_id": "PT-4091",
        "kind": "renal_alert",
        "label": "Contrast-Associated Acute Kidney Injury (KDIGO Stage 2)",
        "status": "resolved",
        "urgency": "critical",
        "confidence": 0.96,
        "rationale": "Serum creatinine surged from baseline 1.02 mg/dL to 2.38 mg/dL (>100% rise) with eGFR dropping to 28 mL/min/1.73m² and oliguria within 48h of 145 mL Omnipaque-350 contrast.",
        "evidence": [
            {"filename": "PT-4091_2025-09-17_Inpatient_Nephrology_Consult_and_Labs.txt", "snippet": "Serum Creatinine: 2.38 mg/dL (CRITICAL ALERT: >100% surge over baseline), Estimated GFR: 28 mL/min/1.73m²", "assertion": "AFFIRMED"},
            {"filename": "PT-4091_2025-09-15_Cardiac_Catheterization_Operative_Report.txt", "snippet": "Radiocontrast agent: Omnipaque-350 (iohexol). Total contrast volume administered: 145 mL.", "assertion": "AFFIRMED"}
        ],
    },
    {
        "flag_id": "FLAG-4091-HEMORRHAGE",
        "patient_id": "PT-4091",
        "kind": "medication_safety",
        "label": "Compound Hemorrhagic Risk (DAPT + LMWH in Acute Renal Failure)",
        "status": "resolved",
        "urgency": "med",
        "confidence": 0.89,
        "rationale": "Patient maintained on Ticagrelor 90mg BID and Aspirin 81mg daily while receiving Enoxaparin. Acute renal insufficiency impairs low-molecular-weight heparin clearance, dramatically heightening bleeding risk.",
        "evidence": [
            {"filename": "PT-4091_2025-09-17_Inpatient_Nephrology_Consult_and_Labs.txt", "snippet": "Discontinue subcutaneous Enoxaparin immediately given eGFR < 30 mL/min; maintain DAPT for stent patency", "assertion": "AFFIRMED"}
        ],
    },
    {
        "flag_id": "FLAG-7215-ESBL",
        "patient_id": "PT-7215",
        "kind": "microbiology_alert",
        "label": "Extended-Spectrum Beta-Lactamase (ESBL) Escherichia coli Pyelonephritis",
        "status": "resolved",
        "urgency": "critical",
        "confidence": 0.98,
        "rationale": "Urine culture positive for >100,000 CFU/mL of ESBL E. coli resistant to Ceftriaxone (MIC > 64) and fluoroquinolones. Initial empiric third-generation cephalosporin was clinically ineffective.",
        "evidence": [
            {"filename": "PT-7215_2025-10-12_Microbiology_and_Renal_Ultrasound_Report.txt", "snippet": "CRITICAL INFECTIOUS DISEASE ALERT: Pathogen is an ESBL-producing Escherichia coli resistant to third-generation cephalosporins and fluoroquinolones.", "assertion": "AFFIRMED"}
        ],
    },
    {
        "flag_id": "FLAG-7215-EUDKA",
        "patient_id": "PT-7215",
        "kind": "endocrine_alert",
        "label": "SGLT2-Inhibitor Associated Euglycemic Diabetic Ketoacidosis (euDKA)",
        "status": "resolved",
        "urgency": "critical",
        "confidence": 0.94,
        "rationale": "Elevated anion gap (17 mEq/L), metabolic acidosis (HCO3 16 mEq/L), and serum beta-hydroxybutyrate 2.1 mmol/L despite blood glucose only 162 mg/dL. Triggered by Empagliflozin during acute infection.",
        "evidence": [
            {"filename": "PT-7215_2025-10-12_Microbiology_and_Renal_Ultrasound_Report.txt", "snippet": "Euglycemic Diabetic Ketoacidosis (euDKA) confirmed in the setting of SGLT2 inhibitor (Empagliflozin) therapy combined with acute severe pyelonephritis", "assertion": "AFFIRMED"},
            {"filename": "PT-7215_2025-10-16_Inpatient_Discharge_Summary.txt", "snippet": "EMPAGLIFLOZIN (JARDIANCE) IS PERMANENTLY DISCONTINUED. Documented allergy/adverse reaction added to EMR.", "assertion": "AFFIRMED"}
        ],
    },
    {
        "flag_id": "FLAG-3892-PE",
        "patient_id": "PT-3892",
        "kind": "pulmonary_alert",
        "label": "Acute Occlusive Segmental Pulmonary Embolism & Hypoxia",
        "status": "resolved",
        "urgency": "critical",
        "confidence": 0.97,
        "rationale": "Day 7 post-op sudden dyspnea and pleuritic chest pain with SpO2 dropping to 88% and D-dimer 2,940 ng/mL FEU. CTPA confirmed acute occlusive filling defects in right lower lobe segmental and subsegmental branches.",
        "evidence": [
            {"filename": "PT-3892_2025-10-21_CT_Pulmonary_Angiogram_Report.txt", "snippet": "POSITIVE FOR ACUTE PULMONARY EMBOLISM: Demonstrating acute occlusive filling defects involving right lower lobe posterior and lateral basal segmental arteries.", "assertion": "AFFIRMED"},
            {"filename": "PT-3892_2025-10-21_Rapid_Response_and_Pulmonary_Evaluation.txt", "snippet": "D-Dimer Level: 2,940 ng/mL FEU — CRITICALLY ELEVATED (> 5-fold upper limit). Modified Wells Score: 6.0 points (High Probability).", "assertion": "AFFIRMED"}
        ],
    },
    {
        "flag_id": "FLAG-5120-STROKE",
        "patient_id": "PT-5120",
        "kind": "neurology_alert",
        "label": "Acute Ischemic Stroke with Symptomatic 70-85% Internal Carotid Stenosis",
        "status": "active",
        "urgency": "critical",
        "confidence": 0.96,
        "rationale": "Brain MRI confirmed acute multifocal DWI-positive ischemic infarctions in right MCA distribution. Carotid duplex revealed severe 70%-85% right internal carotid stenosis with plaque ulceration, plus paroxysmal atrial fibrillation.",
        "evidence": [
            {"filename": "PT-5120_2025-10-23_MRI_Brain_and_Carotid_Doppler_Report.txt", "snippet": "CRITICAL CLINICAL VASCULAR ALERT: High-grade symptomatic Right Internal Carotid Artery stenosis (70%-85%) with plaque ulceration.", "assertion": "AFFIRMED"},
            {"filename": "PT-5120_2025-10-22_Emergency_Neurology_Admission.txt", "snippet": "Atrial fibrillation with controlled ventricular response. High thromboembolic risk (CHA2DS2-VASc score = 4).", "assertion": "AFFIRMED"}
        ],
    },
]


def populate_crm():
    print(f"Connecting to database: {DATABASE_PATH}")
    init_schema(DATABASE_PATH)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    # 1. First index any pending clinical records (e.g. PT-5120)
    store = DocumentStore(DATABASE_PATH)
    proc = DocumentProcessor(LocalSentenceEmbedder())
    seed_clinical_records(store, proc, CLINICAL_RECORDS_DIR)

    doc_lookup = {}
    for row in conn.execute("SELECT document_id, filename, patient_id FROM documents").fetchall():
        doc_lookup[row["filename"]] = row["document_id"]

    now = datetime.now(timezone.utc).isoformat()

    # 2. Populate Clinical Staff (users)
    print("\n--- Populating Clinical Staff in CRM (users table) ---")
    user_ids = {}
    for staff in CLINICAL_STAFF:
        existing = conn.execute("SELECT user_id FROM users WHERE email = ?", (staff["email"],)).fetchone()
        if existing:
            user_ids[staff["username"]] = existing["user_id"]
            print(f"  • Existing user: {staff['title']} ({staff['email']})")
        else:
            uid = uuid.uuid4().hex
            hashed = hash_password(staff["password"])
            conn.execute(
                """INSERT INTO users (user_id, email, username, hashed_pw, role, is_active, created_at)
                   VALUES (?, ?, ?, ?, ?, 1, ?)""",
                (uid, staff["email"], staff["username"], hashed, staff["role"], now),
            )
            user_ids[staff["username"]] = uid
            print(f"  + Added staff: {staff['title']} [Role: {staff['role']}]")

    # 3. Populate Encounters (encounters table)
    print("\n--- Populating Clinical Encounters in CRM (encounters table) ---")
    for enc in PATIENT_ENCOUNTERS:
        doc_id = doc_lookup.get(enc["filename"])
        enc_id = f"enc-{enc['patient_id']}-{enc['occurred_at']}"
        existing = conn.execute("SELECT encounter_id FROM encounters WHERE encounter_id = ?", (enc_id,)).fetchone()
        if existing:
            conn.execute(
                """UPDATE encounters
                   SET title = ?, summary = ?, source_document_id = ?, occurred_at = ?, encounter_type = ?
                   WHERE encounter_id = ?""",
                (enc["title"], enc["summary"], doc_id, enc["occurred_at"], enc["encounter_type"], enc_id),
            )
            print(f"  • Updated encounter: [{enc['patient_id']}] {enc['title']} ({enc['occurred_at']})")
        else:
            conn.execute(
                """INSERT INTO encounters (encounter_id, patient_id, user_id, encounter_type, occurred_at,
                                           source_document_id, title, summary, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (enc_id, enc["patient_id"], user_ids.get("dr_vance"), enc["encounter_type"],
                 enc["occurred_at"], doc_id, enc["title"], enc["summary"], now),
            )
            print(f"  + Added encounter: [{enc['patient_id']}] {enc['title']} ({enc['occurred_at']})")

    # 4. Populate Patient Risk Flags (patient_flags table)
    print("\n--- Populating Clinical Risk Flags in CRM (patient_flags table) ---")
    for flag in CLINICAL_FLAGS:
        existing = conn.execute("SELECT flag_id FROM patient_flags WHERE flag_id = ?", (flag["flag_id"],)).fetchone()
        ev_json = json.dumps(flag["evidence"])
        trace_json = json.dumps({
            "generated_at": now,
            "steps": [
                {"type": "trigger", "text": "Clinical finding identified during hospital stay", "evidence": flag["evidence"][:1]},
                {"type": "anomaly", "text": flag["rationale"], "evidence": flag["evidence"]},
                {"type": "status", "text": f"Status: {flag['status'].upper()}", "evidence": flag["evidence"][:1]},
            ]
        })
        if existing:
            conn.execute(
                """UPDATE patient_flags
                   SET label = ?, status = ?, urgency = ?, confidence = ?, rationale = ?,
                       evidence_json = ?, trace_json = ?, updated_at = ?
                   WHERE flag_id = ?""",
                (flag["label"], flag["status"], flag["urgency"], flag["confidence"], flag["rationale"],
                 ev_json, trace_json, now, flag["flag_id"]),
            )
            print(f"  • Updated flag: [{flag['patient_id']}] {flag['label']} ({flag['urgency']})")
        else:
            conn.execute(
                """INSERT INTO patient_flags (flag_id, patient_id, user_id, kind, label, status, urgency,
                                              confidence, rationale, evidence_json, trace_json, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (flag["flag_id"], flag["patient_id"], user_ids.get("dr_vance"), flag["kind"],
                 flag["label"], flag["status"], flag["urgency"], flag["confidence"],
                 flag["rationale"], ev_json, trace_json, now, now),
            )
            print(f"  + Added flag: [{flag['patient_id']}] {flag['label']} ({flag['urgency']})")

    # 5. Populate Audit Log
    print("\n--- Adding Compliance & EMR Audit Log Entries ---")
    audit_events = [
        ("chart_review", "patient", "PT-4091", "Comprehensive post-PCI longitudinal chart review completed by Dr. Vance."),
        ("risk_flag_evaluated", "flag", "FLAG-4091-AKI", "Contrast AKI KDIGO-2 resolved. Hydration protocol verified."),
        ("antimicrobial_stewardship", "patient", "PT-7215", "Infectious Disease consult: Ertapenem de-escalated to Nitrofurantoin oral step-down."),
        ("rapid_response_audit", "patient", "PT-3892", "Rapid Response protocol compliance verified: STAT CTPA performed within 45 min."),
        ("stroke_conference_review", "patient", "PT-5120", "Multidisciplinary stroke conference: Carotid Endarterectomy scheduled for 2025-11-08."),
    ]
    for action, res_type, res_id, details in audit_events:
        aid = uuid.uuid4().hex
        conn.execute(
            """INSERT INTO audit_log (log_id, user_id, action, resource_type, resource_id, timestamp, details)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (aid, user_ids.get("dr_vance"), action, res_type, res_id, now, json.dumps({"note": details})),
        )
        print(f"  + Audit event: [{action}] {details[:75]}...")

    conn.commit()
    conn.close()
    print("\n✓ CRM Database Population Complete!\n")


if __name__ == "__main__":
    populate_crm()
