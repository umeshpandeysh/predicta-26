"""
PREDICTA Phase 4 — Multi-Criteria Risk Engine & QA Decision Fusion
File: src/decision_engine/decision.py

Concept Flow:
  PAT/COPOD Anomaly + GPR Drift Forecast + Safety Slope Trajectory
        ↓
  Multi-Criteria Evidence Fusion Engine
        ↓
  Dimensionless Risk Score (0-100) → Risk Classification (SAFE / MONITOR / AT RISK)
        ↓
  QA Decision & Action Recommendation
"""

from typing import Dict, Any

class MultiCriteriaDecisionEngine:
    def __init__(self):
        self.spec_limits = {
            "iddq": {"max_limit": 5000.0, "max_slope_per_hour": 15.0},
            "ileak": {"max_limit": 500.0, "max_slope_per_hour": 2.0},
            "tpd": {"max_limit": 250.0, "max_slope_per_hour": 1.0}
        }

    def evaluate_multi_criteria_risk(
        self,
        anomaly_evidence: Dict[str, Any],
        drift_predictions: Dict[str, Any],
        safety_slope: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculates deterministic multi-criteria risk score (0-100), risk class, and QA action."""

        pat = anomaly_evidence.get("pat", {})
        copod = anomaly_evidence.get("copod", {})
        pat_scores = pat.get("parameter_z_scores", {})
        copod_score = copod.get("score", 0.0)
        overall_anomaly = anomaly_evidence.get("overall_status", "NORMAL")

        param_risk = {}
        dominant_factors = []

        params = ["iddq", "ileak", "tpd"]
        for p in params:
            # 1. Anomaly Evidence (PAT Z-score contribution)
            z_score = abs(pat_scores.get(p, 0.0))
            a_score = min(100.0, max(0.0, (z_score - 1.0) * 15.0)) if z_score > 1.0 else 0.0

            # 2. Drift & Trajectory Evidence
            d_item = drift_predictions.get(p, {})
            upper_95 = d_item.get("upper_95", 0.0)
            s_item = safety_slope.get(p, {})
            upper_slope = s_item.get("upper_bound_slope", 0.0)

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
                "boundary_status": s_item.get("boundary_status", "WITHIN")
            }

            if a_score >= 50.0:
                dominant_factors.append(f"PAT_ANOMALY_{p.upper()}_Z={z_score:.2f}")
            if d_score >= 50.0:
                dominant_factors.append(f"HIGH_DRIFT_{p.upper()}_TRAJECTORY")

        # Base Component Risk Aggregation
        p_risks = [param_risk[p]["parameter_risk"] for p in params]
        max_p_risk = max(p_risks) if p_risks else 0.0
        avg_p_risk = sum(p_risks) / len(p_risks) if p_risks else 0.0
        base_risk = max_p_risk * 0.70 + avg_p_risk * 0.30

        # COPOD tail risk contribution
        if copod_score > 6.5:
            base_risk += min(20.0, (copod_score - 6.5) * 5.0)
            dominant_factors.append(f"COPOD_TAIL_SCORE={copod_score:.2f}")

        risk_score = min(100.0, max(0.0, base_risk))

        # Safety Precedence Overrides
        any_exceeded = any(s.get("boundary_status") == "EXCEEDED" for s in safety_slope.values())
        any_warning = any(s.get("boundary_status") == "WARNING" for s in safety_slope.values())

        if any_exceeded:
            risk_score = max(risk_score, 75.0)
            dominant_factors.append("SAFETY_CRITERION_EXCEEDED_OVERRIDE")
        elif pat.get("status") == "REJECT" or copod.get("status") == "REJECT":
            risk_score = max(risk_score, 70.0)
            dominant_factors.append("ANOMALY_REJECT_OVERRIDE")
        elif any_warning:
            risk_score = max(risk_score, 40.0)
            dominant_factors.append("SAFETY_CRITERION_WARNING_OVERRIDE")
        elif overall_anomaly == "MONITOR":
            risk_score = max(risk_score, 35.0)
            dominant_factors.append("ANOMALY_MONITOR_OVERRIDE")

        risk_score = round(risk_score, 2)

        # Risk Classification
        if risk_score >= 67.0:
            risk_class = "AT RISK"
            decision_label = "REJECT"
            decision_action = "QUARANTINE_REJECT_RECOMMENDATION"
            decision_explanation = "Critical specification boundary exceeded or severe multi-criteria anomaly detected; component flagged for quarantine disposition."
        elif risk_score >= 34.0:
            risk_class = "MONITOR"
            decision_label = "MONITOR"
            decision_action = "RECOMMEND_SECONDARY_QA_REVIEW"
            decision_explanation = "Elevated parameter drift or marginal anomaly score detected; secondary QA inspection or extended burn-in monitoring recommended."
        else:
            risk_class = "SAFE"
            decision_label = "PASS"
            decision_action = "PROCEED_STANDARD_SCREENING"
            decision_explanation = "All physical parameters, degradation trajectories, and anomaly scores fall within nominal operating limits."

        if not dominant_factors:
            dominant_factors.append("NOMINAL_OPERATING_ENVELOPE")

        return {
            "risk_score": risk_score,
            "risk_class": risk_class,
            "dominant_factors": list(set(dominant_factors)),
            "parameter_risk": param_risk,
            "decision": {
                "label": decision_label,
                "action": decision_action,
                "explanation": decision_explanation
            }
        }


def make_screening_decision(
    anomaly_score: float, safety_evaluations: dict, data_quality_status: str = "VALID"
) -> dict:
    """Legacy compatibility helper wrapper."""
    engine = MultiCriteriaDecisionEngine()
    dummy_anomaly = {"pat": {"status": "PASS"}, "copod": {"score": anomaly_score}, "overall_status": "NORMAL"}
    dummy_drift = {p: {"value_24h": 0, "predicted_168h": 0, "uncertainty_std": 0, "upper_95": 0} for p in ["iddq", "ileak", "tpd"]}
    res = engine.evaluate_multi_criteria_risk(dummy_anomaly, dummy_drift, safety_evaluations)
    return {
        "status": res["decision"]["label"],
        "risk_level": "HIGH" if res["risk_class"] == "AT RISK" else ("MEDIUM" if res["risk_class"] == "MONITOR" else "LOW"),
        "reason": res["decision"]["explanation"]
    }
