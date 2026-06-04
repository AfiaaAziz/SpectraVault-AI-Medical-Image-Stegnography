# SpectraVault AI: Advanced Hybrid Medical Data Embedding

## Important — current project status

| Component | Status |
|-----------|--------|
| **`model.ipynb` (Python)** | Real pipeline — AES-256-GCM + LSB steganography **works** |
| **DCT / FFT (Python)** | **Working** — block-DCT and block-DFT/FFT via `spectravault/` |
| **`frontend/` (React)** | **LSB/DCT/FFT + DenseNet AI** when API is running |
| **AI analysis (frontend)** | **Real** via `POST /api/analyze` (DenseNet-121) |
| **Download on Embed page** | Real stego PNG from the API |

**Do not use for real patient data without a security review.** DCT/FFT are still broken in Python.

---

## Overview

SpectraVault AI is a Digital Image Processing (DIP) research project for hiding encrypted patient metadata inside chest X-rays. It combines:

- **Deep learning** — DenseNet-121 (NIH ChestX-ray14) on ChestMNIST for pathology labels
- **Encryption** — AES-256-GCM with PBKDF2 key derivation
- **Steganography** — LSB (working), DCT and FFT (in development, currently broken)

The React frontend calls a **FastAPI backend** for real LSB embed/extract. AI scoring on the Embed page is still mocked.

---

## What works today

### Python notebook (`model.ipynb`) and API

- ChestMNIST data loading and DenseNet-121 inference (notebook)
- Patient metadata string → AES-256-GCM encryption
- **LSB embed and blind extract** — ~72 dB PSNR, ~0.999993 SSIM, 100% extraction on evaluation set
- **FastAPI** (`api/main.py`) — same LSB + AES logic as the notebook for the website
- Evaluation artifacts saved to `mediguard_outputs/metrics/`

### Frontend (with API running)

- **Real LSB embed** — uploads image + password → stego PNG + PSNR/SSIM/MSE
- **Real LSB extract** — stego image + password → decrypted patient fields
- **Demo AI analysis** on Embed page (not connected to DenseNet yet)

### Not working yet

- **DCT steganography** — extraction fails (decryption error)
- **FFT steganography** — extraction fails
- **LSB robustness** under noise/JPEG/resize — fails in notebook tests (expected for LSB)
- **Frontend DenseNet inference** — still mocked

---

## Setup and Installation

### Python (real pipeline)

**Prerequisites:** Python 3.8+, PyTorch, Jupyter or Google Colab

1. Clone the repository:
   ```bash
   git clone https://github.com/AfiaaAziz/SpectraVault-AI.git
   cd SpectraVault-AI
   ```

2. Install dependencies (recommended: use the project venv):
   ```powershell
   py -m venv .venv
   .\.venv\Scripts\pip install -r requirements.txt
   ```

3. Run the notebook or CLI:
   Open `model.ipynb` in Jupyter (kernel: **SpectraVault (.venv)**) or Google Colab.

   **Or run the LSB pipeline from the terminal:**
   ```powershell
   .\.venv\Scripts\python.exe run_lsb_pipeline.py --eval-n 20
   ```

   **Hybrid evaluation (LSB + DCT + FFT):**
   ```powershell
   .\.venv\Scripts\python.exe run_hybrid_pipeline.py --eval-n 20
   .\.venv\Scripts\python.exe run_hybrid_pipeline.py --synthetic --eval-n 5
   ```
   Use `--synthetic` to test without downloading the 3.9 GB ChestMNIST dataset.
   Set `SPECTRAVAULT_PASSWORD=yourpass` to skip the password prompt.

   Outputs are written to `mediguard_outputs/` and `frontend/public/data/metrics.json`.

### API + frontend (real LSB in the browser)

**Terminal 1 — Python API:**
```powershell
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python.exe run_api.py
```
API docs: http://127.0.0.1:8000/docs

**Terminal 2 — React UI:**
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 — Embed and Extract call `/api/*` (proxied to port 8000).

Use the **same password** on embed and extract. Images are resized to 224×224 (same as the notebook pipeline).

### Sign up / login (Supabase)

Accounts are stored in **Supabase Auth** (Postgres `auth.users`), not a local JSON file.

1. Create a [Supabase](https://supabase.com) project.
2. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see comments in `.env.example`).
   ```powershell
   copy .env.example .env
   ```
3. For local dev, disable **Confirm email** under Authentication → Providers → Email.
4. Restart `run_api.py` and use `/signup` and `/login` in the app.

See [supabase/README.md](supabase/README.md) for details.

### Frontend only (metrics / UI without embed)

```powershell
cd frontend
npm install
npm run dev
```

Embed/Extract will fail until `run_api.py` is running. Metrics for LSB may load from `frontend/public/data/metrics.json`.

---

## Project structure

```
SpectraVault-AI/
├── model.ipynb              # Main pipeline (Python) — notebook workflow
├── run_lsb_pipeline.py      # CLI: LSB embed/extract/decrypt + save artifacts
├── run_api.py               # Start FastAPI backend for the website
├── api/main.py              # POST /api/embed, /api/extract, GET /api/health
├── spectravault/            # Reusable LSB pipeline modules (+ embed_service.py)
├── mediguard_outputs/       # Evaluation results, figures, stego samples
└── frontend/                # React UI — LSB wired to API when backend runs
    ├── src/api/             # fetch helpers for embed/extract
    ├── src/pages/           # Embed, Extract, Metrics
    └── public/data/         # LSB metrics JSON from notebook runs
```

---

## Core features (target design)

- **AI metadata extraction** — DenseNet-121 pathology scoring from X-rays
- **AES-256-GCM** — authenticated encryption before embedding
- **Hybrid steganography** — LSB (spatial), DCT and FFT (frequency domain, planned)
- **Quality metrics** — PSNR, MSE, SSIM

---

## Performance (measured — LSB only)

From the latest evaluation batch (`mediguard_outputs/metrics/summary.json`):

- **PSNR:** ~72 dB
- **SSIM:** ~0.999993
- **Extraction accuracy:** 100% (LSB, clean images)

DCT and FFT show 0% extraction accuracy until those extractors are fixed.

---

## Future scope

- Wire DenseNet AI inference into the API (Embed page still mocks AI)
- Fix DCT and FFT round-trip extraction
- Pin dependencies (`requirements.txt`)
- Automated tests and CI
- GAN-based cover generation, 3D volumes, audit logging (research directions)
