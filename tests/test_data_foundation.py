"""
Predicta Semiconductor Intelligence Platform — Data & Evaluation Foundation Test Suite
File: tests/test_data_foundation.py

Tests:
1. Dataset manifest integrity & actual SHA-256 matching
2. Rejection of corrupted/mismatched dataset hash
3. Feature contract validation & classification coverage
4. Strict rejection of future-data temporal leakage
5. Rejection of feature/target contamination
6. Split manifest lot disjointness & zero component leakage
7. Rejection of intentional component or lot leakage
8. Division-by-zero resilience in standardized metrics (zero positives, zero negatives)
9. Rejection of forbidden test-set threshold tuning
10. Deterministic reproducibility across repeated canonical evaluations
"""

import os
import sys
import json
import copy
import pytest
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.data.validator import (
    validate_dataset_hash,
    validate_dataset_schema,
    validate_missingness,
    validate_duplicate_records,
    validate_burnin_availability,
    validate_feature_target_separation,
    validate_temporal_leakage,
    validate_split_integrity,
    validate_authoritative_foundation,
    compute_sha256
)
from src.evaluation.metrics import (
    compute_binary_confusion_matrix,
    calculate_standardized_metrics,
    compute_pr_auc_trapz,
    compute_roc_auc_trapz
)
from src.evaluation.threshold_policy import (
    ThresholdPolicy,
    ThresholdSource,
    ForbiddenTestThresholdOptimizationError
)
from src.evaluation.run_evaluation import run_canonical_evaluation


def test_01_dataset_manifest_integrity():
    """Verify that dataset manifest exists and hashes match physical files."""
    manifest_path = os.path.join(BASE_DIR, "ml", "data", "dataset_manifest.json")
    assert os.path.exists(manifest_path), "ml/data/dataset_manifest.json is missing"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert "primary_latent_trajectory_dataset" in manifest
    primary = manifest["primary_latent_trajectory_dataset"]
    assert primary["is_synthetic"] is True
    assert primary["is_externally_validated"] is False
    assert "SYNTHETIC" in primary["data_mode"].upper()

    full_path = os.path.join(BASE_DIR, primary["dataset_path"])
    assert os.path.exists(full_path), f"Dataset file missing at {full_path}"

    res = validate_dataset_hash(full_path, primary["dataset_sha256"])
    assert res["passed"] is True, f"Hash verification failed: {res.get('error')}"


def test_02_dataset_hash_mismatch_rejection(tmp_path):
    """Verify that hash validation strictly rejects tampered/mismatched data."""
    fake_file = tmp_path / "fake_dataset.csv"
    fake_file.write_text("component_id,burn_in_hour,iddq\nC001,0,10.5\n")

    res = validate_dataset_hash(str(fake_file), "0000000000000000000000000000000000000000000000000000000000000000")
    assert res["passed"] is False
    assert "mismatch" in res["error"].lower()


def test_03_feature_contract_and_classification():
    """Verify feature contract schema and required classifications."""
    contract_path = os.path.join(BASE_DIR, "ml", "data", "feature_contract.json")
    assert os.path.exists(contract_path), "ml/data/feature_contract.json is missing"

    with open(contract_path, "r", encoding="utf-8") as f:
        contract = json.load(f)

    features = contract.get("features", {})
    assert "early_observable" in features
    assert "future_ground_truth" in features
    assert "identifiers" in features
    assert "metadata" in features
    assert "targets" in features

    early_names = [f["name"] for f in features["early_observable"]]
    assert "iddq_0h" in early_names
    assert "iddq_24h" in early_names
    assert "tpd_drift_24h" in early_names

    # Ensure no future tokens in early_observable
    for name in early_names:
        assert "168" not in name
        assert "ground_truth" not in name


def test_04_temporal_leakage_rejection():
    """Verify that temporal leakage validator catches future features."""
    valid_features = ["iddq_0h", "ileak_0h", "tpd_0h", "iddq_24h", "tpd_drift_24h"]
    assert validate_temporal_leakage(valid_features)["passed"] is True

    leaked_features = ["iddq_0h", "tpd_168h_ground_truth", "future_wearout"]
    leak_res = validate_temporal_leakage(leaked_features)
    assert leak_res["passed"] is False
    assert len(leak_res["violating_features"]) >= 1


def test_05_feature_target_contamination_rejection():
    """Verify that feature matrices containing target columns are strictly rejected."""
    clean_features = pd.DataFrame({
        "iddq_0h": [10.2, 11.1],
        "tpd_24h": [120.0, 130.0]
    })
    assert validate_feature_target_separation(clean_features)["passed"] is True

    contaminated_features = pd.DataFrame({
        "iddq_0h": [10.2, 11.1],
        "latent_168h_failure": [1, 0]
    })
    contam_res = validate_feature_target_separation(contaminated_features)
    assert contam_res["passed"] is False
    assert "latent_168h_failure" in contam_res["contaminated_columns"]


