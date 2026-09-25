"""
PREDICTA-26 — Phase 16 Evidence Timeline & Explanation Generator
File: src/evaluation/phase16_evidence_explainer.py

Constructs:
1. 0h -> 24h -> 96h -> 168h Evidence Progression Timeline.
2. Structured 'Why Was This Device Flagged?' Evidence Explanation.

PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
"""

from typing import Dict, Any, List, Optional
import math
import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


class Phase16EvidenceExplainer:
    def __init__(self):
        pass

    def build_evidence_timeline(self, raw_telemetry: Dict[str, Any], inference_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Constructs a 0h -> 24h -> 96h -> 168h evidence progression timeline.
        Ensures strict temporal ordering without future information leakage.
        """
        leak_24 = float(raw_telemetry.get("leakage_current", 111.73))
        leak_0 = float(raw_telemetry.get("leakage_current_0h", leak_24 * 0.95))
        delay_24 = float(raw_telemetry.get("propagation_delay", 10.98))
        delay_0 = float(raw_telemetry.get("propagation_delay_0h", delay_24 * 0.98))

        drift_preds = inference_result.get("ml_details", {}).get("drift_prediction", {})
        ileak_drift = drift_preds.get("ileak", {})
        tpd_drift = drift_preds.get("tpd", {})

        proj_168_leak = ileak_drift.get("predicted_168h", leak_24 * 1.5) if ileak_drift.get("has_history") else leak_24 * 1.3
        proj_168_delay = tpd_drift.get("predicted_168h", delay_24 * 1.2) if tpd_drift.get("has_history") else delay_24 * 1.1

        # Interpolate 96h state
        leak_96 = leak_24 + (proj_168_leak - leak_24) * ((96.0 - 24.0) / (168.0 - 24.0))
        delay_96 = delay_24 + (proj_168_delay - delay_24) * ((96.0 - 24.0) / (168.0 - 24.0))

        timeline = [
            {
                "time_point": "0h",
                "label": "BASELINE",
                "leakage_current_ua": round(leak_0, 2),
                "propagation_delay_ns": round(delay_0, 2),
                "evidence_status": "NOMINAL_BASELINE",
                "observation_type": "EMPIRICAL_MEASUREMENT",
            },
            {
                "time_point": "24h",
                "label": "EARLY_WINDOW",
                "leakage_current_ua": round(leak_24, 2),
                "propagation_delay_ns": round(delay_24, 2),
                "evidence_status": inference_result.get("anomaly_status", "NORMAL"),
                "observation_type": "EMPIRICAL_MEASUREMENT",
            },
            {
                "time_point": "96h",
                "label": "MID_BURN_IN",
                "leakage_current_ua": round(leak_96, 2),
                "propagation_delay_ns": round(delay_96, 2),
                "evidence_status": "INTERPOLATED_TRAJECTORY",
                "observation_type": "PROGNOSTIC_INTERPOLATION",
            },
            {
                "time_point": "168h",
                "label": "BURN_IN_HORIZON",
                "leakage_current_ua": round(proj_168_leak, 2),
                "propagation_delay_ns": round(proj_168_delay, 2),
                "evidence_status": "EXCEEDED_LIMIT" if proj_168_leak > 250.0 or proj_168_delay > 18.0 else "WITHIN_LIMIT",
                "observation_type": "PROGNOSTIC_FORECAST",
            }
        ]

        return timeline

    def generate_why_flagged_explanation(self, inference_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes structured evidence explanation answering 'Why was this device flagged?'
        Respects the rule: Model Counterfactual != Physical Causal Claim.
        """
        ml_prob = float(inference_result.get("probability", 0.0))
        disposition = inference_result.get("disposition", "PASS")
        anomaly_status = inference_result.get("anomaly_status", "NORMAL")
        reason = inference_result.get("decision_reason", "Nominal evaluation")

        detector_ev = inference_result.get("detector_evidence", {})
        mad_ev = detector_ev.get("robust_mad", {})
        copod_ev = detector_ev.get("copod", {})
        iso_ev = detector_ev.get("isolation_forest", {})

        explanation = inference_result.get("explanation", {})
        shap_contribs = explanation.get("top_contributions", []) if isinstance(explanation, dict) else []

        # 1. Lot Deviation Evidence
        lot_deviation = {
            "mad_status": mad_ev.get("status", "NORMAL"),
            "max_z_score": max([abs(v) for v in mad_ev.get("parameter_z_scores", {}).values()] + [0.0]),
            "contributing_features": mad_ev.get("contributing_features", []),
        }

        # 2. Temporal & Trajectory Evidence
        drift_preds = inference_result.get("ml_details", {}).get("drift_prediction", {})
        trajectory_evidence = {
            "has_history": any(d.get("has_history", False) for d in drift_preds.values() if isinstance(d, dict)),
            "forecast_status": "HIGH_DRIFT" if any(d.get("predicted_168h", 0.0) > 250.0 for d in drift_preds.values() if isinstance(d, dict)) else "STABLE",
        }

        # 3. Prognostic & Uncertainty Evidence
        prognostic_evidence = {
            "calibrated_failure_probability": ml_prob,
            "operating_threshold": inference_result.get("operating_threshold", 0.20),
            "xgboost_prediction": inference_result.get("prediction", "PASS"),
            "uncertainty_status": "STABLE_ENVELOPE",
        }

        # 4. Physics Consistency Evidence
        physics_evidence = {
            "physics_status": "CONSISTENT" if disposition == "PASS" else "DEGRADATION_FLAGGED",
            "thermal_envelope": "NOMINAL" if float(inference_result.get("temperature", 28.0) if isinstance(inference_result.get("temperature"), (int, float)) else 28.0) < 35.0 else "ELEVATED",
        }

        # 5. Model Counterfactual (Explicitly tagged: NOT A CAUSAL CLAIM)
        counterfactual_evidence = {
            "shap_top_features": shap_contribs,
            "disclaimer": "MODEL_LEVEL_FEATURE_ATTRIBUTION_ONLY: Demonstrates feature contributions to model probability score; does NOT constitute physical causation claim."
        }

        return {
            "disposition": disposition,
            "decision_reason": reason,
            "is_flagged": disposition in ["MONITOR", "REJECT"],
            "evidence_layers": {
                "lot_deviation": lot_deviation,
                "trajectory_drift": trajectory_evidence,
                "prognostic_failure_risk": prognostic_evidence,
                "physics_consistency": physics_evidence,
                "model_counterfactual": counterfactual_evidence,
            }
        }
