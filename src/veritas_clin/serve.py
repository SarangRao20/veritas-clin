"""FastAPI application factory — wires MVC layers together."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CLINICAL_RECORDS_DIR, DATABASE_PATH, DEMO_DOCUMENTS_DIR, ROOT
from .document_nlp import (
    DocumentProcessor,
    EvidenceRetriever,
    LocalSentenceEmbedder,
    seed_clinical_records,
    seed_demo_documents,
)
from .services.workflow_trace_service import WorkflowTraceService
from .models.database import init_schema
from .response_agent import EvidenceResponseAgent
from .store.document_store import DocumentStore
from .store.user_store import UserStore
from .store.patient_store import PatientStore
from .controllers import auth as auth_router
from .controllers import users as users_router
from .controllers import documents as documents_router
from .controllers import search as search_router
from .controllers import patients as patients_router
from .controllers import analysis as analysis_router

load_dotenv(ROOT / ".env", override=False)

FRONTEND_DIST = ROOT / "frontend" / "dist"
DEFAULT_DB_PATH = Path(os.getenv("VERITAS_DB_PATH", str(DATABASE_PATH)))


def create_app(
    db_path: Path | None = None,
    embedder=None,
    demo_dir: Path | None = None,
    response_agent: EvidenceResponseAgent | None = None,
    clinical_dir: Path | None = None,
) -> FastAPI:
    path = Path(db_path or DEFAULT_DB_PATH)
    samples_path = Path(demo_dir or DEMO_DOCUMENTS_DIR)
    clinical_path = (
        Path(clinical_dir)
        if clinical_dir is not None
        else (CLINICAL_RECORDS_DIR if demo_dir is None else None)
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        init_schema(path)
        active_embedder = embedder or LocalSentenceEmbedder()
        processor = DocumentProcessor(active_embedder)
        doc_store = DocumentStore(path)
        user_store = UserStore(path)
        seed_demo_documents(doc_store, processor, samples_path)
        if clinical_path and clinical_path.is_dir():
            seed_clinical_records(doc_store, processor, clinical_path)
        retriever = EvidenceRetriever(doc_store, active_embedder)
        agent = response_agent or EvidenceResponseAgent()
        application.state.document_store = doc_store
        application.state.document_processor = processor
        application.state.evidence_retriever = retriever
        application.state.response_agent = agent
        application.state.user_store = user_store
        application.state.patient_store = PatientStore(path)
        application.state.workflow_service = WorkflowTraceService(doc_store, retriever, agent)
        yield

    application = FastAPI(
        title="Veritas-Clin",
        version="4.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    origins = [o.strip() for o in os.getenv(
        "VERITAS_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # ── Health (public) ───────────────────────────────────────────────────────
    @application.get("/health", tags=["system"])
    def health():
        agent = application.state.response_agent
        return {
            "status": "ok",
            "embedding_model": getattr(
                getattr(application.state, "document_processor", None),
                "embedder", LocalSentenceEmbedder()
            ).model_id,
            "llm_enabled": agent.enabled,
            "llm_provider": agent.provider or None,
            "response_model": agent.model or None,
        }

    # ── Routers ───────────────────────────────────────────────────────────────
    application.include_router(auth_router.router)
    application.include_router(users_router.router)
    application.include_router(documents_router.router)
    application.include_router(search_router.router)
    application.include_router(patients_router.router)
    application.include_router(analysis_router.router)

    # ── Frontend SPA serving ──────────────────────────────────────────────────
    if (FRONTEND_DIST / "assets").is_dir():
        application.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @application.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=FileResponse)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(404, "API endpoint not found")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if FRONTEND_DIST.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(404, "Frontend is not built")

    return application


app = create_app()
