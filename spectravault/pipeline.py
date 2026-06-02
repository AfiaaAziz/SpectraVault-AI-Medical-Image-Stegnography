"""LSB-only embed → extract → decrypt pipeline and artifact export."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from spectravault.config import DEFAULT_CONFIG
from spectravault.dct_stego import DCTStego
from spectravault.encryption import MediGuardEncryptor
from spectravault.fft_stego import FFTStego
from spectravault.lsb_stego import LSBStego
from spectravault.metadata import get_patient_metadata, pil_to_rgb_array, structure_for_embedding
from spectravault.metrics import calculate_metrics, quality_label
from spectravault.paths import get_output_dirs, get_project_root


def make_stego_engine(method: str, config: dict | None = None):
    """Return LSB, DCT, or FFT stego engine from config."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    method = method.upper()
    if method == "LSB":
        return LSBStego(bits=cfg["lsb_bits"])
    if method == "DCT":
        return DCTStego(
            block_size=cfg["dct_block_size"],
            coefficient=tuple(cfg["dct_coefficient"]),
            alpha=cfg["dct_alpha"],
        )
    if method == "FFT":
        return FFTStego(
            block_size=cfg["fft_block_size"],
            coefficient=tuple(cfg["fft_coefficient"]),
            strength=cfg["fft_strength"],
        )
    raise ValueError(f"Unknown method: {method}")


def image_size_for_method(method: str, config: dict | None = None) -> int:
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if method.upper() in ("DCT", "FFT"):
        return cfg["freq_image_size"]
    return cfg["image_size"]


def stego_round_trip(
    encryptor: MediGuardEncryptor,
    engine,
    image: np.ndarray,
    message: str,
) -> dict:
    """Generic encrypt → embed → extract → decrypt round-trip."""
    enc = encryptor.encrypt(message)
    stego_img = engine.embed(image.copy(), enc)
    met = calculate_metrics(image, stego_img)
    extracted = engine.extract(stego_img)
    decrypted = encryptor.decrypt(extracted)
    ok = decrypted == message
    return {
        "stego_image": stego_img,
        "encrypted_len": len(enc),
        "metrics": met,
        "success": ok,
        "decrypted": decrypted,
    }


def lsb_round_trip(encryptor: MediGuardEncryptor, stego: LSBStego, image: np.ndarray, message: str) -> dict:
    """
    Full LSB path: encrypt → embed → extract → decrypt.
    Returns metrics and success flag.
    """
    enc = encryptor.encrypt(message)
    stego_img = stego.embed(image.copy(), enc)
    met = calculate_metrics(image, stego_img)
    extracted = stego.extract(stego_img)
    decrypted = encryptor.decrypt(extracted)
    ok = decrypted == message
    return {
        "stego_image": stego_img,
        "encrypted_len": len(enc),
        "metrics": met,
        "success": ok,
        "decrypted": decrypted,
    }


def _synthetic_rgb_array(index: int, image_size: int = 224) -> np.ndarray:
    """Deterministic fake X-ray-like image for offline testing without MedMNIST download."""
    rng = np.random.default_rng(seed=index + 42)
    base = rng.integers(40, 180, size=(image_size, image_size), dtype=np.uint8)
    if base.ndim == 2:
        base = np.stack([base] * 3, axis=-1)
    return base


def _evaluate_hybrid_row(
    encryptor: MediGuardEncryptor,
    engines: dict,
    *,
    split_name: str,
    index: int,
    img_lsb: np.ndarray,
    img_freq: np.ndarray,
    message: str,
) -> dict:
    row = {"split": split_name, "index": index, "msg_len": len(message)}
    for method, image in (("LSB", img_lsb), ("DCT", img_freq), ("FFT", img_freq)):
        try:
            result = stego_round_trip(encryptor, engines[method], image, message)
            met = result["metrics"]
            row[f"{method}_psnr"] = met["psnr"]
            row[f"{method}_mse"] = met["mse"]
            row[f"{method}_ssim"] = met["ssim"]
            row[f"{method}_success"] = result["success"]
        except Exception as exc:
            print(f"    [{split_name} #{index} {method}] failed: {exc}")
            row[f"{method}_psnr"] = None
            row[f"{method}_mse"] = None
            row[f"{method}_ssim"] = None
            row[f"{method}_success"] = False
    return row


def evaluate_hybrid_synthetic(
    encryptor: MediGuardEncryptor,
    engines: dict,
    *,
    n: int = 10,
    split_name: str = "synthetic",
) -> list[dict]:
    """Hybrid eval on synthetic images (no ChestMNIST download)."""
    rows = []
    print(f"\n  Evaluating {split_name} ({n} synthetic images, LSB+DCT+FFT) ...")
    lsb_size = DEFAULT_CONFIG["image_size"]
    freq_size = DEFAULT_CONFIG["freq_image_size"]

    for idx in range(n):
        img_lsb = _synthetic_rgb_array(idx, lsb_size)
        img_freq = _synthetic_rgb_array(idx + 1000, freq_size)
        meta = {
            "patient_id": f"P{idx:05d}",
            "age": 40 + (idx % 30),
            "gender": "M" if idx % 2 else "F",
            "view_position": "PA",
            "diagnoses_source": "synthetic_test",
            "diagnoses": "No Finding",
        }
        message = structure_for_embedding(meta)
        rows.append(
            _evaluate_hybrid_row(
                encryptor,
                engines,
                split_name=split_name,
                index=idx,
                img_lsb=img_lsb,
                img_freq=img_freq,
                message=message,
            )
        )
    print(f"    {n}/{n} done")
    return rows


def evaluate_hybrid_split(
    dataset,
    split_name: str,
    encryptor: MediGuardEncryptor,
    engines: dict,
    *,
    n: int = 20,
) -> list[dict]:
    """Run LSB + DCT + FFT on n images from one ChestMNIST split."""
    rows = []
    n = min(n, len(dataset))
    lsb_size = DEFAULT_CONFIG["image_size"]
    freq_size = DEFAULT_CONFIG["freq_image_size"]
    print(f"\n  Evaluating {split_name} ({n} images, LSB+DCT+FFT) ...")

    for idx in range(n):
        pil_img, _ = dataset[idx]
        img_lsb = pil_to_rgb_array(pil_img, lsb_size)
        img_freq = pil_to_rgb_array(pil_img, freq_size)
        meta = get_patient_metadata(idx, dataset=dataset, use_ai=False)
        message = structure_for_embedding(meta)
        rows.append(
            _evaluate_hybrid_row(
                encryptor,
                engines,
                split_name=split_name,
                index=idx,
                img_lsb=img_lsb,
                img_freq=img_freq,
                message=message,
            )
        )
        if (idx + 1) % 5 == 0:
            print(f"    {idx + 1}/{n} done")
    return rows


def build_hybrid_summary(df: pd.DataFrame, config: dict) -> dict:
    """Build JSON summary for LSB + DCT + FFT results."""
    summary_methods = {}
    for method in ("LSB", "DCT", "FFT"):
        psnr = df[f"{method}_psnr"].mean(skipna=True)
        mse = df[f"{method}_mse"].mean(skipna=True)
        ssim = df[f"{method}_ssim"].mean(skipna=True)
        acc = df[f"{method}_success"].mean(skipna=True)
        summary_methods[method.lower()] = {
            "avg_psnr": round(float(psnr), 4) if pd.notna(psnr) else None,
            "avg_mse": round(float(mse), 6) if pd.notna(mse) else None,
            "avg_ssim": round(float(ssim), 6) if pd.notna(ssim) else None,
            "extraction_accuracy": round(float(acc), 4) if pd.notna(acc) else None,
        }

    splits = {}
    for split in ("train", "val", "test"):
        sub = df[df["split"] == split]
        if len(sub):
            splits[split] = {
                "count": int(len(sub)),
                "lsb_psnr": round(float(sub["LSB_psnr"].mean()), 4),
                "dct_psnr": round(float(sub["DCT_psnr"].mean()), 4),
                "fft_psnr": round(float(sub["FFT_psnr"].mean()), 4),
                "lsb_accuracy": round(float(sub["LSB_success"].mean()), 4),
                "dct_accuracy": round(float(sub["DCT_success"].mean()), 4),
                "fft_accuracy": round(float(sub["FFT_success"].mean()), 4),
            }

    return {
        "timestamp": datetime.now().isoformat(),
        "pipeline": "hybrid-LSB-DCT-FFT",
        "status": "working",
        "total_images": int(len(df)),
        "config": {k: str(v) for k, v in config.items()},
        **summary_methods,
        "splits": splits,
        "note": "Measured round-trip accuracy for LSB (224px), DCT and block-DFT/FFT (512px).",
    }


def export_hybrid_frontend_metrics(summary: dict, frontend_path: Path) -> None:
    """Write hybrid metrics JSON for the React dashboard."""
    payload = {
        "generatedFrom": "SpectraVault hybrid pipeline (run_hybrid_pipeline.py)",
        "note": summary.get("note", ""),
        "lsb": summary.get("lsb"),
        "dct": summary.get("dct"),
        "fft": summary.get("fft"),
        "splits": summary.get("splits", {}),
    }
    frontend_path.parent.mkdir(parents=True, exist_ok=True)
    with open(frontend_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"  Frontend metrics -> {frontend_path}")


def print_hybrid_summary(df: pd.DataFrame) -> None:
    """Print human-readable hybrid evaluation summary."""
    print("\n" + "=" * 60)
    print("HYBRID SUMMARY - LSB / DCT / FFT")
    print("=" * 60)
    for method in ("LSB", "DCT", "FFT"):
        psnr = df[f"{method}_psnr"].mean()
        ssim = df[f"{method}_ssim"].mean()
        acc = df[f"{method}_success"].mean() * 100
        psnr_str = f"{psnr:.2f} dB" if pd.notna(psnr) else "N/A"
        ssim_str = f"{ssim:.6f}" if pd.notna(ssim) else "N/A"
        print(f"  {method:<4} | PSNR: {psnr_str} | SSIM: {ssim_str} | Accuracy: {acc:.1f}%")


