"""
PREDICTA — Authoritative Latent Trajectory Unit & Regression Test Suite (Python)
File: tests/test_latent_trajectory.py

Tests:
- TEST 1: PASS at 24h and FAIL at 168h -> latent_168h_failure = True
- TEST 2: FAIL at 24h and FAIL at 168h -> latent_168h_failure = False (not latent)
- TEST 3: PASS at 24h and PASS at 168h -> latent_168h_failure = False (healthy)
- TEST 4: Missing 24h or 168h history -> INSUFFICIENT_HISTORY, latent_168h_failure = None
- TEST 5: 168h-only information must not appear in early prediction features (temporal leakage prevention)
- TEST 6: Train/test splitting must not leak the same component across splits
- TEST 7: Lot-held-out split behavior verification
- TEST 8: Metric calculation must correctly handle zero-positive edge cases without NaN
"""

import os
import sys
import math
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.evaluation.latent_trajectory import (
    TrajectoryState,
    evaluate_component_state,
    assert_no_temporal_leakage,
    build_trajectory_dataset,
    split_trajectories_by_lot,
    calculate_latent_screening_metrics,
    evaluate_production_model_compatibility
)


def test_01_pass_24h_fail_168h_is_true_latent_failure():
    """TEST 1: Component acceptable at 24h and failing by 168h must produce latent_168h_failure = True."""
    # Nominal reading at 24h
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0}
    # Degraded reading at 168h exceeding tpd limit (250.0)
    tel_168h = {"iddq": 2200.0, "ileak": 280.0, "tpd": 265.0}

    res = evaluate_component_state(tel_24h, tel_168h)
    assert res["state_24h"] == "PASS"
    assert res["state_168h"] == "FAIL"
    assert res["latent_168h_failure"] is True
    assert res["trajectory_state"] == TrajectoryState.PASS_24H_FAIL_168H.value


def test_02_fail_24h_fail_168h_is_not_latent_failure():
    """TEST 2: Early failure visible at 24h must NOT be counted as a latent failure."""
    # Already exceeding limit at 24h
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 260.0}
    # Remains failed at 168h
    tel_168h = {"iddq": 2200.0, "ileak": 280.0, "tpd": 290.0}

    res = evaluate_component_state(tel_24h, tel_168h)
    assert res["state_24h"] == "FAIL"
    assert res["state_168h"] == "FAIL"
    assert res["latent_168h_failure"] is False
    assert res["trajectory_state"] == TrajectoryState.FAIL_24H_FAIL_168H.value


def test_03_pass_24h_pass_168h_is_healthy():
    """TEST 3: Component passing at 24h and passing at 168h is healthy (latent_168h_failure = False)."""
    tel_24h = {"iddq": 2100.0, "ileak": 280.0, "tpd": 192.0}
    tel_168h = {"iddq": 2150.0, "ileak": 290.0, "tpd": 195.0}

    res = evaluate_component_state(tel_24h, tel_168h)
    assert res["state_24h"] == "PASS"
    assert res["state_168h"] == "PASS"
    assert res["latent_168h_failure"] is False
    assert res["trajectory_state"] == TrajectoryState.PASS_24H_PASS_168H.value


