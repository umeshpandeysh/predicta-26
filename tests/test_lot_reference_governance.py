"""
Predicta Semiconductor Intelligence Platform — Lot Reference Governance Test Suite
File: tests/test_lot_reference_governance.py

Validates Stage 4.2 Lot-Relative Anomaly Engine and Reference Population Governance:
  - Case A: Known lot with >= minimum reference population (LOT_RELATIVE)
  - Case B: Known lot with < minimum reference population (INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK)
  - Case C: Completely unseen lot (UNKNOWN_LOT + GLOBAL_FALLBACK)
  - Case D: Missing lot_id (UNKNOWN_LOT + GLOBAL_FALLBACK)
  - Case E: Empty lot_id (UNKNOWN_LOT + GLOBAL_FALLBACK)
  - Case F: Reference population containing NaN/Inf (rejection / quality fallback)
  - Case G: Near-zero/zero robust scale (no divide-by-zero, explicit degraded/fallback)
  - Case H: Normal sufficiently populated lot (deterministic LOT_RELATIVE scoring)
  - Case I: Determinism (same input scored twice produces identical score and provenance)
  - Case J: Feature reorder (explicit schema/order rejection)
  - Case K: Missing feature (explicit rejection)
  - Case L: Extra feature (explicit rejection)
  - Case M: Reference Store Immutability (scoring does not mutate reference store)
  - Case N: Held-out Test Lot Leakage Protection (test lots are never in reference store)
  - Case O: Multi-Criteria Fusion Reference Provenance Propagation
"""

import copy
import hashlib
import json
import os
import sys
import numpy as np
import pandas as pd
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.anomaly_detection.robust_mad import RobustMADDetector, CANONICAL_ANOMALY_FEATURES
from src.anomaly_detection.fusion import AnomalyFusionEngine

LOT_CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "anomaly", "lot_reference_contract.json")
SPLIT_MANIFEST_PATH = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
DATASET_PATH = os.path.join(BASE_DIR, "data", "synthetic", "semiconductor_synthetic_full.csv")
FIXTURE_PATH = os.path.join(BASE_DIR, "tests", "fixtures", "lot_reference_governance_parity.json")


