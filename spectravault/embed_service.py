"""Embed/extract helpers for the HTTP API (LSB, DCT, FFT)."""

from __future__ import annotations

import base64
import re
from io import BytesIO

import numpy as np
from PIL import Image

from spectravault.config import DEFAULT_CONFIG
from spectravault.dct_stego import DCTStego
from spectravault.encryption import MediGuardEncryptor
from spectravault.fft_stego import FFTStego
from spectravault.lsb_stego import LSBStego
from spectravault.metadata import pil_to_rgb_array, structure_for_embedding
from spectravault.metrics import calculate_metrics

SUPPORTED_METHODS = ("LSB", "DCT", "FFT")


class EmbedServiceError(Exception):
    """Raised when embed/extract fails with a user-facing message."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def normalize_method(method: str) -> str:
    key = (method or "LSB").strip().upper()
    if key not in SUPPORTED_METHODS:
        raise EmbedServiceError(f"Unsupported method '{method}'. Use LSB, DCT, or FFT.")
    return key


def build_metadata_payload(
    *,
    patient_id: str,
    age: str | int,
    gender: str,
    view: str,
    diagnoses: str,
    source: str = "WebUI",
) -> dict:
    dx = diagnoses.strip()
    if not dx:
        dx = "No Finding"
    return {
        "patient_id": patient_id.strip() or "P00000",
        "age": int(age),
        "gender": gender.strip().upper()[:1] or "M",
        "view_position": view.strip().upper() or "PA",
        "diagnoses_source": source.strip() or "WebUI",
        "diagnoses": dx.replace(",", "|").replace(" | ", "|").replace(" |", "|"),
    }


def parse_embedding_string(text: str) -> dict:
    """Parse pipe-delimited payload back into display fields."""
    match = re.match(
        r"PID:(.*?)\|AGE:(.*?)\|GEN:(.*?)\|VIEW:(.*?)\|SRC:(.*?)\|DX:(.*)",
        text,
        re.DOTALL,
    )
    if not match:
        raise EmbedServiceError("Could not parse decrypted metadata.", 422)

    pid, age, gender, view, source, diagnoses = match.groups()
    dx_display = diagnoses.replace("|", " | ")
    return {
        "pid": pid,
        "age": age,
        "gender": gender,
        "view": view,
        "source": source,
        "diagnoses": dx_display,
        "raw": text,
    }


def image_size_for_method(method: str) -> int:
    if method in ("DCT", "FFT"):
        return DEFAULT_CONFIG["freq_image_size"]
    return DEFAULT_CONFIG["image_size"]


def load_image_from_bytes(data: bytes, image_size: int = 224) -> np.ndarray:
    try:
        pil = Image.open(BytesIO(data))
        pil = pil.convert("RGB")
    except Exception as exc:
        raise EmbedServiceError("Invalid image file. Upload PNG or JPG.") from exc
    return pil_to_rgb_array(pil, image_size)


def png_bytes_from_array(image: np.ndarray) -> bytes:
    buf = BytesIO()
    Image.fromarray(image.astype(np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


def _stego_engine(method: str):
    if method == "LSB":
        return LSBStego(bits=DEFAULT_CONFIG["lsb_bits"])
    if method == "DCT":
        return DCTStego(
            block_size=DEFAULT_CONFIG["dct_block_size"],
            coefficient=tuple(DEFAULT_CONFIG["dct_coefficient"]),
            alpha=DEFAULT_CONFIG["dct_alpha"],
        )
    return FFTStego(
        block_size=DEFAULT_CONFIG["fft_block_size"],
        coefficient=tuple(DEFAULT_CONFIG["fft_coefficient"]),
        strength=DEFAULT_CONFIG["fft_strength"],
    )


def _round_trip(method: str, cover: np.ndarray, password: str, metadata: dict) -> dict:
    message = structure_for_embedding(metadata)
    encryptor = MediGuardEncryptor(password)
    engine = _stego_engine(method)

    encrypted = encryptor.encrypt(message)
    stego = engine.embed(cover.copy(), encrypted)
    extracted = engine.extract(stego)
    decrypted = encryptor.decrypt(extracted)

    if decrypted != message:
        raise EmbedServiceError("Round-trip verification failed after embedding.", 500)

    return {
        "method": method,
        "success": True,
        "message_length": len(message),
        "encrypted_length": len(encrypted),
        "metrics": calculate_metrics(cover, stego),
        "metadata_string": message,
        "stego_image": stego,
    }


def embed_stego(
    image_bytes: bytes,
    password: str,
    metadata: dict,
    *,
    method: str = "LSB",
) -> dict:
    if not password:
        raise EmbedServiceError("Password is required.")

    method_key = normalize_method(method)
    size = image_size_for_method(method_key)
    cover = load_image_from_bytes(image_bytes, size)

    try:
        result = _round_trip(method_key, cover, password, metadata)
    except ValueError as exc:
        msg = str(exc)
        if "MAC check failed" in msg:
            raise EmbedServiceError(
                f"{method_key} embedding corrupted the encrypted payload (bits flipped after "
                f"uint8 save). Try LSB, or a different image. Detail: {msg}",
                422,
            ) from exc
        raise EmbedServiceError(msg) from exc
    except EmbedServiceError:
        raise
    except Exception as exc:
        raise EmbedServiceError(f"Embedding failed: {exc}", 500) from exc

    png = png_bytes_from_array(result.pop("stego_image"))
    result["stego_png_base64"] = base64.b64encode(png).decode("ascii")
    return result


def embed_lsb(image_bytes: bytes, password: str, metadata: dict, **kwargs) -> dict:
    return embed_stego(image_bytes, password, metadata, method="LSB", **kwargs)


def extract_stego(
    image_bytes: bytes,
    password: str,
    *,
    method: str = "LSB",
) -> dict:
    if not password:
        raise EmbedServiceError("Password is required.")

    method_key = normalize_method(method)
    size = image_size_for_method(method_key)
    stego = load_image_from_bytes(image_bytes, size)

    encryptor = MediGuardEncryptor(password)
    engine = _stego_engine(method_key)

    try:
        extracted = engine.extract(stego)
        decrypted = encryptor.decrypt(extracted)
    except ValueError as exc:
        raise EmbedServiceError(
            f"Wrong password or this image was not embedded with {method_key} + AES-256-GCM.",
            400,
        ) from exc
    except Exception as exc:
        raise EmbedServiceError(f"Extraction failed: {exc}", 400) from exc

    parsed = parse_embedding_string(decrypted)
    return {
        "method": method_key,
        "success": True,
        "verified": True,
        **parsed,
    }


def extract_lsb(image_bytes: bytes, password: str, **kwargs) -> dict:
    return extract_stego(image_bytes, password, method="LSB", **kwargs)


def extract_auto(image_bytes: bytes, password: str) -> dict:
    """Try LSB, DCT, then FFT until decryption succeeds."""
    last_error: EmbedServiceError | None = None
    for method in SUPPORTED_METHODS:
        try:
            return extract_stego(image_bytes, password, method=method)
        except EmbedServiceError as exc:
            last_error = exc
    raise last_error or EmbedServiceError("Could not extract payload with any method.")
