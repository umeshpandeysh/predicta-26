"""
PREDICTA Phase 5 — Explainability, Feature Attribution & Engineering Trace Engine
File: src/decision_engine/explanation.py

Concept Flow:
  Phases 1–4 Computed Evidence (PAT, COPOD, GPR, Safety Slope, Risk Engine)
        ↓
  Explainability Generator
        ↓
  - Deterministic Parameter Attribution (Iddq, Ileak, Tpd)
  - Ranked Top Risk Factors
  - Dynamic Engineering Summary & Rationale
  - Step-by-Step Decision Trace (ANOMALY → DRIFT → SAFETY → RISK → DECISION)
  - Calibrated 95% Confidence Interval Presentation
"""

from typing import Dict, Any, List

class ExplainabilityGenerator:
    def generate_explanation(
        self,
        anomaly_evidence: Dict[str, Any],
        drift_predictions: Dict[str, Any],
        safety_slope: Dict[str, Any],
        risk_engine: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generates comprehensive, deterministic engineering explainability trace."""

        pat = anomaly_evidence.get("pat", {})
        copod = anomaly_evidence.get("copod", {})
        pat_scores = pat.get("parameter_z_scores", {})
        copod_score = copod.get("score", 0.0)
        overall_anomaly = anomaly_evidence.get("overall_status", "NORMAL")

        risk_score = risk_engine.get("risk_score", 0.0)
        risk_class = risk_engine.get("risk_class", "SAFE")
        decision = risk_engine.get("decision", {})
        param_risk = risk_engine.get("parameter_risk", {})

        # 1. Deterministic Parameter Attribution
        attribution = {}
        params = ["iddq", "ileak", "tpd"]
        for p in params:
            pr = param_risk.get(p, {})
            a_contrib = float(pr.get("anomaly_risk", 0.0))
            d_contrib = float(pr.get("drift_risk", 0.0))

            s_item = safety_slope.get(p, {})
            b_status = s_item.get("boundary_status", "WITHIN")
            s_contrib = 50.0 if b_status == "EXCEEDED" else (25.0 if b_status == "WARNING" else 0.0)

            total = float(max(a_contrib, d_contrib, s_contrib, 0.5 * a_contrib + 0.5 * d_contrib + 0.5 * s_contrib))
            if total > 0.0:
                direction = "INCREASES_RISK"
            elif total < 0.0:
                direction = "REDUCES_RISK"
            else:
                direction = "NEUTRAL"

            attribution[p] = {
                "anomaly_contribution": round(a_contrib, 2),
                "drift_contribution": round(d_contrib, 2),
                "safety_contribution": round(s_contrib, 2),
                "total_contribution": round(total, 2),
                "direction": direction
            }

        # 2. Top Risk Factors Ranking
        top_factors = []
        for p in params:
            z_val = abs(pat_scores.get(p, 0.0))
            if z_val >= 6.0:
                top_factors.append(f"CRITICAL_{p.upper()}_PAT_ANOMALY_Z={z_val:.2f}")
            elif z_val >= 3.0:
                top_factors.append(f"ELEVATED_{p.upper()}_PAT_ANOMALY_Z={z_val:.2f}")

            s_item = safety_slope.get(p, {})
            if s_item.get("boundary_status") == "EXCEEDED":
                top_factors.append(f"EXCEEDED_{p.upper()}_TRAJECTORY_SCREENING_CRITERION")
            elif s_item.get("boundary_status") == "WARNING":
                top_factors.append(f"WARNING_{p.upper()}_TRAJECTORY_APPROACHES_CRITERION")

            d_item = drift_predictions.get(p, {})
            u95 = d_item.get("upper_95", 0.0)
            if pr.get("drift_risk", 0.0) >= 50.0:
                top_factors.append(f"HIGH_{p.upper()}_DRIFT_FORECAST_UPPER95={u95:.1f}")

        if copod_score >= 9.5:
            top_factors.append(f"CRITICAL_COPOD_MULTIVARIATE_TAIL_SCORE={copod_score:.2f}")
        elif copod_score >= 6.5:
            top_factors.append(f"ELEVATED_COPOD_MULTIVARIATE_TAIL_SCORE={copod_score:.2f}")

        if not top_factors:
            top_factors.append("NOMINAL_OPERATING_ENVELOPE")

        # 3. Dynamic Human-Readable Rationale Summary
        if risk_class == "AT RISK":
            summary = f"AT RISK (Score: {risk_score:.1f}): Critical specification boundary exceeded or severe multi-criteria anomaly detected. Primary factor: {top_factors[0]}. Prioritized QA quarantine disposition recommended."
        elif risk_class == "MONITOR":
            summary = f"MONITOR (Score: {risk_score:.1f}): Elevated parameter drift or marginal anomaly score detected. Primary factor: {top_factors[0]}. Secondary QA inspection recommended."
        else:
            summary = f"SAFE (Score: {risk_score:.1f}): Early measurements remain within nominal reference bounds and predicted 168h trajectories adhere to project-defined screening criteria."

        # 4. Decision Trace Construction
        trace = [
            {
                "stage": "ANOMALY",
                "evidence": f"PAT Max Z-Score = {pat.get('score', 0.0):.2f}, COPOD Tail Score = {copod_score:.2f}",
                "status": overall_anomaly
            },
            {
                "stage": "DRIFT",
                "evidence": f"GPR 168h Forecasts: Tpd={drift_predictions.get('tpd', {}).get('predicted_168h', 0.0):.1f}ps [95% CI: {drift_predictions.get('tpd', {}).get('lower_95', 0.0):.1f}, {drift_predictions.get('tpd', {}).get('upper_95', 0.0):.1f}]",
                "status": "NOMINAL" if risk_class == "SAFE" else "ELEVATED"
            },
            {
                "stage": "SAFETY",
                "evidence": "Trajectory boundary statuses evaluated against project-defined screening criteria",
                "status": "EXCEEDED" if any(s.get("boundary_status") == "EXCEEDED" for s in safety_slope.values()) else ("WARNING" if any(s.get("boundary_status") == "WARNING" for s in safety_slope.values()) else "WITHIN")
            },
            {
                "stage": "RISK_ENGINE",
                "evidence": f"Multi-criteria fusion score = {risk_score:.2f}",
                "status": risk_class
            },
            {
                "stage": "DECISION",
                "evidence": f"Action: {decision.get('action', 'PROCEED_STANDARD_SCREENING')}",
                "status": decision.get("label", "PASS")
            }
        ]

        # Structured Evidence Assembly
        drift_evidence = {}
        for p in params:
            d_item = drift_predictions.get(p, {})
            drift_evidence[p] = {
                "predicted_168h": d_item.get("predicted_168h", 0.0),
                "uncertainty_std": d_item.get("uncertainty_std", 0.0),
                "ci_95": [d_item.get("lower_95", 0.0), d_item.get("upper_95", 0.0)]
            }

        return {
            "summary": summary,
            "attribution_method": "DETERMINISTIC_ENGINEERING_ATTRIBUTION",
            "top_risk_factors": top_factors[:5],
            "parameter_attribution": attribution,
            "evidence": {
                "anomaly": {
                    "pat_score": pat.get("score", 0.0),
                    "pat_status": pat.get("status", "PASS"),
                    "copod_score": copod_score,
                    "copod_status": copod.get("status", "PASS"),
                    "overall_status": overall_anomaly
                },
                "drift": drift_evidence,
                "safety": safety_slope
            },
            "decision_trace": trace,
            "recommended_action": decision.get("action", "PROCEED_STANDARD_SCREENING"),
            "criteria_source": "PROJECT_DEFINED_SCREENING_CRITERIA"
        }


def generate_decision_explanation(
    component_id: str,
    lot_id: str,
    anomaly_score: float,
    safety_evaluations: dict,
    decision: dict
) -> dict:
    """Legacy helper wrapper."""
    reasons = [decision.get("reason", "Nominal operational bounds.")]
    return {
        "component_id": component_id,
        "lot_id": lot_id,
        "final_decision": decision.get("status", "PASS"),
        "risk_level": decision.get("risk_level", "LOW"),
        "contributing_reasons": reasons,
        "explanation": f"Component screening result: {decision.get('status', 'PASS')}. {reasons[0]}"
    }
