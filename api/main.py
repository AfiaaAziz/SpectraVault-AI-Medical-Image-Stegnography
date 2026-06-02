"""SpectraVault FastAPI — LSB, DCT, and FFT embed/extract."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from spectravault.auth_service import (
    LoginBody,
    SignupBody,
    get_current_user,
    login_user,
    signup_user,
)
from spectravault.embed_service import (
    EmbedServiceError,
    build_metadata_payload,
    embed_stego,
    extract_auto,
    extract_stego,
)

try:
    from spectravault.ai_inference import AIInferenceError, predict_diseases
except ImportError:
    predict_diseases = None  # type: ignore
    AIInferenceError = Exception  # type: ignore

app = FastAPI(
    title="SpectraVault API",
    description="Hybrid steganography (LSB, DCT, FFT) + AES-256-GCM for SpectraVault AI",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    ai = "available" if predict_diseases is not None else "unavailable"
    return {
        "status": "ok",
        "methods": {"LSB": "available", "DCT": "available", "FFT": "available"},
        "ai": ai,
    }


@app.on_event("startup")
def preload_ai_model():
    """Warm DenseNet on startup so the first /api/analyze request does not time out."""
    if predict_diseases is None:
        return
    try:
        from spectravault.ai_inference import _load_model

        _load_model()
        print("DenseNet-121 ready for /api/analyze")
    except Exception as exc:
        print(f"Warning: AI model preload failed: {exc}")


@app.post("/api/analyze")
async def analyze(image: UploadFile = File(...), threshold: float = Form(0.3)):
    if predict_diseases is None:
        return JSONResponse(
            status_code=503,
            content={"detail": "AI inference unavailable. Install torchxrayvision."},
        )
    data = await image.read()
    try:
        return predict_diseases(data, threshold=threshold)
    except AIInferenceError as exc:
        return JSONResponse(status_code=400, content={"detail": str(exc)})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": f"AI analysis failed: {exc}"})


@app.post("/api/embed")
async def embed(
    image: UploadFile = File(...),
    password: str = Form(...),
    method: str = Form("LSB"),
    patient_id: str = Form("P00001"),
    age: str = Form("40"),
    gender: str = Form("M"),
    view: str = Form("PA"),
    diagnoses: str = Form("No Finding"),
    source: str = Form("WebUI"),
):
    data = await image.read()
    metadata = build_metadata_payload(
        patient_id=patient_id,
        age=age,
        gender=gender,
        view=view,
        diagnoses=diagnoses,
        source=source,
    )
    try:
        return embed_stego(data, password, metadata, method=method)
    except EmbedServiceError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.post("/api/extract")
async def extract(
    image: UploadFile = File(...),
    password: str = Form(...),
    method: str = Form("AUTO"),
):
    data = await image.read()
    try:
        if method.strip().upper() in ("AUTO", "AUTO-DETECT"):
            return extract_auto(data, password)
        return extract_stego(data, password, method=method)
    except EmbedServiceError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})
