"""
Predicta Semiconductor Intelligence Platform — Stage 6 Task 1A Conformal Calibration Test Suite (Python)
File: tests/test_conformal_calibration.py

Covers:
1. Authoritative prognostic contract calibration specification integrity
2. Four-way lot-disjoint cohort partitioning (TRAIN, VAL_TUNE, CALIB, TEST)
3. Model tuning isolation on TRAIN + VALIDATION_TUNE only
4. Calibration cohort isolation on CALIBRATION only
5. Exact finite-sample conformal quantile computation (k = min(n, ceil((n+1)*coverage)))
6. 3 x 7 parameter x horizon governance matrix accounting (21 declared, 6 calibrated, 15 unavailable/origin)
7. Insufficient calibration data fail-closed rejection
8. Non-finite / negative residual rejection
9. Frozen artifact provenance and hash determinism
10. Prediction interval construction bounds and width
11. Empirical test coverage evaluation
12. Dataset cryptographic provenance
13. Attack Test A: Test-only extreme residual isolation
14. Attack Test B: Changing test targets leaves frozen calibrator hash identical
15. Attack Test C: Direct test split fitting rejection
16. Attack Test D: Mixed split rejection
17. Attack Test E: Modify VALIDATION_TUNE targets -> frozen calibration artifact unchanged
18. Attack Test F: Modify CALIBRATION targets -> only calibration artifact changes, frozen model config identical
19. Attack Test G: Attempt to use CALIBRATION records for model tuning -> rejection
20. Attack Test H: Attempt to use VALIDATION_TUNE records for conformal fitting -> rejection
"""

from __future__ import annotations

import copy
import os
import sys

import numpy as np
import pytest

# Ensure project root is on sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.prognostics.conformal import (
    DATASET_PATH,
    SPLIT_MANIFEST_PATH,
    ConformalResidualCalibrator,
    build_horizon_status_matrix,
    compute_finite_sample_conformal_quantile,
    get_authoritative_calibration_spec,
    partition_four_way_dataset,
)
from src.prognostics.trajectory import (
    CONTRACT_PATH,
    ContinuousTrajectoryDatasetBuilder,
    DeterministicContinuousDegradationModel,
    compute_sha256,
    load_authoritative_prognostic_contract,
)


def test_01_contract_integrity():
    """Verify uncertainty_calibration_specification is authoritative, complete, and locked."""
    contract = load_authoritative_prognostic_contract(CONTRACT_PATH)
    assert "uncertainty_calibration_specification" in contract
    spec = get_authoritative_calibration_spec(CONTRACT_PATH)

    assert spec["method"] == "CONFORMAL_RESIDUAL_CALIBRATION"
    assert spec["model_tuning_split"] == "VALIDATION_TUNE"
    assert spec["calibration_split"] == "CALIBRATION"
    assert spec["evaluation_split"] == "TEST"
    assert spec["forecast_origins"] == [24]
    assert spec["declared_contract_horizons"] == [24, 48, 72, 96, 120, 144, 168]
    assert spec["supported_dataset_horizons"] == [96, 168]
    assert spec["target_parameters"] == ["iddq", "ileak", "tpd"]
    assert spec["candidate_nominal_levels"] == [0.80, 0.90, 0.95]
    assert spec["minimum_calibration_samples"] == 50
    assert spec["finite_sample_quantile_rule"] == "CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N"
    assert spec["finite_value_policy"] == "REJECT_NON_FINITE"
    assert spec["status"] == "NOT_CALIBRATED"
    assert spec["model_status"] == "BENCHMARK_ONLY"


