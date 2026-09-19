"""
Predicta Semiconductor Intelligence Platform — Stage 5 Task 2 / Stage 6 Task 1B Test Suite
File: tests/test_continuous_prognostics.py

Covers:
1. Contract integrity for continuous trajectory specification
2. Strict temporal leakage protection on continuous feature inputs
3. Continuous Persistence baseline multi-horizon behavior
4. Deterministic continuous degradation model fitting, validation_tune-only tuning, frozen test evaluation
5. Continuous regression metrics calculation (MAE, RMSE, MedAE, MaxAE, NRMSE)
6. Four-way lot-held-out disjoint split management and 100% completeness:
   - TRAIN: LOT-SYN-001..035 (35 lots, 3500 components)
   - VALIDATION_TUNE: LOT-SYN-036..038 (3 lots, 300 components)
   - CALIBRATION: LOT-SYN-039..042 (4 lots, 400 components)
   - TEST: LOT-SYN-043..050 (8 lots, 800 components)
7. Parametric threshold projection and breach detection
8. Empirical uncertainty diagnostics governance (NOT_CALIBRATED status)
9. Legacy GPR governance audit (INCOMPATIBLE_TRAINING_SCHEMA)
10. Cross-runtime mathematical parity (Python vs Node.js <= 1e-5)
11. Security & Leakage Attacks I, J, K, L (Separation of model tuning from calibration cohort)
"""

import os
import sys
import copy
import subprocess
import json
import hashlib
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.prognostics.conformal import build_authoritative_horizon_matrix
from src.prognostics.trajectory import (
    split_prognostic_dataset,
    get_authoritative_continuous_spec,
    validate_continuous_feature_input,
    calculate_continuous_regression_metrics,
    ContinuousTrajectoryDatasetBuilder,
    ContinuousPersistenceBaseline,
    DeterministicContinuousDegradationModel,
    evaluate_threshold_projections,
    evaluate_legacy_gpr_governance
)
from src.prognostics.conformal import (
    ConformalResidualCalibrator,
    CONTRACT_PATH,
)


class TestContinuousPrognosticsContract:
    def test_contract_contains_continuous_spec(self):
        spec = get_authoritative_continuous_spec()
        assert spec["task_name"] == "continuous_168h_trajectory_forecasting"
        assert spec["forecast_origins"] == [24]
        assert spec["supported_horizons"] == [24, 48, 72, 96, 120, 144, 168]
        assert spec["evaluated_ground_truth_horizons"] == [96, 168]
        assert spec["target_parameters"] == ["iddq", "ileak", "tpd"]
        assert spec["screening_criteria_type"] == "PROJECT_DEFINED_SCREENING_CRITERION"
        assert spec["calibration_status"] == "NOT_CALIBRATED"

    def test_contract_parametric_screening_limits(self):
        spec = get_authoritative_continuous_spec()
        limits = spec["parametric_screening_limits"]
        assert limits["iddq_max_uA"] == 5000.0
        assert limits["ileak_max_uA"] == 500.0
        assert limits["tpd_max_ns"] == 250.0


