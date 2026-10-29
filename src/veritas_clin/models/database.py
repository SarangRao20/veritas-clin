"""SQLite connection factory with schema versioning and migration support."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

_SCHEMA_VERSION = 5


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema(db_path: Path) -> None:
    """Create tables and run migrations up to the current schema version."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(db_path)) as conn:
        # Check and repair any legacy bad foreign key where patient_id referenced users(user_id)
        table_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"
        ).fetchone()
        if table_exists:
            fks = conn.execute("PRAGMA foreign_key_list(documents)").fetchall()
            has_bad_fk = any(fk[2] == "users" and fk[3] == "patient_id" for fk in fks)
            if has_bad_fk:
                conn.execute("PRAGMA foreign_keys = OFF")
                cols = {row[1] for row in conn.execute("PRAGMA table_info(documents)")}
                enc_date = "encounter_date" if "encounter_date" in cols else "NULL AS encounter_date"
                enc_type = "encounter_type" if "encounter_type" in cols else "NULL AS encounter_type"
                usr_id = "user_id" if "user_id" in cols else "NULL AS user_id"
                pat_id = "patient_id" if "patient_id" in cols else "NULL AS patient_id"
                conn.executescript(f"""
                    CREATE TABLE documents_fix (
                        document_id    TEXT PRIMARY KEY,
                        filename       TEXT NOT NULL,
                        media_type     TEXT NOT NULL,
                        extracted_text TEXT NOT NULL,
                        created_at     TEXT NOT NULL,
                        embedding_model TEXT NOT NULL,
                        is_synthetic   INTEGER NOT NULL DEFAULT 0 CHECK (is_synthetic IN (0, 1)),
                        user_id        TEXT REFERENCES users(user_id) ON DELETE SET NULL,
                        patient_id     TEXT,
                        encounter_date TEXT,
                        encounter_type TEXT
                    );
                    INSERT INTO documents_fix
                    SELECT document_id, filename, media_type, extracted_text, created_at,
                           embedding_model, is_synthetic, {usr_id}, {pat_id}, {enc_date}, {enc_type}
                    FROM documents;
                    DROP TABLE documents;
                    ALTER TABLE documents_fix RENAME TO documents;
                """)
                conn.execute("PRAGMA foreign_keys = ON")
                conn.commit()

        version = conn.execute("PRAGMA user_version").fetchone()[0]

        if version not in (0, 1, 2, 3, 4, _SCHEMA_VERSION):
            raise RuntimeError(f"Unsupported database schema version: {version}")

        # Fresh database (version 0): initialize current schema directly
        if version == 0:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id       TEXT PRIMARY KEY,
                    email         TEXT NOT NULL UNIQUE,
                    username      TEXT NOT NULL UNIQUE,
                    hashed_pw     TEXT NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'clinician'
                                  CHECK (role IN ('admin', 'clinician', 'viewer')),
                    is_active     INTEGER NOT NULL DEFAULT 1,
                    created_at    TEXT NOT NULL,
                    last_login_at TEXT
                );
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token_id   TEXT PRIMARY KEY,
                    user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL,
                    revoked    INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                    log_id        TEXT PRIMARY KEY,
                    user_id       TEXT REFERENCES users(user_id),
                    action        TEXT NOT NULL,
                    resource_type TEXT,
                    resource_id   TEXT,
                    timestamp     TEXT NOT NULL,
                    details       TEXT
                );
                CREATE TABLE IF NOT EXISTS documents (
                    document_id    TEXT PRIMARY KEY,
                    filename       TEXT NOT NULL,
                    media_type     TEXT NOT NULL,
                    extracted_text TEXT NOT NULL,
                    created_at     TEXT NOT NULL,
                    embedding_model TEXT NOT NULL,
                    is_synthetic   INTEGER NOT NULL DEFAULT 0 CHECK (is_synthetic IN (0, 1)),
                    user_id        TEXT REFERENCES users(user_id) ON DELETE SET NULL,
                    patient_id     TEXT,
                    encounter_date TEXT,
                    encounter_type TEXT
                );
                CREATE TABLE IF NOT EXISTS passages (
                    passage_id    TEXT PRIMARY KEY,
                    document_id   TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
                    ordinal       INTEGER NOT NULL CHECK (ordinal >= 0),
                    page          INTEGER,
                    text          TEXT NOT NULL,
                    embedding     BLOB,
                    embedding_dim INTEGER,
                    UNIQUE (document_id, ordinal),
                    CHECK ((embedding IS NULL AND embedding_dim IS NULL) OR
                           (embedding IS NOT NULL AND embedding_dim > 0))
                );
                CREATE INDEX IF NOT EXISTS passages_document_id ON passages(document_id);

                CREATE TABLE IF NOT EXISTS encounters (
                    encounter_id   TEXT PRIMARY KEY,
                    patient_id     TEXT NOT NULL,
                    user_id        TEXT,
                    encounter_type TEXT NOT NULL,
                    occurred_at    TEXT,
                    source_document_id TEXT REFERENCES documents(document_id) ON DELETE SET NULL,
                    title          TEXT,
                    summary        TEXT,
                    created_at     TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS encounters_patient_id ON encounters(patient_id);
                CREATE INDEX IF NOT EXISTS encounters_occurred_at ON encounters(occurred_at);

                CREATE TABLE IF NOT EXISTS patient_flags (
                    flag_id        TEXT PRIMARY KEY,
                    patient_id     TEXT NOT NULL,
                    user_id        TEXT,
                    kind           TEXT NOT NULL,
                    label          TEXT NOT NULL,
                    status         TEXT NOT NULL DEFAULT 'open',
                    urgency        TEXT NOT NULL DEFAULT 'low',
                    confidence     REAL NOT NULL DEFAULT 0.0,
                    rationale      TEXT,
                    evidence_json  TEXT,
                    trace_json     TEXT,
                    created_at     TEXT NOT NULL,
                    updated_at     TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS patient_flags_patient_id ON patient_flags(patient_id);

                CREATE TABLE IF NOT EXISTS embedding_cache (
                    text_hash     TEXT PRIMARY KEY,
                    model_id      TEXT NOT NULL,
                    text          TEXT NOT NULL,
                    embedding     BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at    TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_embedding_cache_model ON embedding_cache(model_id);
            """)
            conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
            conn.commit()
            return

        # Upgrading older databases:
        # Base tables (v1 — documents + passages)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                document_id    TEXT PRIMARY KEY,
                filename       TEXT NOT NULL,
                media_type     TEXT NOT NULL,
                extracted_text TEXT NOT NULL,
                created_at     TEXT NOT NULL,
                embedding_model TEXT NOT NULL,
                is_synthetic   INTEGER NOT NULL DEFAULT 0 CHECK (is_synthetic IN (0, 1))
            );
            CREATE TABLE IF NOT EXISTS passages (
                passage_id    TEXT PRIMARY KEY,
                document_id   TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
                ordinal       INTEGER NOT NULL CHECK (ordinal >= 0),
                page          INTEGER,
                text          TEXT NOT NULL,
                embedding     BLOB,
                embedding_dim INTEGER,
                UNIQUE (document_id, ordinal),
                CHECK ((embedding IS NULL AND embedding_dim IS NULL) OR
                       (embedding IS NOT NULL AND embedding_dim > 0))
            );
            CREATE INDEX IF NOT EXISTS passages_document_id ON passages(document_id);
        """)

        # v2 migration: users, refresh_tokens, audit_log, user_id on documents
        if version < 2:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id       TEXT PRIMARY KEY,
                    email         TEXT NOT NULL UNIQUE,
                    username      TEXT NOT NULL UNIQUE,
                    hashed_pw     TEXT NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'clinician'
                                  CHECK (role IN ('admin', 'clinician', 'viewer')),
                    is_active     INTEGER NOT NULL DEFAULT 1,
                    created_at    TEXT NOT NULL,
                    last_login_at TEXT
                );
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token_id   TEXT PRIMARY KEY,
                    user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL,
                    revoked    INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                    log_id        TEXT PRIMARY KEY,
                    user_id       TEXT REFERENCES users(user_id),
                    action        TEXT NOT NULL,
                    resource_type TEXT,
                    resource_id   TEXT,
                    timestamp     TEXT NOT NULL,
                    details       TEXT
                );
            """)
            cols = {row[1] for row in conn.execute("PRAGMA table_info(documents)")}
            if "user_id" not in cols:
                conn.execute(
                    "ALTER TABLE documents ADD COLUMN user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL"
                )

        # v3 migration: patient_id
        if version < 3:
            cols = {row[1] for row in conn.execute("PRAGMA table_info(documents)")}
            if "patient_id" not in cols:
                conn.execute("ALTER TABLE documents ADD COLUMN patient_id TEXT")

        # v4 migration: encounter metadata + encounters + patient_flags
        if version < 4:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS encounters (
                    encounter_id   TEXT PRIMARY KEY,
                    patient_id     TEXT NOT NULL,
                    user_id        TEXT,
                    encounter_type TEXT NOT NULL,
                    occurred_at    TEXT,
                    source_document_id TEXT REFERENCES documents(document_id) ON DELETE SET NULL,
                    title          TEXT,
                    summary        TEXT,
                    created_at     TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS encounters_patient_id ON encounters(patient_id);
                CREATE INDEX IF NOT EXISTS encounters_occurred_at ON encounters(occurred_at);

                CREATE TABLE IF NOT EXISTS patient_flags (
                    flag_id        TEXT PRIMARY KEY,
                    patient_id     TEXT NOT NULL,
                    user_id        TEXT,
                    kind           TEXT NOT NULL,
                    label          TEXT NOT NULL,
                    status         TEXT NOT NULL DEFAULT 'open',
                    urgency        TEXT NOT NULL DEFAULT 'low',
                    confidence     REAL NOT NULL DEFAULT 0.0,
                    rationale      TEXT,
                    evidence_json  TEXT,
                    trace_json     TEXT,
                    created_at     TEXT NOT NULL,
                    updated_at     TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS patient_flags_patient_id ON patient_flags(patient_id);
            """)
            cols = {row[1] for row in conn.execute("PRAGMA table_info(documents)")}
            if "encounter_date" not in cols:
                conn.execute("ALTER TABLE documents ADD COLUMN encounter_date TEXT")
            if "encounter_type" not in cols:
                conn.execute("ALTER TABLE documents ADD COLUMN encounter_type TEXT")

        # v5 migration: persistent embedding cache table
        if version < 5:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    text_hash     TEXT PRIMARY KEY,
                    model_id      TEXT NOT NULL,
                    text          TEXT NOT NULL,
                    embedding     BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at    TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_embedding_cache_model ON embedding_cache(model_id);
            """)

        conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
        conn.commit()
