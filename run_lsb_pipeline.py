#!/usr/bin/env python3
"""
Run the LSB-only SpectraVault pipeline locally.

Usage:
  py run_lsb_pipeline.py
  py run_lsb_pipeline.py --eval-n 5
  set SPECTRAVAULT_PASSWORD=yourpass && py run_lsb_pipeline.py --eval-n 20

Saves to mediguard_outputs/ and updates frontend/public/data/metrics.json
"""

from __future__ import annotations

import argparse
import os
import sys
from getpass import getpass


def main() -> int:
    parser = argparse.ArgumentParser(description="SpectraVault LSB pipeline")
    parser.add_argument(
        "--eval-n",
        type=int,
        default=20,
        help="Images per split to evaluate (default: 20)",
    )
    parser.add_argument(
        "--no-frontend",
        action="store_true",
        help="Skip writing frontend/public/data/metrics.json",
    )
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="Use synthetic images (skip 3.9GB ChestMNIST download)",
    )
    args = parser.parse_args()

    password = os.environ.get("SPECTRAVAULT_PASSWORD")
    if not password:
        password = getpass("Encryption password: ")
        confirm = getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.", file=sys.stderr)
            return 1

    from spectravault.pipeline import run_lsb_pipeline

    df = run_lsb_pipeline(
        password,
        eval_n=args.eval_n,
        export_frontend=not args.no_frontend,
        use_synthetic=args.synthetic,
    )

    failed = int((~df["LSB_success"]).sum()) if len(df) else 0
    if failed:
        print(f"\nWarning: {failed} image(s) failed LSB round-trip.", file=sys.stderr)
        return 1

    print("\nLSB pipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