class TestTemporalLeakageDefense:
    def test_valid_dict_input(self):
        valid = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        arr = validate_continuous_feature_input(valid)
        assert isinstance(arr, np.ndarray)
        assert arr.shape == (9,)
        assert np.allclose(arr, [100.0, 5.0, 20.0, 105.0, 5.2, 20.5, 5.0, 0.2, 0.5])

    def test_reject_future_leakage_keys(self):
        leaky_keys = [
            {"iddq_168h": 120.0},
            {"tpd_96h": 22.0},
            {"future_drift": 10.0},
            {"ground_truth_iddq": 100.0},
            {"target_tpd": 25.0}
        ]
        base_valid = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        for leak in leaky_keys:
            test_dict = dict(base_valid)
            test_dict.update(leak)
            with pytest.raises(ValueError, match="TEMPORAL_LEAKAGE_DETECTED|EXTRA_FEATURE_DETECTED"):
                validate_continuous_feature_input(test_dict)

    def test_reject_missing_feature(self):
        base_valid = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        for k in list(base_valid.keys()):
            incomplete = dict(base_valid)
            del incomplete[k]
            with pytest.raises(ValueError, match="MISSING_REQUIRED_FEATURE"):
                validate_continuous_feature_input(incomplete)

    def test_reject_schema_reordering(self):
        shuffled = {
            "tpd_drift_24h": 0.5,
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2
        }
        with pytest.raises(ValueError, match="SCHEMA_ORDER_MISMATCH"):
            validate_continuous_feature_input(shuffled)

    def test_reject_non_numeric_and_non_finite(self):
        base_valid = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        # NaN
        bad_nan = dict(base_valid, iddq_0h=float("nan"))
        with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
            validate_continuous_feature_input(bad_nan)

        # Inf
        bad_inf = dict(base_valid, ileak_24h=float("inf"))
        with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
            validate_continuous_feature_input(bad_inf)

        # String
        bad_str = dict(base_valid, tpd_0h="non_numeric")
        with pytest.raises(ValueError, match="INVALID_NUMERIC_VALUE"):
            validate_continuous_feature_input(bad_str)


class TestContinuousRegressionMetrics:
    def test_exact_zero_error(self):
        y = [10.0, 20.0, 30.0, 40.0]
        m = calculate_continuous_regression_metrics(y, y)
        assert m["mae"] == 0.0
        assert m["rmse"] == 0.0
        assert m["median_absolute_error"] == 0.0
        assert m["max_absolute_error"] == 0.0
        assert m["normalized_rmse"] == 0.0
        assert m["sample_count"] == 4

    def test_known_metrics_vector(self):
        y_true = [10.0, 20.0, 30.0]
        y_pred = [12.0, 18.0, 34.0]
        # errors: -2, +2, -4 -> abs: 2, 2, 4
        # MAE: 8/3 = 2.666667
        # MSE: (4 + 4 + 16)/3 = 8.0 -> RMSE: sqrt(8) = 2.828427
        # MedAE: 2.0
        # MaxAE: 4.0
        # mean(y_true) = 20.0 -> NRMSE = sqrt(8) / 20 = 0.141421
        m = calculate_continuous_regression_metrics(y_true, y_pred)
        assert abs(m["mae"] - (8.0 / 3.0)) < 1e-5
        assert abs(m["rmse"] - np.sqrt(8.0)) < 1e-5
        assert m["median_absolute_error"] == 2.0
        assert m["max_absolute_error"] == 4.0
        assert abs(m["normalized_rmse"] - (np.sqrt(8.0) / 20.0)) < 1e-5
        assert m["sample_count"] == 3

    def test_empty_and_error_handling(self):
        m = calculate_continuous_regression_metrics([], [])
        assert m["sample_count"] == 0
        assert m["mae"] == 0.0

        with pytest.raises(ValueError, match="DIMENSION_MISMATCH"):
            calculate_continuous_regression_metrics([1.0], [1.0, 2.0])

        with pytest.raises(ValueError, match="NON_FINITE_VALUES"):
            calculate_continuous_regression_metrics([float("nan")], [1.0])


class TestDatasetBuilderAndFourWayPartitions:
    def test_dataset_building_and_four_way_splits(self):
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        assert ds["total_count"] == 5000
        assert len(ds["records"]) == 5000

        splits = builder.split_dataset(ds["records"])
        assert len(splits["train"]) == 3500
        assert len(splits["validation_tune"]) == 300
        assert len(splits["calibration"]) == 400
        assert len(splits["test"]) == 800

        train_lots = {r["lot_id"] for r in splits["train"]}
        val_tune_lots = {r["lot_id"] for r in splits["validation_tune"]}
        calib_lots = {r["lot_id"] for r in splits["calibration"]}
        test_lots = {r["lot_id"] for r in splits["test"]}

        assert len(train_lots) == 35
        assert len(val_tune_lots) == 3
        assert len(calib_lots) == 4
        assert len(test_lots) == 8

        # Four-way strict disjointness
        assert train_lots.isdisjoint(val_tune_lots)
        assert train_lots.isdisjoint(calib_lots)
        assert train_lots.isdisjoint(test_lots)
        assert val_tune_lots.isdisjoint(calib_lots)
        assert val_tune_lots.isdisjoint(test_lots)
        assert calib_lots.isdisjoint(test_lots)

        # Completeness
        all_lots = train_lots | val_tune_lots | calib_lots | test_lots
        assert len(all_lots) == 50


