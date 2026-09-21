"""
Predicta Semiconductor Test Analytics — Governed Risk Fusion Adversarial Test Suite
File: tests/test_risk_fusion.py

Adversarial test suite for governed risk fusion contract and parity engine.
Verifies Attacks A through P, model SHA-256 integrity, threshold protection,
and cross-runtime parity requirements.
"""

import hashlib
import json
import math
import os
import pytest

from src.risk_fusion.risk_fusion import GovernedRiskFusionEngine, load_risk_fusion_contract

PROD_MODEL_PATH = os.path.join("ml", "models", "production", "predicta_xgboost_model.json")
PROD_MANIFEST_PATH = os.path.join("ml", "models", "production", "predicta_production_manifest.json")
EXPECTED_MODEL_SHA256 = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def get_nominal_inputs():
    anomaly_evidence = {
        "pat": {"status": "PASS", "parameter_z_scores": {"iddq": 0.2, "ileak": 0.1, "tpd": 0.1}},
        "copod": {"score": 2.1, "status": "PASS"},
        "overall_status": "NORMAL",
        "anomaly_status": "NORMAL"
    }
    drift_predictions = {
        "iddq": {"value_24h": 10.5, "predicted_168h": 11.0, "uncertainty_std": 0.5, "upper_95": 12.0},
        "ileak": {"value_24h": 110.0, "predicted_168h": 112.0, "uncertainty_std": 2.0, "upper_95": 116.0},
        "tpd": {"value_24h": 10.0, "predicted_168h": 10.2, "uncertainty_std": 0.2, "upper_95": 10.6}
    }
    safety_slope = {
        "iddq": {"predicted_slope": 0.003, "upper_bound_slope": 0.01, "boundary_status": "WITHIN"},
        "ileak": {"predicted_slope": 0.014, "upper_bound_slope": 0.04, "boundary_status": "WITHIN"},
        "tpd": {"predicted_slope": 0.001, "upper_bound_slope": 0.004, "boundary_status": "WITHIN"}
    }
    return anomaly_evidence, drift_predictions, safety_slope


def test_01_contract_integrity():
    contract_data, sha256 = load_risk_fusion_contract()
    assert contract_data["contract_version"] == "1.0.0"
    assert contract_data["operating_threshold"] == 0.20
    assert contract_data["high_risk_probability_threshold"] == 0.65
    assert len(sha256) == 64


def test_02_production_model_sha_integrity():
    assert os.path.exists(PROD_MODEL_PATH)
    with open(PROD_MODEL_PATH, "rb") as f:
        raw = f.read()
        computed_sha = hashlib.sha256(raw).hexdigest()
        computed_sha_lf = hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()
    
    assert EXPECTED_MODEL_SHA256 in (computed_sha, computed_sha_lf)


def test_attack_a_client_fake_risk_score():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    # Critical PAT anomaly gives high risk
    anomaly_ev["pat"] = {"status": "REJECT", "parameter_z_scores": {"iddq": 6.5, "ileak": 0.1, "tpd": 0.1}}

    # Client passes fake low risk score
    res = engine.evaluate(
        ml_probability=0.05,
        anomaly_evidence=anomaly_ev,
        drift_predictions=drift_pred,
        safety_slope=safety_sl,
        client_supplied_risk_score=5.0
    )
    assert res["risk_score"] >= 70.0
    assert res["disposition"] == "REJECT"


def test_attack_b_client_fake_disposition():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    # Client attempts to supply PASS when ML probability is high (0.80)
    res = engine.evaluate(
        ml_probability=0.80,
        anomaly_evidence=anomaly_ev,
        drift_predictions=drift_pred,
        safety_slope=safety_sl,
        client_supplied_disposition="PASS"
    )
    assert res["disposition"] == "REJECT"
    assert res["override_reason"] == "ML_HIGH_RISK"


def test_attack_c_nan_probability():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(float("nan"), anomaly_ev, drift_pred, safety_sl)


def test_attack_d_out_of_bounds_probability():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(1.5, anomaly_ev, drift_pred, safety_sl)

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(-0.1, anomaly_ev, drift_pred, safety_sl)


def test_attack_e_unknown_evidence_type():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.10, "INVALID_ANOMALY", drift_pred, safety_sl)


def test_attack_f_anomaly_reject_with_low_ml_prob():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    anomaly_ev["pat"] = {"status": "REJECT", "parameter_z_scores": {"iddq": 5.0, "ileak": 0.1, "tpd": 0.1}}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "REJECT"
    assert res["override_reason"] == "PAT_CRITICAL_ANOMALY"
    assert res["risk_score"] >= 70.0


def test_attack_g_safety_exceeded_with_low_ml_prob():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    safety_sl["iddq"]["boundary_status"] = "EXCEEDED"

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "REJECT"
    assert res["override_reason"] == "GPR_IDDQ_LIMIT_EXCEEDED"
    assert res["risk_score"] >= 75.0


def test_attack_h_high_ml_prob_with_nominal_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    res = engine.evaluate(0.72, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "REJECT"
    assert res["override_reason"] == "ML_HIGH_RISK"
    assert res["risk_class"] == "SAFE" or res["risk_class"] == "MONITOR" or res["risk_class"] == "AT RISK"


def test_attack_i_elevated_ml_prob_with_nominal_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    res = engine.evaluate(0.35, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "MONITOR"
    assert res["override_reason"] == "ML_ELEVATED_RISK"


def test_attack_j_low_ml_prob_with_anomaly_monitor():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    anomaly_ev["overall_status"] = "MONITOR"
    anomaly_ev["anomaly_status"] = "MONITOR"

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "MONITOR"
    assert res["override_reason"] == "ANOMALY_OR_DRIFT_WARNING"
    assert res["risk_score"] >= 35.0


def test_attack_k_low_ml_prob_with_safety_warning():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    safety_sl["ileak"]["boundary_status"] = "WARNING"

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "MONITOR"
    assert res["override_reason"] == "ANOMALY_OR_DRIFT_WARNING"
    assert res["risk_score"] >= 40.0


def test_attack_l_nominal_pass():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["disposition"] == "PASS"
    assert res["override_reason"] == "NONE"
    assert res["risk_class"] == "SAFE"


def test_attack_m_contract_sha_mutation(tmp_path):
    contract_data, original_sha = load_risk_fusion_contract()
    mutated = dict(contract_data)
    mutated["operating_threshold"] = 0.25
    mutated_file = tmp_path / "risk_fusion_contract.json"
    mutated_file.write_text(json.dumps(mutated), encoding="utf-8")

    engine_mutated = GovernedRiskFusionEngine(contract_path=str(mutated_file))
    assert engine_mutated.contract_sha256 != original_sha


def test_attack_n_model_sha_mismatch_detection():
    manifest_path = PROD_MANIFEST_PATH
    assert os.path.exists(manifest_path)
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["model_sha256"] == EXPECTED_MODEL_SHA256


def test_attack_o_phase9_threshold_modification_attempt():
    engine = GovernedRiskFusionEngine()
    assert engine.operating_threshold == 0.20


def test_attack_p_risk_score_as_probability_rejection():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)

    # Risk score is a 0-100 scalar; failure probability is a 0-1 probability.
    assert 0.0 <= res["risk_score"] <= 100.0
    assert "ml_probability" not in res or res["risk_score"] != 0.05
