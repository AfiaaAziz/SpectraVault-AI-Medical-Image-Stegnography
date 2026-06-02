"""DenseNet-121 chest X-ray pathology scoring via torchxrayvision."""

from __future__ import annotations

from io import BytesIO

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from spectravault.config import DEFAULT_CONFIG

_model = None
_pathologies: list[str] | None = None


class AIInferenceError(Exception):
    """Raised when AI inference fails."""


def _load_model():
    global _model, _pathologies
    if _model is not None:
        return _model, _pathologies

    try:
        import torchxrayvision as xrv
    except ImportError as exc:
        raise AIInferenceError(
            "torchxrayvision is not installed. Run: pip install torchxrayvision"
        ) from exc

    print("Loading DenseNet-121 (NIH ChestX-ray14 weights) ...")
    _model = xrv.models.DenseNet(weights="densenet121-res224-nih")
    _model.eval()
    _pathologies = [p for p in _model.pathologies if p]
    return _model, _pathologies


def pil_from_bytes(data: bytes) -> Image.Image:
    try:
        return Image.open(BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise AIInferenceError("Invalid image file.") from exc


def predict_diseases(
    image: Image.Image | bytes,
    *,
    threshold: float | None = None,
    top_n: int = 14,
) -> dict:
    """
    Run DenseNet-121 on a chest X-ray.

    Returns detected diseases above threshold plus ranked confidence scores.
    """
    threshold = DEFAULT_CONFIG["ai_threshold"] if threshold is None else threshold

    if isinstance(image, bytes):
        image = pil_from_bytes(image)

    model, pathologies = _load_model()

    gray = image.convert("L")
    tensor = transforms.ToTensor()(gray.resize((224, 224)))
    tensor = tensor * 2048 - 1024  # torchxrayvision expects [-1024, 1024]
    tensor = tensor.unsqueeze(0)

    with torch.no_grad():
        probs = torch.sigmoid(model(tensor)).squeeze().numpy()

    scores = {
        pathologies[i]: round(float(probs[i]), 4)
        for i in range(len(pathologies))
    }
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    detected = {name: conf for name, conf in ranked if conf >= threshold}

    if not detected and ranked:
        name, conf = ranked[0]
        detected = {name: conf}

    return {
        "model": "DenseNet-121",
        "weights": "densenet121-res224-nih",
        "threshold": threshold,
        "detected": detected,
        "ranked": [{"name": name, "confidence": conf} for name, conf in ranked[:top_n]],
        "diagnoses": list(detected.keys()),
    }
