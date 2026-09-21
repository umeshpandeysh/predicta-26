"""
Predicta Semiconductor Test Analytics — Governed Risk Fusion Engine (Python)
File: src/risk_fusion/risk_fusion.py

Formalized multi-criteria risk fusion engine operating under authoritative contract:
ml/risk_fusion/risk_fusion_contract.json
"""

from typing import Dict, Any, List, Optional, Tuple
import hashlib
import json
import math
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "risk_fusion", "risk_fusion_contract.json")
DEFAULT_MODEL_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
FROZEN_CONTRACT_SHA256 = "3173e5c2389de81d932562a4726bffcb976126e7bff2b11b8d18339ecf9a18ee"
EXPECTED_MODEL_SHA256 = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

VALID_PAT_STATUSES = {"PASS", "MONITOR", "REJECT"}
VALID_COPOD_STATUSES = {"PASS", "MONITOR", "REJECT"}
VALID_ANOMALY_STATUSES = {"PASS", "NORMAL", "MONITOR", "ANOMALOUS", "REJECT"}
VALID_SAFETY_STATUSES = {"WITHIN", "WARNING", "EXCEEDED", "INSUFFICIENT_HISTORY"}


def load_risk_fusion_contract(contract_path: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
    """Loads and computes SHA-256 for the risk fusion contract JSON, failing closed on mutation or missing fields."""
    target_path = contract_path or CONTRACT_PATH
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"CONFIGURATION_ERROR: Risk fusion contract not found at {target_path}")

    with open(target_path, "r", encoding="utf-8") as f:
        raw_content = f.read()

    try:
        contract_data = json.loads(raw_content)
    except Exception as e:
        raise ValueError(f"CONFIGURATION_ERROR: Malformed contract JSON: {str(e)}")

    normalized = raw_content.replace("\r\n", "\n")
    sha256 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    # DEFECT 6: Strict Schema & Completeness Governance Validation
    required_sections = [
        "contract_name", "contract_version", "target_model_sha256", "operating_threshold",
        "high_risk_probability_threshold", "physics_limits", "pat_parameters", "gpr_parameters",
        "aggregation_weights", "copod_parameters", "risk_class_thresholds", "override_floors",
        "evidence_types", "mathematical_formulas", "risk_classes", "disposition_synthesis_precedence"
    ]
    for sec in required_sections:
        if sec not in contract_data or contract_data[sec] is None:
            raise ValueError(f"CONFIGURATION_ERROR: Missing required contract section '{sec}'")

    if contract_data["contract_name"] != "predicta_governed_risk_fusion_contract":
        raise ValueError("CONFIGURATION_ERROR: Invalid contract name identity")
    if contract_data["contract_version"] != "1.0.0":
        raise ValueError("CONFIGURATION_ERROR: Invalid contract version identity")
    if float(contract_data["operating_threshold"]) != 0.20:
        raise ValueError("CONFIGURATION_ERROR: Mutated operating threshold in contract")
    if contract_data["target_model_sha256"] != EXPECTED_MODEL_SHA256:
        raise ValueError("CONFIGURATION_ERROR: Target model SHA-256 mismatch in contract")

    # Required field verification inside contract sections
    phys = contract_data["physics_limits"]
    for p in ["iddq", "ileak", "tpd"]:
        if p not in phys or "max_limit" not in phys[p] or "max_slope_per_hour" not in phys[p]:
            raise ValueError(f"CONFIGURATION_ERROR: Missing required physics limit for '{p}'")

    pat_p = contract_data["pat_parameters"]
    if "z_threshold" not in pat_p or "scale_multiplier" not in pat_p:
        raise ValueError("CONFIGURATION_ERROR: Missing required fields in pat_parameters")

    gpr_p = contract_data["gpr_parameters"]
    if "ratio_threshold" not in gpr_p or "scale_multiplier" not in gpr_p:
        raise ValueError("CONFIGURATION_ERROR: Missing required fields in gpr_parameters")

    agg_w = contract_data["aggregation_weights"]
    if "base_max_weight" not in agg_w or "base_mean_weight" not in agg_w:
        raise ValueError("CONFIGURATION_ERROR: Missing required fields in aggregation_weights")

    cop_p = contract_data["copod_parameters"]
    if "boost_threshold" not in cop_p or "boost_multiplier" not in cop_p or "max_boost" not in cop_p:
        raise ValueError("CONFIGURATION_ERROR: Missing required fields in copod_parameters")

    rc_t = contract_data["risk_class_thresholds"]
    if "safe_max" not in rc_t or "monitor_max" not in rc_t:
        raise ValueError("CONFIGURATION_ERROR: Missing required fields in risk_class_thresholds")

    ov_f = contract_data["override_floors"]
    for k in ["safety_exceeded", "anomaly_reject", "safety_warning", "anomaly_monitor"]:
        if k not in ov_f:
            raise ValueError(f"CONFIGURATION_ERROR: Missing required override floor '{k}'")

    if contract_path is None and sha256 != FROZEN_CONTRACT_SHA256:
        raise ValueError(f"CONFIGURATION_ERROR: Authoritative contract SHA-256 mismatch! Got {sha256}, expected {FROZEN_CONTRACT_SHA256}")
    elif contract_path is not None and sha256 != FROZEN_CONTRACT_SHA256:
        raise ValueError(f"CONFIGURATION_ERROR: Mutated contract SHA-256 detected! Got {sha256}, expected {FROZEN_CONTRACT_SHA256}")

    return contract_data, sha256