def run_hybrid_pipeline(
    password: str,
    *,
    eval_n: int | None = None,
    config: dict | None = None,
    root: Path | None = None,
    export_frontend: bool = True,
    use_synthetic: bool = False,
) -> pd.DataFrame:
    """Evaluate LSB, DCT, and FFT on ChestMNIST (or synthetic) images."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if eval_n is not None:
        cfg["eval_n_images"] = eval_n

    dirs = get_output_dirs(root)
    root = root or get_project_root()
    print(f"Output directory: {dirs['output']}")

    encryptor = MediGuardEncryptor(password)
    engines = {
        "LSB": make_stego_engine("LSB", cfg),
        "DCT": make_stego_engine("DCT", cfg),
        "FFT": make_stego_engine("FFT", cfg),
    }

    test_msg = "PID:P00000|AGE:40|GEN:M|VIEW:PA|SRC:test|DX:No Finding"
    for method in ("LSB", "DCT", "FFT"):
        size = image_size_for_method(method, cfg)
        dummy = np.random.default_rng(0).integers(40, 200, (size, size, 3), dtype=np.uint8)
        if not stego_round_trip(encryptor, engines[method], dummy, test_msg)["success"]:
            raise RuntimeError(f"{method} self-test failed before evaluation")
        print(f"{method} self-test passed.")

    all_rows: list[dict] = []
    if use_synthetic:
        print("Using synthetic images (no ChestMNIST download).")
        for split in ("train", "val", "test"):
            all_rows.extend(
                evaluate_hybrid_synthetic(
                    encryptor,
                    engines,
                    n=cfg["eval_n_images"],
                    split_name=split,
                )
            )
    else:
        from medmnist import ChestMNIST

        print("Loading ChestMNIST ...")
        lsb_size = cfg["image_size"]
        for split in ("train", "val", "test"):
            ds = ChestMNIST(split=split, download=True, size=lsb_size)
            all_rows.extend(
                evaluate_hybrid_split(
                    ds,
                    split,
                    encryptor,
                    engines,
                    n=cfg["eval_n_images"],
                )
            )

    df = pd.DataFrame(all_rows)
    print_hybrid_summary(df)

    csv_path = dirs["metrics"] / "evaluation_results.csv"
    df.to_csv(csv_path, index=False)
    print(f"\n  Metrics CSV     -> {csv_path}")

    summary = build_hybrid_summary(df, cfg)
    json_path = dirs["metrics"] / "summary.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  Summary JSON    -> {json_path}")

    if export_frontend:
        export_hybrid_frontend_metrics(summary, root / "frontend" / "public" / "data" / "metrics.json")

    print(f"\nAll hybrid artifacts saved under: {dirs['output']}")
    return df


def evaluate_lsb_synthetic(
    encryptor: MediGuardEncryptor,
    stego: LSBStego,
    *,
    n: int = 10,
    image_size: int = 224,
    split_name: str = "synthetic",
) -> list[dict]:
    """Run LSB pipeline on synthetic images (no dataset download)."""
    rows = []
    print(f"\n  Evaluating {split_name} ({n} synthetic images) ...")

    for idx in range(n):
        img_arr = _synthetic_rgb_array(idx, image_size)
        meta = {
            "patient_id": f"P{idx:05d}",
            "age": 40 + (idx % 30),
            "gender": "M" if idx % 2 else "F",
            "view_position": "PA",
            "diagnoses_source": "synthetic_test",
            "diagnoses": "No Finding",
        }
        message = structure_for_embedding(meta)

        try:
            result = lsb_round_trip(encryptor, stego, img_arr, message)
            met = result["metrics"]
            ok = result["success"]
        except Exception as exc:
            print(f"    [{split_name} #{idx}] failed: {exc}")
            met = {"psnr": None, "mse": None, "ssim": None}
            ok = False

        rows.append(
            {
                "split": split_name,
                "index": idx,
                "msg_len": len(message),
                "LSB_psnr": met["psnr"],
                "LSB_mse": met["mse"],
                "LSB_ssim": met["ssim"],
                "LSB_success": ok,
            }
        )

    print(f"    {n}/{n} done")
    return rows


def evaluate_lsb_split(
    dataset,
    split_name: str,
    encryptor: MediGuardEncryptor,
    stego: LSBStego,
    *,
    n: int = 20,
    image_size: int = 224,
) -> list[dict]:
    """Run LSB pipeline on n images from one dataset split."""
    rows = []
    n = min(n, len(dataset))
    print(f"\n  Evaluating {split_name} ({n} images) ...")

    for idx in range(n):
        pil_img, _ = dataset[idx]
        img_arr = pil_to_rgb_array(pil_img, image_size)
        meta = get_patient_metadata(idx, dataset=dataset, use_ai=False)
        message = structure_for_embedding(meta)

        try:
            result = lsb_round_trip(encryptor, stego, img_arr, message)
            met = result["metrics"]
            ok = result["success"]
        except Exception as exc:
            print(f"    [{split_name} #{idx}] failed: {exc}")
            met = {"psnr": None, "mse": None, "ssim": None}
            ok = False

        rows.append(
            {
                "split": split_name,
                "index": idx,
                "msg_len": len(message),
                "LSB_psnr": met["psnr"],
                "LSB_mse": met["mse"],
                "LSB_ssim": met["ssim"],
                "LSB_success": ok,
            }
        )
        if (idx + 1) % 5 == 0:
            print(f"    {idx + 1}/{n} done")

    return rows


def build_lsb_summary(df: pd.DataFrame, config: dict) -> dict:
    """Build valid JSON summary (no NaN) for LSB results."""
    psnr_mean = df["LSB_psnr"].mean(skipna=True)
    mse_mean = df["LSB_mse"].mean(skipna=True)
    ssim_mean = df["LSB_ssim"].mean(skipna=True)
    acc_mean = df["LSB_success"].mean(skipna=True)

    splits = {}
    for split in ("train", "val", "test"):
        sub = df[df["split"] == split]
        if len(sub):
            splits[split] = {
                "count": int(len(sub)),
                "lsb_psnr": round(float(sub["LSB_psnr"].mean()), 4),
                "lsb_ssim": round(float(sub["LSB_ssim"].mean()), 6),
                "extraction_accuracy": round(float(sub["LSB_success"].mean()), 4),
            }

    return {
        "timestamp": datetime.now().isoformat(),
        "pipeline": "LSB-only",
        "status": "working",
        "total_images": int(len(df)),
        "config": {k: str(v) for k, v in config.items()},
        "lsb": {
            "avg_psnr": round(float(psnr_mean), 4) if pd.notna(psnr_mean) else None,
            "avg_mse": round(float(mse_mean), 6) if pd.notna(mse_mean) else None,
            "avg_ssim": round(float(ssim_mean), 6) if pd.notna(ssim_mean) else None,
            "extraction_accuracy": round(float(acc_mean), 4) if pd.notna(acc_mean) else None,
        },
        "splits": splits,
        "note": "DCT and FFT are not included — LSB is the only working steganography method.",
    }


def export_frontend_metrics(summary: dict, frontend_path: Path) -> None:
    """Write metrics JSON consumed by the React dashboard."""
    lsb = summary.get("lsb", {})
    splits = summary.get("splits", {})
    payload = {
        "generatedFrom": "SpectraVault LSB pipeline (model.ipynb / run_lsb_pipeline.py)",
        "note": summary.get("note", ""),
        "lsb": lsb,
        "dct": None,
        "fft": None,
        "splits": {
            name: {"lsb_psnr": data.get("lsb_psnr")}
            for name, data in splits.items()
        },
    }
    frontend_path.parent.mkdir(parents=True, exist_ok=True)
    with open(frontend_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"  Frontend metrics -> {frontend_path}")


def save_lsb_stego_samples(
    datasets: dict,
    encryptor: MediGuardEncryptor,
    stego: LSBStego,
    stego_dir: Path,
    *,
    image_size: int = 224,
) -> None:
    """Save one LSB stego PNG per split (train/val/test)."""
    for split_name, dataset in datasets.items():
        pil_img, _ = dataset[0]
        img_arr = pil_to_rgb_array(pil_img, image_size)
        meta = get_patient_metadata(0, dataset=dataset, use_ai=False)
        message = structure_for_embedding(meta)
        result = lsb_round_trip(encryptor, stego, img_arr, message)
        out_path = stego_dir / f"stego_LSB_{split_name}.png"
        Image.fromarray(result["stego_image"]).save(out_path)
        print(f"  Stego PNG       -> {out_path}  (PSNR {result['metrics']['psnr']} dB, ok={result['success']})")


def print_lsb_summary(df: pd.DataFrame) -> None:
    """Print human-readable LSB evaluation summary."""
    print("\n" + "=" * 60)
    print("LSB SUMMARY - embed -> extract -> decrypt")
    print("=" * 60)
    for split in ("train", "val", "test"):
        sub = df[df["split"] == split]
        if sub.empty:
            continue
        psnr = sub["LSB_psnr"].mean()
        ssim = sub["LSB_ssim"].mean()
        acc = sub["LSB_success"].mean() * 100
        psnr_str = f"{psnr:.2f} dB" if pd.notna(psnr) else "N/A"
        ssim_str = f"{ssim:.6f}" if pd.notna(ssim) else "N/A"
        print(f"  {split:<6} | PSNR: {psnr_str} | SSIM: {ssim_str} | Accuracy: {acc:.1f}%")
    overall_acc = df["LSB_success"].mean() * 100
    print(f"\n  Overall extraction accuracy: {overall_acc:.1f}%")


def run_lsb_pipeline(
    password: str,
    *,
    eval_n: int | None = None,
    config: dict | None = None,
    root: Path | None = None,
    export_frontend: bool = True,
    use_synthetic: bool = False,
) -> pd.DataFrame:
    """
    Run the full LSB pipeline: evaluate, save CSV/JSON/stego images,
    optionally sync frontend metrics.
    """
    from medmnist import ChestMNIST

    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if eval_n is not None:
        cfg["eval_n_images"] = eval_n

    dirs = get_output_dirs(root)
    root = root or get_project_root()

    print(f"Output directory: {dirs['output']}")

    encryptor = MediGuardEncryptor(password)
    stego = LSBStego(bits=cfg["lsb_bits"])
    image_size = cfg["image_size"]

    # Quick sanity check before evaluation
    dummy = np.zeros((image_size, image_size, 3), dtype=np.uint8)
    test_msg = "PID:P00000|AGE:40|GEN:M|VIEW:PA|SRC:test|DX:No Finding"
    if not lsb_round_trip(encryptor, stego, dummy, test_msg)["success"]:
        raise RuntimeError("LSB self-test failed before evaluation")

    print("LSB self-test passed.")

    all_rows: list[dict] = []

    if use_synthetic:
        print("Using synthetic images (no ChestMNIST download).")
        for split in ("train", "val", "test"):
            all_rows.extend(
                evaluate_lsb_synthetic(
                    encryptor,
                    stego,
                    n=cfg["eval_n_images"],
                    image_size=image_size,
                    split_name=split,
                )
            )
        train_ds = val_ds = test_ds = None
    else:
        from medmnist import ChestMNIST

        print("Loading ChestMNIST ...")
        train_ds = ChestMNIST(split="train", download=True, size=image_size)
        val_ds = ChestMNIST(split="val", download=True, size=image_size)
        test_ds = ChestMNIST(split="test", download=True, size=image_size)

        for ds, name in [(train_ds, "train"), (val_ds, "val"), (test_ds, "test")]:
            all_rows.extend(
                evaluate_lsb_split(
                    ds,
                    name,
                    encryptor,
                    stego,
                    n=cfg["eval_n_images"],
                    image_size=image_size,
                )
            )

    df = pd.DataFrame(all_rows)
    print_lsb_summary(df)

    # Save artifacts
    csv_path = dirs["metrics"] / "evaluation_results.csv"
    df.to_csv(csv_path, index=False)
    print(f"\n  Metrics CSV     -> {csv_path}")

    summary = build_lsb_summary(df, cfg)
    json_path = dirs["metrics"] / "summary.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  Summary JSON    -> {json_path}")

    lsb_report = dirs["lsb"] / "round_trip_report.json"
    with open(lsb_report, "w", encoding="utf-8") as f:
        json.dump(
            {
                "pipeline": "encrypt -> LSB embed -> LSB extract -> decrypt",
                "timestamp": summary["timestamp"],
                "overall_accuracy": summary["lsb"]["extraction_accuracy"],
                "samples_per_split": cfg["eval_n_images"],
            },
            f,
            indent=2,
        )
    print(f"  LSB report      -> {lsb_report}")

    if use_synthetic:
        for split in ("train", "val", "test"):
            img_arr = _synthetic_rgb_array(0, image_size)
            meta = {
                "patient_id": "P00000",
                "age": 40,
                "gender": "M",
                "view_position": "PA",
                "diagnoses_source": "synthetic_test",
                "diagnoses": "No Finding",
            }
            message = structure_for_embedding(meta)
            result = lsb_round_trip(encryptor, stego, img_arr, message)
            out_path = dirs["stego"] / f"stego_LSB_{split}.png"
            Image.fromarray(result["stego_image"]).save(out_path)
            print(f"  Stego PNG       -> {out_path}  (PSNR {result['metrics']['psnr']} dB, ok={result['success']})")
    else:
        save_lsb_stego_samples(
            {"train": train_ds, "val": val_ds, "test": test_ds},
            encryptor,
            stego,
            dirs["stego"],
            image_size=image_size,
        )

    if export_frontend:
        export_frontend_metrics(summary, root / "frontend" / "public" / "data" / "metrics.json")

    print(f"\nAll LSB artifacts saved under: {dirs['output']}")
    return df
