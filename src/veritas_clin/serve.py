"""FastAPI service. Models load lazily at startup; policy thresholds come from artifacts."""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .config import SETTINGS, ensure_dirs
from .eval import FALLBACK_THRESHOLD
from .extract import build_extractor
from .pipeline import ExtractionPipeline
from .schemas import ExtractRequest, ExtractionResponse
from .verify import Verifier


def load_policy() -> tuple[float, float]:
    """(threshold, low_frac) from artifacts/policy.json, else honest defaults."""
    if SETTINGS.policy_path.exists():
        data = json.loads(SETTINGS.policy_path.read_text(encoding="utf-8"))
        return float(data["threshold"]), float(data["low_frac"])
    return FALLBACK_THRESHOLD, SETTINGS.low_frac


class _Service:
    def __init__(self) -> None:
        self.pipe: ExtractionPipeline | None = None
        self.kind = os.getenv("VERITAS_EXTRACTOR", "hf")

    def load(self) -> None:
        ensure_dirs()
        threshold, low_frac = load_policy()
        self.pipe = ExtractionPipeline(
            extractor=build_extractor(self.kind),
            verifier=Verifier(),
            threshold=threshold,
            low_frac=low_frac,
        )


SERVICE = _Service()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Blocking model load; acceptable for a demo service (documented in ARCHITECTURE.md).
    SERVICE.load()
    yield


app = FastAPI(title="Veritas-Clin", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "extractor": SERVICE.kind,
        "models_loaded": SERVICE.pipe is not None,
    }


@app.post("/extract", response_model=ExtractionResponse)
def extract(body: ExtractRequest) -> ExtractionResponse:
    if SERVICE.pipe is None:
        raise HTTPException(status_code=503, detail="models still loading; retry shortly")
    claims = SERVICE.pipe.run(body.note_text)
    return ExtractionResponse(
        note_id=body.note_id,
        claims=claims,
        n_accepted=sum(1 for c in claims if c.decision == "accept"),
        n_flagged=sum(1 for c in claims if c.decision == "flag_for_review"),
    )