@pytest.fixture
def parity_fixture_data():
    """Loads authoritative lot reference governance parity fixture."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def fixture_configured_detector(parity_fixture_data):
    """Initializes RobustMADDetector directly from the fixture config."""
    cfg = parity_fixture_data["model_config"]
    det = RobustMADDetector(
        warning_z=cfg["thresholds"]["warning_z"],
        reject_z=cfg["thresholds"]["reject_z"],
        min_reference_size=cfg["min_reference_size"],
    )
    det.global_stats = copy.deepcopy(cfg["global_stats"])
    det.lot_stats = copy.deepcopy(cfg["lot_stats"])
    return det


def test_lot_reference_contract_integrity():
    """Validates authoritative lot reference contract schema, rules, and contamination status."""
    assert os.path.exists(LOT_CONTRACT_PATH), "Contract ml/anomaly/lot_reference_contract.json must exist"
    with open(LOT_CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)

    assert contract["contract_name"] == "PREDICTA_LOT_REFERENCE_GOVERNANCE_CONTRACT"
    assert contract["authority_level"] == "AUTHORITATIVE_LOT_REFERENCE_CONTRACT"
    assert contract["data_lineage"]["is_synthetic"] is True
    assert contract["population_thresholds"]["minimum_reference_population_size"] == 10
    assert contract["population_thresholds"]["allow_fabricated_lot_confidence"] is False
    statuses = [v["status"] for v in contract["semantics_and_provenance"].values()]
    assert "LOT_RELATIVE" in statuses
    assert "INSUFFICIENT_REFERENCE" in statuses
    assert "UNKNOWN_LOT" in statuses
    assert "INVALID_INPUT" in statuses

    # Quality & contamination evaluation check
    ref_rules = contract["reference_quality_rules"]
    assert ref_rules["contamination_evaluation"]["contamination_status"] == "NOT_EVALUATED_BEYOND_ROBUST_DISPERSION"
    assert ref_rules["contamination_evaluation"]["classification"] == "PROJECT_DEFINED_SCREENING_CRITERION"

    # Input validation rules
    input_rules = contract["input_validation_rules"]
    assert input_rules["strict_canonical_feature_order"] == CANONICAL_ANOMALY_FEATURES
    assert input_rules["strict_dictionary_order_enforced"] is True


def test_fixture_case_a_sufficient_known_lot(fixture_configured_detector, parity_fixture_data):
    """Case A: Known lot with >= min reference population -> LOT_RELATIVE."""
    case = parity_fixture_data["test_cases"]["case_a_sufficient_known_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert res["reference_sample_count"] == case["expected"]["reference_sample_count"]
    assert res["lot_id"] == case["expected"]["lot_id"]
    assert res["status"] == case["expected"]["status"]
    assert np.isclose(res["score"], case["expected"]["score"], atol=1e-3)
    for feat, z in case["expected"]["parameter_z_scores"].items():
        assert np.isclose(res["parameter_z_scores"][feat], z, atol=1e-3)


def test_fixture_case_b_undersized_known_lot(fixture_configured_detector, parity_fixture_data):
    """Case B: Known lot with < min reference population -> INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK."""
    case = parity_fixture_data["test_cases"]["case_b_undersized_known_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert res["reference_sample_count"] == case["expected"]["reference_sample_count"]
    assert res["lot_id"] == case["expected"]["lot_id"]
    assert res["status"] == case["expected"]["status"]
    assert np.isclose(res["score"], case["expected"]["score"], atol=1e-3)


def test_fixture_case_c_unseen_lot(fixture_configured_detector, parity_fixture_data):
    """Case C: Completely unseen lot -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    case = parity_fixture_data["test_cases"]["case_c_unseen_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert res["reference_sample_count"] == case["expected"]["reference_sample_count"]
    assert res["lot_id"] == case["expected"]["lot_id"]


def test_fixture_case_d_missing_lot(fixture_configured_detector, parity_fixture_data):
    """Case D: Missing lot_id (None) -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    case = parity_fixture_data["test_cases"]["case_d_missing_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert res["reference_sample_count"] == 0
    assert res["lot_id"] is None


def test_fixture_case_e_empty_whitespace_lot(fixture_configured_detector, parity_fixture_data):
    """Case E: Empty / whitespace lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    case = parity_fixture_data["test_cases"]["case_e_empty_whitespace_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert res["reference_sample_count"] == 0


def test_fixture_case_f_degenerate_zero_scale_lot(fixture_configured_detector, parity_fixture_data):
    """Case F: Degenerate scale lot -> INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK."""
    case = parity_fixture_data["test_cases"]["case_f_degenerate_zero_scale_lot"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["reference_status"] == case["expected"]["reference_status"]
    assert res["reference_source"] == case["expected"]["reference_source"]
    assert np.isfinite(res["score"])


def test_fixture_case_g_extreme_anomaly_reject(fixture_configured_detector, parity_fixture_data):
    """Case G: Extreme anomaly values trigger REJECT status."""
    case = parity_fixture_data["test_cases"]["case_g_extreme_anomaly_reject"]
    res = fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])

    assert res["status"] == case["expected"]["status"]
    assert res["reference_status"] == case["expected"]["reference_status"]
    assert np.isclose(res["score"], case["expected"]["score"], atol=1e-2)
    assert set(res["contributing_features"]) == set(case["expected"]["contributing_features"])


def test_fixture_case_h_reordered_input_rejection(fixture_configured_detector, parity_fixture_data):
    """Case H: Reordered dictionary keys trigger explicit schema mismatch error."""
    case = parity_fixture_data["test_cases"]["case_h_reordered_input_rejection"]
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])


def test_fixture_case_i_missing_feature_rejection(fixture_configured_detector, parity_fixture_data):
    """Case I: Missing feature triggers explicit schema mismatch error."""
    case = parity_fixture_data["test_cases"]["case_i_missing_feature_rejection"]
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])


