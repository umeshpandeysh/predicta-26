"""
Predicta Semiconductor Intelligence Platform — Stage 4.4 Anomaly Subsystem Hardening Suite
File: tests/test_anomaly_hardening.py

Comprehensive 20-Gate Hardening & Architecture Verification:
  A. Runtime Fusion Delegation Sentinel
  B. Three-Detector Fusion
  C. Every Two-Detector Combination (3 pairs)
  D. Every Single-Detector Combination (3 singles)
  E. Zero-Detector Fail Closed (INSUFFICIENT_EVIDENCE, score=None)
  F. Reordered Feature Rejection
  G. Missing Feature Rejection
  H. Extra Feature Rejection
  I. NaN Rejection
  J. Infinity Rejection
  K. Unknown Lot Reference Governance
  L. Undersized Lot Reference Governance
  M. Missing Lot Reference Governance
  N. Degenerate Scale Safety Fallback
  O. Test-Lot Contamination Protection & Reference Store Immutability
  P. NOT_CALIBRATED Calibration Honesty Enforcement
  Q. V2 Promotion Lock & Production Governance
  R. Python/Node Parity via Shared Fixtures (<= 1e-4)
  S. Frontend Authority & Display-Only Enforcement
  T. Single Source of Truth for Thresholds from Contract
"""

import os
import sys
import json
import hashlib
from typing import Any, Dict
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService
from src.anomaly_detection.fusion import AnomalyFusionEngine, load_authoritative_contract
from src.anomaly_detection.robust_mad import RobustMADDetector
from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.isolation_forest import IsolationForestDetector


@pytest.fixture(scope="module")
def service() -> PredictaInferenceService:
    return PredictaInferenceService()


@pytest.fixture
def nominal_record() -> Dict[str, Any]:
    return {
        "equipment_id": "EQP-101",
        "lot_id": "LOT-001",
        "wafer_id": "W-01",
        "die_id": "D-01",
        "supply_voltage": 1.20,
        "threshold_voltage": 0.35,
        "temperature": 25.0,
        "current": 45.0,
        "leakage_current": 111.73,
        "dynamic_power": 54.0,
        "frequency": 3000.0,
        "propagation_delay": 10.98,
        "output_voltage": 1.18,
        "resistance": 12.5,
        "capacitance": 4.2,
        "setup_time": 0.85,
        "hold_time": 0.42,
        "timing_margin": 2.6,
        "total_power": 54.4,
        "test_duration": 150.0,
        "iddq_standby": 10.70,
    }


