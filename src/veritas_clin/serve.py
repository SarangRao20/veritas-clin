"""FastAPI service: REST API + Interactive 3D Clinical Telemetry Studio."""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS, ensure_dirs
from .eval import FALLBACK_THRESHOLD
from .extract import build_extractor
from .pipeline import ExtractionPipeline
from .schemas import ExtractRequest, ExtractionResponse
from .verify import Verifier

UI_DIR = SETTINGS.root / "ui"


def load_policy() -> tuple[float, float]:
    """(threshold, low_frac) from artifacts/policy.json, else honest defaults."""
    if SETTINGS.policy_path.exists():
        data = json.loads(SETTINGS.policy_path.read_text(encoding="utf-8"))
        return float(data["threshold"]), float(data["low_frac"])
    return FALLBACK_THRESHOLD, SETTINGS.low_frac


class _Service:
    def __init__(self) -> None:
        self.pipe: ExtractionPipeline | None = None
        # Default to heuristic on CPU/laptop to prevent hanging on 3B downloads unless explicitly set to 'hf'
        default_kind = "hf" if os.getenv("CUDA_VISIBLE_DEVICES") or os.getenv("VERITAS_DEVICE") == "cuda" else "heuristic"
        self.kind = os.getenv("VERITAS_EXTRACTOR", default_kind)

    def load(self) -> None:
        ensure_dirs()
        threshold, low_frac = load_policy()
        verifier = None
        # Only load verifier if hf or requested
        if self.kind == "hf":
            verifier = Verifier()
        self.pipe = ExtractionPipeline(
            extractor=build_extractor(self.kind),
            verifier=verifier,
            threshold=threshold,
            low_frac=low_frac,
        )


SERVICE = _Service()


@asynccontextmanager
async def lifespan(_: FastAPI):
    SERVICE.load()
    yield


app = FastAPI(
    title="Veritas-Clin",
    description="Evidence-Grounded Clinical Information Extraction with Calibrated Selective Abstention",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "extractor": SERVICE.kind,
        "models_loaded": SERVICE.pipe is not None,
    }


@app.get("/api/metrics")
def get_metrics() -> dict:
    if SETTINGS.metrics_path.exists():
        return json.loads(SETTINGS.metrics_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="Metrics artifact not generated yet.")


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


# Mount UI and Artifacts
if UI_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(UI_DIR)), name="ui")

if SETTINGS.artifacts_dir.exists():
    app.mount("/artifacts", StaticFiles(directory=str(SETTINGS.artifacts_dir)), name="artifacts")


@app.get("/", response_class=FileResponse)
def serve_ui():
    index_file = UI_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="UI index.html not found.")