def test_04_missing_history_produces_explicit_insufficient_history():
    """TEST 4: Missing 24h or 168h history must produce explicit INSUFFICIENT_HISTORY, not fabricated label."""
    # Case A: Missing 168h
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0}
    res_a = evaluate_component_state(tel_24h, None)
    assert res_a["latent_168h_failure"] is None
    assert res_a["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value

    # Case B: Missing 24h
    tel_168h = {"iddq": 2200.0, "ileak": 280.0, "tpd": 265.0}
    res_b = evaluate_component_state(None, tel_168h)
    assert res_b["latent_168h_failure"] is None
    assert res_b["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value

    # Case C: Non-finite values
    tel_nan = {"iddq": np.nan, "ileak": 250.0, "tpd": 190.0}
    res_c = evaluate_component_state(tel_nan, tel_168h)
    assert res_c["latent_168h_failure"] is None
    assert res_c["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value


def test_05_no_temporal_leakage_in_early_features():
    """TEST 5: Verify that early prediction features contain zero 168h or future telemetry."""
    safe_features = [
        "iddq_0h", "ileak_0h", "tpd_0h",
        "iddq_24h", "ileak_24h", "tpd_24h",
        "iddq_drift_24h", "ileak_drift_24h", "tpd_drift_24h"
    ]
    assert assert_no_temporal_leakage(safe_features) is True

    leaky_features = safe_features + ["tpd_168h"]
    with pytest.raises(ValueError, match="TEMPORAL LEAKAGE DETECTED"):
        assert_no_temporal_leakage(leaky_features)


def test_06_trajectory_dataset_construction_and_no_component_leakage():
    """TEST 6: Dataset builder creates correct trajectory rows with no cross-split leakage."""
    test_csv = os.path.join(os.path.dirname(__file__), "../data/synthetic/semiconductor_synthetic_full.csv")
    if not os.path.exists(test_csv):
        pytest.skip("Dataset file not available")

    # Build dataset from first 200 rows of full synthetic
    df_raw = pd.read_csv(test_csv, nrows=800) # 200 components x 4 rows
    traj_df = build_trajectory_dataset(df_raw)

    assert "latent_168h_failure" in traj_df.columns
    assert "trajectory_state" in traj_df.columns
    assert "tpd_168h_ground_truth" in traj_df.columns
    # Ensure early feature columns don't leak 168h
    early_cols = [c for c in traj_df.columns if not c.endswith("ground_truth") and c not in ["state_168h", "latent_168h_failure", "trajectory_state", "evaluation_reason", "has_complete_history"]]
    assert_no_temporal_leakage(early_cols)


def test_07_lot_held_out_splitting():
    """TEST 7: Lot-held-out splits have zero component and zero lot overlap across partitions."""
    test_csv = os.path.join(os.path.dirname(__file__), "../data/synthetic/semiconductor_synthetic_full.csv")
    if not os.path.exists(test_csv):
        pytest.skip("Dataset file not available")

    df_raw = pd.read_csv(test_csv)
    traj_df = build_trajectory_dataset(df_raw)

    train_df, val_df, test_df = split_trajectories_by_lot(traj_df)

    # Check non-empty
    assert len(train_df) > 0
    assert len(val_df) > 0
    assert len(test_df) > 0

    # Check zero overlap in components
    train_comps = set(train_df["component_id"])
    val_comps = set(val_df["component_id"])
    test_comps = set(test_df["component_id"])

    assert len(train_comps.intersection(val_comps)) == 0
    assert len(train_comps.intersection(test_comps)) == 0
    assert len(val_comps.intersection(test_comps)) == 0

    # Check zero overlap in lots
    train_lots = set(train_df["lot_id"].dropna())
    val_lots = set(val_df["lot_id"].dropna())
    test_lots = set(test_df["lot_id"].dropna())

    assert len(train_lots.intersection(val_lots)) == 0
    assert len(train_lots.intersection(test_lots)) == 0
    assert len(val_lots.intersection(test_lots)) == 0


def test_08_metric_calculation_and_zero_division_safety():
    """TEST 8: Metric calculation handles standard, zero-positive, and zero-prediction cases without NaN."""
    # Standard Case
    y_true = np.array([0, 1, 0, 1, 0, 1, 0, 0])
    y_scores = np.array([0.1, 0.9, 0.2, 0.8, 0.3, 0.4, 0.1, 0.2])
    metrics = calculate_latent_screening_metrics(y_true, y_scores, threshold=0.5)

    assert 0.0 <= metrics["latent_recall"] <= 1.0
    assert 0.0 <= metrics["latent_fnr"] <= 1.0
    assert 0.0 <= metrics["latent_precision"] <= 1.0
    assert 0.0 <= metrics["latent_f1"] <= 1.0
    assert 0.0 <= metrics["latent_f2"] <= 1.0
    assert 0.0 <= metrics["pr_auc"] <= 1.0
    assert 0.0 <= metrics["roc_auc"] <= 1.0
    assert not math.isnan(metrics["latent_recall"])
    assert not math.isnan(metrics["latent_f2"])

    # Zero positive case (no latent defects)
    y_zeros = np.zeros(10, dtype=int)
    y_scores_zeros = np.linspace(0.1, 0.9, 10)
    m_zero = calculate_latent_screening_metrics(y_zeros, y_scores_zeros, threshold=0.5)
    assert m_zero["latent_recall"] == 0.0
    assert m_zero["latent_fnr"] == 0.0
    assert m_zero["latent_precision"] == 0.0
    assert not math.isnan(m_zero["latent_f1"])
    assert not math.isnan(m_zero["latent_f2"])


def test_09_production_model_compatibility_honest_assessment():
    """TEST 9: Current production model compatibility assessment is truthful and machine-readable."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    model_path = os.path.join(base_dir, "ml", "models", "production", "predicta_xgboost_model.json")
    meta_path = os.path.join(base_dir, "ml", "models", "production", "predicta_xgboost_metadata.json")

    assessment = evaluate_production_model_compatibility(model_path, meta_path)
    assert assessment["compatibility_status"] == "INCOMPATIBLE_TRAINING_SCHEMA"
    assert assessment["can_evaluate_latent_168h"] is False
    assert assessment["requires_retraining_relabeling"] is True
    assert "single-snapshot" in assessment["limitation_reason"].lower() or "single-station" in assessment["limitation_reason"].lower()