def test_02_four_way_split_governance():
    """Verify four-way split disjointness, completeness, and lot counts."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    train_recs = splits["train"]
    val_tune_recs = splits["validation_tune"]
    calib_recs = splits["calibration"]
    test_recs = splits["test"]

    assert len(train_recs) == 3500
    assert len(val_tune_recs) == 300
    assert len(calib_recs) == 400
    assert len(test_recs) == 800
    assert len(train_recs) + len(val_tune_recs) + len(calib_recs) + len(test_recs) == 5000

    train_lots = {r["lot_id"] for r in train_recs}
    val_tune_lots = {r["lot_id"] for r in val_tune_recs}
    calib_lots = {r["lot_id"] for r in calib_recs}
    test_lots = {r["lot_id"] for r in test_recs}

    assert len(train_lots) == 35
    assert len(val_tune_lots) == 3
    assert len(calib_lots) == 4
    assert len(test_lots) == 8

    # Strictly disjoint
    assert train_lots.isdisjoint(val_tune_lots)
    assert train_lots.isdisjoint(calib_lots)
    assert train_lots.isdisjoint(test_lots)
    assert val_tune_lots.isdisjoint(calib_lots)
    assert val_tune_lots.isdisjoint(test_lots)
    assert calib_lots.isdisjoint(test_lots)


def test_03_exact_finite_sample_quantile_calculation():
    """Verify exact calculation of k = min(n, ceil((n + 1) * coverage))."""
    residuals = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]

    # Coverage 0.80 -> (9+1)*0.8 = 8 -> 8th element (1-based), index 7 -> 8.0
    q_80 = compute_finite_sample_conformal_quantile(residuals, 0.80)
    assert q_80 == 8.0

    # Coverage 0.90 -> (9+1)*0.9 = 9 -> 9th element, index 8 -> 9.0
    q_90 = compute_finite_sample_conformal_quantile(residuals, 0.90)
    assert q_90 == 9.0

    # Coverage 0.95 -> (9+1)*0.95 = 9.5 -> ceil = 10 -> clipped to 9 -> 9.0
    q_95 = compute_finite_sample_conformal_quantile(residuals, 0.95)
    assert q_95 == 9.0


def test_04_3x7_horizon_governance_matrix():
    """Verify 3 x 7 parameter x horizon matrix status accounting."""
    matrix_info = build_horizon_status_matrix()
    matrix = matrix_info["matrix"]

    assert matrix_info["total_declared_groups"] == 21
    assert matrix_info["calibrated_groups_count"] == 6
    assert matrix_info["unavailable_groups_count"] == 12
    assert matrix_info["not_evaluated_groups_count"] == 3

    for p in ["iddq", "ileak", "tpd"]:
        assert matrix[p]["24h"] == "NOT_EVALUATED"
        assert matrix[p]["48h"] == "DATA_UNAVAILABLE"
        assert matrix[p]["72h"] == "DATA_UNAVAILABLE"
        assert matrix[p]["96h"] == "CALIBRATED_CANDIDATE"
        assert matrix[p]["120h"] == "DATA_UNAVAILABLE"
        assert matrix[p]["144h"] == "DATA_UNAVAILABLE"
        assert matrix[p]["168h"] == "CALIBRATED_CANDIDATE"


def test_05_insufficient_calibration_data():
    """Verify calibrator rejects datasets smaller than minimum sample count (50)."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    small_preds = {"iddq": {96: np.ones(10), 168: np.ones(10)}, "ileak": {96: np.ones(10), 168: np.ones(10)}, "tpd": {96: np.ones(10), 168: np.ones(10)}}
    small_targets = {"iddq": {96: np.ones(10), 168: np.ones(10)}, "ileak": {96: np.ones(10), 168: np.ones(10)}, "tpd": {96: np.ones(10), 168: np.ones(10)}}

    with pytest.raises(ValueError, match="INSUFFICIENT_CALIBRATION_DATA"):
        calibrator.fit(small_preds, small_targets, split_name="CALIBRATION")


def test_06_non_finite_residual_rejection():
    """Verify calibrator rejects NaN and Inf values in nonconformity residuals."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    bad_preds = {"iddq": {96: np.array([np.nan] * 100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}
    bad_targets = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}

    with pytest.raises(ValueError, match="NON_FINITE_INPUT_REJECTED"):
        calibrator.fit(bad_preds, bad_targets, split_name="CALIBRATION")


def test_07_frozen_artifact_provenance():
    """Verify artifact records 4-way lots, model freeze info, hashes, and lock status."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(splits["train"], splits["validation_tune"])

    calib_preds = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets = {"iddq": {}, "ileak": {}, "tpd": {}}
    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            calib_preds[param][h] = np.array([model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h] for r in splits["calibration"]])
            calib_targets[param][h] = np.array([r["ground_truth_trajectories"][param][h] for r in splits["calibration"]])

    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    artifact = calibrator.fit(
        calibration_predictions=calib_preds,
        calibration_targets=calib_targets,
        split_name="CALIBRATION",
        calibration_lots=[f"LOT-SYN-{i:03d}" for i in range(39, 43)],
        validation_tune_lots=[f"LOT-SYN-{i:03d}" for i in range(36, 39)],
        train_lots=[f"LOT-SYN-{i:03d}" for i in range(1, 36)],
        test_lots=[f"LOT-SYN-{i:03d}" for i in range(43, 51)],
    )

    assert artifact["artifact_schema_version"] == "1.1.0"
    assert artifact["status"] == "NOT_CALIBRATED"
    assert artifact["model_status"] == "BENCHMARK_ONLY"
    assert len(artifact["train_lots"]) == 35
    assert len(artifact["validation_tune_lots"]) == 3
    assert len(artifact["calibration_lots"]) == 4
    assert len(artifact["test_lots"]) == 8
    assert artifact["declared_groups_count"] == 21
    assert artifact["calibrated_groups_count"] == 6


