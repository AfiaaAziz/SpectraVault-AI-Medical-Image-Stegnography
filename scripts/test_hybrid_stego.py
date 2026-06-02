#!/usr/bin/env python3
"""Quick round-trip test for LSB, DCT, and FFT steganography."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from spectravault.config import DEFAULT_CONFIG
from spectravault.dct_stego import DCTStego
from spectravault.encryption import MediGuardEncryptor
from spectravault.fft_stego import FFTStego
from spectravault.lsb_stego import LSBStego
from spectravault.metadata import structure_for_embedding


def main() -> int:
    parser = argparse.ArgumentParser(description="Test LSB/DCT/FFT round-trip")
    parser.add_argument("--password", default="spectravault-dev")
    args = parser.parse_args()

    meta = {
        "patient_id": "P00001",
        "age": 54,
        "gender": "M",
        "view_position": "PA",
        "diagnoses_source": "TestScript",
        "diagnoses": "Atelectasis|Effusion",
    }
    message = structure_for_embedding(meta)
    enc = MediGuardEncryptor(args.password).encrypt(message)

    rng = np.random.default_rng(42)
    img_lsb = rng.integers(40, 200, (224, 224, 3), dtype=np.uint8)
    img_freq = rng.integers(40, 200, (512, 512, 3), dtype=np.uint8)

    engines = [
        ("LSB", LSBStego(bits=DEFAULT_CONFIG["lsb_bits"]), img_lsb),
        (
            "DCT",
            DCTStego(
                block_size=DEFAULT_CONFIG["dct_block_size"],
                coefficient=tuple(DEFAULT_CONFIG["dct_coefficient"]),
                alpha=DEFAULT_CONFIG["dct_alpha"],
            ),
            img_freq,
        ),
        (
            "FFT",
            FFTStego(
                block_size=DEFAULT_CONFIG["fft_block_size"],
                coefficient=tuple(DEFAULT_CONFIG["fft_coefficient"]),
                strength=DEFAULT_CONFIG["fft_strength"],
            ),
            img_freq,
        ),
    ]

    ok_all = True
    for name, engine, img in engines:
        stego = engine.embed(img.copy(), enc)
        extracted = engine.extract(stego)
        ok = extracted == enc
        ok_all = ok_all and ok
        print(f"{name}: {'PASS' if ok else 'FAIL'}")

    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
