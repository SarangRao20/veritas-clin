"""Users controller: profile management and admin user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Query

from ..middleware.auth import get_current_user, require_role
from ..schemas.user import AdminUserPatch, UserOut, UserUpdate
from ..services.auth_service import hash_password

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserOut)
def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@router.put("/users/me", response_model=UserOut)
def update_me(body: UserUpdate, request: Request, user: dict = Depends(get_current_user)):
    updates: dict = {}
    if body.username is not None:
        # Check uniqueness
        existing = request.app.state.user_store.list_users(limit=1000)
        if any(u["username"] == body.username and u["user_id"] != user["user_id"] for u in existing):
            raise HTTPException(409, "Username already taken")
        updates["username"] = body.username
    if body.password is not None:
        updates["hashed_pw"] = hash_password(body.password)
    updated = request.app.state.user_store.update_user(user["user_id"], **updates)
    return UserOut(**updated)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/users", response_model=list[UserOut])
def list_users(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: dict = Depends(require_role("admin")),
):
    users = request.app.state.user_store.list_users(limit=limit, offset=offset)
    return [UserOut(**u) for u in users]


@router.patch("/admin/users/{user_id}", response_model=UserOut)
def patch_user(
    user_id: str,
    body: AdminUserPatch,
    request: Request,
    admin: dict = Depends(require_role("admin")),
):
    if user_id == admin["user_id"] and body.is_active is False:
        raise HTTPException(400, "Cannot deactivate your own account")
    updates: dict = {}
    if body.role is not None:
        updates["role"] = body.role
    if body.is_active is not None:
        updates["is_active"] = int(body.is_active)
    updated = request.app.state.user_store.update_user(user_id, **updates)
    if updated is None:
        raise HTTPException(404, "User not found")
    request.app.state.user_store.log(
        "admin_patch_user", user_id=admin["user_id"],
        resource_type="user", resource_id=user_id,
    )
    return UserOut(**updated)


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    request: Request,
    admin: dict = Depends(require_role("admin")),
):
    if user_id == admin["user_id"]:
        raise HTTPException(400, "Cannot delete your own account")
    if not request.app.state.user_store.delete_user(user_id):
        raise HTTPException(404, "User not found")
    request.app.state.user_store.log(
        "admin_delete_user", user_id=admin["user_id"],
        resource_type="user", resource_id=user_id,
    )


@router.get("/admin/audit-log")
def get_audit_log(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    _admin: dict = Depends(require_role("admin")),
):
    return request.app.state.user_store.get_audit_log(limit=limit)