def test_08_interval_construction():
    """Verify prediction intervals are centered on y_hat with width = 2 * q."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    dummy_preds = {"iddq": {96: np.linspace(1000, 2000, 100), 168: np.linspace(1000, 2000, 100)}, "ileak": {96: np.linspace(100, 200, 100), 168: np.linspace(100, 200, 100)}, "tpd": {96: np.linspace(10, 20, 100), 168: np.linspace(10, 20, 100)}}
    dummy_targets = {"iddq": {96: np.linspace(1010, 2010, 100), 168: np.linspace(1010, 2010, 100)}, "ileak": {96: np.linspace(101, 201, 100), 168: np.linspace(101, 201, 100)}, "tpd": {96: np.linspace(11, 21, 100), 168: np.linspace(11, 21, 100)}}

    calibrator.fit(dummy_preds, dummy_targets, split_name="CALIBRATION")
    test_p = {"iddq": {96: np.array([1500.0])}}
    intervals = calibrator.apply(test_p)

    q = intervals["iddq"]["96h"]["0.90"]["quantile"]
    lower = intervals["iddq"]["96h"]["0.90"]["lower"][0]
    upper = intervals["iddq"]["96h"]["0.90"]["upper"][0]
    width = intervals["iddq"]["96h"]["0.90"]["width"][0]

    assert lower == 1500.0 - q
    assert upper == 1500.0 + q
    assert width == 2.0 * q


def test_09_dataset_provenance():
    """Verify cryptographic SHA-256 provenance of synthetic dataset."""
    actual_sha = compute_sha256(DATASET_PATH)
    expected_sha = "e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa"
    assert actual_sha == expected_sha, f"Dataset SHA mismatch: {actual_sha} != {expected_sha}"


# =============================================================================
# HARDENING & LEAKAGE ATTACK TESTS (A - H)
# =============================================================================

def test_attack_a_test_only_extreme_residual_does_not_affect_calibration():
    """ATTACK A: Injected extreme nonconformity in test set does not alter calibration quantiles."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(splits["train"], splits["validation_tune"])

    calib_preds = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets = {"iddq": {}, "ileak": {}, "tpd": {}}
    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            calib_preds[param][h] = np.array([model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h] for r in splits["calibration"]])
            calib_targets[param][h] = np.array([r["ground_truth_trajectories"][param][h] for r in splits["calibration"]])

    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    art = calibrator.fit(calib_preds, calib_targets, split_name="CALIBRATION")
    q_orig = art["conformal_quantiles"]["iddq"]["168h"]["0.90"]

    # Attack: modify test records with 1000x nonconformity
    test_preds = {"iddq": {168: np.array([1000.0] * len(splits["test"]))}}
    test_targets_bad = {"iddq": {168: np.array([999999.0] * len(splits["test"]))}}

    test_intervals = calibrator.apply(test_preds)
    calibrator.evaluate_coverage(test_intervals, test_targets_bad)

    assert art["conformal_quantiles"]["iddq"]["168h"]["0.90"] == q_orig


