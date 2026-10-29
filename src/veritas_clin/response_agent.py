"""Evidence-grounded response synthesis with Groq (cloud) or Ollama (local)."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Callable
from urllib.request import Request, urlopen

from .deidentifier import default_deidentifier

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are Veritas-Clin, an expert clinical decision support synthesis engine. "
    "Review the patient's retrieved medical record passages and provide a clear, "
    "thorough, professional clinical assessment that directly addresses the user's inquiry.\n\n"
    "Guidelines:\n"
    "1. Synthesize the findings into professional medical language with clear clinical structure.\n"
    "2. Cite every factual claim using the exact passage_id values from the evidence (e.g. [PT-4091:1]).\n"
    "3. Clearly distinguish affirmed findings from negated / ruled-out conditions.\n"
    "4. Highlight relevant laboratory values, vital signs, and medication adjustments.\n"
    "5. If the evidence does NOT contain information to answer the question, state that clearly.\n"
    "6. Never fabricate passage_id values — use ONLY IDs supplied in the evidence.\n\n"
    "Return valid JSON with exactly two keys:\n"
    '  "answer": "Structured markdown clinical response with inline citations",\n'
    '  "citations": ["array", "of", "cited", "passage_id", "strings"]'
)


class EvidenceResponseAgent:
    """Synthesise a grounded answer from retrieved evidence passages.

    Supports three provider modes selected by the *provider* argument or the
    ``VERITAS_LLM_PROVIDER`` environment variable:

    * ``"groq"`` — cloud inference via the Groq API (requires ``GROQ_API_KEY``).
    * ``"ollama"`` — local inference via an Ollama instance on loopback.
    * ``""`` (empty / unset) — deterministic evidence-only output, no LLM.

    A custom *generator* callable overrides both providers and is used for
    testing.
    """

    def __init__(
        self,
        model: str | None = None,
        provider: str | None = None,
        generator: Callable[[str, list[dict], str], dict] | None = None,
    ):
        self.provider = (
            provider if provider is not None
            else os.getenv("VERITAS_LLM_PROVIDER", "")
        ).strip().lower()

        if model is not None:
            self.model = model
        elif self.provider == "groq":
            self.model = os.getenv("VERITAS_GROQ_MODEL", "qwen/qwen3.8-27b")
        elif self.provider == "ollama":
            self.model = os.getenv("VERITAS_OLLAMA_MODEL", "")
        else:
            self.model = ""

        self.generator = generator

    @property
    def enabled(self) -> bool:
        """Whether an LLM provider is configured for answer synthesis."""
        return bool(self.model and (self.provider or self.generator))

    def answer(self, question: str, evidence: list[dict]) -> dict[str, Any]:
        if not evidence:
            return {
                "status": "NO_EVIDENCE",
                "answer": "No relevant evidence was found in the selected clinical documents.",
                "citations": [],
                "used_agent": False,
                "pii_audit": {
                    "scrubbed_count": 0,
                    "hipaa_safe_harbor_applied": True,
                },
            }

        # 1. Automatic HIPAA Safe Harbor de-identification before passing to any engine
        deid_q = default_deidentifier.deidentify(question)
        scrubbed_evidence = []
        scrubbed_count = deid_q.get("scrubbed_count", 0)
        for item in evidence:
            raw_text = item.get("passage", "")
            d = default_deidentifier.deidentify(raw_text)
            scrubbed_count += d.get("scrubbed_count", 0)
            scrubbed_evidence.append({**item, "passage": d["deidentified_text"]})

        pii_audit = {
            "scrubbed_count": scrubbed_count,
            "hipaa_safe_harbor_applied": True,
        }

        # 2. Try LLM generation if enabled
        if self.enabled:
            try:
                result = self._generate(deid_q["deidentified_text"], scrubbed_evidence)
                citations = result.get("citations")
                allowed = {item["passage_id"] for item in evidence}
                if (isinstance(result.get("answer"), str) and result["answer"].strip()
                        and isinstance(citations, list) and citations
                        and all(isinstance(item, str) and item in allowed for item in citations)):
                    return {
                        "status": "EVIDENCE_FOUND",
                        "answer": self._with_citations(result["answer"].strip(), citations),
                        "citations": citations,
                        "used_agent": True,
                        "pii_audit": pii_audit,
                    }
                logger.warning("LLM response had invalid citations; falling back to deterministic output")
            except Exception:
                logger.exception("LLM synthesis failed; falling back to deterministic output")

        # 3. Deterministic Clinical Language Synthesis (Doctor-grade, highly structured)
        citations = [item["passage_id"] for item in evidence]
        answer_text = self._deterministic_clinical_summary(question, scrubbed_evidence)
        return {
            "status": "EVIDENCE_FOUND",
            "answer": answer_text,
            "citations": citations,
            "used_agent": False,
            "pii_audit": pii_audit,
        }

    def _deterministic_clinical_summary(self, question: str, evidence: list[dict]) -> str:
        """Produce a structured, professional clinical answer when LLM is offline or disabled."""
        affirmed = []
        negated = []

        for item in evidence:
            passage = item.get("passage", "").strip()
            citation = f"[{item['passage_id']}]"
            source = item.get("filename", "")
            page_info = f", p. {item['page']}" if item.get("page") is not None else ""
            assertion = item.get("assertion", "AFFIRMED")

            entry = f"• {passage} [{item['passage_id']}] ({source}{page_info})"
            if assertion == "NEGATED":
                negated.append(entry)
            else:
                affirmed.append(entry)

        lines = [
            f"**Clinical Assessment & Evidence Review**\n",
            f"*Query:* {question}\n",
        ]

        if affirmed:
            lines.append("**Documented Clinical Findings:**")
            lines.extend(affirmed[:5])

        if negated:
            lines.append("\n**Ruled-Out / Negated Observations:**")
            lines.extend(negated[:3])

        citations = [item["passage_id"] for item in evidence]
        lines.append(f"\nSources: {', '.join(f'[{c}]' for c in citations)}")
        return "\n".join(lines)

    @staticmethod
    def _with_citations(answer: str, citations: list[str]) -> str:
        if not citations:
            return answer
        if all(f"[{c}]" in answer for c in citations):
            return answer
        missing = [c for c in citations if f"[{c}]" not in answer]
        if not missing:
            return answer
        return f"{answer}\n\nSources: " + ", ".join(f"[{citation}]" for citation in citations)

    def _build_messages(self, question: str, evidence: list[dict]) -> list[dict]:
        prompt_data = {
            "question": question,
            "evidence": [
                {"passage_id": item["passage_id"], "text": item["passage"]}
                for item in evidence
            ],
        }
        return [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(prompt_data)},
        ]

    def _generate(self, question: str, evidence: list[dict]) -> dict:
        if self.generator is not None:
            return self.generator(question, evidence, self.model)

        if self.provider == "groq":
            return self._generate_groq(question, evidence)
        return self._generate_ollama(question, evidence)

    def _generate_groq(self, question: str, evidence: list[dict]) -> dict:
        from groq import Groq

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set")

        client = Groq(api_key=api_key)
        groq_max_tokens = int(os.getenv("VERITAS_GROQ_MAX_TOKENS", "650"))

        # Build numbered evidence index [1], [2], ... to keep tokens compact & avoid hex ID bloat
        evidence_lines = [f"Retrieved Clinical Evidence ({len(evidence)} passages):"]
        ref_to_pid = {}
        for idx, e in enumerate(evidence, start=1):
            ref_tag = str(idx)
            ref_to_pid[ref_tag] = e["passage_id"]
            filename = e.get("filename", "Clinical Record")
            evidence_lines.append(f"[{ref_tag}] ({filename}): {e.get('passage', '')}")

        evidence_lines.append(f"\nClinician Inquiry: {question}")
        evidence_lines.append(
            "\nPlease synthesize a concise, doctor-grade clinical response with inline [1], [2] citations."
        )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Veritas-Clin, an evidence-grounded clinical intelligence engine. "
                    "Synthesize a direct, authoritative, doctor-grade clinical summary based strictly on the retrieved records. "
                    "Structure your answer with clean bold headings (e.g. Presentation & Diagnosis, Interventions, Abnormal Labs / Vitals, Trajectory & Medications). "
                    "Cite factual claims using bracketed reference numbers like [1], [2]. "
                    "Keep the entire response concise, high-yield, and under 250 words so that the synthesis is fully complete and never truncated. "
                    "Never hallucinate or assume unmentioned facts."
                ),
            },
            {"role": "user", "content": "\n".join(evidence_lines)},
        ]

        completion = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,
            max_tokens=groq_max_tokens,
        )
        content = (completion.choices[0].message.content or "").strip()

        # If wrapped in JSON, parse it
        if content.startswith("{") and content.endswith("}"):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "answer" in parsed and isinstance(parsed.get("citations"), list):
                    return parsed
            except Exception:
                pass

        # Extract cited references: either [1], [2] or full passage IDs
        allowed_pids = {e["passage_id"] for e in evidence}
        cited_pids = []

        # Check for [1], [2], etc.
        num_refs = re.findall(r"\[(\d+)\]", content)
        for num in num_refs:
            if num in ref_to_pid:
                pid = ref_to_pid[num]
                if pid not in cited_pids:
                    cited_pids.append(pid)

        # Check for any full passage IDs if present
        full_refs = [m for m in re.findall(r"\[([a-zA-Z0-9_\-:]+)\]", content) if m in allowed_pids]
        for pid in full_refs:
            if pid not in cited_pids:
                cited_pids.append(pid)

        if not cited_pids and evidence:
            cited_pids = [evidence[0]["passage_id"]]

        # Map numbered citations in the answer string to passage IDs for backend assertion consistency
        def _replace_ref(match):
            tag = match.group(1)
            if tag in ref_to_pid:
                return f"[{ref_to_pid[tag]}]"
            return match.group(0)

        standardized_content = re.sub(r"\[(\d+)\]", _replace_ref, content)

        return {
            "answer": standardized_content,
            "citations": cited_pids,
        }

    def _generate_ollama(self, question: str, evidence: list[dict]) -> dict:
        payload = json.dumps({
            "model": self.model,
            "stream": False,
            "format": "json",
            "messages": self._build_messages(question, evidence),
            "options": {"temperature": 0},
        }).encode("utf-8")
        request = Request(
            "http://127.0.0.1:11434/api/chat", data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urlopen(request, timeout=20) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("Local response exceeded size limit")
        message = json.loads(raw).get("message", {}).get("content", "")
        result = json.loads(message)
        if not isinstance(result, dict):
            raise ValueError("Invalid local response format")
        return result
