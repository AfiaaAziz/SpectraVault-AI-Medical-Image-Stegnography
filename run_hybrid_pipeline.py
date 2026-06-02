#!/usr/bin/env python3
"""
Run hybrid LSB + DCT + FFT evaluation on ChestMNIST.

Usage:
  py run_hybrid_pipeline.py --synthetic --eval-n 5
  py run_hybrid_pipeline.py --eval-n 20
  set SPECTRAVAULT_PASSWORD=yourpass && py run_hybrid_pipeline.py
"""

from __future__ import annotations

import argparse
import os
import sys
from getpass import getpass


def main() -> int:
    parser = argparse.ArgumentParser(description="SpectraVault hybrid LSB/DCT/FFT pipeline")
    parser.add_argument("--eval-n", type=int, default=20, help="Images per split (default: 20)")
    parser.add_argument("--no-frontend", action="store_true", help="Skip frontend metrics JSON")
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="Use synthetic images (skip ChestMNIST download)",
    )
    args = parser.parse_args()

    password = os.environ.get("SPECTRAVAULT_PASSWORD")
    if not password:
        password = getpass("Encryption password: ")
        confirm = getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.", file=sys.stderr)
            return 1

    from spectravault.pipeline import run_hybrid_pipeline

    df = run_hybrid_pipeline(
        password,
        eval_n=args.eval_n,
        export_frontend=not args.no_frontend,
        use_synthetic=args.synthetic,
    )

    failed = 0
    for method in ("LSB", "DCT", "FFT"):
        col = f"{method}_success"
        if col in df.columns:
            failed += int((~df[col]).sum())

    if failed:
        print(f"\nWarning: {failed} method×image round-trip(s) failed.", file=sys.stderr)
        return 1

    print("\nHybrid pipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
