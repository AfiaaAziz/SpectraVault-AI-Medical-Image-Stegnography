"""Patient metadata helpers for embedding payloads."""

import json

import numpy as np

DISEASES = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Effusion",
    "Emphysema",
    "Fibrosis",
    "Hernia",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pleural_Thickening",
    "Pneumonia",
    "Pneumothorax",
]

DISEASE_EPI = {
    "Emphysema": {"age_μ": 62, "age_σ": 8, "male_p": 0.65},
    "Fibrosis": {"age_μ": 58, "age_σ": 10, "male_p": 0.55},
    "Cardiomegaly": {"age_μ": 60, "age_σ": 12, "male_p": 0.50},
    "Effusion": {"age_μ": 55, "age_σ": 14, "male_p": 0.52},
    "Pneumonia": {"age_μ": 45, "age_σ": 20, "male_p": 0.52},
    "Pneumothorax": {"age_μ": 35, "age_σ": 15, "male_p": 0.70},
    "Mass": {"age_μ": 57, "age_σ": 12, "male_p": 0.55},
    "Nodule": {"age_μ": 54, "age_σ": 12, "male_p": 0.53},
    "Atelectasis": {"age_μ": 50, "age_σ": 16, "male_p": 0.50},
    "Consolidation": {"age_μ": 48, "age_σ": 18, "male_p": 0.51},
    "Edema": {"age_μ": 58, "age_σ": 13, "male_p": 0.50},
    "Infiltration": {"age_μ": 47, "age_σ": 17, "male_p": 0.51},
    "Hernia": {"age_μ": 55, "age_σ": 12, "male_p": 0.65},
    "Pleural_Thickening": {"age_μ": 52, "age_σ": 14, "male_p": 0.55},
}


def structure_for_embedding(meta: dict) -> str:
    """Compact pipe-delimited string written into the stego image."""
    return (
        f"PID:{meta['patient_id']}|"
        f"AGE:{meta['age']}|"
        f"GEN:{meta['gender']}|"
        f"VIEW:{meta['view_position']}|"
        f"SRC:{meta['diagnoses_source']}|"
        f"DX:{meta['diagnoses']}"
    )


def get_patient_metadata(index, dataset, use_ai: bool = False, ai_predict_fn=None):
    """Build metadata dict for one ChestMNIST image."""
    rng = np.random.default_rng(seed=index + 2026)
    pil_img, label = dataset[index]

    real_diseases = [DISEASES[i] for i, v in enumerate(label) if v == 1]
    ai_detected, ai_conf = {}, {}

    if use_ai and ai_predict_fn is not None:
        ai_detected, ai_conf = ai_predict_fn(pil_img)

    if ai_detected:
        final_diagnoses = list(ai_detected.keys())
        dx_source = "DenseNet121_AI"
    elif real_diseases:
        final_diagnoses = real_diseases
        dx_source = "MedMNIST_labels"
    else:
        final_diagnoses = ["No Finding"]
        dx_source = "MedMNIST_labels"

    primary = final_diagnoses[0] if final_diagnoses[0] != "No Finding" else None
    epi = (
        DISEASE_EPI.get(primary, {"age_μ": 50, "age_σ": 15, "male_p": 0.5})
        if primary
        else {"age_μ": 50, "age_σ": 15, "male_p": 0.5}
    )
    age = int(np.clip(rng.normal(epi["age_μ"], epi["age_σ"]), 18, 90))
    gender = "M" if rng.random() < epi["male_p"] else "F"
    view = rng.choice(["PA", "AP"], p=[0.65, 0.35])

    return {
        "patient_id": f"P{index:05d}",
        "image_index": index,
        "diagnoses_source": dx_source,
        "diagnoses": "|".join(final_diagnoses),
        "ai_confidence": json.dumps({k: round(v, 3) for k, v in ai_conf.items() if v >= 0.15}),
        "demographics_source": "SIMULATED_epidemiology_based",
        "age": age,
        "gender": gender,
        "view_position": view,
    }


def pil_to_rgb_array(pil_img, size: int = 224) -> np.ndarray:
    """Resize PIL image to RGB uint8 numpy array."""
    arr = np.array(pil_img.resize((size, size)))
    if arr.ndim == 2:
        arr = np.stack([arr] * 3, axis=-1)
    return arr