def test_06_split_manifest_disjointness():
    """Verify that authoritative split manifest enforces strictly disjoint lots and counts."""
    split_manifest_path = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
    assert os.path.exists(split_manifest_path), "ml/data/split_manifest.json is missing"

    with open(split_manifest_path, "r", encoding="utf-8") as f:
        split_m = json.load(f)

    train_lots = set(split_m["lots"]["train"])
    val_lots = set(split_m["lots"]["validation"])
    test_lots = set(split_m["lots"]["test"])

    assert len(train_lots) == 35
    assert len(val_lots) == 7
    assert len(test_lots) == 8

    assert train_lots.isdisjoint(val_lots), "Train and Val lots overlap!"
    assert train_lots.isdisjoint(test_lots), "Train and Test lots overlap!"
    assert val_lots.isdisjoint(test_lots), "Val and Test lots overlap!"


def test_07_split_leakage_rejection():
    """Verify split validator catches both component-level and lot-level leakage."""
    train_df = pd.DataFrame({"component_id": ["C1", "C2"], "lot_id": ["L1", "L1"]})
    val_df = pd.DataFrame({"component_id": ["C3", "C4"], "lot_id": ["L2", "L2"]})
    test_clean = pd.DataFrame({"component_id": ["C5", "C6"], "lot_id": ["L3", "L3"]})

    # Clean split
    assert validate_split_integrity(train_df, val_df, test_clean)["passed"] is True

    # Component leakage
    test_leaked_comp = pd.DataFrame({"component_id": ["C1", "C6"], "lot_id": ["L3", "L3"]})
    comp_res = validate_split_integrity(train_df, val_df, test_leaked_comp)
    assert comp_res["passed"] is False
    assert "Component leakage" in comp_res["error"]

    # Lot leakage
    test_leaked_lot = pd.DataFrame({"component_id": ["C5", "C6"], "lot_id": ["L1", "L3"]})
    lot_res = validate_split_integrity(train_df, val_df, test_leaked_lot)
    assert lot_res["passed"] is False
    assert "Lot leakage" in lot_res["error"]


def test_08_metric_zero_positive_safety():
    """Verify that metric calculation handles zero-positive and zero-negative edge cases safely."""
    # Zero positives (all negatives)
    y_true_zero_pos = [0, 0, 0, 0]
    y_pred = [0, 0, 0, 0]
    res_zero_pos = calculate_standardized_metrics(y_true_zero_pos, y_pred)
    assert res_zero_pos["safety_primary_metrics"]["latent_recall"] == 0.0
    assert res_zero_pos["safety_primary_metrics"]["latent_false_negative_rate"] == 0.0
    assert res_zero_pos["standard_classification_metrics"]["precision"] == 0.0
    assert res_zero_pos["confusion_matrix"]["tp"] == 0

    # Zero negatives (all positives)
    y_true_all_pos = [1, 1, 1, 1]
    res_all_pos = calculate_standardized_metrics(y_true_all_pos, [1, 1, 1, 1])
    assert res_all_pos["safety_primary_metrics"]["latent_recall"] == 1.0
    assert res_all_pos["safety_primary_metrics"]["latent_false_negative_rate"] == 0.0
    assert res_all_pos["standard_classification_metrics"]["specificity"] == 0.0


def test_09_forbidden_test_set_threshold_tuning_rejection():
    """Verify that threshold policy explicitly rejects optimization on the test partition."""
    y_true = np.array([1, 0, 1, 0, 1])
    y_prob = np.array([0.9, 0.1, 0.8, 0.2, 0.7])

    # Validation split is allowed
    val_res = ThresholdPolicy.select_optimal_safety_threshold(y_true, y_prob, split_name="validation_split")
    assert "threshold" in val_res
    assert val_res["threshold_source"] == ThresholdSource.VALIDATION_OPTIMIZED.value

    # Test split MUST raise ForbiddenTestThresholdOptimizationError
    with pytest.raises(ForbiddenTestThresholdOptimizationError) as exc_info:
        ThresholdPolicy.select_optimal_safety_threshold(y_true, y_prob, split_name="held_out_test_split")

    assert "CRITICAL GOVERNANCE VIOLATION" in str(exc_info.value)


def test_10_deterministic_evaluation_reproducibility(tmp_path):
    """
    Verify that running the canonical evaluation twice produces 100% identical:
    - sample counts
    - split sizes
    - metric numbers
    - confusion matrices
    """
    out1 = tmp_path / "eval1"
    out2 = tmp_path / "eval2"
    fixed_ts = "2026-09-15T18:00:00Z"

    rep1 = run_canonical_evaluation(output_dir=str(out1), threshold=0.50, enforce_reproducible_timestamp=fixed_ts)
    rep2 = run_canonical_evaluation(output_dir=str(out2), threshold=0.50, enforce_reproducible_timestamp=fixed_ts)

    # 1. Compare top-level values
    assert rep1["dataset_lineage"] == rep2["dataset_lineage"]
    assert rep1["trajectory_state_distribution"] == rep2["trajectory_state_distribution"]
    assert rep1["early_screening_performance_on_held_out_test"] == rep2["early_screening_performance_on_held_out_test"]
    assert rep1["evaluation_provenance"] == rep2["evaluation_provenance"]

    # 2. Compare serialized JSON files
    json1 = (out1 / "latent_trajectory_report.json").read_text(encoding="utf-8")
    json2 = (out2 / "latent_trajectory_report.json").read_text(encoding="utf-8")
    assert json1 == json2

    # 3. Compare serialized MD files
    md1 = (out1 / "latent_trajectory_report.md").read_text(encoding="utf-8")
    md2 = (out2 / "latent_trajectory_report.md").read_text(encoding="utf-8")
    assert md1 == md2
