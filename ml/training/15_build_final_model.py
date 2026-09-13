"""
Predicta Semiconductor Test Analytics Prototype — Build Final Production XGBoost Model
File: ml/training/15_build_final_model.py

Authoritative script to train and save the approved production XGBoost model artifact.
"""

import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.training.train_authoritative import train_authoritative_models


def build_and_save_final_production_model():
    print("=========================================================================")
    print("PREDICTA — NATIVE XGBOOST PRODUCTION MODEL TRAINER DELEGATE")
    print("=========================================================================\n")
    return train_authoritative_models()


if __name__ == "__main__":
    build_and_save_final_production_model()
