"""Filesystem locations for the local document workbench."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DEMO_DOCUMENTS_DIR = DATA_DIR / "demo_documents"
DATABASE_PATH = DATA_DIR / "documents.sqlite3"