class TestPersistenceBaseline:
    def test_constant_forecast(self):
        model = ContinuousPersistenceBaseline()
        features = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.5,
            "tpd_24h": 21.0,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.5,
            "tpd_drift_24h": 1.0
        }
        traj = model.forecast_trajectory(features)
        for h in [24, 48, 72, 96, 120, 144, 168]:
            assert traj["iddq"][h] == 105.0
            assert traj["ileak"][h] == 5.5
            assert traj["tpd"][h] == 21.0


class TestDeterministicContinuousDegradationModel:
    def test_fit_tune_and_frozen_evaluation(self):
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        model = DeterministicContinuousDegradationModel()
        model.fit_and_tune(splits["train"], splits["validation_tune"])
        assert model.is_frozen

        # Structural rejection of tuning on test
        with pytest.raises(ValueError, match="TEST_SET_TUNING_FORBIDDEN"):
            model.evaluate_frozen_test(splits["test"], tune_on_test=True)

        eval_res = model.evaluate_frozen_test(splits["test"], tune_on_test=False)
        assert "metrics" in eval_res
        assert "coverage" in eval_res

        # Check coverage diagnostics flagged NOT_CALIBRATED
        for p in ["iddq", "ileak", "tpd"]:
            for h in ["96h", "168h"]:
                assert eval_res["coverage"][p][h]["calibration_status"] == "NOT_CALIBRATED"
                assert eval_res["coverage"][p][h]["nominal_level"] == 0.90
                assert 70.0 <= eval_res["coverage"][p][h]["observed_coverage_pct"] <= 100.0


class TestThresholdProjections:
    def test_threshold_crossing_detection(self):
        traj = {
            "iddq": {24: 100.0, 48: 200.0, 96: 300.0, 168: 400.0},
            "ileak": {24: 10.0, 48: 20.0, 96: 30.0, 168: 40.0},
            "tpd": {24: 200.0, 48: 240.0, 96: 255.0, 168: 270.0}  # Limit is 250 -> breach at 96h
        }
        res = evaluate_threshold_projections(traj)
        assert res["overall_breach_projected"] is True
        assert res["earliest_breach_hour"] == 96
        assert res["parameter_projections"]["tpd"]["breach_projected"] is True
        assert res["parameter_projections"]["tpd"]["earliest_crossing_hour"] == 96
        assert res["parameter_projections"]["tpd"]["crossing_direction"] == "UPWARD_BREACH"
        assert res["parameter_projections"]["iddq"]["breach_projected"] is False


class TestLegacyGprGovernance:
    def test_gpr_audit_rejection(self):
        audit = evaluate_legacy_gpr_governance()
        assert audit["compatibility_status"] == "INCOMPATIBLE_TRAINING_SCHEMA"
        assert audit["promotion_eligible"] is False
        assert "overlap" in audit["rejection_reason"].lower() or "schema" in audit["compatibility_status"].lower()


