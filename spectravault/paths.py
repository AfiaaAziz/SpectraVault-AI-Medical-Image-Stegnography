"""Resolve output directories for Colab and local runs."""

from pathlib import Path


def get_project_root() -> Path:
    """Project root (folder containing model.ipynb)."""
    return Path(__file__).resolve().parent.parent


def get_output_dirs(root: Path | None = None) -> dict[str, Path]:
    """
    Return output directory paths. Uses mediguard_outputs/ under project root
    locally, or /content/mediguard_outputs on Google Colab.
    """
    if root is None:
        root = get_project_root()

    colab_dir = Path("/content/mediguard_outputs")
    if colab_dir.parent.exists() and str(colab_dir).startswith("/content"):
        output_dir = colab_dir
    else:
        output_dir = root / "mediguard_outputs"

    dirs = {
        "output": output_dir,
        "stego": output_dir / "stego_images",
        "metrics": output_dir / "metrics",
        "models": output_dir / "models",
        "figures": output_dir / "figures",
        "lsb": output_dir / "lsb",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs
