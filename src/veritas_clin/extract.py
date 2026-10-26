"""Extraction: a deterministic heuristic baseline and a zero-shot LLM extractor.

Both satisfy the same `Extractor` protocol, so downstream verification/calibration/serving
code is identical regardless of which one runs. The heuristic exists for two honest
reasons: the offline test suite runs network-free, and eval can compare baseline vs LLM
under the same harness. It is format-aware (it mirrors the corpus templates).
"""

from __future__ import annotations

import json
import re
from typing import Protocol

from .config import SETTINGS
from .schemas import Claim, FindingType

_TRAP = re.compile(r"^(.+?)\s+-\s+(?:ruled out|resolved|unlikely)\.$")
_NUMBERED = re.compile(r"^\d+\.\s+(.+?)$")
_MED_SECTION = re.compile(r"^MEDICATIONS(?: ON DISCHARGE)?:$")
_ASSESSMENT_SECTIONS = ("ASSESSMENT:", "INTERIM ASSESSMENT:")


def anchor(note_text: str, phrase: str) -> str | None:
    """Return the phrase if it appears verbatim in the note, else None."""
    if phrase and phrase in note_text:
        return phrase
    return None


class Extractor(Protocol):
    def extract(self, note_text: str) -> list[Claim]: ...


class HeuristicExtractor:
    """Format-aware rule baseline. token_conf is a fixed 0.95 (rules, not a model)."""

    def extract(self, note_text: str) -> list[Claim]:
        claims: list[Claim] = []
        section: str | None = None
        for line in note_text.splitlines():
            line = line.strip()
            if not line:
                section = None
                continue
            if line in _ASSESSMENT_SECTIONS:
                section = "diagnosis"
                continue
            if _MED_SECTION.match(line):
                section = "medication"
                continue
            if line.startswith("FOLLOW-UP:"):
                m = re.match(r"^FOLLOW-UP:\s*(.+?)\.$", line)
                if m:
                    claims.append(self._claim("followup", m.group(1), note_text))
                section = None
                continue
            m = _NUMBERED.match(line)
            if not m or section not in ("diagnosis", "medication"):
                continue
            value = m.group(1)
            if section == "diagnosis" and _TRAP.match(value):
                continue  # ruled-out / resolved / unlikely: not a diagnosis
            claims.append(self._claim(section, value, note_text))
        return claims

    def _claim(self, ftype: str, value: str, note_text: str) -> Claim:
        dosage = None
        if ftype == "medication":
            dm = re.search(r"\d.*", value)
            dosage = dm.group(0) if dm else None
        return Claim(
            type=FindingType(ftype),
            value=value,
            dosage=dosage,
            span_text=anchor(note_text, value),
            token_conf=0.95,
        )


_PROMPT = (
    "You are a clinical information extraction system.\n"
    "Extract all:\n"
    "1. Active Diagnoses (type: 'diagnosis')\n"
    "2. Discharge Medications (type: 'medication', value is full drug name with dosage and frequency, e.g. 'Losartan 50 mg once daily')\n"
    "3. Follow-up plans (type: 'followup', e.g. 'Cardiology in 2 weeks')\n\n"
    "Do NOT extract anything that is: ruled out, resolved, unlikely, historical,\n"
    "a family member's condition, or a drug listed only as an allergy.\n"
    "Return strict JSON matching this schema:\n"
    '{"findings":[{"type":"diagnosis|medication|followup","value":"...",'
    '"dosage":null_or_string,"span":"<exact substring copied from the note>"}]}\n\n'
    "Example:\n"
    "Note: DISCHARGE SUMMARY\\nAssessment: 1. Hypertension\\n"
    "Medications: 1. Amlodipine 5 mg once daily\\nFollow-up: Primary Care in 7 days.\n"
    "Output:\n"
    '{"findings":[{"type":"diagnosis","value":"Hypertension","dosage":null,'
    '"span":"1. Hypertension"},{"type":"medication","value":"Amlodipine 5 mg once daily",'
    '"dosage":"5 mg once daily","span":"Amlodipine 5 mg once daily"},'
    '{"type":"followup","value":"Primary Care in 7 days","dosage":null,'
    '"span":"Primary Care in 7 days"}]}\n\n'
    "Note:\n<<<\n{note}\n>>>\n"
    "Output:\n"
)


