"""Supabase client for SpectraVault auth."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from supabase import Client, create_client

ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
    except ImportError:
        pass


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    _load_env()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env "
            "(see .env.example)."
        )
    return create_client(url, key)


def is_supabase_configured() -> bool:
    _load_env()
    return bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
