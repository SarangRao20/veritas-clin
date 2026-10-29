"""Data-access layer for users, refresh tokens, and audit log."""
from __future__ import annotations

import hashlib
import json
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..models.database import connect


class UserStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)

    def _conn(self):
        return connect(self.db_path)

    # ── Users ────────────────────────────────────────────────────────────

    def count_users(self) -> int:
        with closing(self._conn()) as conn:
            return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    def create_user(self, email: str, username: str, hashed_pw: str, role: str, user_id: str | None = None) -> dict[str, Any]:
        user_id = user_id or uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat()
        with closing(self._conn()) as conn:
            with conn:
                conn.execute(
                    """INSERT INTO users (user_id, email, username, hashed_pw, role, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (user_id, email.lower().strip(), username.strip(), hashed_pw, role, created_at),
                )
        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
            ).fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE user_id = ?", (user_id,)
            ).fetchone()
            return dict(row) if row else None

    def list_users(self, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        with closing(self._conn()) as conn:
            rows = conn.execute(
                "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [dict(r) for r in rows]

    def update_user(self, user_id: str, **fields) -> dict[str, Any] | None:
        allowed = {"username", "hashed_pw", "role", "is_active", "last_login_at"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return self.get_user_by_id(user_id)
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        with closing(self._conn()) as conn:
            with conn:
                conn.execute(
                    f"UPDATE users SET {set_clause} WHERE user_id = ?",
                    (*updates.values(), user_id),
                )
        return self.get_user_by_id(user_id)

    def delete_user(self, user_id: str) -> bool:
        with closing(self._conn()) as conn:
            with conn:
                cur = conn.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
                return cur.rowcount > 0

    # ── Refresh tokens ───────────────────────────────────────────────────

    @staticmethod
    def _hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    def save_refresh_token(self, user_id: str, raw_token: str, expires_at: str) -> None:
        token_id = uuid.uuid4().hex
        with closing(self._conn()) as conn:
            with conn:
                conn.execute(
                    """INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at)
                       VALUES (?, ?, ?, ?)""",
                    (token_id, user_id, self._hash_token(raw_token), expires_at),
                )

    def get_refresh_token(self, raw_token: str) -> dict[str, Any] | None:
        h = self._hash_token(raw_token)
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0",
                (h,),
            ).fetchone()
            return dict(row) if row else None

    def revoke_refresh_token(self, raw_token: str) -> None:
        h = self._hash_token(raw_token)
        with closing(self._conn()) as conn:
            with conn:
                conn.execute(
                    "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", (h,)
                )

    def revoke_all_refresh_tokens(self, user_id: str) -> None:
        with closing(self._conn()) as conn:
            with conn:
                conn.execute(
                    "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?", (user_id,)
                )

    # ── Audit log ────────────────────────────────────────────────────────

    def log(
        self,
        action: str,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        details: dict | None = None,
    ) -> None:
        log_id = uuid.uuid4().hex
        timestamp = datetime.now(timezone.utc).isoformat()
        with closing(self._conn()) as conn:
            try:
                with conn:
                    conn.execute(
                        """INSERT INTO audit_log
                           (log_id, user_id, action, resource_type, resource_id, timestamp, details)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (log_id, user_id, action, resource_type, resource_id, timestamp,
                         json.dumps(details) if details else None),
                    )
            except Exception:
                pass  # audit log must never crash a request

    def get_audit_log(self, limit: int = 100) -> list[dict[str, Any]]:
        with closing(self._conn()) as conn:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