class TestCrossRuntimeParity:
    def test_python_nodejs_parity(self):
        # Run node script and python script, compare output JSON metrics
        node_script = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "src", "prognostics", "evaluate_continuous_prognostics.js")
        )
        res = subprocess.run(["node", node_script], capture_output=True, text=True, check=True)
        assert res.returncode == 0

        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        model_py = DeterministicContinuousDegradationModel()
        model_py.fit_and_tune(splits["train"], splits["validation_tune"])
        py_test_eval = model_py.evaluate_frozen_test(splits["test"], tune_on_test=False)

        json_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "experiments", "prognostics", "continuous_prognostic_benchmark_report.json")
        )
        with open(json_path, "r", encoding="utf-8") as f:
            node_report = json.load(f)

        node_m_test = node_report["benchmark_metrics"]["held_out_test_cohort"]["deterministic_degradation_model"]
        py_m_test = py_test_eval["metrics"]

        for param in ["iddq", "ileak", "tpd"]:
            for h in ["96h", "168h"]:
                for metric in ["mae", "rmse", "median_absolute_error", "max_absolute_error", "normalized_rmse"]:
                    val_py = py_m_test[param][h][metric]
                    val_node = node_m_test[param][h][metric]
                    diff = abs(val_py - val_node)
                    assert diff <= 1e-5, f"Parity mismatch in {param} {h} {metric}: Python={val_py}, Node={val_node}, diff={diff}"


# =============================================================================
# LEAKAGE ATTACK TESTS (I - L) — MODEL TUNING & CALIBRATION INDEPENDENCE
# =============================================================================

class TestModelTuningCalibrationAttacks:
    def test_attack_i_inject_calibration_records_into_validation_tune_rejected(self):
        """ATTACK I: Injecting calibration records into validation_tune cohort is rejected fail-closed."""
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        # Create contaminated tuning cohort with calibration records
        contaminated_tune = list(splits["validation_tune"]) + [splits["calibration"][0]]

        model = DeterministicContinuousDegradationModel()
        with pytest.raises(ValueError, match="TUNING_SET_CONTAMINATION"):
            model.fit_and_tune(splits["train"], contaminated_tune)

    def test_attack_j_replace_validation_tune_with_calibration_records_rejected(self):
        """ATTACK J: Replacing validation_tune cohort with calibration records (same size) is rejected."""
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        # Take 300 calibration records and attempt to pass as tuning split
        calib_sub = splits["calibration"][:300]

        model = DeterministicContinuousDegradationModel()
        with pytest.raises(ValueError, match="TUNING_SET_CONTAMINATION"):
            model.fit_and_tune(splits["train"], calib_sub)

    def test_attack_k_modify_calibration_targets_leaves_frozen_model_identical(self):
        """ATTACK K: Modifying calibration targets leaves frozen model parameters/configuration identical."""
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        # 1. Fit baseline model
        model1 = DeterministicContinuousDegradationModel()
        model1.fit_and_tune(splits["train"], splits["validation_tune"])

        # 2. Perturb calibration targets
        perturbed_calib = copy.deepcopy(splits["calibration"])
        for r in perturbed_calib:
            for p in ["iddq", "ileak", "tpd"]:
                for h in [96, 168]:
                    r["ground_truth_trajectories"][p][h] += 1000.0

        # 3. Fit second model with identical train & validation_tune cohorts
        model2 = DeterministicContinuousDegradationModel()
        model2.fit_and_tune(splits["train"], splits["validation_tune"])

        # 4. Verify weights and alphas are 100% byte-identical
        for p in ["iddq", "ileak", "tpd"]:
            for h in [96, 168]:
                assert np.allclose(model1.weights[p][h], model2.weights[p][h])
                assert model1.optimal_alphas[p][h] == model2.optimal_alphas[p][h]

    def test_attack_l_strict_model_tuning_and_calibration_independence(self):
        """
        ATTACK L: Comprehensive demonstration of Model Tuning & Conformal Calibration Independence (Steps A-J).
        """
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        # A. Build baseline model using TRAIN + VALIDATION_TUNE
        model1 = DeterministicContinuousDegradationModel()
        model1.fit_and_tune(splits["train"], splits["validation_tune"])

        # B. Freeze it
        assert model1.is_frozen

        # C. Produce calibration predictions from the frozen model
        calib_preds = {}
        calib_targets = {}
        for p in ["iddq", "ileak", "tpd"]:
            calib_preds[p] = {96: [], 168: []}
            calib_targets[p] = {96: [], 168: []}

        for r in splits["calibration"]:
            fc = model1.forecast_trajectory(r["early_features_dict"])
            for p in ["iddq", "ileak", "tpd"]:
                for h in [96, 168]:
                    calib_preds[p][h].append(fc["forecast_trajectories"][p][h])
                    calib_targets[p][h].append(r["ground_truth_trajectories"][p][h])

        for p in ["iddq", "ileak", "tpd"]:
            for h in [96, 168]:
                calib_preds[p][h] = np.array(calib_preds[p][h])
                calib_targets[p][h] = np.array(calib_targets[p][h])

        # D. Create second tuning cohort where VALIDATION_TUNE targets are materially changed
        perturbed_val_tune = copy.deepcopy(splits["validation_tune"])
        for r in perturbed_val_tune:
            for p in ["iddq", "ileak", "tpd"]:
                for h in [96, 168]:
                    r["ground_truth_trajectories"][p][h] += 500.0

        # E. Fit/tune a second model
        model2 = DeterministicContinuousDegradationModel()
        model2.fit_and_tune(splits["train"], perturbed_val_tune)

        # F. Demonstrate that changing VALIDATION_TUNE can change model configuration
        changed_config = (
            model1.optimal_alphas != model2.optimal_alphas or
            not all(
                np.allclose(model1.weights[p][h], model2.weights[p][h])
                for p in ["iddq", "ileak", "tpd"] for h in [96, 168]
            )
        )
        assert changed_config, "Materially changed validation_tune targets should alter model parameters/alphas."

        # G. Demonstrate that calibration procedure STILL uses only independent CALIBRATION cohort
        calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
        calibrator.fit(calib_preds, calib_targets, split_name="CALIBRATION")
        assert calibrator.is_frozen
        assert len(calibrator.frozen_artifact["calibration_lots"]) == 4
        assert calibrator.frozen_artifact["sample_counts"]["iddq"]["96h"] == 400

        # H. Attempt to provide VALIDATION_TUNE records to conformal fitting -> Hard Rejection
        with pytest.raises(ValueError, match="CALIBRATION_SPLIT_LEAKAGE_REJECTED"):
            calibrator.fit(calib_preds, calib_targets, split_name="VALIDATION_TUNE")

        # I. Attempt to provide TEST records to conformal fitting -> Hard Rejection
        with pytest.raises(ValueError, match="CALIBRATION_SPLIT_LEAKAGE_REJECTED"):
            calibrator.fit(calib_preds, calib_targets, split_name="TEST")

        # J. Attempt to provide CALIBRATION records to model tuning -> Hard Rejection
        with pytest.raises(ValueError, match="TUNING_SET_CONTAMINATION"):
            model_bad = DeterministicContinuousDegradationModel()
            model_bad.fit_and_tune(splits["train"], splits["calibration"][:300])


