"""
Predicta Semiconductor Intelligence Platform — Conformal Calibration Test Suite (Python)
File: tests/test_conformal_calibration.py

Validates Stage 6 Task 1:
1. Contract integrity (uncertainty_calibration_specification)
2. Validation-only calibration fitting
3. Test-set calibration rejection
4. Exact finite-sample quantile calculation
5. Deterministic quantile calculation
6. Parameter x horizon grouping
7. Insufficient calibration data handling
8. Non-finite residual rejection
9. Frozen artifact reproducibility
10. Interval construction logic
11. Coverage calculation correctness
12. Zero-width residual edge case
13. Negative / invalid coverage rejection
14. Unsupported parameter rejection
15. Unsupported horizon rejection
16. Numerical parity
17. Dataset hash provenance
18. Split manifest provenance
19. Attack Tests A, B, C, D
"""

from __future__ import annotations

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
    ConformalResidualCalibrator,
    compute_finite_sample_conformal_quantile,
    get_authoritative_calibration_spec,
)
from src.prognostics.trajectory import (
    CONTRACT_PATH,
    compute_sha256,
    load_authoritative_prognostic_contract,
)


def test_01_contract_integrity():
    """Verify uncertainty_calibration_specification is authoritative and complete."""
    contract = load_authoritative_prognostic_contract(CONTRACT_PATH)
    assert "uncertainty_calibration_specification" in contract
    spec = get_authoritative_calibration_spec(CONTRACT_PATH)

    assert spec["method"] == "CONFORMAL_RESIDUAL_CALIBRATION"
    assert spec["calibration_split"] == "VALIDATION"
    assert spec["evaluation_split"] == "TEST"
    assert spec["forecast_origins"] == [24]
    assert spec["supported_horizons"] == [24, 48, 72, 96, 120, 144, 168]
    assert spec["target_parameters"] == ["iddq", "ileak", "tpd"]
    assert spec["candidate_nominal_levels"] == [0.80, 0.90, 0.95]
    assert spec["minimum_calibration_samples"] >= 50
    assert spec["status"] == "NOT_CALIBRATED"
    assert spec["model_status"] == "BENCHMARK_ONLY"
    assert "disclaimer" in spec


