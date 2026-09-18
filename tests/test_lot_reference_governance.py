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
from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.isolation_forest import IsolationForestDetector
from src.anomaly_detection.fusion import AnomalyFusionEngine

LOT_CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "anomaly", "lot_reference_contract.json")
SPLIT_MANIFEST_PATH = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
DATASET_PATH = os.path.join(BASE_DIR, "data", "synthetic", "semiconductor_synthetic_full.csv")


@pytest.fixture
def governance_test_setup():
    """Generates synthetic training reference populations for governance testing."""
    np.random.seed(42)

    # Lot A: Sufficiently populated (100 samples)
    n_a = 100
    df_a = pd.DataFrame({
        "iddq": np.random.normal(2100.0, 45.0, n_a),
        "ileak": np.random.normal(300.0, 10.0, n_a),
        "tpd": np.random.normal(190.0, 5.0, n_a),
    })
    lots_a = ["LOT-SYN-001"] * n_a

    # Lot B: Undersized (5 samples < min 10)
    n_b = 5
    df_b = pd.DataFrame({
        "iddq": np.random.normal(2100.0, 45.0, n_b),
        "ileak": np.random.normal(300.0, 10.0, n_b),
        "tpd": np.random.normal(190.0, 5.0, n_b),
    })
    lots_b = ["LOT-SYN-UNDERSIZED"] * n_b

    # Lot C: Degenerate constant feature (zero dispersion)
    n_c = 50
    df_c = pd.DataFrame({
        "iddq": [2100.0] * n_c,
        "ileak": np.random.normal(300.0, 10.0, n_c),
        "tpd": np.random.normal(190.0, 5.0, n_c),
    })
    lots_c = ["LOT-SYN-CONSTANT"] * n_c

    train_df = pd.concat([df_a, df_b, df_c], ignore_index=True)
    train_lots = pd.Series(lots_a + lots_b + lots_c)

    detector = RobustMADDetector(warning_z=3.0, reject_z=6.0, min_reference_size=10)
    detector.fit(train_df, train_lots)

    sample_component = {"iddq": 2110.0, "ileak": 302.0, "tpd": 191.0}

    return detector, sample_component, train_df, train_lots


def test_lot_reference_contract_integrity():
    """Validates authoritative lot reference contract schema and rules."""
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


def test_case_a_sufficient_known_lot(governance_test_setup):
    """CASE A: Known lot with >= min reference population -> LOT_RELATIVE."""
    detector, sample_comp, _, _ = governance_test_setup
    res = detector.score_single(sample_comp, lot_id="LOT-SYN-001")

    assert res["reference_status"] == "LOT_RELATIVE"
    assert res["reference_source"] == "LOT_RELATIVE"
    assert res["reference_sample_count"] == 100
    assert res["lot_id"] == "LOT-SYN-001"
    assert res["reference_context"]["status"] == "LOT_RELATIVE"
    assert res["reference_context"]["source"] == "LOT_RELATIVE"


def test_case_b_undersized_known_lot(governance_test_setup):
    """CASE B: Known lot with < min reference population -> INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK."""
    detector, sample_comp, _, _ = governance_test_setup
    res = detector.score_single(sample_comp, lot_id="LOT-SYN-UNDERSIZED")

    assert res["reference_status"] == "INSUFFICIENT_REFERENCE"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_sample_count"] == 5
    assert res["lot_id"] == "LOT-SYN-UNDERSIZED"


def test_case_c_unseen_lot(governance_test_setup):
    """CASE C: Completely unseen lot -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    detector, sample_comp, _, _ = governance_test_setup
    res = detector.score_single(sample_comp, lot_id="LOT-SYN-999-UNSEEN")

    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_sample_count"] == 0
    assert res["lot_id"] == "LOT-SYN-999-UNSEEN"


def test_case_d_missing_lot_id(governance_test_setup):
    """CASE D: Missing lot_id (None) -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    detector, sample_comp, _, _ = governance_test_setup
    res = detector.score_single(sample_comp, lot_id=None)

    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_sample_count"] == 0
    assert res["lot_id"] is None


def test_case_e_empty_lot_id(governance_test_setup):
    """CASE E: Empty string / whitespace lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK."""
    detector, sample_comp, _, _ = governance_test_setup
    for empty_val in ["", "   ", "nan", "None", "null"]:
        res = detector.score_single(sample_comp, lot_id=empty_val)
        assert res["reference_status"] == "UNKNOWN_LOT"
        assert res["reference_source"] == "GLOBAL_FALLBACK"
        assert res["reference_sample_count"] == 0


def test_case_f_reference_population_non_finite():
    """CASE F: Reference population containing NaN/Inf fails during fitting."""
    bad_df = pd.DataFrame({
        "iddq": [2100.0, np.nan, 2120.0] * 5,
        "ileak": [300.0, 305.0, 310.0] * 5,
        "tpd": [190.0, 191.0, 192.0] * 5,
    })
    bad_lots = pd.Series(["LOT-BAD"] * 15)
    det = RobustMADDetector()
    with pytest.raises(ValueError, match="non-finite"):
        det.fit(bad_df, bad_lots)


def test_case_g_near_zero_scale_fallback(governance_test_setup):
    """CASE G: Near-zero / zero robust scale does not divide by zero and falls back to global."""
    detector, sample_comp, _, _ = governance_test_setup
    res = detector.score_single(sample_comp, lot_id="LOT-SYN-CONSTANT")

    assert res["reference_status"] == "INSUFFICIENT_REFERENCE"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert np.isfinite(res["score"])
    assert res["score"] < 100.0


