"""FastAPI auth dependencies: current-user extraction and role enforcement."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from ..services.auth_service import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Extract and validate the JWT from the Authorization: Bearer header."""
    if credentials is None:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    user_store = request.app.state.user_store
    user = user_store.get_user_by_id(payload["sub"])
    if user is None or not user["is_active"]:
        raise HTTPException(401, "User not found or inactive")
    return user


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """Extract and validate user if header is present, else None."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_store = getattr(request.app.state, "user_store", None)
        if user_store:
            user = user_store.get_user_by_id(payload.get("sub", ""))
            if user and user.get("is_active"):
                return user
    except Exception:
        pass
    return None


def require_role(*roles: str):
    """Dependency factory: raise 403 if the current user's role is not in *roles*."""
    def _check(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _check


# Convenient pre-built dependencies
CurrentUser = Depends(get_current_user)
RequireAdmin = Depends(require_role("admin"))
RequireClinician = Depends(require_role("admin", "clinician"))