def verify_production_model_sha(model_path: Optional[str] = None, expected_sha: str = EXPECTED_MODEL_SHA256) -> str:
    """Verifies actual XGBoost production model file SHA-256 checksum against authoritative expectation."""
    target_path = model_path or DEFAULT_MODEL_PATH
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"CONFIGURATION_ERROR: Production model artifact not found at {target_path}")

    with open(target_path, "rb") as f:
        raw_bytes = f.read()

    computed_sha = hashlib.sha256(raw_bytes).hexdigest()
    computed_sha_lf = hashlib.sha256(raw_bytes.replace(b"\r\n", b"\n")).hexdigest()

    if computed_sha != expected_sha and computed_sha_lf != expected_sha:
        raise ValueError(f"CONFIGURATION_ERROR: Production model SHA-256 mismatch! Computed: {computed_sha}, Expected: {expected_sha}")

    return computed_sha_lf if computed_sha_lf == expected_sha else computed_sha


class GovernedRiskFusionEngine:
    def __init__(self, contract_path: Optional[str] = None, model_path: Optional[str] = None):
        self.contract_path = contract_path or CONTRACT_PATH
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self.contract_data, self.contract_sha256 = load_risk_fusion_contract(self.contract_path)
        self.model_sha256 = verify_production_model_sha(self.model_path, self.contract_data["target_model_sha256"])

        self.operating_threshold = float(self.contract_data["operating_threshold"])
        self.high_risk_threshold = float(self.contract_data["high_risk_probability_threshold"])

        # Load authoritative contract constants strictly from contract
        self.physics_limits = self.contract_data["physics_limits"]
        self.pat_params = self.contract_data["pat_parameters"]
        self.gpr_params = self.contract_data["gpr_parameters"]
        self.weights = self.contract_data["aggregation_weights"]
        self.copod_params = self.contract_data["copod_parameters"]
        self.risk_classes_cfg = self.contract_data["risk_class_thresholds"]
        self.override_floors = self.contract_data["override_floors"]

    def validate_ml_probability(self, ml_probability: Any) -> float:
        """Validates calibrated failure probability P, failing closed on non-finite or out-of-bounds values."""
        if ml_probability is None or isinstance(ml_probability, bool):
            raise ValueError("VALIDATION_ERROR: ml_probability cannot be None or boolean")
        try:
            p = float(ml_probability)
        except (ValueError, TypeError):
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be a numeric value, got: {ml_probability}")

        if math.isnan(p) or math.isinf(p):
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be finite, got: {p}")
        if p < 0.0 or p > 1.0:
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be in range [0.0, 1.0], got: {p}")
        return p

    def validate_evidence(
        self,
        anomaly_evidence: Any,
        drift_predictions: Any,
        safety_slope: Any
    ) -> None:
        """Validates required evidence structures, numeric types, finite bounds, and enum statuses without fallback defaults."""
        if not isinstance(anomaly_evidence, dict):
            raise ValueError("VALIDATION_ERROR: anomaly_evidence must be a dictionary")
        if not isinstance(drift_predictions, dict):
            raise ValueError("VALIDATION_ERROR: drift_predictions must be a dictionary")
        if not isinstance(safety_slope, dict):
            raise ValueError("VALIDATION_ERROR: safety_slope must be a dictionary")

        # 1. Validate PAT Evidence
        pat = anomaly_evidence.get("pat")
        if not isinstance(pat, dict):
            raise ValueError("VALIDATION_ERROR: Missing required 'pat' evidence dictionary")
        pat_status = pat.get("status")
        if pat_status not in VALID_PAT_STATUSES:
            raise ValueError(f"VALIDATION_ERROR: Invalid PAT status '{pat_status}'. Must be one of: {sorted(list(VALID_PAT_STATUSES))}")

        pat_scores = pat.get("parameter_z_scores")
        if not isinstance(pat_scores, dict):
            raise ValueError("VALIDATION_ERROR: Missing required 'parameter_z_scores' in PAT evidence")
        for p in ["iddq", "ileak", "tpd"]:
            if p not in pat_scores:
                raise ValueError(f"VALIDATION_ERROR: Missing required PAT z-score for parameter '{p}'")
            z_val = pat_scores[p]
            if z_val is None or isinstance(z_val, bool):
                raise ValueError(f"VALIDATION_ERROR: PAT z-score for '{p}' cannot be None/bool")
            try:
                fz = float(z_val)
                if not math.isfinite(fz):
                    raise ValueError(f"VALIDATION_ERROR: Non-finite PAT z-score for '{p}'")
            except (ValueError, TypeError):
                raise ValueError(f"VALIDATION_ERROR: Non-numeric PAT z-score for '{p}'")

        # 2. Validate COPOD Evidence
        copod = anomaly_evidence.get("copod")
        if not isinstance(copod, dict):
            raise ValueError("VALIDATION_ERROR: Missing required 'copod' evidence dictionary")
        copod_status = copod.get("status")
        if copod_status not in VALID_COPOD_STATUSES:
            raise ValueError(f"VALIDATION_ERROR: Invalid COPOD status '{copod_status}'. Must be one of: {sorted(list(VALID_COPOD_STATUSES))}")

        copod_score = copod.get("score")
        if copod_score is None or isinstance(copod_score, bool):
            raise ValueError("VALIDATION_ERROR: COPOD score cannot be None/bool")
        try:
            fc = float(copod_score)
            if not math.isfinite(fc):
                raise ValueError("VALIDATION_ERROR: Non-finite COPOD score")
        except (ValueError, TypeError):
            raise ValueError("VALIDATION_ERROR: Non-numeric COPOD score")

        # 3. Validate Anomaly / Fusion Status Enumerations
        fusion_status = anomaly_evidence.get("anomaly_status") or anomaly_evidence.get("overall_status")
        if fusion_status and fusion_status not in VALID_ANOMALY_STATUSES:
            raise ValueError(f"VALIDATION_ERROR: Invalid anomaly status '{fusion_status}'. Must be one of: {sorted(list(VALID_ANOMALY_STATUSES))}")

        # 4. DEFECT 1: Validate GPR Drift Evidence (Fail closed on missing/non-finite upper_95)
        for p in ["iddq", "ileak", "tpd"]:
            if p not in drift_predictions:
                raise ValueError(f"VALIDATION_ERROR: Missing GPR drift prediction for parameter '{p}'")
            d_item = drift_predictions[p]
            if not isinstance(d_item, dict):
                raise ValueError(f"VALIDATION_ERROR: GPR drift prediction for '{p}' must be a dictionary")
            has_history = d_item.get("has_history", True)
            d_status = d_item.get("status")
            if has_history and d_status != "INSUFFICIENT_HISTORY":
                if "upper_95" not in d_item or d_item["upper_95"] is None or isinstance(d_item["upper_95"], bool):
                    raise ValueError(f"VALIDATION_ERROR: Missing required GPR upper_95 for parameter '{p}'")
                try:
                    fu = float(d_item["upper_95"])
                    if not math.isfinite(fu):
                        raise ValueError(f"VALIDATION_ERROR: Non-finite GPR upper_95 for parameter '{p}'")
                except (ValueError, TypeError):
                    raise ValueError(f"VALIDATION_ERROR: Non-numeric GPR upper_95 for parameter '{p}'")

        # 5. DEFECT 2: Validate Safety Slope Evidence (Fail closed on missing/non-finite upper_bound_slope)
        for p in ["iddq", "ileak", "tpd"]:
            if p not in safety_slope:
                raise ValueError(f"VALIDATION_ERROR: Missing safety slope evidence for parameter '{p}'")
            s_item = safety_slope[p]
            if not isinstance(s_item, dict):
                raise ValueError(f"VALIDATION_ERROR: Safety slope evidence for '{p}' must be a dictionary")
            b_status = s_item.get("boundary_status")
            if b_status not in VALID_SAFETY_STATUSES:
                raise ValueError(f"VALIDATION_ERROR: Invalid safety boundary_status '{b_status}' for '{p}'. Must be one of: {sorted(list(VALID_SAFETY_STATUSES))}")

            if b_status != "INSUFFICIENT_HISTORY":
                if "upper_bound_slope" not in s_item or s_item["upper_bound_slope"] is None or isinstance(s_item["upper_bound_slope"], bool):
                    raise ValueError(f"VALIDATION_ERROR: Missing required safety upper_bound_slope for parameter '{p}'")
                try:
                    fs = float(s_item["upper_bound_slope"])
                    if not math.isfinite(fs):
                        raise ValueError(f"VALIDATION_ERROR: Non-finite safety upper_bound_slope for parameter '{p}'")
                except (ValueError, TypeError):
                    raise ValueError(f"VALIDATION_ERROR: Non-numeric safety upper_bound_slope for parameter '{p}'")

    def evaluate(
        self,
        ml_probability: float,
        anomaly_evidence: Dict[str, Any],
        drift_predictions: Dict[str, Any],
        safety_slope: Dict[str, Any],
        client_supplied_risk_score: Optional[Any] = None,
        client_supplied_disposition: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Executes governed multi-criteria risk fusion and disposition synthesis.
        Fails closed on non-finite ML probability, malformed evidence, or client authority injections.
        """
        if client_supplied_risk_score is not None:
            raise ValueError("VALIDATION_ERROR: Client-supplied risk score authority injection rejected")
        if client_supplied_disposition is not None:
            raise ValueError("VALIDATION_ERROR: Client-supplied disposition authority injection rejected")

        p_ml = self.validate_ml_probability(ml_probability)
        self.validate_evidence(anomaly_evidence, drift_predictions, safety_slope)

        pat = anomaly_evidence["pat"]
        copod = anomaly_evidence["copod"]
        pat_scores = pat["parameter_z_scores"]
        copod_score = float(copod["score"])

        pat_status = pat["status"]
        copod_status = copod["status"]
        fusion_status = anomaly_evidence.get("anomaly_status") or anomaly_evidence.get("overall_status", "NORMAL")

        param_risk = {}
        dominant_factors = []
        params = ["iddq", "ileak", "tpd"]

        z_thresh = float(self.pat_params["z_threshold"])
        z_mult = float(self.pat_params["scale_multiplier"])
        ratio_thresh = float(self.gpr_params["ratio_threshold"])
        ratio_mult = float(self.gpr_params["scale_multiplier"])

        for p in params:
            # 1. PAT Anomaly Z-Score Risk
            raw_z = pat_scores[p]
            z_score = abs(float(raw_z))
            a_score = min(100.0, max(0.0, (z_score - z_thresh) * z_mult)) if z_score > z_thresh else 0.0

            # 2. GPR Drift & Safety Slope Risk (Handling INSUFFICIENT_HISTORY explicitly)
            d_item = drift_predictions[p]
            s_item = safety_slope[p]

            b_status = s_item.get("boundary_status", "WITHIN")
            d_status = d_item.get("status")
            has_history = d_item.get("has_history", True)

            if not has_history or d_status == "INSUFFICIENT_HISTORY" or b_status == "INSUFFICIENT_HISTORY":
                # DEFECT 3: Explicit INSUFFICIENT_HISTORY handling
                d_score = 0.0
                b_status = "INSUFFICIENT_HISTORY"
            else:
                upper_95 = float(d_item["upper_95"])
                upper_slope = float(s_item["upper_bound_slope"])

                cfg = self.physics_limits[p]
                r_upper = upper_95 / float(cfg["max_limit"]) if float(cfg["max_limit"]) > 0 else 0.0
                r_slope = upper_slope / float(cfg["max_slope_per_hour"]) if float(cfg["max_slope_per_hour"]) > 0 else 0.0
                r_max = max(r_upper, r_slope)
                d_score = min(100.0, max(0.0, (r_max - ratio_thresh) * ratio_mult)) if r_max > ratio_thresh else 0.0

            p_risk = max(a_score, d_score, 0.5 * a_score + 0.5 * d_score)
            param_risk[p] = {
                "anomaly_risk": round(a_score, 2),
                "drift_risk": round(d_score, 2),
                "parameter_risk": round(p_risk, 2),
                "boundary_status": b_status,
            }

            if a_score >= 50.0:
                dominant_factors.append(f"PAT_ANOMALY_{p.upper()}_Z={z_score:.2f}")
            if d_score >= 50.0:
                dominant_factors.append(f"HIGH_DRIFT_{p.upper()}_TRAJECTORY")

        # Aggregate Base Component Risk
        w_max = float(self.weights["base_max_weight"])
        w_mean = float(self.weights["base_mean_weight"])

        p_risks = [param_risk[p]["parameter_risk"] for p in params]
        max_p_risk = max(p_risks) if p_risks else 0.0
        avg_p_risk = sum(p_risks) / len(p_risks) if p_risks else 0.0
        base_risk = max_p_risk * w_max + avg_p_risk * w_mean

        # Degradation Drift Score
        d_risks = [param_risk[p]["drift_risk"] for p in params]
        max_d_risk = max(d_risks) if d_risks else 0.0
        avg_d_risk = sum(d_risks) / len(d_risks) if d_risks else 0.0
        degradation_drift_score = round(max_d_risk * w_max + avg_d_risk * w_mean, 2)

        # COPOD Tail Risk Boost
        copod_b_thresh = float(self.copod_params["boost_threshold"])
        copod_b_mult = float(self.copod_params["boost_multiplier"])
        copod_b_max = float(self.copod_params["max_boost"])

        if copod_score > copod_b_thresh:
            base_risk += min(copod_b_max, (copod_score - copod_b_thresh) * copod_b_mult)
            dominant_factors.append(f"COPOD_TAIL_SCORE={copod_score:.2f}")

        risk_score = min(100.0, max(0.0, base_risk))

        # Check Safety Precedence Overrides & Floors
        any_exceeded = any(s.get("boundary_status") == "EXCEEDED" for s in safety_slope.values())
        any_warning = any(s.get("boundary_status") == "WARNING" for s in safety_slope.values())

        floor_exceeded = float(self.override_floors["safety_exceeded"])
        floor_rej = float(self.override_floors["anomaly_reject"])
        floor_warn = float(self.override_floors["safety_warning"])
        floor_mon = float(self.override_floors["anomaly_monitor"])

        if any_exceeded:
            risk_score = max(risk_score, floor_exceeded)
            dominant_factors.append("SAFETY_CRITERION_EXCEEDED_OVERRIDE")
        elif pat_status == "REJECT" or copod_status == "REJECT" or fusion_status == "REJECT":
            risk_score = max(risk_score, floor_rej)
            dominant_factors.append("ANOMALY_REJECT_OVERRIDE")
        elif any_warning:
            risk_score = max(risk_score, floor_warn)
            dominant_factors.append("SAFETY_CRITERION_WARNING_OVERRIDE")
        elif fusion_status == "MONITOR":
            risk_score = max(risk_score, floor_mon)
            dominant_factors.append("ANOMALY_MONITOR_OVERRIDE")

        risk_score = round(risk_score, 2)

        # Risk Classification
        safe_max = float(self.risk_classes_cfg["safe_max"])
        monitor_max = float(self.risk_classes_cfg["monitor_max"])

        if risk_score >= monitor_max:
            risk_class = "AT RISK"
        elif risk_score >= safe_max:
            risk_class = "MONITOR"
        else:
            risk_class = "SAFE"

        # Disposition Synthesis & Override Reason Determination
        disposition = "PASS"
        override_reason = "NONE"

        if p_ml >= self.high_risk_threshold or pat_status == "REJECT" or copod_status == "REJECT" or fusion_status == "REJECT" or any_exceeded:
            disposition = "REJECT"
            if p_ml >= self.high_risk_threshold:
                override_reason = "ML_HIGH_RISK"
            elif pat_status == "REJECT":
                override_reason = "PAT_CRITICAL_ANOMALY"
            elif copod_status == "REJECT":
                override_reason = "COPOD_CRITICAL_ANOMALY"
            elif safety_slope.get("iddq", {}).get("boundary_status") == "EXCEEDED":
                override_reason = "GPR_IDDQ_LIMIT_EXCEEDED"
            elif safety_slope.get("ileak", {}).get("boundary_status") == "EXCEEDED":
                override_reason = "GPR_ILEAK_LIMIT_EXCEEDED"
            elif safety_slope.get("tpd", {}).get("boundary_status") == "EXCEEDED":
                override_reason = "GPR_TPD_LIMIT_EXCEEDED"
            else:
                override_reason = "PAT_CRITICAL_ANOMALY"
        elif p_ml >= self.operating_threshold or fusion_status == "MONITOR" or any_warning:
            disposition = "MONITOR"
            if p_ml >= self.operating_threshold:
                override_reason = "ML_ELEVATED_RISK"
            else:
                override_reason = "ANOMALY_OR_DRIFT_WARNING"

        if not dominant_factors:
            dominant_factors.append("NOMINAL_OPERATING_ENVELOPE")

        unique_factors = sorted(list(set(dominant_factors)))

        # Machine-Readable Provenance Object
        provenance = {
            "contract_name": self.contract_data["contract_name"],
            "contract_version": self.contract_data["contract_version"],
            "contract_sha256": self.contract_sha256,
            "model_identity": "predicta_xgboost_model",
            "model_sha256": self.model_sha256,
            "operating_threshold": self.operating_threshold,
            "anomaly_detector_identity": "ANOMALY_FUSION_ENGINE",
            "prognostic_engine_identity": "GPR_DEGRADATION_FORECASTER",
            "physics_safety_identity": "SAFETY_SLOPE_CALCULATOR",
            "calculation_version": "1.0.0",
            "evaluation_status": "EVALUATION_ONLY",
            "governance_disclaimer": "NOT A FAILURE PROBABILITY. NOT AN EXPECTED MONETARY LOSS. NOT A CONFORMAL GUARANTEE.",
        }

        return {
            "risk_score": risk_score,
            "degradation_drift_score": degradation_drift_score,
            "risk_class": risk_class,
            "dominant_factors": unique_factors,
            "disposition": disposition,
            "override_reason": override_reason,
            "parameter_risk": param_risk,
            "provenance": provenance,
            "contract_version": self.contract_data["contract_version"],
            "contract_sha256": self.contract_sha256,
        }
