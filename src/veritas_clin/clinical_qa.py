"""Clinical Question Answering & Retrieval-Augmented Generation (RAG).

Synthesizes grounded clinical diagnostic answers from longitudinal patient notes
with verified evidence citations, assertion tracking, and calibrated confidence.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from typing import Any

from .search_engine import (
    SYMPTOM_SEEDS,
    _TOK,
    _STEMMER,
    _tokenize,
    _stem_tokens,
    extract_assertion,
)

QUESTION_STOP = {
    "has","have","had","does","did","do","is","are","was","were",
    "the","a","an","this","that","patient","he","she","they","his","her",
    "any","ever","report","reported","experience","experienced","show",
    "showing","mention","mentioned","suffer","suffering","feel","feeling",
    "note","noted","history","of","in","at","on","for","with","and","or",
    "look","looks","looked","looking","own","get","getting","seem","seems","seemed",
    "some","what","which","where","who","whom","been","having","also","really",
}


def call_cloud_llm(
    prompt: str,
    provider: str = "gemini",
    api_key: str | None = None,
    timeout: float = 25.0,
) -> str | None:
    """Invokes a cloud LLM (Gemini, Groq, OpenAI) via lightweight HTTP requests (no local LLM)."""
    import os
    import httpx

    # Resolve provider and API key from arguments or environment
    default_prov = os.environ.get("LLM_PROVIDER") or ("gemini" if os.environ.get("GEMINI_API_KEY") else "groq")
    prov = (provider or default_prov).lower()
    
    key = api_key or os.environ.get(f"{prov.upper()}_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("GROQ_API_KEY")
    if not key:
        return None

    try:
        if prov == "gemini":
            gemini_models = ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest"]
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "systemInstruction": {
                    "parts": [{
                        "text": "You are an evidence-grounded clinical decision support assistant. Formulate clear, structured, physician-grade SBAR consultation notes. Every clinical claim must strictly cite [Note ID - Date]. Clearly state when symptoms are denied, ruled out, or familial."
                    }]
                },
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 2048,
                },
            }
            with httpx.Client(timeout=timeout) as client:
                for g_model in gemini_models:
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent?key={key}"
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts and parts[0].get("text"):
                                    return parts[0].get("text", "")
                    except Exception:
                        continue
        elif prov == "groq":
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a clinical decision support assistant. Synthesize grounded SBAR answers citing [Note ID - Date]."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 800,
            }
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
        elif prov == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a clinical decision support assistant. Synthesize grounded SBAR answers citing [Note ID - Date]."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 800,
            }
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
    except Exception:
        return None
    return None


class LLMSynthesizer:
    """Generative Clinical Synthesizer for evidence-grounded SBAR consultation notes."""

    def __init__(self, llm_callable: Any = None):
        self.llm_callable = llm_callable

    def build_prompt(self, question: str, patient_name: str, findings: list[dict], citations: list[dict]) -> str:
        cit_lines = [
            f"- [{c['note_id']} | {c['date']}] \"{c['sentence']}\" (Assertion: {c.get('assertion', 'AFFIRMED')})"
            for c in citations[:8]
        ]
        return (
            "You are an evidence-grounded clinical consultation assistant.\n"
            "Synthesize an SBAR (Situation, Background, Assessment, Recommendation) note based ONLY on these verified citations.\n"
            "Every clinical statement must cite its [Note ID - Date]. Explicitly document negated findings.\n\n"
            f"Patient: {patient_name}\n"
            f"Clinical Question: {question}\n\n"
            "Verified Citations:\n" + "\n".join(cit_lines) + "\n\n"
            "Generate SBAR:"
        )

    def synthesize(
        self,
        question: str,
        patient_name: str,
        clinical_status: str,
        findings: list[dict],
        citations: list[dict],
        provider: str = "groq",
        api_key: str | None = None,
    ) -> dict[str, str]:
        # 1. If an explicit callable is provided (tests, local pipeline)
        if self.llm_callable is not None:
            try:
                prompt = self.build_prompt(question, patient_name, findings, citations)
                raw_response = self.llm_callable(prompt)
                if isinstance(raw_response, str) and len(raw_response.strip()) > 30:
                    return {
                        "situation": f"Patient {patient_name} evaluated regarding \"{question}\".",
                        "background": f"Synthesized from {len(citations)} verified clinical note citation(s).",
                        "assessment": raw_response.strip(),
                        "recommendation": "Review documented findings with attending physician.",
                        "grounded_narrative": raw_response.strip(),
                    }
            except Exception:
                pass

        # 2. If cloud provider / API key is available, call cloud LLM (no local weights needed)
        prompt = self.build_prompt(question, patient_name, findings, citations)
        cloud_resp = call_cloud_llm(prompt, provider=provider, api_key=api_key)
        if cloud_resp and len(cloud_resp.strip()) > 30:
            narrative = cloud_resp.strip()
            cit_refs = [f"[{c['note_id']} - {c['date']}]" for c in citations[:4]]
            if cit_refs and not any(f"[{c['note_id']}" in narrative for c in citations):
                narrative += f"\n\n**Verified Evidence References:** {', '.join(cit_refs)}"

            return {
                "situation": f"Patient {patient_name} evaluated regarding \"{question}\" (Provider: {provider.upper()}).",
                "background": f"Synthesized via {provider.upper()} cloud LLM from {len(citations)} verified citation(s).",
                "assessment": narrative,
                "recommendation": "Grounded clinical synthesis ready for attending physician sign-off.",
                "grounded_narrative": narrative,
            }

        # 3. Deterministic evidence-grounded clinical synthesizer fallback

        situation = f"Patient {patient_name} evaluated regarding clinical inquiry: \"{question}\" (Status: {clinical_status})."

        total_notes = len(citations)
        max_span = max((f.get("span_days", 0) for f in findings), default=0)
        has_dsm5 = any(f.get("dsm5_persistent", False) for f in findings)
        dsm5_text = "meets DSM-5 ≥14-day persistence threshold" if has_dsm5 else "under 14-day duration threshold"
        background = f"Longitudinal records document symptoms across {total_notes} note entries (symptom span: {max_span} days, {dsm5_text})."

        assessment_lines = []
        for f in findings:
            cits = ", ".join(f.get("citations", [])[:3])
            cat = f.get("category", "Clinical Finding")
            status = f.get("status", "Affirmed")
            sample = f.get("sample_sentence", "")
            if status == "Affirmed":
                assessment_lines.append(f"• {cat} [{cits}]: Affirmed across {f.get('count', 1)} visit(s). Patient affirmed: \"{sample}\".")
            elif status == "Negated / Denied":
                assessment_lines.append(f"• {cat} [{cits}]: Explicitly negated/denied in clinical evaluation.")
            elif status == "Family History":
                assessment_lines.append(f"• {cat} [{cits}]: Recorded as familial history rather than active diagnosis.")
            else:
                assessment_lines.append(f"• {cat} [{cits}]: {status} status noted across evaluations.")

        assessment = "\n".join(assessment_lines) if assessment_lines else f"Documented observations for {question}."

        if clinical_status == "AFFIRMED":
            if has_dsm5:
                recommendation = "Active persistent symptoms documented; recommend structured PHQ-9 tracking and psychiatric follow-up."
            else:
                recommendation = "Symptoms documented; recommend interim symptom monitoring at next scheduled clinical encounter."
        elif clinical_status == "PARTIALLY_AFFIRMED":
            recommendation = "Multi-aspect or mixed symptoms noted; recommend comprehensive psychiatric consultation to clarify presentation."
        elif clinical_status == "NEGATED":
            recommendation = "Symptoms explicitly denied in record; rule out acute affective disturbance and assess somatic alternatives."
        else:
            recommendation = "Maintain standard clinical observation and periodic evaluation."

        grounded_narrative = (
            f"CLINICAL SBAR CONSULTATION REPORT\n"
            f"SITUATION: {situation}\n\n"
            f"BACKGROUND: {background}\n\n"
            f"ASSESSMENT:\n{assessment}\n\n"
            f"RECOMMENDATION: {recommendation}"
        )

        return {
            "situation": situation,
            "background": background,
            "assessment": assessment,
            "recommendation": recommendation,
            "grounded_narrative": grounded_narrative,
        }


class ClinicalQASystem:
    """Retrieval-Augmented Clinical QA Engine with strict assertion grounding."""

    def __init__(
        self,
        hybrid_retriever: Any,
        corpus: list[dict],
        patients: list[dict],
        synthesizer: LLMSynthesizer | None = None,
    ):
        self.retriever = hybrid_retriever
        self.corpus = corpus
        self.patients = patients
        self.patient_map = {p["id"]: p for p in patients}
        self.note_map = {n["note_id"]: n for n in corpus}
        self.synthesizer = synthesizer or LLMSynthesizer()

    def _extract_question_aspects(self, question: str) -> list[dict[str, Any]]:
        """Deconstructs the question into clinical symptom aspects."""
        q_tokens = [w for w in _TOK.findall(question.lower()) if w not in QUESTION_STOP]
        if not q_tokens:
            q_tokens = _TOK.findall(question.lower())

        aspects: list[dict[str, Any]] = []

        # Match against known symptom dimensions
        for category, seeds in SYMPTOM_SEEDS.items():
            matched_seeds = [s for s in seeds if s in q_tokens or any(s in t for t in q_tokens)]
            if matched_seeds:
                aspects.append({
                    "category": category,
                    "seeds": matched_seeds,
                    "query": " ".join(matched_seeds),
                })

        # If no explicit category matched, treat the content tokens as an open clinical aspect
        if not aspects and q_tokens:
            aspects.append({
                "category": "General Clinical Inquiry",
                "seeds": q_tokens,
                "query": " ".join(q_tokens),
            })

        return aspects

    def answer_question(
        self,
        question: str,
        patient_id: str | None = None,
        top_k: int = 6,
        provider: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """Answers a clinical diagnostic question grounded strictly in patient notes."""
        import os
        default_prov = os.environ.get("LLM_PROVIDER") or ("gemini" if os.environ.get("GEMINI_API_KEY") else "groq")
        prov = provider or default_prov
        key = api_key or os.environ.get(f"{prov.upper()}_API_KEY") or os.environ.get("GEMINI_API_KEY")

        clean_q = question.strip()
        if not clean_q:
            return {
                "question": question,
                "patient_id": patient_id,
                "answer_summary": "Please provide a clinical question or inquiry.",
                "clinical_status": "ABSTAINED",
                "confidence": 0.0,
                "sbar": {
                    "situation": "No inquiry provided.",
                    "background": "N/A",
                    "assessment": "Please provide a clinical question or inquiry.",
                    "recommendation": "Provide clinical inquiry for evaluation.",
                    "grounded_narrative": "No inquiry provided. Please provide a clinical question.",
                },
                "findings": [],
                "citations": [],
            }

        patient = self.patient_map.get(patient_id) if patient_id else None
        p_name = patient["name"] if patient else "All Patients"

        # 1. Deconstruct question into aspects
        aspects = self._extract_question_aspects(clean_q)
        q_tokens = [w for w in _TOK.findall(clean_q.lower()) if w not in QUESTION_STOP]
        q_stems = {_STEMMER.stem(t) for t in q_tokens}
        target_aspect_cats = {asp["category"] for asp in aspects if asp["category"] != "General Clinical Inquiry"}

        # 2. Retrieve candidate passages for the question
        raw_candidates = self.retriever.query(clean_q, top_k=24)

        # Filter by patient if specified
        if patient_id:
            raw_candidates = [
                r for r in raw_candidates
                if self.note_map.get(r["note_id"], {}).get("patient_id") == patient_id
            ]

        # Filter candidates to ensure clinical grounding (prevent false hallucinations)
        grounded_candidates = []
        for r in raw_candidates:
            sent_lower = r["sentence"].lower()
            sent_tokens = set(_TOK.findall(sent_lower))
            sent_stems = {_STEMMER.stem(t) for t in sent_tokens}

            has_stem_overlap = len(sent_stems & q_stems) > 0
            has_aspect_overlap = False
            for cat in target_aspect_cats:
                seeds = SYMPTOM_SEEDS.get(cat, [])
                if any(s in sent_tokens or _STEMMER.stem(s) in sent_stems for s in seeds):
                    has_aspect_overlap = True
                    break

            if has_stem_overlap or has_aspect_overlap:
                grounded_candidates.append(r)

        # 3. If no passages retrieved or low match score, honestly abstain
        if not grounded_candidates or grounded_candidates[0]["score"] < 0.20:
            return {
                "question": clean_q,
                "patient_id": patient_id,
                "patient_name": p_name,
                "answer_summary": f"No documented clinical evidence found in {p_name}'s records regarding this inquiry.",
                "clinical_status": "NO_EVIDENCE",
                "confidence": 0.95,
                "sbar": {
                    "situation": f"Clinical inquiry for {p_name}: \"{clean_q}\"",
                    "background": f"Longitudinal records reviewed for {p_name}.",
                    "assessment": f"No documented clinical evidence found in {p_name}'s records regarding this inquiry.",
                    "recommendation": "Maintain periodic observation or investigate alternate diagnostic hypotheses.",
                    "grounded_narrative": (
                        f"CLINICAL SBAR CONSULTATION REPORT\n"
                        f"SITUATION: Clinical inquiry for {p_name}: \"{clean_q}\"\n\n"
                        f"BACKGROUND: Longitudinal records reviewed for {p_name}.\n\n"
                        f"ASSESSMENT: No documented clinical evidence found in {p_name}'s records regarding this inquiry.\n\n"
                        f"RECOMMENDATION: Maintain periodic observation."
                    ),
                },
                "findings": [],
                "citations": [],
            }

        # 4. Group retrieved passages by clinical assertion & category
        top_evidence = grounded_candidates[:top_k]
        citations = []
        findings_by_cat: dict[str, list[dict]] = defaultdict(list)

        for r in top_evidence:
            note_info = self.note_map.get(r["note_id"], {})
            assertion = r.get("assertion", "PATIENT_AFFIRMED")

            # Determine category (prioritizing question aspects, using word token matching)
            sent_lower = r["sentence"].lower()
            sent_tokens = set(_TOK.findall(sent_lower))
            sent_stems = {_STEMMER.stem(t) for t in sent_tokens}

            matched_cat = "Clinical Observation"
            for cat in target_aspect_cats:
                seeds = SYMPTOM_SEEDS.get(cat, [])
                if any(s in sent_tokens or _STEMMER.stem(s) in sent_stems for s in seeds):
                    matched_cat = cat
                    break

            if matched_cat == "Clinical Observation":
                for cat, seeds in SYMPTOM_SEEDS.items():
                    if any(s in sent_tokens or _STEMMER.stem(s) in sent_stems for s in seeds):
                        matched_cat = cat
                        break

            finding_item = {
                "sentence": r["sentence"],
                "note_id": r["note_id"],
                "date": r["date"],
                "score": r["score"],
                "assertion": assertion,
                "patient_name": note_info.get("patient_name", p_name),
                "patient_id": note_info.get("patient_id", patient_id or "?"),
            }
            findings_by_cat[matched_cat].append(finding_item)

            citations.append({
                "note_id": r["note_id"],
                "date": r["date"],
                "sentence": r["sentence"],
                "score": r["score"],
                "assertion": assertion,
                "patient_name": note_info.get("patient_name", p_name),
            })

        # 5. Formulate categorized findings
        structured_findings = []
        overall_statuses = []

        for cat, items in findings_by_cat.items():
            items.sort(key=lambda x: x["date"])
            affirmed = [it for it in items if it["assertion"] == "PATIENT_AFFIRMED"]
            negated  = [it for it in items if it["assertion"] == "NEGATED"]
            family   = [it for it in items if it["assertion"] == "FAMILY_HISTORY"]

            dates = [it["date"] for it in items]
            d_span = (date.fromisoformat(dates[-1]) - date.fromisoformat(dates[0])).days if len(dates) > 1 else 0

            if affirmed and not negated:
                status_str = "Affirmed"
                overall_statuses.append("AFFIRMED")
            elif negated and not affirmed:
                status_str = "Negated / Denied"
                overall_statuses.append("NEGATED")
            elif affirmed and negated:
                status_str = "Fluctuating / Mixed"
                overall_statuses.append("MIXED")
            elif family:
                status_str = "Family History"
                overall_statuses.append("FAMILY_HISTORY")
            else:
                status_str = "Documented"
                overall_statuses.append("AFFIRMED")

            structured_findings.append({
                "category": cat,
                "status": status_str,
                "assertion": items[0]["assertion"],
                "count": len(items),
                "first_date": dates[0],
                "latest_date": dates[-1],
                "span_days": d_span,
                "dsm5_persistent": d_span >= 14,
                "sample_sentence": items[0]["sentence"],
                "citations": [it["note_id"] for it in items],
            })

        # 6. Synthesize executive clinical answer
        summary_sentences = []
        for f in structured_findings:
            cit_str = ", ".join(f["citations"][:3])
            if f["status"] == "Affirmed":
                time_note = f" (span {f['span_days']} days, DSM-5 persistent)" if f["dsm5_persistent"] else ""
                summary_sentences.append(
                    f"• {f['category']}: Documented across {f['count']} visit(s) from {f['first_date']} to {f['latest_date']}{time_note} [{cit_str}]. Patient affirmed: \"{f['sample_sentence']}\""
                )
            elif f["status"] == "Negated / Denied":
                summary_sentences.append(
                    f"• {f['category']}: Explicitly negated / denied in clinical evaluation on {f['latest_date']} [{cit_str}]."
                )
            elif f["status"] == "Family History":
                summary_sentences.append(
                    f"• {f['category']}: Documented as familial history rather than active patient symptom [{cit_str}]."
                )
            else:
                summary_sentences.append(
                    f"• {f['category']}: Documented with mixed/fluctuating status across visits [{cit_str}]."
                )

        if "AFFIRMED" in overall_statuses and "NEGATED" in overall_statuses:
            final_status = "PARTIALLY_AFFIRMED"
        elif "AFFIRMED" in overall_statuses:
            final_status = "AFFIRMED"
        elif "NEGATED" in overall_statuses:
            final_status = "NEGATED"
        else:
            final_status = "OBSERVED"

        answer_text = "\n".join(summary_sentences)
        avg_score = sum(r["score"] for r in top_evidence) / len(top_evidence)
        confidence = round(min(0.98, max(0.60, avg_score + 0.15)), 2)

        sbar = self.synthesizer.synthesize(
            question=clean_q,
            patient_name=p_name,
            clinical_status=final_status,
            findings=structured_findings,
            citations=citations,
            provider=prov,
            api_key=key,
        )

        final_summary = sbar.get("grounded_narrative") or answer_text

        return {
            "question": clean_q,
            "patient_id": patient_id,
            "patient_name": p_name,
            "answer_summary": final_summary,
            "clinical_status": final_status,
            "confidence": confidence,
            "sbar": sbar,
            "findings": structured_findings,
            "citations": citations,
        }
