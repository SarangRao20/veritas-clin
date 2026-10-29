"""Patient-centric store for timeline, encounters, and evidence-grounded findings."""
from __future__ import annotations

import json
import re
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models.database import connect
from ..services.clinical_sentiment_service import clinical_sentiment_service
from ..services.clinical_watchdog_service import clinical_watchdog_service


class PatientStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)

    def _connect(self):
        return connect(self.db_path)

    def get_patient_profile(self, patient_id: str, user_id: str | None = None, admin: bool = False) -> dict[str, Any]:
        """Dynamically extract patient clinical demographics and trajectory from SQLite documents without hardcoded strings."""
        with closing(self._connect()) as conn:
            query = """SELECT document_id, patient_id, filename, extracted_text, encounter_type, encounter_date
                       FROM documents
                       WHERE UPPER(patient_id) = UPPER(?)"""
            params: list = [patient_id]
            if not admin and user_id is not None:
                query += " AND (user_id = ? OR user_id IS NULL OR is_synthetic = 1)"
                params.append(user_id)
            query += " ORDER BY COALESCE(encounter_date, created_at) DESC"
            rows = conn.execute(query, params).fetchall()

        if not rows:
            return {
                "patient_id": patient_id,
                "name": f"Patient {patient_id}",
                "condition": "Clinical Inpatient Record",
                "department": "General Medicine",
                "status": "Active Record",
                "status_color": "bg-slate-100 text-slate-800 border-slate-200",
                "sentiment": clinical_sentiment_service.analyze_text(""),
                "document_count": 0,
            }

        combined_texts = [r["extracted_text"] for r in rows if r["extracted_text"]]
        all_text = "\n\n".join(combined_texts)

        # 1. Extract Patient Name
        name_match = re.search(r"PATIENT(?:\s+NAME)?:\s*([A-Za-z\s\.\,\'\-]+?)(?:\s*\||\s*DATE|\s*DOB|\s*\n|$)", all_text, re.IGNORECASE)
        name = name_match.group(1).strip() if name_match else ""
        if not name or "ID" in name.upper() or len(name) < 3 or name.upper() == "NAME":
            name = f"Patient {patient_id}"

        # 2. Extract Age / Gender
        age_match = re.search(r"(\d{1,3})\s*(?:yo|y/o|years old|\s*years of age)", all_text, re.IGNORECASE)
        gender_match = re.search(r"\b(Male|Female)\b", all_text, re.IGNORECASE)
        age_str = ""
        if age_match:
            g_char = gender_match.group(1)[0].upper() if gender_match else ""
            age_str = f"{age_match.group(1)}{g_char}"
        elif gender_match:
            age_str = gender_match.group(1)

        full_display_name = f"{name} ({age_str})" if age_str and age_str not in name else name

        # 3. Extract Department / Specialty
        dept_match = re.search(r"(?:DEPARTMENT|DIVISION|SERVICE)\s+OF\s+([A-Za-z\s&]+?)(?:\s*—|\s*[-–]|\s*\n|$)", all_text, re.IGNORECASE)
        department = dept_match.group(1).strip() if dept_match else "Inpatient Medicine"

        # 4. Extract Primary Condition / Diagnosis
        diag_match = re.search(r"(?:PRIMARY\s+DIAGNOSIS|ADMISSION\s+DIAGNOSIS|IMPRESSION|CHIEF\s+COMPLAINT):\s*(?:\d+\.\s*)?([^\n\r]+)", all_text, re.IGNORECASE)
        if diag_match:
            condition = diag_match.group(1).strip()
        else:
            condition = rows[0]["encounter_type"] or "Clinical Inpatient Evaluation"

        # 5. Extract Status
        has_discharge = any("discharge" in r["filename"].lower() or "discharge" in (r["encounter_type"] or "").lower() for r in rows)
        if has_discharge:
            status = "Recovered · Discharged"
            status_color = "bg-emerald-100 text-emerald-800 border-emerald-200"
        else:
            status = "Inpatient Stabilized"
            status_color = "bg-teal-100 text-teal-800 border-teal-200"

        # 6. Compute Clinical Sentiment & Trajectory
        sentiment = clinical_sentiment_service.analyze_patient_documents([dict(r) for r in rows])

        # 7. Evaluate Proactive Clinical Safety Watchdog (Drug contraindications & guideline compliance)
        watchdog_alerts = clinical_watchdog_service.evaluate_patient([dict(r) for r in rows])

        # 8. Extract Active Medications & Contraindicated/Held Drugs
        active_meds = []
        held_meds = []
        med_matches = re.finditer(
            r"(?:DISCHARGE MEDICATIONS|CURRENT MEDICATIONS|PRESCRIBED MEDICATIONS|ACTIVE MEDICATIONS?|MEDICATION ORDERS?|MEDICATIONS?)[^\n]*:\s*\n((?:[ \t]*[-•\d\.]+[^\n]+\n?)+)",
            all_text,
            re.IGNORECASE,
        )
        for mm in med_matches:
            block = mm.group(1)
            for line in block.splitlines():
                clean = re.sub(r"^\s*[\d\.\-\*•]+\s*", "", line).strip()
                if not clean or len(clean) < 3:
                    continue
                if re.search(r"\b(HELD|CONTRAINDICATED|DISCONTINUED|DO NOT RESTART)\b", clean, re.IGNORECASE):
                    if clean not in held_meds:
                        held_meds.append(clean)
                else:
                    if clean not in active_meds and not clean.startswith("FOLLOW-UP"):
                        active_meds.append(clean)

        # Also search explicit Contraindicated/Held sections
        held_matches = re.finditer(
            r"(?:CONTRAINDICATED|DISCONTINUED|PERMANENTLY HELD|HOLD|HELD\s+MEDICATIONS?)[^\n]*:\s*\n((?:[ \t]*[-•\d\.]+[^\n]+\n?)+)",
            all_text,
            re.IGNORECASE,
        )
        for hm in held_matches:
            block = hm.group(1)
            for line in block.splitlines():
                clean = re.sub(r"^\s*[\d\.\-\*•]+\s*", "", line).strip()
                if clean and len(clean) >= 3 and clean not in held_meds and not clean.startswith("FOLLOW-UP"):
                    held_meds.append(clean)

        canonical_id = (rows[0]["patient_id"] if (rows and rows[0]["patient_id"]) else patient_id.upper())
        return {
            "patient_id": canonical_id,
            "name": full_display_name,
            "condition": condition[:120],
            "department": department[:60],
            "status": status,
            "status_color": status_color,
            "sentiment": sentiment,
            "watchdog_alerts": watchdog_alerts,
            "active_medications": active_meds,
            "held_medications": held_meds,
            "document_count": len(rows),
        }

    def list_patients(self, user_id: str | None = None, admin: bool = False) -> list[dict[str, Any]]:
        with closing(self._connect()) as conn:
            query = """SELECT d.patient_id,
                             COUNT(DISTINCT d.document_id) AS document_count,
                             COUNT(DISTINCT p.passage_id) AS passage_count,
                             MAX(COALESCE(d.encounter_date, d.created_at)) AS last_event_at,
                             MIN(COALESCE(d.encounter_date, d.created_at)) AS first_event_at
                      FROM documents d
                      LEFT JOIN passages p ON p.document_id = d.document_id
                      WHERE d.patient_id IS NOT NULL AND d.patient_id != ''"""
            params: list = []
            if not admin and user_id is not None:
                query += " AND (d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)"
                params.append(user_id)
            query += " GROUP BY d.patient_id ORDER BY last_event_at DESC, d.patient_id"
            rows = conn.execute(query, params).fetchall()
            patients = []
            for row in rows:
                patient_id = row["patient_id"]
                # Get flag count
                flag_row = conn.execute(
                    "SELECT COUNT(*) AS c FROM patient_flags WHERE patient_id = ?",
                    (patient_id,),
                ).fetchone()

                profile = self.get_patient_profile(patient_id, user_id=user_id, admin=admin)

                patients.append(
                    {
                        "patient_id": patient_id,
                        "name": profile.get("name", f"Patient {patient_id}"),
                        "condition": profile.get("condition", "Clinical Inpatient Record"),
                        "department": profile.get("department", "General Medicine"),
                        "status": profile.get("status", "Active Inpatient"),
                        "status_color": profile.get("status_color", "bg-slate-100 text-slate-800 border-slate-200"),
                        "sentiment": profile.get("sentiment", {}),
                        "document_count": row["document_count"],
                        "passage_count": row["passage_count"],
                        "first_event_at": row["first_event_at"],
                        "last_event_at": row["last_event_at"],
                        "flag_count": flag_row["c"] if flag_row else 0,
                    }
                )
            return patients

    def get_timeline(self, patient_id: str, user_id: str | None = None, admin: bool = False) -> list[dict[str, Any]]:
        with closing(self._connect()) as conn:
            query = """SELECT d.document_id, d.filename, d.media_type, d.created_at,
                             d.is_synthetic, d.user_id, d.encounter_date, d.encounter_type,
                             COUNT(p.passage_id) AS passage_count
                      FROM documents d
                      LEFT JOIN passages p ON p.document_id = d.document_id
                      WHERE UPPER(d.patient_id) = UPPER(?)"""
            params: list = [patient_id]
            if not admin and user_id is not None:
                query += " AND (d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)"
                params.append(user_id)
            query += " GROUP BY d.document_id ORDER BY COALESCE(d.encounter_date, d.created_at), d.document_id"
            rows = conn.execute(query, params).fetchall()
            timeline = []
            for row in rows:
                timeline.append(
                    {
                        "id": row["document_id"],
                        "type": "document",
                        "document_id": row["document_id"],
                        "title": row["filename"],
                        "filename": row["filename"],
                        "media_type": row["media_type"],
                        "encounter_type": row["encounter_type"] or self._infer_type(row["filename"]),
                        "occurred_at": row["encounter_date"],
                        "created_at": row["created_at"],
                        "passage_count": row["passage_count"],
                        "is_synthetic": bool(row["is_synthetic"]),
                    }
                )
            return timeline

    def get_patient_passages(self, patient_id: str, user_id: str | None = None, admin: bool = False) -> list[dict[str, Any]]:
        with closing(self._connect()) as conn:
            query = """SELECT p.passage_id, p.document_id, d.filename, d.media_type,
                             d.is_synthetic, d.user_id, d.encounter_date, d.encounter_type,
                             p.ordinal, p.page, p.text
                      FROM passages p
                      JOIN documents d ON d.document_id = p.document_id
                      WHERE UPPER(d.patient_id) = UPPER(?)"""
            params: list = [patient_id]
            if not admin and user_id is not None:
                query += " AND (d.user_id = ? OR d.user_id IS NULL OR d.is_synthetic = 1)"
                params.append(user_id)
            query += " ORDER BY COALESCE(d.encounter_date, d.created_at), p.ordinal"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) | {"is_synthetic": bool(row["is_synthetic"])} for row in rows]

    def get_flags(self, patient_id: str, user_id: str | None = None, admin: bool = False) -> list[dict[str, Any]]:
        with closing(self._connect()) as conn:
            query = "SELECT * FROM patient_flags WHERE UPPER(patient_id) = UPPER(?)"
            params: list = [patient_id]
            if not admin and user_id is not None:
                query += " AND (user_id = ? OR user_id IS NULL)"
                params.append(user_id)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            flags = []
            for row in rows:
                d = dict(row)
                try:
                    d["evidence"] = json.loads(d.get("evidence_json") or "[]")
                except Exception:
                    d["evidence"] = []
                try:
                    d["trace"] = json.loads(d.get("trace_json") or "{}")
                except Exception:
                    d["trace"] = {}
                d.pop("evidence_json", None)
                d.pop("trace_json", None)
                flags.append(d)
            return flags

    def save_flag(self, flag: dict[str, Any]) -> str:
        flag_id = flag.get("flag_id") or uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        evidence_json = json.dumps(flag.get("evidence") or [])
        trace_json = json.dumps(flag.get("trace") or {})
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """INSERT OR REPLACE INTO patient_flags
                       (flag_id, patient_id, user_id, kind, label, status, urgency, confidence,
                        rationale, evidence_json, trace_json, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ?), ?)""",
                    (
                        flag_id,
                        flag["patient_id"],
                        flag.get("user_id"),
                        flag.get("kind", "finding"),
                        flag.get("label", ""),
                        flag.get("status", "open"),
                        flag.get("urgency", "low"),
                        float(flag.get("confidence") or 0.0),
                        flag.get("rationale"),
                        evidence_json,
                        trace_json,
                        flag.get("created_at") or now,
                        flag.get("created_at") or now,
                        now,
                    ),
                )
        return flag_id

    @staticmethod
    def _infer_type(filename: str) -> str:
        name = filename.lower()
        if "discharge" in name:
            return "discharge"
        if "lab" in name:
            return "lab"
        if any(k in name for k in ["radiology", "mri", "ct", "xray", "imaging"]):
            return "radiology"
        if "prescription" in name or "rx" in name:
            return "prescription"
        if "visit" in name or "note" in name or "soap" in name:
            return "visit"
        if "med" in name or "drug" in name:
            return "medication"
        return "document"
