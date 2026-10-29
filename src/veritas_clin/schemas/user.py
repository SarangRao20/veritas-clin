from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Literal


class UserOut(BaseModel):
    user_id: str
    email: str
    username: str
    role: Literal["admin", "clinician", "viewer"]
    is_active: bool
    created_at: str
    last_login_at: str | None = None


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_\-]+$")
    password: str | None = Field(default=None, min_length=8, max_length=128)


class AdminUserPatch(BaseModel):
    role: Literal["admin", "clinician", "viewer"] | None = None
    is_active: bool | None = None
