"""FastAPI app for local, document-grounded clinical NLP search."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import DATABASE_PATH, DEMO_DOCUMENTS_DIR, ROOT
from .document_nlp import DocumentProcessor, EvidenceRetriever, LocalSentenceEmbedder, seed_demo_documents
from .document_store import DocumentStore
from .response_agent import EvidenceResponseAgent

FRONTEND_DIST = ROOT / "frontend" / "dist"
DEFAULT_DB_PATH = Path(os.getenv("VERITAS_DB_PATH", str(DATABASE_PATH)))


class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)


def _safe_filename(filename: str | None) -> str:
    cleaned = (filename or "upload").replace("\\", "/").split("/")[-1]
    cleaned = "".join(char for char in cleaned if char.isprintable()).strip(" .")
    if not cleaned or len(cleaned) > 255:
        raise HTTPException(400, "Invalid filename")
    return cleaned


def create_app(
    db_path: Path | None = None,
    embedder=None,
    demo_dir: Path | None = None,
    response_agent: EvidenceResponseAgent | None = None,
) -> FastAPI:
    path = Path(db_path or DEFAULT_DB_PATH)
    samples_path = Path(demo_dir or DEMO_DOCUMENTS_DIR)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        store = DocumentStore(path)
        active_embedder = embedder or LocalSentenceEmbedder()
        processor = DocumentProcessor(active_embedder)
        seed_demo_documents(store, processor, samples_path)
        application.state.document_store = store
        application.state.document_processor = processor
        application.state.evidence_retriever = EvidenceRetriever(store, active_embedder)
        application.state.response_agent = response_agent or EvidenceResponseAgent()
        yield
        store.close()

    application = FastAPI(title="Veritas-Clin Document Search", version="3.0.0", lifespan=lifespan)
    origins = [origin.strip() for origin in os.getenv(
        "VERITAS_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()]
    application.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @application.get("/health")
    def health(request: Request):
        return {
            "status": "ok",
            "embedding_model": getattr(getattr(request.app.state, "document_processor", None),
                                        "embedder", LocalSentenceEmbedder()).model_id,
            "local_llm_enabled": bool(request.app.state.response_agent.model),
            "response_model": request.app.state.response_agent.model or None,
        }

    @application.post("/api/documents")
    async def upload_document(request: Request, file: UploadFile = File(...)):
        filename = _safe_filename(file.filename)
        content = await file.read(5 * 1024 * 1024 + 1)
        try:
            passages = request.app.state.document_processor.extract_and_chunk(
                filename, file.content_type or "", content
            )
            extracted_text = "\n".join(passage["text"] for passage in passages)
            document_id = request.app.state.document_store.add_document(
                filename, file.content_type or "", extracted_text, passages,
                request.app.state.document_processor.embedder.model_id,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        except Exception as exc:
            # Keep internal extraction/model/database details out of the response.
            raise HTTPException(500, "Document could not be indexed") from exc

        document = next(doc for doc in request.app.state.document_store.list_documents()
                        if doc["document_id"] == document_id)
        return document

    @application.get("/api/documents")
    def list_documents(request: Request):
        return request.app.state.document_store.list_documents()

    @application.delete("/api/documents/{document_id}", status_code=204)
    def delete_document(document_id: str, request: Request):
        if not request.app.state.document_store.delete_document(document_id):
            raise HTTPException(404, "Document not found")
        return Response(status_code=204)

    @application.post("/api/search")
    def search_documents(body: SearchRequest, request: Request):
        evidence = request.app.state.evidence_retriever.search(
            body.question.strip(), body.document_id, body.top_k
        )
        result = request.app.state.response_agent.answer(body.question.strip(), evidence)
        result["evidence"] = evidence
        return result

    if (FRONTEND_DIST / "assets").is_dir():
        application.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @application.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=FileResponse)
    def spa(full_path: str):
        candidate = (FRONTEND_DIST / full_path).resolve()
        if FRONTEND_DIST.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(404, "Frontend is not built")

    return application


app = create_app()
