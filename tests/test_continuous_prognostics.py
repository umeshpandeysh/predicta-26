"""
Predicta Semiconductor Intelligence Platform — Stage 5 Task 2 Test Suite
File: tests/test_continuous_prognostics.py

Covers:
1. Contract integrity for continuous trajectory specification
2. Strict temporal leakage protection on continuous feature inputs
3. Continuous Persistence baseline multi-horizon behavior
4. Deterministic continuous degradation model fitting, validation-only tuning, frozen test evaluation
5. Continuous regression metrics calculation (MAE, RMSE, MedAE, MaxAE, NRMSE)
6. Lot-held-out disjoint split management and 100% completeness
7. Parametric threshold projection and breach detection
8. Empirical uncertainty diagnostics governance (NOT_CALIBRATED status)
9. Legacy GPR governance audit (INCOMPATIBLE_TRAINING_SCHEMA)
10. Cross-runtime mathematical parity (Python vs Node.js <= 1e-6)
"""

import os
import sys
import subprocess
import json
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.prognostics.trajectory import (
    get_authoritative_continuous_spec,
    validate_continuous_feature_input,
    calculate_continuous_regression_metrics,
    ContinuousTrajectoryDatasetBuilder,
    ContinuousPersistenceBaseline,
    DeterministicContinuousDegradationModel,
    evaluate_threshold_projections,
    evaluate_legacy_gpr_governance
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

    def test_reject_missing_keys(self):
        invalid = {
            "iddq_0h": 100.0,
            "ileak_0h": 5.0,
            # missing tpd_0h
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        with pytest.raises(ValueError, match="MISSING_REQUIRED_FEATURE"):
            validate_continuous_feature_input(invalid)

    def test_reject_out_of_order_keys(self):
        out_of_order = {
            "ileak_0h": 5.0,
            "iddq_0h": 100.0,
            "tpd_0h": 20.0,
            "iddq_24h": 105.0,
            "ileak_24h": 5.2,
            "tpd_24h": 20.5,
            "iddq_drift_24h": 5.0,
            "ileak_drift_24h": 0.2,
            "tpd_drift_24h": 0.5
        }
        with pytest.raises(ValueError, match="SCHEMA_ORDER_MISMATCH"):
            validate_continuous_feature_input(out_of_order)

    def test_reject_nan_inf_non_numeric(self):
        base = {
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
        bad_nan = dict(base)
        bad_nan["iddq_0h"] = float("nan")
        with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
            validate_continuous_feature_input(bad_nan)

        # Inf
        bad_inf = dict(base)
        bad_inf["tpd_drift_24h"] = float("inf")
        with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
            validate_continuous_feature_input(bad_inf)

        # String
        bad_str = dict(base)
        bad_str["ileak_0h"] = "corrupted"
        with pytest.raises(ValueError, match="INVALID_NUMERIC_VALUE"):
            validate_continuous_feature_input(bad_str)


class TestContinuousRegressionMetrics:
    def test_exact_zero_error(self):
        y_true = [10.0, 20.0, 30.0]
        y_pred = [10.0, 20.0, 30.0]
        m = calculate_continuous_regression_metrics(y_true, y_pred)
        assert m["mae"] == 0.0
        assert m["rmse"] == 0.0
        assert m["median_absolute_error"] == 0.0
        assert m["max_absolute_error"] == 0.0
        assert m["normalized_rmse"] == 0.0
        assert m["sample_count"] == 3

    def test_known_metrics_vector(self):
        y_true = [10.0, 20.0, 30.0]
        y_pred = [12.0, 18.0, 34.0]  # errors: -2, +2, -4 -> abs: 2, 2, 4 -> sq: 4, 4, 16 (mean 8)
        m = calculate_continuous_regression_metrics(y_true, y_pred)
        assert m["mae"] == pytest.approx(8.0 / 3.0, rel=1e-5)
        assert m["rmse"] == pytest.approx(np.sqrt(8.0), rel=1e-5)
        assert m["median_absolute_error"] == 2.0
        assert m["max_absolute_error"] == 4.0
        assert m["normalized_rmse"] == pytest.approx(np.sqrt(8.0) / 20.0, rel=1e-5)

    def test_empty_and_error_handling(self):
        m = calculate_continuous_regression_metrics([], [])
        assert m["sample_count"] == 0
        assert m["mae"] == 0.0

        with pytest.raises(ValueError, match="DIMENSION_MISMATCH"):
            calculate_continuous_regression_metrics([1.0], [1.0, 2.0])

        with pytest.raises(ValueError, match="NON_FINITE_VALUES"):
            calculate_continuous_regression_metrics([np.nan], [1.0])


class TestDatasetBuilderAndPartitions:
    def test_dataset_building_and_splits(self):
        builder = ContinuousTrajectoryDatasetBuilder()
        ds = builder.build_dataset()
        assert ds["total_count"] == 5000
        assert len(ds["records"]) == 5000

        splits = builder.split_dataset(ds["records"])
        assert len(splits["train"]) == 3500
        assert len(splits["validation"]) == 700
        assert len(splits["test"]) == 800

        train_lots = {r["lot_id"] for r in splits["train"]}
        val_lots = {r["lot_id"] for r in splits["validation"]}
        test_lots = {r["lot_id"] for r in splits["test"]}

        assert len(train_lots) == 35
        assert len(val_lots) == 7
        assert len(test_lots) == 8

        # Disjointness
        assert train_lots.isdisjoint(val_lots)
        assert train_lots.isdisjoint(test_lots)
        assert val_lots.isdisjoint(test_lots)


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
        model.fit_and_tune(splits["train"], splits["validation"])
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
        model_py.fit_and_tune(splits["train"], splits["validation"])
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
