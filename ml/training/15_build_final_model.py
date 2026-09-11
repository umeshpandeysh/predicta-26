"""
Predicta Semiconductor Test Analytics Prototype — Build Final Production XGBoost Model
File: ml/training/15_build_final_model.py

Authoritative script to train and save the approved production XGBoost model artifact
trained on real 50,000 dataset records (ml/data/synthetic/predicta_dataset_v3_50000.csv).

Outputs:
  - ml/models/production/predicta_xgboost_model.json (Executable Model Artifact)
  - ml/models/production/predicta_xgboost_metadata.json (Metadata Artifact with SHA-256)
  - ml/models/production/predicta_production_manifest.json (Production Manifest Artifact)
"""

import os
import sys
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
TRAIN_JS_PATH = os.path.join(BASE_DIR, "ml", "training", "train_real_xgboost.js")

def build_and_save_final_production_model():
    print("=========================================================================")
    print("PREDICTA — DATASET-DRIVEN GBDT PRODUCTION MODEL TRAINER")
    print("=========================================================================\n")

    if os.path.exists(TRAIN_JS_PATH):
        print(f"[TRAIN] Invoking Fast Histogram GBDT trainer: {TRAIN_JS_PATH}")
        res = subprocess.run(["node", TRAIN_JS_PATH], cwd=BASE_DIR, capture_output=True, text=True)
        print(res.stdout)
        if res.stderr:
            print(res.stderr, file=sys.stderr)
        if res.returncode != 0:
            raise RuntimeError(f"Training failed with exit code {res.returncode}")
    else:
        raise FileNotFoundError(f"Training script missing: {TRAIN_JS_PATH}")

if __name__ == "__main__":
    build_and_save_final_production_model()