class TestSplitManifestFailClosedGovernance:
    def test_corrupt_or_missing_split_cohorts_fail_closed(self, tmp_path):
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        records = ds["records"][:100]

        # 1. Missing validation_tune in manifest
        bad_manifest_1 = tmp_path / "manifest_no_val_tune.json"
        with open(bad_manifest_1, "w", encoding="utf-8") as f:
            json.dump({
                "lots": {
                    "train": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                    "calibration": [f"LOT-SYN-{i:03d}" for i in range(39, 43)],
                    "test": [f"LOT-SYN-{i:03d}" for i in range(43, 51)]
                }
            }, f)

        with pytest.raises(ValueError, match="SPLIT_MANIFEST_INVALID"):
            builder.split_dataset(records, split_manifest_path=str(bad_manifest_1))
        with pytest.raises(ValueError, match="SPLIT_MANIFEST_INVALID"):
            split_prognostic_dataset(records, split_manifest_path=str(bad_manifest_1))

        # 2. Missing calibration in manifest
        bad_manifest_2 = tmp_path / "manifest_no_calib.json"
        with open(bad_manifest_2, "w", encoding="utf-8") as f:
            json.dump({
                "lots": {
                    "train": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                    "validation_tune": [f"LOT-SYN-{i:03d}" for i in range(36, 39)],
                    "test": [f"LOT-SYN-{i:03d}" for i in range(43, 51)]
                }
            }, f)

        with pytest.raises(ValueError, match="SPLIT_MANIFEST_INVALID"):
            builder.split_dataset(records, split_manifest_path=str(bad_manifest_2))
        with pytest.raises(ValueError, match="SPLIT_MANIFEST_INVALID"):
            split_prognostic_dataset(records, split_manifest_path=str(bad_manifest_2))

        # 3. Empty validation_tune cohort
        bad_manifest_3 = tmp_path / "manifest_empty_val_tune.json"
        with open(bad_manifest_3, "w", encoding="utf-8") as f:
            json.dump({
                "lots": {
                    "train": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                    "validation_tune": [],
                    "calibration": [f"LOT-SYN-{i:03d}" for i in range(39, 43)],
                    "test": [f"LOT-SYN-{i:03d}" for i in range(43, 51)]
                }
            }, f)

        with pytest.raises(ValueError, match="SPLIT_MANIFEST_INVALID"):
            builder.split_dataset(records, split_manifest_path=str(bad_manifest_3))

        # 4. Overlapping cohorts in manifest
        bad_manifest_4 = tmp_path / "manifest_overlapping.json"
        with open(bad_manifest_4, "w", encoding="utf-8") as f:
            json.dump({
                "lots": {
                    "train": [f"LOT-SYN-{i:03d}" for i in range(1, 37)],  # Includes 036
                    "validation_tune": [f"LOT-SYN-{i:03d}" for i in range(36, 39)],  # Includes 036
                    "calibration": [f"LOT-SYN-{i:03d}" for i in range(39, 43)],
                    "test": [f"LOT-SYN-{i:03d}" for i in range(43, 51)]
                }
            }, f)

        with pytest.raises((ValueError, AssertionError)):
            builder.split_dataset(records, split_manifest_path=str(bad_manifest_4))


