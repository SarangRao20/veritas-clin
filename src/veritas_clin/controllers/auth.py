"""Auth controller: register, login, refresh, logout."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from ..schemas.auth import (
    AccessTokenResponse, LoginRequest, RefreshRequest,
    RegisterRequest, TokenResponse,
)
from ..schemas.user import UserOut
from ..services.auth_service import (
    create_access_token, create_refresh_token,
    hash_password, refresh_token_expires_at, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, request: Request):
    user_store = request.app.state.user_store
    if user_store.get_user_by_email(body.email):
        raise HTTPException(409, "Email already registered")

    role = "admin" if user_store.count_users() == 0 else "clinician"
    user = user_store.create_user(
        email=body.email,
        username=body.username,
        hashed_pw=hash_password(body.password),
        role=role,
    )
    user_store.log("register", user_id=user["user_id"], resource_type="user",
                   resource_id=user["user_id"])

    access = create_access_token(user["user_id"], user["email"], user["role"])
    refresh = create_refresh_token()
    user_store.save_refresh_token(user["user_id"], refresh, refresh_token_expires_at())
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request):
    user_store = request.app.state.user_store
    user = user_store.get_user_by_email(body.email)
    if user is None or not verify_password(body.password, user["hashed_pw"]):
        raise HTTPException(401, "Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(403, "Account is deactivated")

    user_store.update_user(user["user_id"], last_login_at=datetime.now(timezone.utc).isoformat())
    user_store.log("login", user_id=user["user_id"])

    access = create_access_token(user["user_id"], user["email"], user["role"])
    refresh = create_refresh_token()
    user_store.save_refresh_token(user["user_id"], refresh, refresh_token_expires_at())
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(body: RefreshRequest, request: Request):
    user_store = request.app.state.user_store
    record = user_store.get_refresh_token(body.refresh_token)
    if record is None:
        raise HTTPException(401, "Invalid or revoked refresh token")

    now = datetime.now(timezone.utc).isoformat()
    if record["expires_at"] < now:
        user_store.revoke_refresh_token(body.refresh_token)
        raise HTTPException(401, "Refresh token expired")

    user = user_store.get_user_by_id(record["user_id"])
    if user is None or not user["is_active"]:
        raise HTTPException(401, "User not found or inactive")

    access = create_access_token(user["user_id"], user["email"], user["role"])
    return AccessTokenResponse(access_token=access)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, request: Request):
    request.app.state.user_store.revoke_refresh_token(body.refresh_token)