def test_case_h_deterministic_lot_relative(governance_test_setup):
    """CASE H: Normal sufficiently populated lot produces deterministic LOT_RELATIVE scoring."""
    detector, sample_comp, _, _ = governance_test_setup
    res1 = detector.score_single(sample_comp, lot_id="LOT-SYN-001")
    res2 = detector.score_single(sample_comp, lot_id="LOT-SYN-001")

    assert res1["score"] == res2["score"]
    assert res1["reference_status"] == res2["reference_status"] == "LOT_RELATIVE"
    assert res1["reference_source"] == res2["reference_source"] == "LOT_RELATIVE"
    assert res1["parameter_z_scores"] == res2["parameter_z_scores"]


def test_case_i_component_repeat_determinism(governance_test_setup):
    """CASE I: Same component/features scored twice produces identical score and provenance."""
    detector, sample_comp, _, _ = governance_test_setup
    for lot_key in ["LOT-SYN-001", "LOT-SYN-UNDERSIZED", "LOT-UNSEEN", None]:
        r1 = detector.score_single(sample_comp, lot_id=lot_key)
        r2 = detector.score_single(sample_comp, lot_id=lot_key)
        assert r1 == r2


def test_case_j_feature_reorder_rejection(governance_test_setup):
    """CASE J: Feature reorder in DataFrame or dict triggers rejection."""
    detector, _, train_df, train_lots = governance_test_setup
    reordered_df = train_df[["tpd", "iddq", "ileak"]].copy()

    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        detector.fit(reordered_df, train_lots)
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        detector.score(reordered_df)


def test_case_k_missing_feature_rejection(governance_test_setup):
    """CASE K: Missing feature triggers explicit rejection."""
    detector, _, _, _ = governance_test_setup
    missing_features = {"iddq": 2100.0, "ileak": 300.0}
    with pytest.raises(ValueError, match="Missing required canonical anomaly feature"):
        detector.score_single(missing_features)


def test_case_l_extra_feature_rejection(governance_test_setup):
    """CASE L: Extra feature triggers explicit rejection."""
    detector, _, _, _ = governance_test_setup
    extra_features = {"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0, "extra_param": 42.0}
    with pytest.raises(ValueError, match="Extra feature"):
        detector.score_single(extra_features)


def test_case_m_reference_store_immutability(governance_test_setup):
    """CASE M: Scoring components from unseen or test lots must NOT mutate detector reference store."""
    detector, sample_comp, _, _ = governance_test_setup

    # Snapshot reference state
    initial_global = copy.deepcopy(detector.global_stats)
    initial_lot = copy.deepcopy(detector.lot_stats)

    # Score 50 unseen lots
    for i in range(50):
        detector.score_single(sample_comp, lot_id=f"LOT-UNSEEN-{i:03d}")

    # Verify state is 100% bitwise unmodified
    assert detector.global_stats == initial_global
    assert detector.lot_stats == initial_lot


def test_case_n_held_out_test_lot_leakage_protection():
    """CASE N: Held-out test lots are never in reference store and execute via GLOBAL_FALLBACK."""
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

    # Prove test lots are NOT in lot_stats
    for t_lot in test_lots:
        assert t_lot not in detector.lot_stats, f"Test lot {t_lot} leaked into training reference store!"

    # Prove scoring test lot sample routes to UNKNOWN_LOT and GLOBAL_FALLBACK
    test_sample = h24[h24["lot_id"].isin(test_lots)][CANONICAL_ANOMALY_FEATURES].iloc[0].to_dict()
    test_lot_id = h24[h24["lot_id"].isin(test_lots)]["lot_id"].iloc[0]

    res = detector.score_single(test_sample, lot_id=test_lot_id)
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_sample_count"] == 0


def test_case_o_fusion_reference_provenance_propagation(governance_test_setup):
    """CASE O: Multi-Criteria Fusion engine propagates reference provenance cleanly."""
    detector, sample_comp, train_df, train_lots = governance_test_setup

    copod = COPODDetector()
    copod.fit(train_df, train_lots)

    iso = IsolationForestDetector(n_estimators=10, random_state=42)
    iso.fit(train_df, train_lots)

    fusion = AnomalyFusionEngine(
        mad_detector=detector,
        copod_detector=copod,
        iso_detector=iso,
    )

    # Known sufficient lot
    res_known = fusion.evaluate_component(sample_comp, lot_id="LOT-SYN-001")
    assert res_known["reference_status"] == "LOT_RELATIVE"
    assert res_known["reference_source"] == "LOT_RELATIVE"
    assert res_known["reference_sample_count"] == 100
    assert res_known["lot_id"] == "LOT-SYN-001"
    assert "evidence" in res_known
    assert res_known["evidence"]["mad"]["reference_source"] == "LOT_RELATIVE"

    # Unseen lot
    res_unseen = fusion.evaluate_component(sample_comp, lot_id="LOT-UNSEEN-099")
    assert res_unseen["reference_status"] == "UNKNOWN_LOT"
    assert res_unseen["reference_source"] == "GLOBAL_FALLBACK"
    assert res_unseen["reference_sample_count"] == 0
    assert res_unseen["lot_id"] == "LOT-UNSEEN-099"
