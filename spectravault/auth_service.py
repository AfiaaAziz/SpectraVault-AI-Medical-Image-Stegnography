"""User registration, login, and JWT validation via Supabase Auth."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthApiError
from pydantic import BaseModel, EmailStr, Field

from spectravault.supabase_client import get_supabase, is_supabase_configured

_bearer = HTTPBearer(auto_error=False)


class SignupBody(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _public_user_from_auth(user: Any) -> dict[str, Any]:
    meta = getattr(user, "user_metadata", None) or {}
    if not isinstance(meta, dict):
        meta = {}
    created = getattr(user, "created_at", None)
    return {
        "id": str(user.id),
        "email": user.email or "",
        "full_name": meta.get("full_name") or meta.get("name") or "",
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
    }


def _auth_payload(session: Any, user: Any) -> dict[str, Any]:
    return {
        "access_token": session.access_token,
        "token_type": "bearer",
        "user": _public_user_from_auth(user),
    }


def _require_supabase() -> None:
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env "
                "(copy from .env.example)."
            ),
        )


def _map_auth_error(exc: AuthApiError) -> HTTPException:
    msg = (getattr(exc, "message", None) or str(exc) or "Authentication failed.").strip()
    lower = msg.lower()
    status = getattr(exc, "status", 400)
    if not isinstance(status, int):
        status = 400

    if "already" in lower or "already registered" in lower:
        return HTTPException(status_code=409, detail="An account with this email already exists.")
    if "invalid login credentials" in lower or "invalid credentials" in lower:
        return HTTPException(status_code=401, detail="Invalid email or password.")
    if "email not confirmed" in lower or "confirm your email" in lower:
        return HTTPException(
            status_code=403,
            detail="Please confirm your email before logging in (check your inbox).",
        )
    if status == 422:
        return HTTPException(status_code=400, detail=msg)
    if status >= 500:
        return HTTPException(status_code=502, detail="Authentication service error. Try again later.")
    return HTTPException(status_code=400, detail=msg)


def signup_user(body: SignupBody) -> dict[str, Any]:
    _require_supabase()
    email = _normalize_email(str(body.email))
    try:
        client = get_supabase()
        response = client.auth.sign_up(
            {
                "email": email,
                "password": body.password,
                "options": {"data": {"full_name": body.full_name.strip()}},
            }
        )
    except AuthApiError as exc:
        raise _map_auth_error(exc) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if response.user is None:
        raise HTTPException(status_code=400, detail="Sign up failed. Please try again.")

    if response.session is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Account created. Confirm your email before logging in, or disable "
                "'Confirm email' in Supabase → Authentication → Providers → Email (for local dev)."
            ),
        )

    return _auth_payload(response.session, response.user)


def login_user(body: LoginBody) -> dict[str, Any]:
    _require_supabase()
    email = _normalize_email(str(body.email))
    try:
        client = get_supabase()
        response = client.auth.sign_in_with_password(
            {"email": email, "password": body.password}
        )
    except AuthApiError as exc:
        raise _map_auth_error(exc) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if response.session is None or response.user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return _auth_payload(response.session, response.user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    _require_supabase()
    try:
        client = get_supabase()
        response = client.auth.get_user(credentials.credentials)
    except AuthApiError as exc:
        raise _map_auth_error(exc) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if response.user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return _public_user_from_auth(response.user)