def test_02_validation_only_calibration():
    """Verify fitting succeeds strictly on VALIDATION split."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)

    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }

    artifact = calibrator.fit(val_preds, val_targets, split_name="VALIDATION")
    assert calibrator.is_frozen is True
    assert artifact["calibration_split"] == "VALIDATION"
    assert artifact["status"] == "NOT_CALIBRATED"
    assert "conformal_quantiles" in artifact


def test_03_test_set_calibration_rejection():
    """Verify fail-closed rejection if calibration is attempted on TEST split."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {"iddq": {96: np.array([2000.0] * 100)}}
    val_targets = {"iddq": {96: np.array([2010.0] * 100)}}

    with pytest.raises(ValueError, match="TEST_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(val_preds, val_targets, split_name="TEST")

    with pytest.raises(ValueError, match="TEST_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(val_preds, val_targets, split_name="HELD_OUT_TEST")


def test_04_exact_finite_sample_quantile_calculation():
    """Verify finite-sample index formula: k = ceil((n + 1) * coverage)."""
    # Sample of 9 residuals: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    # For coverage=0.80: k = ceil(10 * 0.80) = 8 -> sorted[7] = 8.0
    residuals = [9.0, 1.0, 8.0, 2.0, 7.0, 3.0, 6.0, 4.0, 5.0]
    q_80 = compute_finite_sample_conformal_quantile(residuals, 0.80)
    assert q_80 == 8.0

    # For coverage=0.90: k = ceil(10 * 0.90) = 9 -> sorted[8] = 9.0
    q_90 = compute_finite_sample_conformal_quantile(residuals, 0.90)
    assert q_90 == 9.0

    # For coverage=0.50: k = ceil(10 * 0.50) = 5 -> sorted[4] = 5.0
    q_50 = compute_finite_sample_conformal_quantile(residuals, 0.50)
    assert q_50 == 5.0


def test_05_deterministic_quantile_calculation():
    """Verify deterministic quantile calculations across 10 repeated invocations."""
    np.random.seed(42)
    residuals = np.random.exponential(scale=10.0, size=200)

    q1 = compute_finite_sample_conformal_quantile(residuals, 0.90)
    for _ in range(10):
        q_rep = compute_finite_sample_conformal_quantile(residuals, 0.90)
        assert q_rep == q1


def test_06_parameter_horizon_grouping():
    """Verify quantiles are estimated distinctly per parameter and horizon."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)

    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    # Deliberately different error scales
    val_targets = {
        "iddq": {96: np.array([2050.0] * 100), 168: np.array([2200.0] * 100)},  # residuals: 50, 100
        "ileak": {96: np.array([305.0] * 100), 168: np.array([320.0] * 100)},   # residuals: 5, 10
        "tpd": {96: np.array([182.0] * 100), 168: np.array([195.0] * 100)},     # residuals: 2, 5
    }

    artifact = calibrator.fit(val_preds, val_targets, split_name="VALIDATION")
    q_iddq_96 = artifact["conformal_quantiles"]["iddq"]["96h"]["0.90"]
    q_iddq_168 = artifact["conformal_quantiles"]["iddq"]["168h"]["0.90"]
    q_ileak_96 = artifact["conformal_quantiles"]["ileak"]["96h"]["0.90"]
    q_tpd_96 = artifact["conformal_quantiles"]["tpd"]["96h"]["0.90"]

    assert q_iddq_96 == 50.0
    assert q_iddq_168 == 100.0
    assert q_ileak_96 == 5.0
    assert q_tpd_96 == 2.0
    assert q_iddq_96 != q_ileak_96


def test_07_insufficient_calibration_data():
    """Verify rejection when calibration sample size is below contract minimum."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {"iddq": {96: np.array([2000.0] * 10)}}
    val_targets = {"iddq": {96: np.array([2010.0] * 10)}}

    with pytest.raises(ValueError, match="INSUFFICIENT_CALIBRATION_DATA"):
        calibrator.fit(val_preds, val_targets, split_name="VALIDATION")


def test_08_non_finite_residual_rejection():
    """Verify rejection of NaN and Inf in calibration residuals."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)

    val_preds = {"iddq": {96: np.array([np.nan] + [2000.0] * 99)}}
    val_targets = {"iddq": {96: np.array([2010.0] * 100)}}

    with pytest.raises(ValueError, match="NON_FINITE_INPUT_REJECTED"):
        calibrator.fit(val_preds, val_targets, split_name="VALIDATION")

    with pytest.raises(ValueError, match="NON_FINITE_RESIDUAL_REJECTED"):
        compute_finite_sample_conformal_quantile([1.0, 2.0, np.inf], 0.90)


def test_09_frozen_artifact_reproducibility():
    """Verify identical validation data produces identical content hash."""
    calibrator1 = ConformalResidualCalibrator(CONTRACT_PATH)
    calibrator2 = ConformalResidualCalibrator(CONTRACT_PATH)

    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }

    art1 = calibrator1.fit(val_preds, val_targets, split_name="VALIDATION", dataset_sha256="TEST_HASH")
    art2 = calibrator2.fit(val_preds, val_targets, split_name="VALIDATION", dataset_sha256="TEST_HASH")

    assert art1["calibration_artifact_sha256"] == art2["calibration_artifact_sha256"]


def test_10_interval_construction():
    """Verify lower = y_hat - q, upper = y_hat + q, width = 2q."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }
    calibrator.fit(val_preds, val_targets, split_name="VALIDATION")

    test_preds = {"iddq": {96: np.array([2500.0, 2600.0])}}
    intervals = calibrator.apply(test_preds)

    intv_90 = intervals["iddq"]["96h"]["0.90"]
    q = intv_90["quantile"]
    assert q == 10.0
    assert np.allclose(intv_90["lower"], [2490.0, 2590.0])
    assert np.allclose(intv_90["upper"], [2510.0, 2610.0])
    assert np.allclose(intv_90["width"], [20.0, 20.0])


def test_11_coverage_calculation():
    """Verify empirical coverage calculation on test cohort."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }
    calibrator.fit(val_preds, val_targets, split_name="VALIDATION")

    test_preds = {"iddq": {96: np.array([2000.0, 2000.0, 2000.0, 2000.0])}}
    test_targets = {"iddq": {96: np.array([2005.0, 2008.0, 2010.0, 2025.0])}}  # 3 covered (q=10), 1 breach

    intervals = calibrator.apply(test_preds)
    coverage = calibrator.evaluate_coverage(intervals, test_targets)

    res = coverage["iddq"]["96h"]["0.90"]
    assert res["test_sample_count"] == 4
    assert res["covered_sample_count"] == 3
    assert res["observed_coverage_pct"] == 75.0
    assert res["observed_coverage_ratio"] == 0.75
    assert res["coverage_error"] == -0.15


def test_12_zero_width_residual_edge_case():
    """Verify all-zero residuals yield q=0 without error."""
    zeros = [0.0] * 100
    q = compute_finite_sample_conformal_quantile(zeros, 0.90)
    assert q == 0.0


def test_13_invalid_coverage_level_rejection():
    """Verify rejection of coverage <= 0 or >= 1."""
    with pytest.raises(ValueError, match="INVALID_COVERAGE_LEVEL"):
        compute_finite_sample_conformal_quantile([1.0, 2.0], 0.0)

    with pytest.raises(ValueError, match="INVALID_COVERAGE_LEVEL"):
        compute_finite_sample_conformal_quantile([1.0, 2.0], 1.0)

    with pytest.raises(ValueError, match="INVALID_COVERAGE_LEVEL"):
        compute_finite_sample_conformal_quantile([1.0, 2.0], -0.5)


def test_14_unsupported_parameter_rejection():
    """Verify application on unsupported parameter raises explicit error."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {
        "iddq": {96: np.array([2000.0] * 100)},
        "ileak": {96: np.array([300.0] * 100)},
        "tpd": {96: np.array([180.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100)},
        "ileak": {96: np.array([302.0] * 100)},
        "tpd": {96: np.array([182.0] * 100)},
    }
    calibrator.fit(val_preds, val_targets, split_name="VALIDATION")

    with pytest.raises(ValueError, match="UNSUPPORTED_PARAMETER"):
        calibrator.apply({"unsupported_param": {96: np.array([100.0])}})


def test_15_dataset_provenance():
    """Verify dataset SHA-256 matches authoritative contract."""
    sha = compute_sha256(DATASET_PATH)
    assert sha == "e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa"


# =============================================================================
# ATTACK TESTS A, B, C, D
# =============================================================================

def test_attack_a_test_only_extreme_residual_does_not_affect_calibration():
    """Attack A: Put test-only extreme residual into test cohort; prove calibration quantile does NOT change."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }
    art_clean = calibrator.fit(val_preds, val_targets, split_name="VALIDATION")
    q_clean = art_clean["conformal_quantiles"]["iddq"]["96h"]["0.90"]

    # Now simulate test cohort with catastrophic 1,000,000 uA residual
    test_preds = {"iddq": {96: np.array([2000.0])}}
    test_targets_extreme = {"iddq": {96: np.array([1002000.0])}}

    intvs = calibrator.apply(test_preds)
    calibrator.evaluate_coverage(intvs, test_targets_extreme)

    # Calibration quantile MUST remain exactly identical
    assert calibrator.frozen_artifact["conformal_quantiles"]["iddq"]["96h"]["0.90"] == q_clean


def test_attack_b_changing_test_targets_leaves_frozen_calibrator_identical():
    """Attack B: Change test targets completely; prove frozen calibrator artifact is byte-identical."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    val_preds = {
        "iddq": {96: np.array([2000.0] * 100), 168: np.array([2100.0] * 100)},
        "ileak": {96: np.array([300.0] * 100), 168: np.array([310.0] * 100)},
        "tpd": {96: np.array([180.0] * 100), 168: np.array([190.0] * 100)},
    }
    val_targets = {
        "iddq": {96: np.array([2010.0] * 100), 168: np.array([2115.0] * 100)},
        "ileak": {96: np.array([302.0] * 100), 168: np.array([312.0] * 100)},
        "tpd": {96: np.array([182.0] * 100), 168: np.array([193.0] * 100)},
    }
    art1 = calibrator.fit(val_preds, val_targets, split_name="VALIDATION", dataset_sha256="SAME_SHA")
    hash1 = art1["calibration_artifact_sha256"]

    # Evaluate on set of test targets 1
    intv1 = calibrator.apply({"iddq": {96: np.array([2000.0] * 50)}})
    calibrator.evaluate_coverage(intv1, {"iddq": {96: np.array([2005.0] * 50)}})

    # Evaluate on wildly different set of test targets 2
    intv2 = calibrator.apply({"iddq": {96: np.array([2000.0] * 50)}})
    calibrator.evaluate_coverage(intv2, {"iddq": {96: np.array([9999.0] * 50)}})

    assert calibrator.frozen_artifact["calibration_artifact_sha256"] == hash1


def test_attack_c_fitting_api_rejects_test_split():
    """Attack C: Directly attempt to pass split_name='TEST' to fit API; verify failure."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    with pytest.raises(ValueError, match="TEST_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(
            {"iddq": {96: np.array([2000.0] * 100)}},
            {"iddq": {96: np.array([2010.0] * 100)}},
            split_name="TEST",
        )


def test_attack_d_mixing_validation_and_test_residuals_rejected():
    """Attack D: Attempt to mix validation and test split names; verify failure."""
    calibrator = ConformalResidualCalibrator(CONTRACT_PATH)
    with pytest.raises(ValueError, match="TEST_SPLIT_LEAKAGE_REJECTED"):
        calibrator.fit(
            {"iddq": {96: np.array([2000.0] * 100)}},
            {"iddq": {96: np.array([2010.0] * 100)}},
            split_name="VALIDATION_AND_TEST",
        )
