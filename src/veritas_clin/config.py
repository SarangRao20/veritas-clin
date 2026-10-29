"""Filesystem locations and runtime configuration for Veritas-Clin."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DEMO_DOCUMENTS_DIR = DATA_DIR / "demo_documents"
CLINICAL_RECORDS_DIR = DATA_DIR / "clinical_records"
DATABASE_PATH = DATA_DIR / "documents.sqlite3"
CONFIG_DIR = ROOT / "config"

# Auth — override in .env for production
SECRET_KEY: str = os.getenv("VERITAS_SECRET_KEY", "dev-secret-change-me-in-production")
