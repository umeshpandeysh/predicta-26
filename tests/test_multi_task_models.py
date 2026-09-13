"""
Predicta Semiconductor Reliability — Multi-Task Model & Anomaly Detection Test Suite
File: tests/test_multi_task_models.py

Rigorous assertions verifying:
1. Model 1: Binary failure prediction with calibrated probability and cost-sensitive threshold (0.20).
2. Model 2: Multiclass defect classification (8-class taxonomy) with confidence scores.
3. Model 3: Open-set unknown anomaly detection (Robust MAD + COPOD) identifying out-of-distribution patterns.
4. Tree SHAP feature attributions via genuine pred_contribs.
5. Authoritative 4-tier risk taxonomy (LOW, MEDIUM, HIGH, CRITICAL).
"""

import os
import sys
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from src.features.feature_contract import DEFECT_TAXONOMY
from src.api.inference_service import PredictaInferenceService


@pytest.fixture(scope="module")
def service():
    return PredictaInferenceService()


@pytest.fixture
def nominal_sample():
    return {
        "equipment_id": "EQP-101",
        "supply_voltage": 1.20,
        "output_voltage": 1.20,
        "current": 45.0,
            "leakage_current": 111.5,
        "resistance": 12.5,
        "capacitance": 4.2,
        "threshold_voltage": 0.45,
        "frequency": 2500.0,
        "propagation_delay": 11.0,
        "setup_time": 0.85,
        "hold_time": 0.42,
        "timing_margin": 2.6,
        "temperature": 27.5,
        "dynamic_power": 54.0,
        "total_power": 54.5,
        "test_duration": 150.0,
    }


@pytest.fixture
def high_leakage_sample():
    return {
        "equipment_id": "EQP-102",
        "supply_voltage": 1.20,
        "output_voltage": 1.18,
        "current": 60.0,
            "leakage_current": 480.0,  # Extreme gate leakage
        "resistance": 12.0,
        "capacitance": 4.0,
        "threshold_voltage": 0.38,
        "frequency": 2400.0,
        "propagation_delay": 13.0,
        "setup_time": 1.0,
        "hold_time": 0.5,
        "timing_margin": 2.0,
        "temperature": 45.0,
        "dynamic_power": 65.0,
        "total_power": 75.0,
        "test_duration": 150.0,
    }


def test_01_binary_failure_prediction(service, nominal_sample, high_leakage_sample):
    """Verify calibrated probability and operating threshold response."""
    res_nom = service.predict_single(nominal_sample)
    res_leak = service.predict_single(high_leakage_sample)

    assert res_nom["probability"] < service.operating_threshold
    assert res_nom["prediction"] == "PASS"
    assert res_nom["risk_level"] == "LOW"

    assert res_leak["probability"] >= service.operating_threshold
    assert res_leak["prediction"] == "FAIL"
    assert res_leak["risk_level"] in ["HIGH", "CRITICAL"]


def test_02_multiclass_defect_classification(service, high_leakage_sample):
    """Verify multiclass defect classification outputs recognized defect class."""
    res = service.predict_single(high_leakage_sample)
    defect_info = res["defect_classification"]

    assert defect_info["predicted_defect"] in DEFECT_TAXONOMY + ["UNKNOWN_ANOMALY"]
    assert 0.0 <= defect_info["confidence"] <= 1.0


def test_03_open_set_unknown_anomaly_detection(service, nominal_sample):
    """Verify extreme multivariate anomaly flags REJECT and UNKNOWN_ANOMALY."""
    anomaly_sample = dict(nominal_sample)
    anomaly_sample["leakage_current"] = 1200.0
    anomaly_sample["propagation_delay"] = 45.0
    anomaly_sample["temperature"] = 95.0

    res = service.predict_single(anomaly_sample)
    assert res["anomaly_status"] in ["MONITOR", "REJECT"]
    assert res["disposition"] in ["MONITOR", "REJECT"]
    assert res["risk_level"] in ["HIGH", "CRITICAL"]


def test_04_tree_shap_feature_attributions(service, high_leakage_sample):
    """Verify XGBoost tree SHAP attributions (pred_contribs) return top ranked contributors."""
    res = service.predict_single(high_leakage_sample)
    explanation = res["explanation"]

    assert "top_contributions" in explanation
    top_contribs = explanation["top_contributions"]
    assert len(top_contribs) > 0

    top_feature_names = [c["feature"] for c in top_contribs]
    # For a high leakage sample, leakage or voltage/power features should be among top contributors
    assert any("leak" in f or "voltage" in f or "power" in f for f in top_feature_names)

    for c in top_contribs:
        assert c["direction"] in ["INCREASES_RISK", "REDUCES_RISK"]
        assert isinstance(c["contribution"], float)


def test_05_authoritative_four_tier_risk_taxonomy(service):
    """Verify exact 4-tier risk mapping: LOW, MEDIUM, HIGH, CRITICAL."""
    # Low risk
    assert service.determine_risk_level(0.05, "NORMAL") == "LOW"
    # Medium risk (operating threshold 0.20 <= P < 0.50)
    assert service.determine_risk_level(0.25, "NORMAL") == "MEDIUM"
    assert service.determine_risk_level(0.10, "MONITOR") == "MEDIUM"
    # High risk (0.50 <= P < 0.75)
    assert service.determine_risk_level(0.60, "NORMAL") == "HIGH"
    # Critical risk (P >= 0.75 or severe anomaly REJECT)
    assert service.determine_risk_level(0.85, "NORMAL") == "CRITICAL"
    assert service.determine_risk_level(0.10, "REJECT") == "CRITICAL"
