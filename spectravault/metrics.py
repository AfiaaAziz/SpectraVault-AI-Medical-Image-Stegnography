"""Image quality metrics for stego pairs."""

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim_func


def calculate_metrics(original: np.ndarray, stego: np.ndarray) -> dict:
    """Return PSNR (dB), MSE, and SSIM for a cover/stego pair."""
    o = original.astype(np.float64)
    s = stego.astype(np.float64)

    mse = float(np.mean((o - s) ** 2))
    psnr = float(20 * np.log10(255.0 / np.sqrt(mse))) if mse > 0 else float("inf")

    og = cv2.cvtColor(original, cv2.COLOR_RGB2GRAY) if original.ndim == 3 else original
    sg = cv2.cvtColor(stego, cv2.COLOR_RGB2GRAY) if stego.ndim == 3 else stego
    ssim_v = float(ssim_func(og, sg, data_range=255))

    return {"psnr": round(psnr, 4), "mse": round(mse, 6), "ssim": round(ssim_v, 6)}


def quality_label(psnr: float) -> str:
    if psnr >= 45:
        return "Excellent (imperceptible)"
    if psnr >= 35:
        return "Good (barely noticeable)"
    if psnr >= 25:
        return "Fair (visible distortion)"
    return "Poor"
