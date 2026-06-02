"""User registration, login, and JWT tokens for the SpectraVault API."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

ROOT = Path(__file__).resolve().parent.parent
USERS_FILE = ROOT / "data" / "users.json"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
PBKDF2_ITERATIONS = 100_000

_bearer = HTTPBearer(auto_error=False)


class SignupBody(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


def _jwt_secret() -> str:
    secret = os.environ.get("SPECTRAVAULT_JWT_SECRET", "").strip()
    if secret:
        return secret
    return "spectravault-dev-secret-change-in-production"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"{salt}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, hex_digest = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return secrets.compare_digest(digest.hex(), hex_digest)


def _load_users() -> dict[str, Any]:
    if not USERS_FILE.exists():
        return {"users": []}
    with open(USERS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    if "users" not in data or not isinstance(data["users"], list):
        return {"users": []}
    return data


def _save_users(data: dict[str, Any]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _public_user(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "email": record["email"],
        "full_name": record["full_name"],
        "created_at": record.get("created_at"),
    }


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


def signup_user(body: SignupBody) -> dict[str, Any]:
    email = _normalize_email(str(body.email))
    data = _load_users()
    for user in data["users"]:
        if user["email"] == email:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

    record = {
        "id": secrets.token_urlsafe(12),
        "full_name": body.full_name.strip(),
        "email": email,
        "password_hash": _hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    data["users"].append(record)
    _save_users(data)

    token = create_access_token(record["id"], record["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _public_user(record),
    }


def login_user(body: LoginBody) -> dict[str, Any]:
    email = _normalize_email(str(body.email))
    data = _load_users()
    for user in data["users"]:
        if user["email"] == email:
            if not _verify_password(body.password, user["password_hash"]):
                break
            token = create_access_token(user["id"], user["email"])
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": _public_user(user),
            }
    raise HTTPException(status_code=401, detail="Invalid email or password.")


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    data = _load_users()
    for user in data["users"]:
        if user["id"] == user_id:
            return user
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    payload = decode_access_token(credentials.credentials)
    user = get_user_by_id(payload.get("sub", ""))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")
    return _public_user(user)