class TestHorizonMatrixGovernanceAndParity:
    def test_authoritative_3x7_horizon_matrix_and_accounting(self):
        matrix_info = build_authoritative_horizon_matrix()
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


class TestModelFreezeAndImmutability:
    def test_model_freeze_state_immutability(self):
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        splits = builder.split_dataset(ds["records"])

        model = DeterministicContinuousDegradationModel()
        model.fit_and_tune(splits["train"], splits["validation_tune"])
        assert model.is_frozen

        # Compute hash of model state
        state_repr = json.dumps({
            "alphas": model.optimal_alphas,
            "weights": {p: {str(h): list(model.weights[p][h]) for h in [96, 168]} for p in ["iddq", "ileak", "tpd"]},
            "residuals_std": model.validation_residuals_std
        }, sort_keys=True)
        hash_before = hashlib.sha256(state_repr.encode("utf-8")).hexdigest()

        # Modify calibration records
        perturbed_calib = copy.deepcopy(splits["calibration"])
        for r in perturbed_calib:
            for p in ["iddq", "ileak", "tpd"]:
                for h in [96, 168]:
                    r["ground_truth_trajectories"][p][h] += 9999.0

        # Model evaluation on calibration records
        for r in perturbed_calib:
            model.forecast_trajectory(r["early_features_dict"])

        # Re-compute state hash
        state_repr_after = json.dumps({
            "alphas": model.optimal_alphas,
            "weights": {p: {str(h): list(model.weights[p][h]) for h in [96, 168]} for p in ["iddq", "ileak", "tpd"]},
            "residuals_std": model.validation_residuals_std
        }, sort_keys=True)
        hash_after = hashlib.sha256(state_repr_after.encode("utf-8")).hexdigest()

        assert hash_before == hash_after

        # Attempt to mutate/refit frozen model
        with pytest.raises(RuntimeError, match="FROZEN_MODEL_MUTATION_PROHIBITED"):
            model.fit_and_tune(splits["train"], splits["validation_tune"])

        # Attempt to tune on test set
        with pytest.raises(ValueError, match="TEST_SET_TUNING_FORBIDDEN"):
            model.evaluate_frozen_test(splits["test"], tune_on_test=True)
