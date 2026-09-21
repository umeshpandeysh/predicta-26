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


def load_risk_fusion_contract(contract_path: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
    """Loads and computes SHA-256 for the risk fusion contract JSON."""
    target_path = contract_path or CONTRACT_PATH
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"CONFIGURATION_ERROR: Risk fusion contract not found at {target_path}")
    
    with open(target_path, "r", encoding="utf-8") as f:
        raw_content = f.read()
    
    contract_data = json.loads(raw_content)
    normalized = raw_content.replace("\r\n", "\n")
    sha256 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    
    return contract_data, sha256


class GovernedRiskFusionEngine:
    def __init__(self, contract_path: Optional[str] = None):
        self.contract_path = contract_path or CONTRACT_PATH
        self.contract_data, self.contract_sha256 = load_risk_fusion_contract(self.contract_path)
        self.operating_threshold = float(self.contract_data.get("operating_threshold", 0.20))
        self.high_risk_threshold = float(self.contract_data.get("high_risk_probability_threshold", 0.65))
        self.spec_limits = {
            "iddq": {"max_limit": 5000.0, "max_slope_per_hour": 15.0},
            "ileak": {"max_limit": 500.0, "max_slope_per_hour": 2.0},
            "tpd": {"max_limit": 250.0, "max_slope_per_hour": 1.0},
        }

    def validate_ml_probability(self, ml_probability: Any) -> float:
        """Validates calibrated failure probability P, failing closed on non-finite or out-of-bounds values."""
        if ml_probability is None:
            raise ValueError("VALIDATION_ERROR: ml_probability cannot be None")
        try:
            p = float(ml_probability)
        except (ValueError, TypeError):
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be a numeric value, got: {ml_probability}")

        if math.isnan(p) or math.isinf(p):
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be finite, got: {p}")
        if p < 0.0 or p > 1.0:
            raise ValueError(f"VALIDATION_ERROR: ml_probability must be in range [0.0, 1.0], got: {p}")
        return p

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
        Fails closed on non-finite ML probability or malformed inputs.
        Ignores client-supplied risk scores or dispositions to enforce server-side authority.
        """
        p_ml = self.validate_ml_probability(ml_probability)

        if not isinstance(anomaly_evidence, dict) or not isinstance(drift_predictions, dict) or not isinstance(safety_slope, dict):
            raise ValueError("VALIDATION_ERROR: anomaly_evidence, drift_predictions, and safety_slope must be dictionaries")

        pat = anomaly_evidence.get("pat", {})
        copod = anomaly_evidence.get("copod", {})
        pat_scores = pat.get("parameter_z_scores", {})
        copod_score_raw = copod.get("score", 0.0)
        
        if copod_score_raw is None or not math.isfinite(float(copod_score_raw)):
            raise ValueError("VALIDATION_ERROR: Non-finite COPOD score")
        copod_score = float(copod_score_raw)
        
        pat_status = pat.get("status", "PASS")
        copod_status = copod.get("status", "PASS")
        fusion_status = anomaly_evidence.get("anomaly_status") or anomaly_evidence.get("overall_status", "NORMAL")

        param_risk = {}
        dominant_factors = []
        params = ["iddq", "ileak", "tpd"]

        for p in params:
            # 1. PAT Anomaly Z-Score Risk
            raw_z = pat_scores.get(p, 0.0)
            if raw_z is None:
                raw_z = 0.0
            if not math.isfinite(float(raw_z)):
                raise ValueError(f"VALIDATION_ERROR: Non-finite PAT score for {p}")
            z_score = abs(float(raw_z))
            a_score = min(100.0, max(0.0, (z_score - 1.0) * 15.0)) if z_score > 1.0 else 0.0

            # 2. GPR Drift & Safety Slope Risk
            d_item = drift_predictions.get(p, {}) if isinstance(drift_predictions, dict) else {}
            s_item = safety_slope.get(p, {}) if isinstance(safety_slope, dict) else {}
            
            upper_95_raw = d_item.get("upper_95")
            upper_slope_raw = s_item.get("upper_bound_slope")
            
            upper_95 = float(upper_95_raw) if (upper_95_raw is not None and math.isfinite(float(upper_95_raw))) else 0.0
            upper_slope = float(upper_slope_raw) if (upper_slope_raw is not None and math.isfinite(float(upper_slope_raw))) else 0.0

            cfg = self.spec_limits.get(p, {"max_limit": 250.0, "max_slope_per_hour": 1.0})
            r_upper = upper_95 / cfg["max_limit"] if cfg["max_limit"] > 0 else 0.0
            r_slope = upper_slope / cfg["max_slope_per_hour"] if cfg["max_slope_per_hour"] > 0 else 0.0
            r_max = max(r_upper, r_slope)
            d_score = min(100.0, max(0.0, (r_max - 0.70) * 250.0)) if r_max > 0.70 else 0.0

            p_risk = max(a_score, d_score, 0.5 * a_score + 0.5 * d_score)
            param_risk[p] = {
                "anomaly_risk": round(a_score, 2),
                "drift_risk": round(d_score, 2),
                "parameter_risk": round(p_risk, 2),
                "boundary_status": s_item.get("boundary_status", "WITHIN"),
            }

            if a_score >= 50.0:
                dominant_factors.append(f"PAT_ANOMALY_{p.upper()}_Z={z_score:.2f}")
            if d_score >= 50.0:
                dominant_factors.append(f"HIGH_DRIFT_{p.upper()}_TRAJECTORY")

        # Aggregate Base Component Risk
        p_risks = [param_risk[p]["parameter_risk"] for p in params]
        max_p_risk = max(p_risks) if p_risks else 0.0
        avg_p_risk = sum(p_risks) / len(p_risks) if p_risks else 0.0
        base_risk = max_p_risk * 0.70 + avg_p_risk * 0.30

        # Degradation Drift Score
        d_risks = [param_risk[p]["drift_risk"] for p in params]
        max_d_risk = max(d_risks) if d_risks else 0.0
        avg_d_risk = sum(d_risks) / len(d_risks) if d_risks else 0.0
        degradation_drift_score = round(max_d_risk * 0.70 + avg_d_risk * 0.30, 2)

        # COPOD Tail Risk Boost
        if copod_score > 6.5:
            base_risk += min(20.0, (copod_score - 6.5) * 5.0)
            dominant_factors.append(f"COPOD_TAIL_SCORE={copod_score:.2f}")

        risk_score = min(100.0, max(0.0, base_risk))

        # Check Safety Precedence Overrides & Floors
        any_exceeded = any(s.get("boundary_status") == "EXCEEDED" for s in safety_slope.values())
        any_warning = any(s.get("boundary_status") == "WARNING" for s in safety_slope.values())

        if any_exceeded:
            risk_score = max(risk_score, 75.0)
            dominant_factors.append("SAFETY_CRITERION_EXCEEDED_OVERRIDE")
        elif pat_status == "REJECT" or copod_status == "REJECT" or fusion_status == "REJECT":
            risk_score = max(risk_score, 70.0)
            dominant_factors.append("ANOMALY_REJECT_OVERRIDE")
        elif any_warning:
            risk_score = max(risk_score, 40.0)
            dominant_factors.append("SAFETY_CRITERION_WARNING_OVERRIDE")
        elif fusion_status == "MONITOR":
            risk_score = max(risk_score, 35.0)
            dominant_factors.append("ANOMALY_MONITOR_OVERRIDE")

        risk_score = round(risk_score, 2)

        # Risk Classification
        if risk_score >= 67.0:
            risk_class = "AT RISK"
        elif risk_score >= 34.0:
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

        return {
            "risk_score": risk_score,
            "degradation_drift_score": degradation_drift_score,
            "risk_class": risk_class,
            "dominant_factors": unique_factors,
            "disposition": disposition,
            "override_reason": override_reason,
            "parameter_risk": param_risk,
            "contract_version": self.contract_data.get("contract_version", "1.0.0"),
            "contract_sha256": self.contract_sha256,
        }
