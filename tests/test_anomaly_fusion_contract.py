"""
Predicta Semiconductor Intelligence Platform — Anomaly Fusion Contract Test Suite
File: tests/test_anomaly_fusion_contract.py

Validates Stage 4.3 Authoritative Anomaly Fusion + Calibration/Decision Semantics:
  - Fusion Contract Schema & Integrity (ml/anomaly/fusion_contract.json)
  - Parity Fixture Validation across All Edge Cases (tests/fixtures/anomaly_fusion_parity.json)
  - Two-Threshold Decision Semantics (MONITOR_THRESHOLD vs REJECT_THRESHOLD)
  - Dynamic Weight Re-normalization with Missing Detectors
  - Fail-Closed Zero-Detectors Behavior (NEVER return PASS)
  - Reference Context & Lot Provenance Propagation
  - Pure Immutability and No Contamination
  - Explicit NOT_CALIBRATED and Synthetic Data Governance Disclosures
"""

import copy
import hashlib
import json
import os
import sys
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.anomaly_detection.robust_mad import RobustMADDetector
from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.isolation_forest import IsolationForestDetector
from src.anomaly_detection.fusion import AnomalyFusionEngine
from src.anomaly_detection.normalization import normalize_detector_score

FUSION_CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "anomaly", "fusion_contract.json")
FIXTURE_PATH = os.path.join(BASE_DIR, "tests", "fixtures", "anomaly_fusion_parity.json")