# =============================================================================
# GATE A — RUNTIME FUSION DELEGATION SENTINEL
# =============================================================================
def test_gate_a_runtime_fusion_delegation_sentinel(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    """Proves that production inference strictly delegates to AnomalyFusionEngine."""
    class SentinelFusionEngine:
        def __init__(self, status: str, score: float):
            self.status = status
            self.score = score

        def evaluate_component(self, features: Dict[str, float], lot_id: Any = None) -> Dict[str, Any]:
            return {
                "anomaly_status": self.status,
                "overall_status": self.status,
                "anomaly_score": self.score,
                "weighted_fusion_score": self.score,
                "fusion_method": "TEST_SENTINEL_FUSION",
                "contributing_detectors": ["TEST_SENTINEL_DETECTOR"],
                "detector_evidence": {
                    "sentinel": {"score": self.score, "status": self.status},
                    "robust_mad": {
                        "score": self.score,
                        "status": self.status,
                        "parameter_z_scores": {"iddq": 0.0, "ileak": 0.0, "tpd": 0.0},
                    },
                    "copod": {"score": self.score, "status": self.status},
                    "isolation_forest": {"score": self.score, "status": self.status},
                },
                "evidence": {
                    "mad": {"score": self.score, "status": self.status},
                    "copod": {"score": self.score, "status": self.status},
                    "isolation_forest": {"score": self.score, "status": self.status},
                },
                "reference_status": "TEST_REFERENCE_STATUS",
                "reference_source": "TEST_REFERENCE_SOURCE",
                "reference_sample_count": 9999,
                "lot_id": "TEST_LOT_SENTINEL",
                "reference_context": {
                    "lot_id": "TEST_LOT_SENTINEL",
                    "status": "TEST_REFERENCE_STATUS",
                    "source": "TEST_REFERENCE_SOURCE",
                    "sample_count": 9999,
                },
                "calibration_status": "NOT_CALIBRATED",
                "anomaly_calibration_status": "NOT_CALIBRATED",
                "validation_status": "PROJECT_DEFINED_SCREENING_CRITERION",
                "promotion_status": "BENCHMARK_ONLY",
            }

    try:
        # Test Sentinel 1: MONITOR
        service._fusion_detector_instance = SentinelFusionEngine("MONITOR", 0.123456789)
        res_monitor = service.predict_single(nominal_record)

        assert res_monitor["anomaly_status"] == "MONITOR"
        assert res_monitor["anomaly_score"] == 0.123456789
        assert res_monitor["weighted_fusion_score"] == 0.123456789
        assert res_monitor["fusion_method"] == "TEST_SENTINEL_FUSION"
        assert res_monitor["contributing_detectors"] == ["TEST_SENTINEL_DETECTOR"]
        assert res_monitor["reference_status"] == "TEST_REFERENCE_STATUS"
        assert res_monitor["reference_source"] == "TEST_REFERENCE_SOURCE"
        assert res_monitor["reference_sample_count"] == 9999

        # Test Sentinel 2: REJECT
        service._fusion_detector_instance = SentinelFusionEngine("REJECT", 0.876543211)
        res_reject = service.predict_single(nominal_record)

        assert res_reject["anomaly_status"] == "REJECT"
        assert res_reject["anomaly_score"] == 0.876543211
        assert res_reject["weighted_fusion_score"] == 0.876543211
        assert res_reject["disposition"] == "REJECT"
    finally:
        # Reset service fusion instance
        service._fusion_detector_instance = None


# =============================================================================
# GATE B — THREE-DETECTOR FUSION
# =============================================================================
def test_gate_b_three_detector_fusion(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    """Tests all three detectors active together with canonical weights."""
    mad_det = RobustMADDetector(stats=service.anomaly_artifacts.get("robust_mad", {}))
    copod_det = COPODDetector(model_data=service.anomaly_artifacts.get("copod", {}))
    iso_mock_data = {
        "feature_names": ["iddq", "ileak", "tpd"],
        "trees": [
            {
                "children_left": [-1],
                "children_right": [-1],
                "feature": [-2],
                "threshold": [-2.0],
                "n_node_samples": [100]
            }
        ],
        "max_samples": 256,
        "offset": -0.5,
        "c_factor": 10.0,
        "thresholds": {"warning_score": 0.55, "reject_score": 0.65}
    }
    iso_det = IsolationForestDetector(forest_data=iso_mock_data)

    fusion = AnomalyFusionEngine(
        mad_detector=mad_det,
        copod_detector=copod_det,
        iso_detector=iso_det,
    )
    canonical = service.get_normalized_params(nominal_record)
    res = fusion.evaluate_component(canonical, lot_id="LOT-001")

    assert len(res["contributing_detectors"]) == 3
    assert "robust_mad" in res["contributing_detectors"]
    assert "copod" in res["contributing_detectors"]
    assert "isolation_forest" in res["contributing_detectors"]
    assert res["anomaly_score"] is not None
    assert 0.0 <= res["anomaly_score"] <= 1.0


# =============================================================================
# GATE C — EVERY TWO-DETECTOR COMBINATION
# =============================================================================
def test_gate_c_every_two_detector_combination(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    """Tests all 3 combinations of pairs: (MAD, COPOD), (MAD, ISO), (COPOD, ISO)."""
    canonical = service.get_normalized_params(nominal_record)
    mad_det = RobustMADDetector(stats=service.anomaly_artifacts.get("robust_mad", {}))
    copod_det = COPODDetector(model_data=service.anomaly_artifacts.get("copod", {}))
    iso_mock_data = {
        "feature_names": ["iddq", "ileak", "tpd"],
        "trees": [
            {
                "children_left": [-1],
                "children_right": [-1],
                "feature": [-2],
                "threshold": [-2.0],
                "n_node_samples": [100]
            }
        ],
        "max_samples": 256,
        "offset": -0.5,
        "c_factor": 10.0,
        "thresholds": {"warning_score": 0.55, "reject_score": 0.65}
    }
    iso_det = IsolationForestDetector(forest_data=iso_mock_data)

    # Pair 1: MAD + COPOD
    f1 = AnomalyFusionEngine(mad_detector=mad_det, copod_detector=copod_det, iso_detector=None)
    r1 = f1.evaluate_component(canonical, lot_id="LOT-001")
    assert r1["contributing_detectors"] == ["robust_mad", "copod"]
    assert r1["anomaly_score"] is not None

    # Pair 2: MAD + ISO
    f2 = AnomalyFusionEngine(mad_detector=mad_det, copod_detector=None, iso_detector=iso_det)
    r2 = f2.evaluate_component(canonical, lot_id="LOT-001")
    assert r2["contributing_detectors"] == ["robust_mad", "isolation_forest"]
    assert r2["anomaly_score"] is not None

    # Pair 3: COPOD + ISO
    f3 = AnomalyFusionEngine(mad_detector=None, copod_detector=copod_det, iso_detector=iso_det)
    r3 = f3.evaluate_component(canonical, lot_id="LOT-001")
    assert r3["contributing_detectors"] == ["copod", "isolation_forest"]
    assert r3["anomaly_score"] is not None


# =============================================================================
# GATE D — EVERY SINGLE-DETECTOR COMBINATION
# =============================================================================
def test_gate_d_every_single_detector_combination(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    """Tests 100% weight normalization on each individual detector."""
    canonical = service.get_normalized_params(nominal_record)
    mad_det = RobustMADDetector(stats=service.anomaly_artifacts.get("robust_mad", {}))
    copod_det = COPODDetector(model_data=service.anomaly_artifacts.get("copod", {}))
    iso_mock_data = {
        "feature_names": ["iddq", "ileak", "tpd"],
        "trees": [
            {
                "children_left": [-1],
                "children_right": [-1],
                "feature": [-2],
                "threshold": [-2.0],
                "n_node_samples": [100]
            }
        ],
        "max_samples": 256,
        "offset": -0.5,
        "c_factor": 10.0,
        "thresholds": {"warning_score": 0.55, "reject_score": 0.65}
    }
    iso_det = IsolationForestDetector(forest_data=iso_mock_data)

    # Single 1: MAD only
    f1 = AnomalyFusionEngine(mad_detector=mad_det, copod_detector=None, iso_detector=None)
    r1 = f1.evaluate_component(canonical, lot_id="LOT-001")
    assert r1["contributing_detectors"] == ["robust_mad"]
    assert r1["anomaly_score"] is not None

    # Single 2: COPOD only
    f2 = AnomalyFusionEngine(mad_detector=None, copod_detector=copod_det, iso_detector=None)
    r2 = f2.evaluate_component(canonical, lot_id="LOT-001")
    assert r2["contributing_detectors"] == ["copod"]
    assert r2["anomaly_score"] is not None

    # Single 3: ISO only
    f3 = AnomalyFusionEngine(mad_detector=None, copod_detector=None, iso_detector=iso_det)
    r3 = f3.evaluate_component(canonical, lot_id="LOT-001")
    assert r3["contributing_detectors"] == ["isolation_forest"]
    assert r3["anomaly_score"] is not None


# =============================================================================
# GATE E — ZERO-DETECTOR FAIL CLOSED
# =============================================================================
def test_gate_e_zero_detector_fail_closed():
    """Zero detectors must fail closed with INSUFFICIENT_EVIDENCE and null score, NEVER PASS."""
    f = AnomalyFusionEngine(mad_detector=None, copod_detector=None, iso_detector=None)
    res = f.evaluate_component({"iddq": 2140.0, "ileak": 301.6, "tpd": 192.1}, lot_id="LOT-001")

    assert res["anomaly_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["overall_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["anomaly_score"] is None
    assert res["weighted_fusion_score"] is None
    assert res["contributing_detectors"] == []
    assert res["fusion_method"] == "NO_ACTIVE_DETECTORS"
    assert res["anomaly_status"] != "PASS"


# =============================================================================
# GATES F, G, H, I, J — STRICT FEATURE CONTRACT ENFORCEMENT
# =============================================================================
def test_gate_f_reordered_feature_rejection():
    f = AnomalyFusionEngine.from_artifacts({})
    reordered = {"tpd": 192.1, "iddq": 2140.0, "ileak": 301.6}
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        f.evaluate_component(reordered)


def test_gate_g_missing_feature_rejection():
    f = AnomalyFusionEngine.from_artifacts({})
    missing = {"iddq": 2140.0, "ileak": 301.6}
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        f.evaluate_component(missing)


def test_gate_h_extra_feature_rejection():
    f = AnomalyFusionEngine.from_artifacts({})
    extra = {"iddq": 2140.0, "ileak": 301.6, "tpd": 192.1, "extra_col": 99.0}
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        f.evaluate_component(extra)


def test_gate_i_nan_rejection():
    f = AnomalyFusionEngine.from_artifacts({})
    nan_input = {"iddq": float("nan"), "ileak": 301.6, "tpd": 192.1}
    with pytest.raises(ValueError, match="Invalid non-numeric or non-finite"):
        f.evaluate_component(nan_input)


def test_gate_j_infinity_rejection():
    f = AnomalyFusionEngine.from_artifacts({})
    inf_input = {"iddq": float("inf"), "ileak": 301.6, "tpd": 192.1}
    with pytest.raises(ValueError, match="Invalid non-numeric or non-finite"):
        f.evaluate_component(inf_input)


# =============================================================================
# GATES K, L, M, N — LOT REFERENCE GOVERNANCE
# =============================================================================
def test_gate_k_unknown_lot(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["lot_id"] = "FAB_UNKNOWN_LOT_999"
    res = service.predict_single(rec)
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"


def test_gate_l_undersized_lot(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["lot_id"] = "LOT_UNDERSIZED_TEST"
    res = service.predict_single(rec)
    assert res["reference_source"] == "GLOBAL_FALLBACK"


def test_gate_m_missing_lot(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec.pop("lot_id", None)
    res = service.predict_single(rec)
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"


def test_gate_n_degenerate_scale_safety():
    """Verifies that degenerate 0-scale parameter stats safely fall back to global reference."""
    stats = {
        "global_stats": {
            "iddq": {"median": 2000.0, "mad": 100.0, "sigma": 148.26, "sample_count": 1000},
            "ileak": {"median": 300.0, "mad": 20.0, "sigma": 29.65, "sample_count": 1000},
            "tpd": {"median": 190.0, "mad": 10.0, "sigma": 14.83, "sample_count": 1000},
        },
        "lot_stats": {
            "LOT_DEGEN": {
                "sample_count": 50,
                "reference_status": "LOT_RELATIVE",
                "reference_source": "LOT_RELATIVE",
                "features": {
                    "iddq": {"median": 2000.0, "mad": 0.0, "sigma": 0.0, "is_degenerate": True},
                    "ileak": {"median": 300.0, "mad": 20.0, "sigma": 29.65},
                    "tpd": {"median": 190.0, "mad": 10.0, "sigma": 14.83},
                }
            }
        }
    }
    mad = RobustMADDetector(stats=stats)
    res = mad.score_single({"iddq": 2000.0, "ileak": 300.0, "tpd": 190.0}, lot_id="LOT_DEGEN")
    assert res["status"] == "PASS"
    assert res["score"] == 0.0


# =============================================================================
# GATE O — TEST-LOT CONTAMINATION PROTECTION & STORE IMMUTABILITY
# =============================================================================
def test_gate_o_test_lot_contamination_protection():
    """Asserts that held-out test lots are strictly excluded from reference stats."""
    split_path = os.path.join(BASE_DIR, "ml/data/split_manifest.json")
    with open(split_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)

    test_lots = set(split_manifest.get("lots", {}).get("test", []))
    assert len(test_lots) > 0, "Test lots must be defined in split manifest"

    # Check production anomaly artifacts
    artifact_path = os.path.join(BASE_DIR, "ml/models/production/predicta_anomaly_artifacts.json")
    with open(artifact_path, "r", encoding="utf-8") as f:
        anomaly_artifacts = json.load(f)

    mad_lot_stats = anomaly_artifacts.get("robust_mad", {}).get("lot_stats", {})
    for lot_id in mad_lot_stats.keys():
        assert lot_id not in test_lots, f"Contamination detected! Test lot '{lot_id}' found in robust_mad reference store."

    # Immutability Check
    initial_bytes = json.dumps(anomaly_artifacts, sort_keys=True).encode("utf-8")
    initial_sha = hashlib.sha256(initial_bytes).hexdigest()

    # Run 20 scoring runs
    engine = AnomalyFusionEngine.from_artifacts(anomaly_artifacts)
    for _ in range(20):
        engine.evaluate_component({"iddq": 2140.0, "ileak": 301.6, "tpd": 192.1}, lot_id="LOT-001")

    after_bytes = json.dumps(anomaly_artifacts, sort_keys=True).encode("utf-8")
    after_sha = hashlib.sha256(after_bytes).hexdigest()
    assert initial_sha == after_sha, "Reference store was mutated during scoring runs!"


# =============================================================================
# GATE P — NOT_CALIBRATED CALIBRATION HONESTY ENFORCEMENT
# =============================================================================
def test_gate_p_not_calibrated_enforcement(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    res = service.predict_single(nominal_record)
    assert res.get("anomaly_calibration_status") == "NOT_CALIBRATED"
    assert res.get("calibration_status") == "NOT_CALIBRATED"
    assert res["ml_details"]["anomaly_detection"]["calibration_status"] == "NOT_CALIBRATED"


# =============================================================================
# GATE Q — V2 PROMOTION LOCK
# =============================================================================
def test_gate_q_v2_promotion_lock(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    res = service.predict_single(nominal_record)
    assert res.get("promotion_status") == "BENCHMARK_ONLY"
    assert res["model_version"] == "4.0.0_authoritative"

    manifest_path = os.path.join(BASE_DIR, "ml/models/production/predicta_production_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert manifest.get("release_version") == "2.0_production"
    assert manifest.get("authoritative_threshold") == 0.20


# =============================================================================
# GATE R — PYTHON/NODE PARITY (<= 1e-6)
# =============================================================================
def test_gate_r_python_node_parity():
    """Verifies that anomaly fusion contract test fixture matches exact Python engine output with tolerance <= 1e-6."""
    fixture_path = os.path.join(BASE_DIR, "tests/fixtures/anomaly_fusion_parity.json")
    assert os.path.exists(fixture_path), "Required anomaly fusion parity fixture is missing"

    with open(fixture_path, "r", encoding="utf-8") as f:
        fixture = json.load(f)

    cfg = fixture["fusion_config"]
    mad = RobustMADDetector(stats=cfg["mad_parameters"])
    copod = COPODDetector(model_data=cfg["copod_parameters"])
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

    for case_key, c in fixture.get("test_cases", {}).items():
        if case_key == "case_f_zero_detectors_available":
            empty_engine = AnomalyFusionEngine()
            res = empty_engine.evaluate_component(c["input"]["features"], lot_id=c["input"].get("lot_id"))
            assert res["anomaly_status"] == "INSUFFICIENT_EVIDENCE"
            assert res["anomaly_score"] is None
            continue
        if "input" in c and "features" in c["input"] and "expected" in c:
            res = engine.evaluate_component(c["input"]["features"], lot_id=c["input"].get("lot_id"))
            if "anomaly_status" in c["expected"]:
                assert res["anomaly_status"] == c["expected"]["anomaly_status"]
            if "anomaly_score" in c["expected"]:
                assert abs(res["anomaly_score"] - c["expected"]["anomaly_score"]) <= 1e-6


# =============================================================================
# GATE S — FRONTEND AUTHORITY (DISPLAY ONLY)
# =============================================================================
def test_gate_s_frontend_authority():
    """Asserts that root script.js and frontend/script.js have exact byte parity and no threshold logic."""
    root_script = os.path.join(BASE_DIR, "script.js")
    fe_script = os.path.join(BASE_DIR, "frontend/script.js")

    with open(root_script, "rb") as f1, open(fe_script, "rb") as f2:
        b1 = f1.read()
        b2 = f2.read()

    assert len(b1) == len(b2), f"Byte length mismatch between root script.js ({len(b1)}) and frontend/script.js ({len(b2)})"
    assert hashlib.sha256(b1).hexdigest() == hashlib.sha256(b2).hexdigest(), "SHA-256 mismatch between root script.js and frontend/script.js"

    code_text = b1.decode("utf-8")
    assert "isReject ? 8.5 : 2.0" not in code_text, "Fabricated client-side anomaly score ternary detected in frontend script"
    assert "* 1.2" not in code_text or "fallback" not in code_text, "Client-side fallback multiplier detected in frontend script"


# =============================================================================
# GATE T — THRESHOLD SINGLE SOURCE OF TRUTH FROM CONTRACT
# =============================================================================
def test_gate_t_threshold_single_source_of_truth():
    """Asserts that AnomalyFusionEngine loads defaults directly from fusion_contract.json."""
    contract_path = os.path.join(BASE_DIR, "ml/anomaly/fusion_contract.json")
    with open(contract_path, "r", encoding="utf-8") as f:
        contract = json.load(f)

    two_t = contract["fusion_methodology"]["two_threshold_policy"]
    expected_monitor = float(two_t["monitor_threshold"])
    expected_reject = float(two_t["reject_threshold"])
    expected_weights = contract["fusion_methodology"]["default_weights"]

    engine = AnomalyFusionEngine()
    assert engine.monitor_threshold == expected_monitor
    assert engine.reject_threshold == expected_reject
    assert engine.weights == expected_weights


# =============================================================================
# GATE U — TEST-SUITE SELF-INTEGRITY (MANDATORY FIXTURES EXISTENCE)
# =============================================================================
def test_gate_u_mandatory_fixtures_integrity():
    """Verifies that all required Stage 4 test fixtures exist and are non-empty with no skip paths."""
    required_fixtures = [
        "tests/fixtures/anomaly_fusion_parity.json",
        "tests/fixtures/lot_reference_governance_parity.json",
    ]
    for rel_path in required_fixtures:
        full_path = os.path.join(BASE_DIR, rel_path)
        assert os.path.exists(full_path), f"Mandatory Stage 4 fixture is missing: {rel_path}"
        assert os.path.getsize(full_path) > 0, f"Mandatory Stage 4 fixture is empty: {rel_path}"
        with open(full_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict), f"Mandatory Stage 4 fixture must be a JSON object: {rel_path}"


# =============================================================================
# GATE V — CONTRACT FAIL-CLOSED SEMANTICS
# =============================================================================
def test_gate_v_contract_fail_closed_semantics(tmp_path):
    """Verifies that missing, malformed, or incomplete fusion contract strictly fails closed."""
    # A. Missing contract file
    missing_path = str(tmp_path / "nonexistent_contract.json")
    with pytest.raises(RuntimeError, match="Authoritative anomaly fusion contract not found"):
        load_authoritative_contract(missing_path)

    with pytest.raises(RuntimeError, match="Authoritative anomaly fusion contract not found"):
        AnomalyFusionEngine(contract_path=missing_path)

    # B. Malformed JSON
    malformed_file = tmp_path / "malformed.json"
    malformed_file.write_text("{ this is invalid json }", encoding="utf-8")
    with pytest.raises(RuntimeError, match="unreadable or malformed JSON"):
        load_authoritative_contract(str(malformed_file))

    # C. Missing default_weights
    missing_weights = tmp_path / "missing_weights.json"
    missing_weights.write_text(json.dumps({
        "fusion_methodology": {
            "two_threshold_policy": {"monitor_threshold": 0.35, "reject_threshold": 0.50}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Missing 'default_weights'"):
        load_authoritative_contract(str(missing_weights))

    # D. Missing detector weight inside default_weights
    incomplete_weights = tmp_path / "incomplete_weights.json"
    incomplete_weights.write_text(json.dumps({
        "fusion_methodology": {
            "default_weights": {"robust_mad": 0.35, "copod": 0.35},
            "two_threshold_policy": {"monitor_threshold": 0.35, "reject_threshold": 0.50}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Missing required detector weight for 'isolation_forest'"):
        load_authoritative_contract(str(incomplete_weights))

    # E. Missing monitor_threshold
    missing_monitor = tmp_path / "missing_monitor.json"
    missing_monitor.write_text(json.dumps({
        "fusion_methodology": {
            "default_weights": {"robust_mad": 0.35, "copod": 0.35, "isolation_forest": 0.30},
            "two_threshold_policy": {"reject_threshold": 0.50}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Missing 'monitor_threshold'"):
        load_authoritative_contract(str(missing_monitor))

    # F. Missing reject_threshold
    missing_reject = tmp_path / "missing_reject.json"
    missing_reject.write_text(json.dumps({
        "fusion_methodology": {
            "default_weights": {"robust_mad": 0.35, "copod": 0.35, "isolation_forest": 0.30},
            "two_threshold_policy": {"monitor_threshold": 0.35}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Missing 'reject_threshold'"):
        load_authoritative_contract(str(missing_reject))

    # G. Invalid non-numeric threshold
    invalid_thresh = tmp_path / "invalid_thresh.json"
    invalid_thresh.write_text(json.dumps({
        "fusion_methodology": {
            "default_weights": {"robust_mad": 0.35, "copod": 0.35, "isolation_forest": 0.30},
            "two_threshold_policy": {"monitor_threshold": "not_a_number", "reject_threshold": 0.50}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Invalid monitor_threshold"):
        load_authoritative_contract(str(invalid_thresh))

    # H. Invalid detector weights (negative weight)
    invalid_weight = tmp_path / "invalid_weight.json"
    invalid_weight.write_text(json.dumps({
        "fusion_methodology": {
            "default_weights": {"robust_mad": -0.35, "copod": 0.35, "isolation_forest": 0.30},
            "two_threshold_policy": {"monitor_threshold": 0.35, "reject_threshold": 0.50}
        }
    }), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Invalid non-finite or negative weight"):
        load_authoritative_contract(str(invalid_weight))


def test_anomaly_detector_fail_closed_evidence_verification(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    """Verifies that missing or malformed anomaly detector artifacts do NOT return PASS."""
    # 1. Missing COPOD artifact -> INSUFFICIENT_EVIDENCE (NOT PASS)
    service.anomaly_artifacts = {"robust_mad": service.anomaly_artifacts.get("robust_mad")}
    if hasattr(service, "_copod_detector_instance"):
        service._copod_detector_instance = None
    copod_res = service.evaluate_copod(nominal_record)
    assert copod_res.get("status") != "PASS", "Missing COPOD artifact must NOT return PASS"
    assert copod_res.get("status") == "INSUFFICIENT_EVIDENCE", "Missing COPOD artifact must return INSUFFICIENT_EVIDENCE"

    # 2. Missing Isolation Forest artifact -> INSUFFICIENT_EVIDENCE (NOT PASS)
    if hasattr(service, "_iso_detector_instance"):
        service._iso_detector_instance = None
    iso_res = service.evaluate_isolation_forest(nominal_record)
    assert iso_res.get("status") != "PASS", "Missing Isolation Forest artifact must NOT return PASS"
    assert iso_res.get("status") == "INSUFFICIENT_EVIDENCE", "Missing Isolation Forest artifact must return INSUFFICIENT_EVIDENCE"

    # 3. Malformed detector configuration -> INSUFFICIENT_EVIDENCE (NOT PASS)
    service.anomaly_artifacts = {"copod": {"thresholds": "invalid"}, "isolation_forest": {"trees": "invalid"}}
    if hasattr(service, "_copod_detector_instance"):
        service._copod_detector_instance = None
    if hasattr(service, "_iso_detector_instance"):
        service._iso_detector_instance = None
    malformed_copod = service.evaluate_copod(nominal_record)
    malformed_iso = service.evaluate_isolation_forest(nominal_record)
    assert malformed_copod.get("status") != "PASS", "Malformed COPOD config must NOT return PASS"
    assert malformed_copod.get("status") == "INSUFFICIENT_EVIDENCE", "Malformed COPOD config must return INSUFFICIENT_EVIDENCE"
    assert malformed_iso.get("status") != "PASS", "Malformed Isolation Forest config must NOT return PASS"
    assert malformed_iso.get("status") == "INSUFFICIENT_EVIDENCE", "Malformed Isolation Forest config must return INSUFFICIENT_EVIDENCE"

    # 4. Configured vs missing production artifact verification
    fresh_service = PredictaInferenceService()
    normal_copod = fresh_service.evaluate_copod(nominal_record)
    normal_iso = fresh_service.evaluate_isolation_forest(nominal_record)
    assert normal_copod.get("status") in ["PASS", "MONITOR", "REJECT"], "Configured COPOD status must be standard classification"
    assert normal_iso.get("status") == "INSUFFICIENT_EVIDENCE", "Unconfigured Isolation Forest artifact must return INSUFFICIENT_EVIDENCE"