class HuggingFaceExtractor:
    """Zero-shot extraction with a small instruct model (designed for a Colab T4)."""

    def __init__(self, model_id: str = SETTINGS.extract_model, max_new_tokens: int = SETTINGS.max_new_tokens) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.max_new_tokens = max_new_tokens
        self.tok = AutoTokenizer.from_pretrained(model_id)
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, torch_dtype=dtype, device_map="auto" if SETTINGS.device == "auto" else SETTINGS.device
        )
        self.model.eval()

    def extract(self, note_text: str) -> list[Claim]:
        prompt = _PROMPT.replace("{note}", note_text)
        messages = [{"role": "user", "content": prompt}]
        rendered = self.tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
        import torch

        inputs = self.tok(rendered, return_tensors="pt").to(self.model.device)
        out = self.model.generate(
            **inputs,
            max_new_tokens=self.max_new_tokens,
            do_sample=False,
            return_dict_in_generate=True,
            output_scores=True,
            pad_token_id=self.tok.eos_token_id,
        )
        n_new = out.sequences.shape[1] - inputs["input_ids"].shape[1]
        text = self.tok.decode(out.sequences[0, -n_new:], skip_special_tokens=True)
        token_conf = self._token_confidence(out, n_new)
        return self._parse(text, note_text, token_conf)

    def _token_confidence(self, out, n_new: int) -> float:
        """Mean probability of the sampled tokens — the extractor's own confidence."""
        import torch

        scores = out.scores
        if not scores:
            return SETTINGS.token_conf_default
        logits = torch.stack([s[0] for s in scores])  # (n_new, vocab)
        probs = torch.softmax(logits, dim=-1)
        ids = out.sequences[0, -n_new:].to(probs.device)
        token_probs = probs.gather(1, ids.unsqueeze(1)).squeeze(1)
        val = token_probs.mean().item()
        return max(0.0, min(1.0, float(val)))

    def _parse(self, text: str, note_text: str, token_conf: float) -> list[Claim]:
        clean = text.strip()
        if "```" in clean:
            clean = re.sub(r"^```[a-zA-Z]*\n?", "", clean)
            clean = re.sub(r"\n?```$", "", clean)

        findings: list = []
        try:
            parsed = json.loads(clean)
            if isinstance(parsed, list):
                findings = parsed
            elif isinstance(parsed, dict):
                findings = parsed.get("findings", [])
        except json.JSONDecodeError:
            start_bracket = clean.find("[")
            end_bracket = clean.rfind("]")
            start_brace = clean.find("{")
            end_brace = clean.rfind("}")

            candidates = []
            if start_bracket != -1 and end_bracket > start_bracket:
                candidates.append(clean[start_bracket : end_bracket + 1])
            if start_brace != -1 and end_brace > start_brace:
                candidates.append(clean[start_brace : end_brace + 1])

            for cand in candidates:
                try:
                    res = json.loads(cand)
                    if isinstance(res, list):
                        findings = res
                        break
                    elif isinstance(res, dict) and "findings" in res:
                        findings = res["findings"]
                        break
                except json.JSONDecodeError:
                    continue

        claims: list[Claim] = []
        for item in findings:
            if not isinstance(item, dict):
                continue
            ftype = str(item.get("type", "")).strip().lower()
            value = str(item.get("value", "")).strip()
            if ftype not in FindingType._value2member_map_ or not value:
                continue
            dosage = item.get("dosage") or None
            span = item.get("span") or None
            span_text = anchor(note_text, span) or anchor(note_text, value)
            claims.append(
                Claim(
                    type=FindingType(ftype),
                    value=value,
                    dosage=dosage,
                    span_text=span_text,
                    token_conf=token_conf,
                )
            )
        return claims


def build_extractor(kind: str) -> Extractor:
    if kind == "heuristic":
        return HeuristicExtractor()
    if kind == "hf":
        return HuggingFaceExtractor()
    raise ValueError(f"unknown extractor kind: {kind!r}")
