"""
Predicta Semiconductor Test Analytics — Governed Risk Fusion Adversarial Test Suite (Final Remediation)
File: tests/test_risk_fusion.py

Hardened adversarial test suite for governed risk fusion contract, production model SHA verification,
and parity engine. Verifies Attacks A through Z plus explicit INSUFFICIENT_HISTORY governance.
"""

import hashlib
import json
import math
import os
import pytest

from src.risk_fusion.risk_fusion import GovernedRiskFusionEngine, load_risk_fusion_contract, verify_production_model_sha

PROD_MODEL_PATH = os.path.join("ml", "models", "production", "predicta_xgboost_model.json")
PROD_MANIFEST_PATH = os.path.join("ml", "models", "production", "predicta_production_manifest.json")
EXPECTED_MODEL_SHA256 = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
FROZEN_CONTRACT_SHA256 = "44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf"


def get_nominal_inputs():
    anomaly_evidence = {
        "pat": {"status": "PASS", "parameter_z_scores": {"iddq": 0.2, "ileak": 0.1, "tpd": 0.1}},
        "copod": {"score": 2.1, "status": "PASS"},
        "overall_status": "NORMAL",
        "anomaly_status": "NORMAL"
    }
    drift_predictions = {
        "iddq": {"has_history": True, "value_24h": 10.5, "predicted_168h": 11.0, "uncertainty_std": 0.5, "upper_95": 12.0, "status": "CALCULATED"},
        "ileak": {"has_history": True, "value_24h": 110.0, "predicted_168h": 112.0, "uncertainty_std": 2.0, "upper_95": 116.0, "status": "CALCULATED"},
        "tpd": {"has_history": True, "value_24h": 10.0, "predicted_168h": 10.2, "uncertainty_std": 0.2, "upper_95": 10.6, "status": "CALCULATED"}
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
    assert contract_data["physics_limits"]["iddq"]["max_limit"] == 5000.0
    assert contract_data["physics_limits"]["ileak"]["max_limit"] == 500.0
    assert contract_data["physics_limits"]["tpd"]["max_limit"] == 250.0
    assert sha256 == FROZEN_CONTRACT_SHA256


def test_02_production_model_sha_integrity():
    computed_sha = verify_production_model_sha()
    assert computed_sha == EXPECTED_MODEL_SHA256


def test_attack_a_client_fake_risk_score():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    for val in [5, 0, 100, 42.5]:
        with pytest.raises(ValueError, match="VALIDATION_ERROR"):
            engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl, client_supplied_risk_score=val)


def test_attack_b_client_fake_disposition():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    for disp in ["PASS", "MONITOR", "REJECT", "APPROVED"]:
        with pytest.raises(ValueError, match="VALIDATION_ERROR"):
            engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl, client_supplied_disposition=disp)


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

    anomaly_ev_bad = dict(anomaly_ev)
    anomaly_ev_bad["pat"] = {"status": "INVALID_PAT", "parameter_z_scores": {"iddq": 0.1, "ileak": 0.1, "tpd": 0.1}}
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.10, anomaly_ev_bad, drift_pred, safety_sl)


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
    assert res["provenance"]["operating_threshold"] == 0.20


def test_attack_m_contract_sha_mutation(tmp_path):
    contract_data, _ = load_risk_fusion_contract()
    mutated = dict(contract_data)
    mutated["operating_threshold"] = 0.25
    mutated_file = tmp_path / "risk_fusion_contract.json"
    mutated_file.write_text(json.dumps(mutated), encoding="utf-8")

    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        GovernedRiskFusionEngine(contract_path=str(mutated_file))


def test_attack_n_model_sha_mismatch_detection(tmp_path):
    mutated_model = tmp_path / "predicta_xgboost_model.json"
    mutated_model.write_text(json.dumps({"mutated": True}), encoding="utf-8")

    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        GovernedRiskFusionEngine(model_path=str(mutated_model))


def test_attack_o_attempt_substitute_phase9_threshold(tmp_path):
    contract_data, _ = load_risk_fusion_contract()
    mutated = dict(contract_data)
    mutated["operating_threshold"] = 0.90
    mutated_file = tmp_path / "risk_fusion_contract.json"
    mutated_file.write_text(json.dumps(mutated), encoding="utf-8")

    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        GovernedRiskFusionEngine(contract_path=str(mutated_file))


def test_attack_p_risk_score_as_probability_rejection():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(85.0, anomaly_ev, drift_pred, safety_sl)


def test_attack_q_missing_pat_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    del anomaly_ev["pat"]

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_r_missing_copod_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    del anomaly_ev["copod"]

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_s_missing_gpr_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    
    # 1. Missing parameter
    drift_pred_bad = dict(drift_pred)
    del drift_pred_bad["iddq"]
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred_bad, safety_sl)

    # 2. Missing field upper_95
    drift_pred_bad2 = json.loads(json.dumps(drift_pred))
    del drift_pred_bad2["iddq"]["upper_95"]
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred_bad2, safety_sl)

    # 3. None upper_95
    drift_pred_bad3 = json.loads(json.dumps(drift_pred))
    drift_pred_bad3["iddq"]["upper_95"] = None
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred_bad3, safety_sl)


def test_attack_t_missing_safety_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()

    # 1. Missing parameter
    safety_sl_bad = dict(safety_sl)
    del safety_sl_bad["tpd"]
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl_bad)

    # 2. Missing upper_bound_slope
    safety_sl_bad2 = json.loads(json.dumps(safety_sl))
    del safety_sl_bad2["tpd"]["upper_bound_slope"]
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl_bad2)