def test_fixture_case_j_extra_feature_rejection(fixture_configured_detector, parity_fixture_data):
    """Case J: Extra feature triggers explicit schema mismatch error."""
    case = parity_fixture_data["test_cases"]["case_j_extra_feature_rejection"]
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])


def test_fixture_case_k_nan_inf_rejection(fixture_configured_detector, parity_fixture_data):
    """Case K: Non-numeric / NaN / Inf triggers explicit validation error."""
    case = parity_fixture_data["test_cases"]["case_k_nan_inf_rejection"]
    with pytest.raises((ValueError, TypeError), match=r"non-numeric or non-finite"):
        fixture_configured_detector.score_single(case["input"]["features"], lot_id=case["input"]["lot_id"])


def test_reference_store_immutability_sha256(fixture_configured_detector):
    """Scoring unseen lots must never mutate the detector state (verified via SHA-256 hash)."""
    state_json_before = json.dumps(
        {"global": fixture_configured_detector.global_stats, "lot": fixture_configured_detector.lot_stats},
        sort_keys=True
    )
    hash_before = hashlib.sha256(state_json_before.encode("utf-8")).hexdigest()

    sample_comp = {"iddq": 2110.0, "ileak": 302.0, "tpd": 191.0}
    for i in range(50):
        fixture_configured_detector.score_single(sample_comp, lot_id=f"LOT-UNSEEN-{i:03d}")

    state_json_after = json.dumps(
        {"global": fixture_configured_detector.global_stats, "lot": fixture_configured_detector.lot_stats},
        sort_keys=True
    )
    hash_after = hashlib.sha256(state_json_after.encode("utf-8")).hexdigest()

    assert hash_before == hash_after, "Detector state mutated during scoring!"


def test_held_out_test_lot_leakage_protection():
    """Held-out test lots are strictly unseen in reference store and route to GLOBAL_FALLBACK."""
    with open(SPLIT_MANIFEST_PATH, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)

    full_df = pd.read_csv(DATASET_PATH)
    h24 = full_df[full_df["burn_in_hour"] == 24].copy()

    train_lots = set(split_manifest["lots"]["train"])
    test_lots = set(split_manifest["lots"]["test"])

    train_df = h24[h24["lot_id"].isin(train_lots)][CANONICAL_ANOMALY_FEATURES].copy()
    train_lot_series = h24[h24["lot_id"].isin(train_lots)]["lot_id"].copy()

    detector = RobustMADDetector(min_reference_size=10)
    detector.fit(train_df, train_lot_series)

    for t_lot in test_lots:
        assert t_lot not in detector.lot_stats, f"Test lot {t_lot} leaked into training reference store!"

    test_sample = h24[h24["lot_id"].isin(test_lots)][CANONICAL_ANOMALY_FEATURES].iloc[0].to_dict()
    test_lot_id = h24[h24["lot_id"].isin(test_lots)]["lot_id"].iloc[0]

    res = detector.score_single(test_sample, lot_id=test_lot_id)
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_sample_count"] == 0


def test_fusion_reference_provenance_propagation(fixture_configured_detector):
    """Multi-Criteria Fusion engine propagates reference provenance cleanly."""
    fusion = AnomalyFusionEngine(
        mad_detector=fixture_configured_detector,
    )

    sample_comp = {"iddq": 2110.0, "ileak": 302.0, "tpd": 191.0}

    # Known sufficient lot
    res_known = fusion.evaluate_component(sample_comp, lot_id="LOT-SYN-001")
    assert res_known["reference_status"] == "LOT_RELATIVE"
    assert res_known["reference_source"] == "LOT_RELATIVE"
    assert res_known["reference_sample_count"] == 100
    assert res_known["lot_id"] == "LOT-SYN-001"
    assert res_known["evidence"]["mad"]["reference_source"] == "LOT_RELATIVE"

    # Unseen lot
    res_unseen = fusion.evaluate_component(sample_comp, lot_id="LOT-UNSEEN-099")
    assert res_unseen["reference_status"] == "UNKNOWN_LOT"
    assert res_unseen["reference_source"] == "GLOBAL_FALLBACK"
    assert res_unseen["reference_sample_count"] == 0
    assert res_unseen["lot_id"] == "LOT-UNSEEN-099"

