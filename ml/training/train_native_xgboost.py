"""
Predicta Semiconductor Test Analytics Prototype — Authoritative Native XGBoost Trainer
File: ml/training/train_native_xgboost.py

Authoritative native XGBoost training pipeline delegating to the certified,
leakage-free, group-aware multi-task training system (ml/training/train_authoritative.py).
"""

import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.training.train_authoritative import train_authoritative_models


def train_and_save_native_xgboost():
    """Authoritative production training entrypoint."""
    return train_authoritative_models()


if __name__ == "__main__":
    train_and_save_native_xgboost()
