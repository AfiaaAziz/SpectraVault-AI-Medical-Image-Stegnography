"""Patch model.ipynb for portable paths and LSB-focused pipeline."""

import json
from pathlib import Path

NOTEBOOK = Path(__file__).resolve().parent.parent / "model.ipynb"


def set_cell_source(cells, cell_id: str, new_source: str) -> bool:
    for cell in cells:
        if cell.get("id") == cell_id:
            cell["source"] = new_source.splitlines(keepends=True)
            return True
    return False


def main():
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    cells = nb["cells"]

    # Step 0 imports — portable output dir + spectravault on path
    imports = '''import numpy as np
import cv2
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from PIL import Image
import base64
import json
import os
import csv
import sys
from pathlib import Path
from getpass import getpass
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Random import get_random_bytes

import torch
import torchvision.transforms as transforms
from medmnist import ChestMNIST
from scipy.fftpack import dct, idct
from skimage.metrics import structural_similarity as ssim_func
import pandas as pd

# ── Project root & spectravault package ─────────────────────────────────────
PROJECT_ROOT = Path.cwd()
if not (PROJECT_ROOT / "model.ipynb").exists():
    PROJECT_ROOT = Path("/content") if Path("/content").exists() else PROJECT_ROOT
sys.path.insert(0, str(PROJECT_ROOT))

from spectravault.paths import get_output_dirs
from spectravault.pipeline import (
    run_lsb_pipeline,
    export_frontend_metrics,
    build_lsb_summary,
    evaluate_lsb_split,
    lsb_round_trip,
)
from spectravault.encryption import MediGuardEncryptor
from spectravault.lsb_stego import LSBStego
from spectravault.metrics import calculate_metrics, quality_label
from spectravault.metadata import get_patient_metadata, structure_for_embedding, pil_to_rgb_array, DISEASES

_dirs = get_output_dirs(PROJECT_ROOT)
OUTPUT_DIR  = _dirs["output"]
STEGO_DIR   = _dirs["stego"]
METRICS_DIR = _dirs["metrics"]
MODELS_DIR  = _dirs["models"]
FIGS_DIR    = _dirs["figures"]
LSB_DIR     = _dirs["lsb"]

print(" All imports successful!")
print(f" Outputs will be saved to: {OUTPUT_DIR}")
print(" LSB pipeline module: spectravault/ (run Step 11 for LSB-only evaluation)")
'''
    set_cell_source(cells, "4d82619e", imports)

    # Step 11 — LSB-only evaluation
    eval_cell = '''## Step 11 — LSB Evaluation (Train / Val / Test)

# LSB-only: encrypt → embed → extract → decrypt
# DCT and FFT are skipped until those extractors are fixed.

encryptor = MediGuardEncryptor(ENCRYPTION_PASSWORD)
lsb_stego = LSBStego(bits=CONFIG["lsb_bits"])

all_rows = []
for ds, name in [(train_dataset, "train"), (val_dataset, "val"), (test_dataset, "test")]:
    all_rows += evaluate_lsb_split(
        ds,
        name,
        encryptor,
        lsb_stego,
        n=CONFIG["eval_n_images"],
        image_size=CONFIG["image_size"],
    )

df_eval = pd.DataFrame(all_rows)

print("\\n" + "=" * 70)
print("LSB SUMMARY — embed → extract → decrypt")
print("=" * 70)
for split in ["train", "val", "test"]:
    sub = df_eval[df_eval["split"] == split]
    if sub.empty:
        continue
    psnr_mean = sub["LSB_psnr"].mean()
    ssim_mean = sub["LSB_ssim"].mean()
    acc_mean  = sub["LSB_success"].mean()
    psnr_str  = f"{psnr_mean:.2f} dB" if not pd.isna(psnr_mean) else "N/A"
    ssim_str  = f"{ssim_mean:.6f}"    if not pd.isna(ssim_mean) else "N/A"
    print(f"  {split:<6} | PSNR: {psnr_str} | SSIM: {ssim_str} | Accuracy: {acc_mean * 100:.1f}%")
'''
    # Find evaluation cell by content
    for cell in cells:
        src = "".join(cell.get("source", []))
        if "def evaluate_split(dataset" in src and "Step 11" in src:
            cell["source"] = eval_cell.splitlines(keepends=True)
            break

    # Step 12 — save LSB artifacts only
    save_cell = '''# ── Save LSB artifacts to mediguard_outputs/ ───────────────────────────────

csv_path = METRICS_DIR / "evaluation_results.csv"
df_eval.to_csv(csv_path, index=False)
print(f" Metrics CSV     → {csv_path}")

summary = build_lsb_summary(df_eval, CONFIG)
json_path = METRICS_DIR / "summary.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)
print(f" Summary JSON    → {json_path}")

# One LSB stego PNG per split
for ds, split_name in [(train_dataset, "train"), (val_dataset, "val"), (test_dataset, "test")]:
    pil_img, _ = ds[0]
    img_arr = pil_to_rgb_array(pil_img, CONFIG["image_size"])
    meta = get_patient_metadata(0, dataset=ds, use_ai=False)
    message = structure_for_embedding(meta)
    result = lsb_round_trip(encryptor, lsb_stego, img_arr, message)
    p = STEGO_DIR / f"stego_LSB_{split_name}.png"
    Image.fromarray(result["stego_image"]).save(p)
    print(f" Stego PNG       → {p}  (PSNR {result['metrics']['psnr']} dB)")

# Sync frontend dashboard
export_frontend_metrics(summary, PROJECT_ROOT / "frontend" / "public" / "data" / "metrics.json")

if AI_AVAILABLE:
    model_path = MODELS_DIR / "densenet121_nih_xray.pth"
    torch.save(ai_model.state_dict(), model_path)
    print(f" AI model        → {model_path}")

print(f"\\n All LSB artifacts saved under: {OUTPUT_DIR}")
'''
    for cell in cells:
        src = "".join(cell.get("source", []))
        if "df_eval.to_csv" in src and "summary.json" in src:
            cell["source"] = save_cell.splitlines(keepends=True)
            break

    NOTEBOOK.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Patched {NOTEBOOK}")


if __name__ == "__main__":
    main()