def test_attack_u_unknown_status_enumeration():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    
    anomaly_ev_bad = json.loads(json.dumps(anomaly_ev))
    anomaly_ev_bad["pat"]["status"] = "UNKNOWN_STATUS"
    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev_bad, drift_pred, safety_sl)


def test_attack_v_nan_copod_score():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    anomaly_ev["copod"]["score"] = float("nan")

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_w_nan_pat_score():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    anomaly_ev["pat"]["parameter_z_scores"]["iddq"] = float("nan")

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_x_nan_gpr_evidence():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    drift_pred["ileak"]["upper_95"] = float("inf")

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_y_contract_constant_mutation(tmp_path):
    contract_data, _ = load_risk_fusion_contract()
    mutated = dict(contract_data)
    mutated["physics_limits"]["iddq"]["max_limit"] = 9999.0
    mutated_file = tmp_path / "risk_fusion_contract.json"
    mutated_file.write_text(json.dumps(mutated), encoding="utf-8")

    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        GovernedRiskFusionEngine(contract_path=str(mutated_file))


def test_attack_z_model_sha_mutation(tmp_path):
    contract_data, _ = load_risk_fusion_contract()
    mutated = dict(contract_data)
    mutated["target_model_sha256"] = "0000000000000000000000000000000000000000000000000000000000000000"
    mutated_file = tmp_path / "risk_fusion_contract.json"
    mutated_file.write_text(json.dumps(mutated), encoding="utf-8")

    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        GovernedRiskFusionEngine(contract_path=str(mutated_file))


# EXPLICIT INSUFFICIENT_HISTORY GOVERNANCE TESTS (AA - AH)

def test_attack_aa_iddq_insufficient_history():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    drift_pred["iddq"] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 10.5}
    safety_sl["iddq"] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["parameter_risk"]["iddq"]["boundary_status"] == "INSUFFICIENT_HISTORY"
    assert res["parameter_risk"]["iddq"]["drift_risk"] is None
    assert res["prognostic_evidence_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["disposition"] == "MONITOR"  # Never silently PASS
    assert res["override_reason"] == "ANOMALY_OR_DRIFT_WARNING"


def test_attack_ab_ileak_insufficient_history():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    drift_pred["ileak"] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 110.0}
    safety_sl["ileak"] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["parameter_risk"]["ileak"]["boundary_status"] == "INSUFFICIENT_HISTORY"
    assert res["parameter_risk"]["ileak"]["drift_risk"] is None
    assert res["disposition"] == "MONITOR"


def test_attack_ac_tpd_insufficient_history():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    drift_pred["tpd"] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 10.0}
    safety_sl["tpd"] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["parameter_risk"]["tpd"]["boundary_status"] == "INSUFFICIENT_HISTORY"
    assert res["parameter_risk"]["tpd"]["drift_risk"] is None
    assert res["disposition"] == "MONITOR"


def test_attack_ad_safety_insufficient_history():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    safety_sl["iddq"]["boundary_status"] = "INSUFFICIENT_HISTORY"

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["parameter_risk"]["iddq"]["boundary_status"] == "INSUFFICIENT_HISTORY"
    assert res["disposition"] == "MONITOR"


def test_attack_ae_all_prognostic_evidence_insufficient():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    for p in ["iddq", "ileak", "tpd"]:
        drift_pred[p] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 10.0}
        safety_sl[p] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    assert res["degradation_drift_score"] is None
    assert res["prognostic_evidence_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["disposition"] == "MONITOR"
    assert res["provenance"]["prognostic_evidence_status"] == "INSUFFICIENT_EVIDENCE"


def test_attack_af_valid_anomaly_with_insufficient_prognostics():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    anomaly_ev["pat"] = {"status": "PASS", "parameter_z_scores": {"iddq": 3.0, "ileak": 0.1, "tpd": 0.1}}
    drift_pred["iddq"] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 10.5}
    safety_sl["iddq"] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    # PAT z=3.0 -> a_score = (3.0 - 1.0) * 15 = 30.0
    assert res["parameter_risk"]["iddq"]["anomaly_risk"] == 30.0
    assert res["parameter_risk"]["iddq"]["drift_risk"] is None
    assert res["disposition"] == "MONITOR"


def test_attack_ag_missing_history_indicator_fails_closed():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    del drift_pred["iddq"]["has_history"]

    with pytest.raises(ValueError, match="VALIDATION_ERROR"):
        engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)


def test_attack_ah_python_node_insufficient_history_parity():
    engine = GovernedRiskFusionEngine()
    anomaly_ev, drift_pred, safety_sl = get_nominal_inputs()
    for p in ["iddq", "ileak", "tpd"]:
        drift_pred[p] = {"has_history": False, "status": "INSUFFICIENT_HISTORY", "value_24h": 10.0}
        safety_sl[p] = {"boundary_status": "INSUFFICIENT_HISTORY", "predicted_slope": 0.0, "upper_bound_slope": 0.0}

    res = engine.evaluate(0.05, anomaly_ev, drift_pred, safety_sl)
    for p in ["iddq", "ileak", "tpd"]:
        assert res["parameter_risk"][p]["boundary_status"] == "INSUFFICIENT_HISTORY"
        assert res["parameter_risk"][p]["drift_risk"] is None
    assert res["prognostic_evidence_status"] == "INSUFFICIENT_EVIDENCE"
    assert res["degradation_drift_score"] is None
    assert res["disposition"] == "MONITOR"
    assert res["disposition"] != "PASS"
    assert res["provenance"]["prognostic_evidence_status"] == "INSUFFICIENT_EVIDENCE"