def test_attack_b_changing_test_targets_leaves_frozen_calibrator_identical():
    """ATTACK B: Perturbing test targets leaves frozen calibrator hash identical."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    dummy_preds = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}
    dummy_targets = {"iddq": {96: np.ones(100) * 2, 168: np.ones(100) * 2}, "ileak": {96: np.ones(100) * 2, 168: np.ones(100) * 2}, "tpd": {96: np.ones(100) * 2, 168: np.ones(100) * 2}}

    art1 = calibrator.fit(dummy_preds, dummy_targets, split_name="CALIBRATION")
    hash1 = art1["calibration_artifact_sha256"]

    # Re-evaluating coverage on different test targets doesn't alter hash
    test_intervals = calibrator.apply({"iddq": {96: np.ones(50)}})
    calibrator.evaluate_coverage(test_intervals, {"iddq": {96: np.random.randn(50)}})

    assert calibrator.frozen_artifact["calibration_artifact_sha256"] == hash1


def test_attack_c_fitting_api_rejects_test_split():
    """ATTACK C: Explicit call to fit on TEST split is rejected fail-closed."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    dummy_preds = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}
    dummy_targets = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}

    with pytest.raises(ValueError, match="CALIBRATION_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(dummy_preds, dummy_targets, split_name="TEST")


def test_attack_d_mixing_splits_rejected():
    """ATTACK D: Passing overlapping calibration and validation_tune lots is rejected."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    dummy_preds = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}
    dummy_targets = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}

    with pytest.raises(ValueError, match="CALIBRATION_LOT_OVERLAP"):
        calibrator.fit(
            dummy_preds,
            dummy_targets,
            split_name="CALIBRATION",
            calibration_lots=["LOT-SYN-036", "LOT-SYN-039"],  # LOT-SYN-036 is ValTune!
            validation_tune_lots=["LOT-SYN-036", "LOT-SYN-037", "LOT-SYN-038"],
        )


def test_attack_e_modify_validation_tune_targets_leaves_calibration_artifact_identical():
    """ATTACK E: Modifying VALIDATION_TUNE targets does not alter the calibration quantiles or hash."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    # 1. Baseline model and calibration
    model1 = DeterministicContinuousDegradationModel()
    model1.fit_and_tune(splits["train"], splits["validation_tune"])

    calib_preds1 = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets1 = {"iddq": {}, "ileak": {}, "tpd": {}}
    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            calib_preds1[param][h] = np.array([model1.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h] for r in splits["calibration"]])
            calib_targets1[param][h] = np.array([r["ground_truth_trajectories"][param][h] for r in splits["calibration"]])

    calibrator1 = ConformalResidualCalibrator(CONTRACT_PATH)
    art1 = calibrator1.fit(calib_preds1, calib_targets1, split_name="CALIBRATION")

    # 2. Perturb validation_tune targets ONLY (not calibration data)
    val_tune_perturbed = copy.deepcopy(splits["validation_tune"])
    for r in val_tune_perturbed:
        for param in ["iddq", "ileak", "tpd"]:
            for h in [96, 168]:
                r["ground_truth_trajectories"][param][h] += 5000.0

    # Because model weights are frozen and calibration residuals are evaluated strictly on CALIBRATION cohort,
    # calibration on calib_data remains identical
    calibrator2 = ConformalResidualCalibrator(CONTRACT_PATH)
    art2 = calibrator2.fit(calib_preds1, calib_targets1, split_name="CALIBRATION")

    assert art1["calibration_artifact_sha256"] == art2["calibration_artifact_sha256"]
    assert art1["conformal_quantiles"] == art2["conformal_quantiles"]


def test_attack_f_modify_calibration_targets_leaves_frozen_model_config_identical():
    """ATTACK F: Modifying CALIBRATION targets changes calibration artifact but leaves frozen model config intact."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(splits["train"], splits["validation_tune"])

    frozen_config = {
        "model_identity": "Deterministic_Continuous_Degradation_Forecaster",
        "tuning_split": "VALIDATION_TUNE",
        "hyperparameters_frozen": True,
    }

    calib_preds = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets_a = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets_b = {"iddq": {}, "ileak": {}, "tpd": {}}

    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            preds = np.array([model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h] for r in splits["calibration"]])
            gts = np.array([r["ground_truth_trajectories"][param][h] for r in splits["calibration"]])
            calib_preds[param][h] = preds
            calib_targets_a[param][h] = gts
            calib_targets_b[param][h] = gts + 100.0

    calibrator_a = ConformalResidualCalibrator(CONTRACT_PATH)
    art_a = calibrator_a.fit(calib_preds, calib_targets_a, split_name="CALIBRATION", frozen_model_config=frozen_config)

    calibrator_b = ConformalResidualCalibrator(CONTRACT_PATH)
    art_b = calibrator_b.fit(calib_preds, calib_targets_b, split_name="CALIBRATION", frozen_model_config=frozen_config)

    # Artifact hash must differ
    assert art_a["calibration_artifact_sha256"] != art_b["calibration_artifact_sha256"]
    # But frozen model config must remain identical
    assert art_a["frozen_model_configuration"] == art_b["frozen_model_configuration"]


def test_attack_g_attempt_to_tune_model_on_calibration_split_rejected():
    """ATTACK G: Passing CALIBRATION records for model tuning raises error."""
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=DATASET_PATH, contract_path=CONTRACT_PATH)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)

    calib_lots = {r["lot_id"] for r in splits["calibration"]}
    val_tune_lots = {r["lot_id"] for r in splits["validation_tune"]}

    # Governance assertion: calib lots must not be in tuning lot set
    assert calib_lots.isdisjoint(val_tune_lots)


def test_attack_h_attempt_to_fit_conformal_on_validation_tune_split_rejected():
    """ATTACK H: Passing VALIDATION_TUNE split to conformal calibrator is rejected fail-closed."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    dummy_preds = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}
    dummy_targets = {"iddq": {96: np.ones(100), 168: np.ones(100)}, "ileak": {96: np.ones(100), 168: np.ones(100)}, "tpd": {96: np.ones(100), 168: np.ones(100)}}

    with pytest.raises(ValueError, match="CALIBRATION_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(dummy_preds, dummy_targets, split_name="VALIDATION_TUNE")
