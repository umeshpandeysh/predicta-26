"""
Predicta Semiconductor Test Analytics Prototype — Build Final Production XGBoost Model
File: ml/training/15_build_final_model.py

Authoritative script to train and save the approved production XGBoost model artifact
trained on synthetic 50,000 dataset records (ml/data/synthetic/predicta_dataset_v3_50000.csv).

Outputs:
  - ml/models/production/predicta_xgboost_model.json (Executable Model Artifact)
  - ml/models/production/predicta_xgboost_metadata.json (Metadata Artifact with SHA-256)
  - ml/models/production/predicta_production_manifest.json (Production Manifest Artifact)
"""

import os
import sys
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
TRAIN_PY_PATH = os.path.join(BASE_DIR, "ml", "training", "train_native_xgboost.py")

def build_and_save_final_production_model():
    print("=========================================================================")
    print("PREDICTA — NATIVE XGBOOST PRODUCTION MODEL TRAINER DELEGATE")
    print("=========================================================================\n")

    if os.path.exists(TRAIN_PY_PATH):
        py_exe = sys.executable or r"C:\Users\UMESH PANDEY\python311\python.exe"
        print(f"[TRAIN] Invoking Native XGBoost trainer: {TRAIN_PY_PATH} using {py_exe}")
        res = subprocess.run([py_exe, TRAIN_PY_PATH], cwd=BASE_DIR, capture_output=True, text=True)
        print(res.stdout)
        if res.stderr:
            print(res.stderr, file=sys.stderr)
        if res.returncode != 0:
            raise RuntimeError(f"Training failed with exit code {res.returncode}")
    else:
        raise FileNotFoundError(f"Training script missing: {TRAIN_PY_PATH}")

if __name__ == "__main__":
    build_and_save_final_production_model()
