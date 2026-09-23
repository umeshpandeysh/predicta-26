"""
PREDICTA — Operational Disposition Cross-Runtime Parity Test Suite (Python)
File: tests/test_disposition_cross_runtime_parity.py
"""

import pytest
from src.api.inference_service import PredictaInferenceService

PROBABILITY_TEST_CASES = [
    (0.10, "PASS"),
    (0.15, "PASS"),
    (0.20, "MONITOR"),
    (0.49, "MONITOR"),
    (0.50, "MONITOR"),
    (0.64, "MONITOR"),
    (0.65, "REJECT"),
    (0.70, "REJECT"),
    (0.74, "REJECT"),
    (0.75, "REJECT"),
    (0.90, "REJECT"),
]


@pytest.fixture
def service():
    return PredictaInferenceService()


@pytest.mark.parametrize("prob,expected_disposition", PROBABILITY_TEST_CASES)
def test_probability_disposition_boundaries(service, prob, expected_disposition):
    anomaly_evidence = {"pat": {"status": "PASS"}, "copod": {"status": "PASS"}, "overall_status": "PASS"}
    drift_predictions = {}
    safety_slope = {
        "iddq": {"boundary_status": "WITHIN"},
        "ileak": {"boundary_status": "WITHIN"},
        "tpd": {"boundary_status": "WITHIN"},
    }
    risk_engine = {}

    res = service.synthesize_operational_disposition(prob, anomaly_evidence, drift_predictions, safety_slope, risk_engine)
    assert res["disposition"] == expected_disposition, f"P={prob} expected {expected_disposition}, got {res['disposition']}"


def test_safety_slope_exceeded_override(service):
    anomaly_evidence = {"pat": {"status": "PASS"}, "copod": {"status": "PASS"}, "overall_status": "PASS"}
    drift_predictions = {}
    safety_slope = {
        "iddq": {"boundary_status": "EXCEEDED"},
        "ileak": {"boundary_status": "WITHIN"},
        "tpd": {"boundary_status": "WITHIN"},
    }
    risk_engine = {}

    res = service.synthesize_operational_disposition(0.15, anomaly_evidence, drift_predictions, safety_slope, risk_engine)
    assert res["disposition"] == "REJECT"
    assert res["decision_override_reason"] == "GPR_IDDQ_LIMIT_EXCEEDED"


def test_safety_slope_warning_override(service):
    anomaly_evidence = {"pat": {"status": "PASS"}, "copod": {"status": "PASS"}, "overall_status": "PASS"}
    drift_predictions = {}
    safety_slope = {
        "iddq": {"boundary_status": "WITHIN"},
        "ileak": {"boundary_status": "WARNING"},
        "tpd": {"boundary_status": "WITHIN"},
    }
    risk_engine = {}

    res = service.synthesize_operational_disposition(0.15, anomaly_evidence, drift_predictions, safety_slope, risk_engine)
    assert res["disposition"] == "MONITOR"


def test_anomaly_reject_override(service):
    anomaly_evidence = {"pat": {"status": "REJECT"}, "copod": {"status": "PASS"}, "overall_status": "ANOMALOUS"}
    drift_predictions = {}
    safety_slope = {"iddq": {"boundary_status": "WITHIN"}}
    risk_engine = {}

    res = service.synthesize_operational_disposition(0.15, anomaly_evidence, drift_predictions, safety_slope, risk_engine)
    assert res["disposition"] == "REJECT"
    assert res["decision_override_reason"] == "PAT_CRITICAL_ANOMALY"