@pytest.fixture
def fusion_fixture_data():
    """Loads authoritative anomaly fusion parity fixture."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def configured_fusion_engine(fusion_fixture_data):
    """Initializes AnomalyFusionEngine from fixture configuration."""
    cfg = fusion_fixture_data["fusion_config"]

    mad = RobustMADDetector(
        warning_z=cfg["mad_parameters"]["thresholds"]["warning_z"],
        reject_z=cfg["mad_parameters"]["thresholds"]["reject_z"],
        min_reference_size=cfg["mad_parameters"]["min_reference_size"],
    )
    mad.global_stats = copy.deepcopy(cfg["mad_parameters"]["global_stats"])
    mad.lot_stats = copy.deepcopy(cfg["mad_parameters"]["lot_stats"])

    copod = COPODDetector(
        warning_score=cfg["copod_parameters"]["thresholds"]["warning_score"],
        reject_score=cfg["copod_parameters"]["thresholds"]["reject_score"],
    )
    copod.global_ecdfs = copy.deepcopy(cfg["copod_parameters"]["global_ecdfs"])

    iso = IsolationForestDetector(forest_data=cfg["isolation_forest_parameters"])

    engine = AnomalyFusionEngine(
        mad_detector=mad,
        copod_detector=copod,
        iso_detector=iso,
        weights=cfg["weights"],
        monitor_threshold=cfg["monitor_threshold"],
        reject_threshold=cfg["reject_threshold"],
        norm_scales=cfg["normalization_scales"],
    )
    return engine


def test_fusion_contract_integrity():
    """Validates authoritative fusion contract structure and calibration honesty."""
    assert os.path.exists(FUSION_CONTRACT_PATH), "Contract ml/anomaly/fusion_contract.json must exist"
    with open(FUSION_CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)

    assert contract["contract_name"] == "PREDICTA_ANOMALY_FUSION_CONTRACT"
    assert contract["authority_level"] == "AUTHORITATIVE_ANOMALY_FUSION_CONTRACT"
    assert contract["data_governance"]["is_synthetic"] is True
    assert contract["calibration_and_validation_governance"]["calibration_status"] == "NOT_CALIBRATED"
    assert contract["calibration_and_validation_governance"]["promotion_status"] == "BENCHMARK_ONLY"
    assert contract["calibration_and_validation_governance"]["probability_claims_permitted"] is False

    detectors = contract["canonical_detectors"]
    assert "robust_mad" in detectors
    assert "copod" in detectors
    assert "isolation_forest" in detectors
    for d in detectors.values():
        assert d["score_direction"] == "HIGHER_IS_MORE_ANOMALOUS"

    decision_policy = contract["fusion_methodology"]["two_threshold_policy"]
    assert decision_policy["policy_classification"] == "PROJECT_DEFINED_SCREENING_CRITERION"
    assert decision_policy["monitor_threshold"] == 0.35
    assert decision_policy["reject_threshold"] == 0.50

    zero_policy = contract["fusion_methodology"]["zero_detectors_available_policy"]
    assert zero_policy["allow_pass"] is False
    assert zero_policy["status"] == "INSUFFICIENT_EVIDENCE"


def test_normalization_monotonicity_and_bounds():
    """Validates that normalization produces strictly bounded and monotonic scores."""
    assert normalize_detector_score("robust_mad", 0.0) == 0.0
    assert normalize_detector_score("robust_mad", 3.0) == 0.50
    assert normalize_detector_score("robust_mad", 6.0) == 1.0
    assert normalize_detector_score("robust_mad", 12.0) == 1.0

    assert normalize_detector_score("copod", 0.0) == 0.0
    assert normalize_detector_score("copod", 9.5) == 1.0
    assert normalize_detector_score("copod", 20.0) == 1.0

    assert normalize_detector_score("isolation_forest", 0.35) == 0.0
    assert normalize_detector_score("isolation_forest", 0.40) == 0.0
    assert normalize_detector_score("isolation_forest", 0.55) == 0.50
    assert normalize_detector_score("isolation_forest", 0.70) == 1.0
    assert normalize_detector_score("isolation_forest", 0.95) == 1.0


def test_case_a_nominal_all_detectors(configured_fusion_engine, fusion_fixture_data):
    """Case A: All detectors active with nominal input -> PASS."""
    c = fusion_fixture_data["test_cases"]["case_a_nominal_all_detectors"]
    res = configured_fusion_engine.evaluate_component(c["input"]["features"], lot_id=c["input"]["lot_id"])

    assert res["anomaly_status"] == c["expected"]["anomaly_status"]
    assert res["reference_status"] == c["expected"]["reference_status"]
    assert res["reference_source"] == c["expected"]["reference_source"]
    assert set(res["contributing_detectors"]) == set(c["expected"]["contributing_detectors"])
    assert res["calibration_status"] == "NOT_CALIBRATED"
    assert res["validation_status"] == "PROJECT_DEFINED_SCREENING_CRITERION"
    assert res["promotion_status"] == "BENCHMARK_ONLY"
    assert "robust_mad" in res["detector_evidence"]
    assert "copod" in res["detector_evidence"]
    assert "isolation_forest" in res["detector_evidence"]


def test_cases_b_c_d_e_missing_detectors_dynamic_weighting(configured_fusion_engine):
    """Cases B-E: Dynamic weight re-normalization when subset of detectors is active."""
    comp = {"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}

    # Case B: MAD unavailable (copod + iso)
    eng_b = AnomalyFusionEngine(
        copod_detector=configured_fusion_engine.copod_detector,
        iso_detector=configured_fusion_engine.iso_detector,
    )
    res_b = eng_b.evaluate_component(comp, lot_id="LOT-SYN-001")
    assert res_b["contributing_detectors"] == ["copod", "isolation_forest"]
    assert res_b["anomaly_status"] == "PASS"

    # Case C: COPOD unavailable (mad + iso)
    eng_c = AnomalyFusionEngine(
        mad_detector=configured_fusion_engine.mad_detector,
        iso_detector=configured_fusion_engine.iso_detector,
    )
    res_c = eng_c.evaluate_component(comp, lot_id="LOT-SYN-001")
    assert res_c["contributing_detectors"] == ["robust_mad", "isolation_forest"]
    assert res_c["reference_status"] == "LOT_RELATIVE"

    # Case D: ISO unavailable (mad + copod)
    eng_d = AnomalyFusionEngine(
        mad_detector=configured_fusion_engine.mad_detector,
        copod_detector=configured_fusion_engine.copod_detector,
    )
    res_d = eng_d.evaluate_component(comp, lot_id="LOT-SYN-001")
    assert res_d["contributing_detectors"] == ["robust_mad", "copod"]

    # Case E: Only MAD active
    eng_e = AnomalyFusionEngine(
        mad_detector=configured_fusion_engine.mad_detector,
    )
    res_e = eng_e.evaluate_component(comp, lot_id="LOT-SYN-001")
    assert res_e["contributing_detectors"] == ["robust_mad"]


def test_case_f_zero_detectors_fail_closed():
    """Case F: Zero detectors active must NEVER return PASS; emits INSUFFICIENT_EVIDENCE."""
    empty_engine = AnomalyFusionEngine()
    comp = {"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}

    res = empty_engine.evaluate_component(comp, lot_id="LOT-SYN-001")
    assert res["anomaly_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["overall_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["anomaly_score"] is None
    assert res["fusion_method"] == "NO_ACTIVE_DETECTORS"
    assert res["contributing_detectors"] == []
    assert res["reference_status"] == "INSUFFICIENT_EVIDENCE"


def test_cases_g_h_i_j_lot_reference_provenance(configured_fusion_engine, fusion_fixture_data):
    """Cases G-J: Lot reference provenance propagation (Undersized, Unseen, Missing, Constant)."""
    cases = fusion_fixture_data["test_cases"]

    # Undersized
    res_g = configured_fusion_engine.evaluate_component(cases["case_g_undersized_known_lot"]["input"]["features"], lot_id="LOT-SYN-UNDERSIZED")
    assert res_g["reference_status"] == "INSUFFICIENT_REFERENCE"
    assert res_g["reference_source"] == "GLOBAL_FALLBACK"
    assert res_g["reference_sample_count"] == 5

    # Unseen
    res_h = configured_fusion_engine.evaluate_component(cases["case_h_unseen_lot"]["input"]["features"], lot_id="LOT-UNSEEN-999")
    assert res_h["reference_status"] == "UNKNOWN_LOT"
    assert res_h["reference_source"] == "GLOBAL_FALLBACK"
    assert res_h["reference_sample_count"] == 0

    # Missing
    res_i = configured_fusion_engine.evaluate_component(cases["case_i_missing_lot"]["input"]["features"], lot_id=None)
    assert res_i["reference_status"] == "UNKNOWN_LOT"
    assert res_i["reference_source"] == "GLOBAL_FALLBACK"

    # Constant / Degenerate
    res_j = configured_fusion_engine.evaluate_component(cases["case_j_degenerate_constant_lot"]["input"]["features"], lot_id="LOT-SYN-CONSTANT")
    assert res_j["reference_status"] == "INSUFFICIENT_REFERENCE"
    assert res_j["reference_source"] == "GLOBAL_FALLBACK"


def test_case_k_extreme_anomaly_reject(configured_fusion_engine, fusion_fixture_data):
    """Case K: Extreme anomaly triggers REJECT status and conservative alarm."""
    c = fusion_fixture_data["test_cases"]["case_k_extreme_anomaly_reject"]
    res = configured_fusion_engine.evaluate_component(c["input"]["features"], lot_id=c["input"]["lot_id"])

    assert res["anomaly_status"] == "REJECT"
    assert res["overall_status"] == "REJECT"
    assert res["conservative_alarm"] is True
    assert res["weighted_fusion_score"] >= 0.50


def test_cases_l_m_n_o_input_rejections(configured_fusion_engine, fusion_fixture_data):
    """Cases L-O: Strict rejection on reordered keys, missing keys, extra keys, and non-finite values."""
    cases = fusion_fixture_data["test_cases"]

    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        configured_fusion_engine.evaluate_component(cases["case_l_reordered_features_rejection"]["input"]["features"])

    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        configured_fusion_engine.evaluate_component(cases["case_m_missing_feature_rejection"]["input"]["features"])

    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        configured_fusion_engine.evaluate_component(cases["case_n_extra_feature_rejection"]["input"]["features"])

    with pytest.raises((ValueError, TypeError), match="non-numeric or non-finite"):
        configured_fusion_engine.evaluate_component(cases["case_o_nan_inf_rejection"]["input"]["features"])


def test_fusion_immutability_sha256(configured_fusion_engine):
    """Validates that scoring components does not mutate detector states (SHA-256 hash)."""
    params_before = json.dumps(configured_fusion_engine.export_parameters(), sort_keys=True)
    hash_before = hashlib.sha256(params_before.encode("utf-8")).hexdigest()

    sample = {"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}
    for i in range(50):
        configured_fusion_engine.evaluate_component(sample, lot_id=f"LOT-EVAL-{i:03d}")

    params_after = json.dumps(configured_fusion_engine.export_parameters(), sort_keys=True)
    hash_after = hashlib.sha256(params_after.encode("utf-8")).hexdigest()

    assert hash_before == hash_after, "AnomalyFusionEngine internal state mutated during evaluation!"
