"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostic Target & Trajectory Test Suite
File: tests/test_prognostic_trajectory.py

Covers:
A. Authoritative target semantics (latent_168h_failure)
B. PASS_24H_PASS_168H
C. PASS_24H_FAIL_168H
D. FAIL_24H_FAIL_168H
E. INSUFFICIENT_HISTORY
F. Early-feature extraction
G. 168h leakage rejection
H. Future-target leakage rejection
I. Missing feature rejection
J. Extra feature rejection
K. Reordered feature dictionary rejection
L. NaN / Inf rejection
M. Incomplete trajectory handling
N. Lot-held-out split integrity
O. Component disjointness across partitions
P. Zero-positive metrics safety
Q. Validation-only threshold selection
R. Test threshold immutability
S. Deterministic reproducibility
T. Synthetic disclosure verification
U. Production-promotion lock
V. Python/Node parity against fixture (tolerance <= 1e-6)
"""

import os
import sys
import json
import math
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.prognostics.trajectory import (
    TrajectoryState,
    CANONICAL_EARLY_FEATURES,
    CANONICAL_FUTURE_FIELDS,
    FORBIDDEN_LEAKAGE_TOKENS,
    load_authoritative_prognostic_contract,
    get_authoritative_spec_limits,
    validate_early_feature_input,
    evaluate_acceptance_at_hour,
    evaluate_trajectory_state,
    extract_prognostic_record,
    build_prognostic_dataset,
    split_prognostic_dataset,
    calculate_prognostic_metrics,
    PersistenceBaseline,
    MLPrognosticBaseline
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PARITY_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "prognostic_trajectory_parity.json")
CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "prognostics", "prognostic_contract.json")
SPLIT_MANIFEST_PATH = os.path.join(PROJECT_ROOT, "ml", "data", "split_manifest.json")
DATASET_MANIFEST_PATH = os.path.join(PROJECT_ROOT, "ml", "data", "dataset_manifest.json")
DATASET_PATH = os.path.join(PROJECT_ROOT, "data", "synthetic", "semiconductor_synthetic_full.csv")


def test_01_prognostic_contract_integrity():
    """Test prognostic contract schema, version, authority, and fail-closed validation."""
    assert os.path.exists(CONTRACT_PATH), "Prognostic contract file missing"
    contract = load_authoritative_prognostic_contract(CONTRACT_PATH)

    assert contract["contract_version"] == "1.0.0"
    assert contract["authority_level"] == "AUTHORITATIVE_PROGNOSTIC_CONTRACT"
    assert contract["temporal_specification"]["prediction_horizon_hours"] == 168
    assert contract["temporal_specification"]["decision_cutoff_hour"] == 24
    assert contract["temporal_specification"]["observation_checkpoints_hours"] == [0, 24]
    assert contract["target_specification"]["target_name"] == "latent_168h_failure"
    assert contract["production_and_model_governance"]["prognostic_model_status"] == "BENCHMARK_ONLY"
    assert contract["production_and_model_governance"]["production_promotion_permitted"] is False
    assert contract["dataset_lineage"]["is_synthetic"] is True

    # Validate limits loader
    limits = get_authoritative_spec_limits(CONTRACT_PATH)
    assert limits["iddq"] == 5000.0
    assert limits["ileak"] == 500.0
    assert limits["tpd"] == 250.0

    # Fail closed on missing file
    with pytest.raises(FileNotFoundError):
        load_authoritative_prognostic_contract("non_existent_contract.json")


def test_02_pass_24h_pass_168h_healthy():
    """Test Case B: PASS at 24h and PASS at 168h -> PASS_24H_PASS_168H, latent_168h_failure = False."""
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0}
    tel_168h = {"iddq": 2050.0, "ileak": 255.0, "tpd": 192.0}
    res = evaluate_trajectory_state(tel_24h, tel_168h)

    assert res["state_24h"] == "PASS"
    assert res["state_168h"] == "PASS"
    assert res["latent_168h_failure"] is False
    assert res["trajectory_state"] == TrajectoryState.PASS_24H_PASS_168H.value


def test_03_pass_24h_fail_168h_true_latent_failure():
    """Test Case C: PASS at 24h and FAIL at 168h -> PASS_24H_FAIL_168H, latent_168h_failure = True."""
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0}
    tel_168h = {"iddq": 2200.0, "ileak": 280.0, "tpd": 265.0}  # tpd > 250.0
    res = evaluate_trajectory_state(tel_24h, tel_168h)

    assert res["state_24h"] == "PASS"
    assert res["state_168h"] == "FAIL"
    assert res["latent_168h_failure"] is True
    assert res["trajectory_state"] == TrajectoryState.PASS_24H_FAIL_168H.value


def test_04_fail_24h_fail_168h_early_failure():
    """Test Case D: FAIL at 24h and FAIL at 168h -> FAIL_24H_FAIL_168H, latent_168h_failure = False."""
    tel_24h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 260.0}  # tpd > 250.0 at 24h
    tel_168h = {"iddq": 2200.0, "ileak": 280.0, "tpd": 290.0}
    res = evaluate_trajectory_state(tel_24h, tel_168h)

    assert res["state_24h"] == "FAIL"
    assert res["state_168h"] == "FAIL"
    assert res["latent_168h_failure"] is False
    assert res["trajectory_state"] == TrajectoryState.FAIL_24H_FAIL_168H.value


def test_05_insufficient_history_handling():
    """Test Case E: Missing 24h or 168h yields INSUFFICIENT_HISTORY, latent_168h_failure = None."""
    tel_valid = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0}

    # Missing 24h
    res_no_24 = evaluate_trajectory_state(None, tel_valid)
    assert res_no_24["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value
    assert res_no_24["latent_168h_failure"] is None

    # Missing 168h
    res_no_168 = evaluate_trajectory_state(tel_valid, None)
    assert res_no_168["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value
    assert res_no_168["latent_168h_failure"] is None


def test_06_early_feature_extraction():
    """Test Case F: Extract canonical early features cleanly without future contamination."""
    row_0h = {"iddq": 2000.0, "ileak": 250.0, "tpd": 190.0, "lot_id": "LOT-SYN-001"}
    row_24h = {"iddq": 2100.0, "ileak": 260.0, "tpd": 195.0, "lot_id": "LOT-SYN-001"}
    row_168h = {"iddq": 2150.0, "ileak": 270.0, "tpd": 200.0, "lot_id": "LOT-SYN-001"}

    rec = extract_prognostic_record(row_0h, row_24h, row_168h, "COMP-TEST-001")

    # Verify structural separation
    assert "early_features" in rec
    assert "future_ground_truth" in rec
    assert "metadata" in rec

    ef = rec["early_features"]
    assert list(ef.keys()) == CANONICAL_EARLY_FEATURES
    assert ef["iddq_0h"] == 2000.0
    assert ef["iddq_24h"] == 2100.0
    assert ef["iddq_drift_24h"] == 100.0
    assert ef["tpd_drift_24h"] == 5.0

    # Ensure no future fields in early features
    for k in ef.keys():
        for token in FORBIDDEN_LEAKAGE_TOKENS:
            assert token not in k.lower(), f"Leakage token '{token}' in early feature key '{k}'"


def test_07_direct_168h_leakage_rejection():
    """Test Case G: Model input validator rejects 168h future features."""
    valid_features = {
        "iddq_0h": 2000.0, "ileak_0h": 250.0, "tpd_0h": 190.0,
        "iddq_24h": 2100.0, "ileak_24h": 260.0, "tpd_24h": 195.0,
        "iddq_drift_24h": 100.0, "ileak_drift_24h": 10.0, "tpd_drift_24h": 5.0
    }

    # Valid passes
    arr = validate_early_feature_input(valid_features)
    assert arr.shape == (9,)

    # Injecting 168h telemetry must raise TEMPORAL_LEAKAGE_DETECTED
    leaky_features = dict(valid_features)
    leaky_features["tpd_168h"] = 250.0
    with pytest.raises(ValueError, match="TEMPORAL_LEAKAGE_DETECTED"):
        validate_early_feature_input(leaky_features)


def test_08_target_leakage_rejection():
    """Test Case H: Model input validator rejects target labels in feature dict."""
    valid_features = {
        "iddq_0h": 2000.0, "ileak_0h": 250.0, "tpd_0h": 190.0,
        "iddq_24h": 2100.0, "ileak_24h": 260.0, "tpd_24h": 195.0,
        "iddq_drift_24h": 100.0, "ileak_drift_24h": 10.0, "tpd_drift_24h": 5.0
    }

    leaky = dict(valid_features)
    leaky["latent_168h_failure"] = 1.0
    with pytest.raises(ValueError, match="TEMPORAL_LEAKAGE_DETECTED|EXTRA_FEATURE_DETECTED"):
        validate_early_feature_input(leaky)


def test_09_missing_and_extra_feature_rejection():
    """Test Cases I & J: Validator rejects missing and extra features."""
    valid_features = {
        "iddq_0h": 2000.0, "ileak_0h": 250.0, "tpd_0h": 190.0,
        "iddq_24h": 2100.0, "ileak_24h": 260.0, "tpd_24h": 195.0,
        "iddq_drift_24h": 100.0, "ileak_drift_24h": 10.0, "tpd_drift_24h": 5.0
    }

    # Missing
    missing = dict(valid_features)
    del missing["tpd_drift_24h"]
    with pytest.raises(ValueError, match="MISSING_REQUIRED_FEATURE"):
        validate_early_feature_input(missing)

    # Extra
    extra = dict(valid_features)
    extra["temperature_c"] = 85.0
    with pytest.raises(ValueError, match="EXTRA_FEATURE_DETECTED"):
        validate_early_feature_input(extra)


def test_10_reordered_feature_dict_rejection():
    """Test Case K: Reordered dictionary keys must fail with SCHEMA_ORDER_MISMATCH."""
    reordered = {
        "tpd_drift_24h": 5.0,
        "iddq_0h": 2000.0, "ileak_0h": 250.0, "tpd_0h": 190.0,
        "iddq_24h": 2100.0, "ileak_24h": 260.0, "tpd_24h": 195.0,
        "iddq_drift_24h": 100.0, "ileak_drift_24h": 10.0
    }
    with pytest.raises(ValueError, match="SCHEMA_ORDER_MISMATCH"):
        validate_early_feature_input(reordered)


def test_11_nan_inf_non_numeric_rejection():
    """Test Case L: NaN, Inf, and non-numeric values must fail with explicit errors."""
    valid_features = {
        "iddq_0h": 2000.0, "ileak_0h": 250.0, "tpd_0h": 190.0,
        "iddq_24h": 2100.0, "ileak_24h": 260.0, "tpd_24h": 195.0,
        "iddq_drift_24h": 100.0, "ileak_drift_24h": 10.0, "tpd_drift_24h": 5.0
    }

    # NaN
    nan_dict = dict(valid_features)
    nan_dict["tpd_0h"] = np.nan
    with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
        validate_early_feature_input(nan_dict)

    # Inf
    inf_dict = dict(valid_features)
    inf_dict["iddq_24h"] = np.inf
    with pytest.raises(ValueError, match="NON_FINITE_VALUE"):
        validate_early_feature_input(inf_dict)

    # String
    str_dict = dict(valid_features)
    str_dict["ileak_0h"] = "INVALID"
    with pytest.raises(ValueError, match="INVALID_NUMERIC_VALUE"):
        validate_early_feature_input(str_dict)


def test_12_lot_held_out_split_and_component_disjointness_and_completeness():
    """Test Cases N & O: Verify lot-held-out splits, 100% record completeness, and zero component overlap."""
    assert os.path.exists(DATASET_PATH), f"Dataset file missing at {DATASET_PATH}"
    assert os.path.exists(SPLIT_MANIFEST_PATH), f"Split manifest missing at {SPLIT_MANIFEST_PATH}"

    records = build_prognostic_dataset(DATASET_PATH)
    assert len(records) == 5000, f"Expected 5000 components, got {len(records)}"

    splits = split_prognostic_dataset(records, SPLIT_MANIFEST_PATH)
    train_recs = splits["train"]
    val_tune_recs = splits["validation_tune"]
    calib_recs = splits["calibration"]
    test_recs = splits["test"]

    assert len(train_recs) == 3500
    assert len(val_tune_recs) == 300
    assert len(calib_recs) == 400
    assert len(test_recs) == 800
    assert len(train_recs) + len(val_tune_recs) + len(calib_recs) + len(test_recs) == len(records)

    train_comps = {r["metadata"]["component_id"] for r in train_recs}
    val_comps = {r["metadata"]["component_id"] for r in val_tune_recs}
    calib_comps = {r["metadata"]["component_id"] for r in calib_recs}
    test_comps = {r["metadata"]["component_id"] for r in test_recs}

    assert train_comps.isdisjoint(val_comps)
    assert train_comps.isdisjoint(calib_comps)
    assert train_comps.isdisjoint(test_comps)
    assert val_comps.isdisjoint(calib_comps)
    assert val_comps.isdisjoint(test_comps)
    assert calib_comps.isdisjoint(test_comps)

    # Rejection of unknown lot
    bad_records = [dict(records[0])]
    bad_records[0] = {
        "metadata": {"component_id": "COMP-BAD-01", "lot_id": "LOT-UNKNOWN-999"},
        "early_features": records[0]["early_features"],
        "future_ground_truth": records[0]["future_ground_truth"]
    }
    with pytest.raises(ValueError, match="UNKNOWN_LOT_DETECTED"):
        split_prognostic_dataset(bad_records, SPLIT_MANIFEST_PATH)

    # Rejection of duplicate component
    dup_records = [records[0], records[0]]
    with pytest.raises(ValueError, match="DUPLICATE_COMPONENT_DETECTED"):
        split_prognostic_dataset(dup_records, SPLIT_MANIFEST_PATH)


def test_13_zero_positive_metrics_safety():
    """Test Case P: Zero-positive test sets compute safely without crash or NaN."""
    y_zeros = np.zeros(10, dtype=int)
    probs = np.linspace(0.1, 0.9, 10)
    m = calculate_prognostic_metrics(y_zeros, probs, threshold=0.5)

    assert m["latent_recall"] == 0.0
    assert m["latent_false_negative_rate"] == 0.0
    assert m["latent_precision"] == 0.0
    assert not math.isnan(m["latent_f1_score"])
    assert not math.isnan(m["latent_f2_score"])
    assert m["support"]["positives"] == 0
    assert m["support"]["total"] == 10


def test_14_validation_only_threshold_governance_and_test_immutability():
    """Test Cases Q & R: Threshold must be tuned on validation set, frozen, and test tuning rejected."""
    assert os.path.exists(DATASET_PATH), f"Dataset file missing at {DATASET_PATH}"
    records = build_prognostic_dataset(DATASET_PATH)
    splits = split_prognostic_dataset(records, SPLIT_MANIFEST_PATH)
    train_recs = splits["train"]
    val_tune_recs = splits["validation_tune"]
    test_recs = splits["test"]

    def extract_xy(recs):
        X = np.array([list(r["early_features"].values()) for r in recs])
        y = np.array([int(r["future_ground_truth"]["latent_168h_failure"]) for r in recs])
        return X, y

    X_train, y_train = extract_xy(train_recs)
    X_val, y_val = extract_xy(val_tune_recs)
    X_test, y_test = extract_xy(test_recs)

    model = MLPrognosticBaseline(random_state=42)

    # Attempting to evaluate frozen test before fitting/tuning must fail
    with pytest.raises(RuntimeError):
        model.evaluate_frozen_test(X_test, y_test)

    model.fit(X_train, y_train)

    # Attempting to evaluate frozen test before tuning must fail
    with pytest.raises(RuntimeError, match="THRESHOLD_NOT_FROZEN"):
        model.evaluate_frozen_test(X_test, y_test)

    opt_th = model.tune_threshold_on_validation(X_val, y_val, metric="f2")
    assert 0.0 < opt_th < 1.0
    assert model.is_threshold_frozen is True

    # Test evaluation uses the frozen validation threshold
    test_metrics = model.evaluate_frozen_test(X_test, y_test)
    assert test_metrics["operating_threshold"] == opt_th
    assert test_metrics["latent_recall"] > 0.50
    assert test_metrics["latent_f2_score"] > 0.0

    # Attempting to tune on test data must fail closed
    with pytest.raises(ValueError, match="TEST_SET_THRESHOLD_TUNING_FORBIDDEN"):
        model.evaluate_frozen_test(X_test, y_test, tune_on_test=True)


def test_15_python_node_parity_fixture():
    """Test Case V: Verify exact parity against fixture (tolerance <= 1e-6)."""
    assert os.path.exists(PARITY_FIXTURE_PATH), f"Parity fixture missing at {PARITY_FIXTURE_PATH}"
    with open(PARITY_FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture = json.load(f)

    cases = fixture["cases"]

    # Cases A - F
    for case_id in ["case_a_nominal_healthy", "case_b_true_latent_failure", "case_c_early_failure", "case_d_early_fail_recovery", "case_e_missing_24h", "case_f_missing_168h"]:
        c = cases[case_id]
        res = evaluate_trajectory_state(c["row_24h"], c["row_168h"])
        exp = c["expected"]
        assert res["state_24h"] == exp["state_24h"], f"{case_id} state_24h mismatch"
        assert res["state_168h"] == exp["state_168h"], f"{case_id} state_168h mismatch"
        assert res["latent_168h_failure"] == exp["latent_168h_failure"], f"{case_id} latent_168h_failure mismatch"
        assert res["trajectory_state"] == exp["trajectory_state"], f"{case_id} trajectory_state mismatch"

    # Case G: early feature extraction
    cg = cases["case_g_early_feature_extraction"]
    rec = extract_prognostic_record(cg["row_0h"], cg["row_24h"], cg["row_168h"], "COMP-0007")
    exp_ef = cg["expected_early_features"]
    for k, v in exp_ef.items():
        assert abs(rec["early_features"][k] - v) <= 1e-6, f"Feature {k} parity mismatch: {rec['early_features'][k]} vs {v}"

    # Case H: metrics calculation
    ch = cases["case_h_metrics_calculation"]
    y_true = np.array(ch["y_true"])
    y_prob = np.array(ch["y_pred_prob"])
    m_calc = calculate_prognostic_metrics(y_true, y_prob, threshold=ch["threshold"])
    exp_m = ch["expected_metrics"]

    assert m_calc["support"] == exp_m["support"]
    assert m_calc["confusion_matrix"] == exp_m["confusion_matrix"]
    assert abs(m_calc["latent_recall"] - exp_m["latent_recall"]) <= 1e-6
    assert abs(m_calc["latent_false_negative_rate"] - exp_m["latent_false_negative_rate"]) <= 1e-6
    assert abs(m_calc["latent_precision"] - exp_m["latent_precision"]) <= 1e-6
    assert abs(m_calc["latent_f1_score"] - exp_m["latent_f1_score"]) <= 1e-6
    assert abs(m_calc["latent_f2_score"] - exp_m["latent_f2_score"]) <= 1e-6
    assert abs(m_calc["specificity"] - exp_m["specificity"]) <= 1e-6


def test_16_persistence_baseline_constant_zero_semantics():
    """Test persistence constant zero baseline predictions and exact metric calculation."""
    pers = PersistenceBaseline()
    assert pers.algorithm == "PERSISTENCE_CONSTANT_ZERO"
    assert pers.status == "BENCHMARK_ONLY"

    records = build_prognostic_dataset(DATASET_PATH)
    test_recs = split_prognostic_dataset(records, SPLIT_MANIFEST_PATH)["test"]
    X_test = np.array([list(r["early_features"].values()) for r in test_recs])
    y_test = np.array([int(r["future_ground_truth"]["latent_168h_failure"]) for r in test_recs])

    probs = pers.predict_proba(X_test)
    assert len(probs) == 800
    assert np.all(probs == 0.0)

    m = calculate_prognostic_metrics(y_test, probs, threshold=0.50)
    assert m["latent_recall"] == 0.0
    assert m["latent_false_negative_rate"] == 1.0
    assert m["latent_precision"] == 0.0
    assert m["latent_f1_score"] == 0.0
    assert m["latent_f2_score"] == 0.0
    assert m["specificity"] == 1.0
    assert m["confusion_matrix"] == {"tn": 781, "fp": 0, "fn": 19, "tp": 0}


def test_17_deterministic_reproducibility():
    """Test that two independent evaluation runs yield identical thresholds and test metrics."""
    records_1 = build_prognostic_dataset(DATASET_PATH)
    splits_1 = split_prognostic_dataset(records_1, SPLIT_MANIFEST_PATH)
    train_1, val_1, test_1 = splits_1["train"], splits_1["validation_tune"], splits_1["test"]

    def extract_xy(recs):
        X = np.array([list(r["early_features"].values()) for r in recs])
        y = np.array([int(r["future_ground_truth"]["latent_168h_failure"]) for r in recs])
        return X, y

    X_train1, y_train1 = extract_xy(train_1)
    X_val1, y_val1 = extract_xy(val_1)
    X_test1, y_test1 = extract_xy(test_1)

    m1 = MLPrognosticBaseline(random_state=42)
    m1.fit(X_train1, y_train1)
    th1 = m1.tune_threshold_on_validation(X_val1, y_val1, metric="f2")
    res1 = m1.evaluate_frozen_test(X_test1, y_test1)

    # Second Run
    records_2 = build_prognostic_dataset(DATASET_PATH)
    splits_2 = split_prognostic_dataset(records_2, SPLIT_MANIFEST_PATH)
    train_2, val_2, test_2 = splits_2["train"], splits_2["validation_tune"], splits_2["test"]

    X_train2, y_train2 = extract_xy(train_2)
    X_val2, y_val2 = extract_xy(val_2)
    X_test2, y_test2 = extract_xy(test_2)

    m2 = MLPrognosticBaseline(random_state=42)
    m2.fit(X_train2, y_train2)
    th2 = m2.tune_threshold_on_validation(X_val2, y_val2, metric="f2")
    res2 = m2.evaluate_frozen_test(X_test2, y_test2)

    assert th1 == th2
    assert res1["operating_threshold"] == res2["operating_threshold"]
    assert res1["confusion_matrix"] == res2["confusion_matrix"]
    assert res1["latent_recall"] == res2["latent_recall"]
    assert res1["latent_false_negative_rate"] == res2["latent_false_negative_rate"]
    assert res1["latent_precision"] == res2["latent_precision"]
    assert res1["latent_f1_score"] == res2["latent_f1_score"]
    assert res1["latent_f2_score"] == res2["latent_f2_score"]
    assert res1["specificity"] == res2["specificity"]
    assert res1["pr_auc"] == res2["pr_auc"]
    assert res1["roc_auc"] == res2["roc_auc"]
    assert res1["support"] == res2["support"]


def test_18_spec_limits_authoritative_contract_enforcement():
    """Test that evaluate_acceptance_at_hour loads and enforces contract specification limits."""
    # Canonical future fields count
    assert len(CANONICAL_FUTURE_FIELDS) == 5

    # Nominal acceptable telemetry at 24h
    is_acc, reason = evaluate_acceptance_at_hour({"iddq": 2000.0, "ileak": 200.0, "tpd": 190.0}, 24)
    assert is_acc is True
    assert "ACCEPTABLE" in reason

    # Out of limit iddq (> 5000 uA)
    is_acc_fail, reason_fail = evaluate_acceptance_at_hour({"iddq": 6000.0, "ileak": 200.0, "tpd": 190.0}, 24)
    assert is_acc_fail is False
    assert "IDDQ_EXCEEDED" in reason_fail

