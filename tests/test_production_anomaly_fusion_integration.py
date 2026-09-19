"""
Predicta Semiconductor Intelligence Platform — Production Anomaly Fusion Integration Tests
File: tests/test_production_anomaly_fusion_integration.py

Verifies that production inference strictly routes through the authoritative anomaly fusion engine
and produces identical anomaly_status, score, and provenance to AnomalyFusionEngine across:
  A. Nominal
  B. Monitor
  C. Reject
  D. Unknown lot
  E. Undersized lot
  F. Missing lot
  G. One detector unavailable
  H. Two detectors unavailable
  I. Zero detectors available (Fail-closed INSUFFICIENT_EVIDENCE)
  J. Reordered feature input rejection
  K. Malformed numeric input rejection
  L. Explicit non-calibration governance
"""

import os
import sys
from typing import Any, Dict
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService
from src.anomaly_detection.fusion import AnomalyFusionEngine
from src.anomaly_detection.normalization import CALIBRATION_STATUS, VALIDATION_STATUS


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


def test_case_a_nominal_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    res = service.predict_single(nominal_record)
    canonical = service.get_normalized_params(nominal_record)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id="LOT-001")

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["anomaly_score"] == fusion_res["anomaly_score"]
    assert res["overall_status"] == fusion_res["overall_status"]
    assert res["anomaly_calibration_status"] == "NOT_CALIBRATED"
    assert res["calibration_status"] == CALIBRATION_STATUS
    assert res["validation_status"] == VALIDATION_STATUS
    assert res["promotion_status"] == "BENCHMARK_ONLY"
    assert res["fusion_method"] == "WEIGHTED_SCORE_FUSION"
    assert res["contributing_detectors"] == fusion_res["contributing_detectors"]
    assert "robust_mad" in res["contributing_detectors"]
    assert "copod" in res["contributing_detectors"]


def test_case_b_monitor_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["leakage_current"] = 280.0
    rec["propagation_delay"] = 15.5

    res = service.predict_single(rec)
    canonical = service.get_normalized_params(rec)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id="LOT-001")

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["anomaly_status"] in ["MONITOR", "REJECT"]
    assert res["anomaly_score"] == fusion_res["anomaly_score"]


def test_case_c_reject_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["leakage_current"] = 1200.0
    rec["propagation_delay"] = 45.0
    rec["iddq_standby"] = 40.0

    res = service.predict_single(rec)
    canonical = service.get_normalized_params(rec)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id="LOT-001")

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["anomaly_status"] == "REJECT"
    assert res["disposition"] == "REJECT"
    assert res["operational_decision"] == "REJECT"


def test_case_d_unknown_lot_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["lot_id"] = "UNKNOWN_LOT_XYZ_9999"

    res = service.predict_single(rec)
    canonical = service.get_normalized_params(rec)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id="UNKNOWN_LOT_XYZ_9999")

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"
    assert res["reference_context"]["status"] == "UNKNOWN_LOT"


def test_case_e_undersized_lot_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec["lot_id"] = "LOT_UNDERSIZED_TEST"

    res = service.predict_single(rec)
    canonical = service.get_normalized_params(rec)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id="LOT_UNDERSIZED_TEST")

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["reference_source"] == "GLOBAL_FALLBACK"


def test_case_f_missing_lot_parity(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    rec = dict(nominal_record)
    rec.pop("lot_id", None)

    res = service.predict_single(rec)
    canonical = service.get_normalized_params(rec)
    fusion_res = service.evaluate_anomaly_fusion(canonical, lot_id=None)

    assert res["anomaly_status"] == fusion_res["anomaly_status"]
    assert res["reference_status"] == "UNKNOWN_LOT"
    assert res["reference_source"] == "GLOBAL_FALLBACK"


def test_case_g_one_detector_unavailable(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    artifacts_sub = {
        "robust_mad": service.anomaly_artifacts.get("robust_mad", {}),
        "copod": service.anomaly_artifacts.get("copod", {}),
    }
    fusion_engine = AnomalyFusionEngine.from_artifacts(artifacts_sub)
    canonical = service.get_normalized_params(nominal_record)
    res = fusion_engine.evaluate_component(canonical, lot_id="LOT-001")

    assert len(res["contributing_detectors"]) == 2
    assert "robust_mad" in res["contributing_detectors"]
    assert "copod" in res["contributing_detectors"]
    assert "isolation_forest" not in res["contributing_detectors"]
    assert res["anomaly_score"] is not None
    assert res["anomaly_status"] in ["PASS", "MONITOR", "REJECT"]


def test_case_h_two_detectors_unavailable(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    artifacts_sub = {
        "copod": service.anomaly_artifacts.get("copod", {}),
    }
    fusion_engine = AnomalyFusionEngine.from_artifacts(artifacts_sub)
    canonical = service.get_normalized_params(nominal_record)
    res = fusion_engine.evaluate_component(canonical, lot_id="LOT-001")

    assert res["contributing_detectors"] == ["copod"]
    assert res["anomaly_score"] is not None
    assert res["anomaly_status"] in ["PASS", "MONITOR", "REJECT"]


def test_case_i_zero_detectors_fail_closed(nominal_record: Dict[str, Any]):
    fusion_engine = AnomalyFusionEngine.from_artifacts({})
    canonical = {"iddq": 2140.0, "ileak": 301.6, "tpd": 192.1}
    res = fusion_engine.evaluate_component(canonical, lot_id="LOT-001")

    assert res["anomaly_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["anomaly_score"] is None
    assert res["weighted_fusion_score"] is None
    assert res["contributing_detectors"] == []
    assert res["fusion_method"] == "NO_ACTIVE_DETECTORS"
    assert res["anomaly_status"] != "PASS"


def test_case_j_reordered_feature_input_rejection():
    fusion_engine = AnomalyFusionEngine.from_artifacts({})
    reordered = {"tpd": 192.1, "iddq": 2140.0, "ileak": 301.6}
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        fusion_engine.evaluate_component(reordered)


def test_case_k_malformed_numeric_input_rejection(nominal_record: Dict[str, Any]):
    fusion_engine = AnomalyFusionEngine.from_artifacts({})
    nan_input = {"iddq": float("nan"), "ileak": 301.6, "tpd": 192.1}
    with pytest.raises(ValueError, match="Invalid non-numeric or non-finite"):
        fusion_engine.evaluate_component(nan_input)


def test_case_l_no_fake_anomaly_calibration_claims(service: PredictaInferenceService, nominal_record: Dict[str, Any]):
    res = service.predict_single(nominal_record)

    assert res.get("anomaly_calibration_status") == "NOT_CALIBRATED"
    assert res.get("calibration_status") == "NOT_CALIBRATED"

    anomaly_details = res.get("ml_details", {}).get("anomaly_detection", {})
    assert anomaly_details.get("calibration_status") == "NOT_CALIBRATED"

    assert "probability" in res
    assert "anomaly_score" in res
