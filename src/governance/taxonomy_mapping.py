"""
PREDICTA-26 Phase 17.1 — Governed Decision Center Taxonomy Mapping Engine (Python)
File: src/governance/taxonomy_mapping.py

Bridges the four distinct vocabularies in the PREDICTA-26 platform:
1. ML Decision Layer: PASS / FAIL (Binary classifier + failure probability vs locked threshold 0.20)
2. Operational Recommendation Layer: PASS / MONITOR / REJECT (Multi-criteria evidence synthesis)
3. Backend Human Governance Layer: ACCEPT / REJECT / HOLD / RETEST / ESCALATE (Authoritative lifecycle)
4. Target Judge/Operator UI Actions: PASS / MONITOR / RETEST / REJECT (Interactive operator actions)

CRITICAL INVARIANTS:
- ML Prediction and Calibrated Probability are STRICTLY IMMUTABLE and read-only.
- Backend governance contract remains authoritative.
- ESCALATE maps to UI action MONITOR with an explicit ESCALATION INDICATOR (semantically loss-protected).
- Missing evidence evaluates fail-closed to "INSUFFICIENT EVIDENCE".
- Zero fabrication of failure times or lead times (basis locked to 168H_EVALUATION_HORIZON_NOT_FAILURE_TIME).
"""

import json
import os
from typing import Any, Dict, List, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TAXONOMY_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "governance", "taxonomy_mapping_contract.json")
DISPOSITION_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "governance", "disposition_contract.json")

# Authoritative Vocabularies
UI_ACTION_TAXONOMY: List[str] = ["PASS", "MONITOR", "RETEST", "REJECT"]
ML_DECISION_TAXONOMY: List[str] = ["PASS", "FAIL"]
OPERATIONAL_RECOMMENDATION_TAXONOMY: List[str] = ["PASS", "MONITOR", "REJECT"]
BACKEND_DISPOSITION_TAXONOMY: List[str] = ["ACCEPT", "REJECT", "HOLD", "RETEST", "ESCALATE"]

REASON_CODE_TAXONOMY: List[str] = [
    "FALSE_POSITIVE_SUSPECTED",
    "FALSE_NEGATIVE_SUSPECTED",
    "INSUFFICIENT_DATA",
    "RETEST_REQUIRED",
    "EQUIPMENT_ISSUE",
    "PROCESS_EXCEPTION",
    "MANUAL_ENGINEERING_REVIEW",
    "OTHER",
]

LEAD_TIME_BASIS: str = "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"
INSUFFICIENT_EVIDENCE_STATUS: str = "INSUFFICIENT EVIDENCE"
OPERATING_THRESHOLD: float = 0.20


def load_taxonomy_contract(contract_path: str = TAXONOMY_CONTRACT_PATH) -> Dict[str, Any]:
    """Loads authoritative taxonomy mapping contract."""
    if not os.path.exists(contract_path):
        raise FileNotFoundError(f"CONTRACT_MISSING: Taxonomy contract missing at {contract_path}")
    with open(contract_path, "r", encoding="utf-8") as f:
        return json.load(f)


def map_ui_to_backend_disposition(ui_action: str) -> str:
    """
    Maps an interactive operator UI action to the authoritative backend governance disposition.
    UI actions: PASS, MONITOR, RETEST, REJECT.
    Backend dispositions: ACCEPT, HOLD, RETEST, REJECT.
    """
    if not isinstance(ui_action, str):
        raise ValueError("INVALID_UI_ACTION: UI action must be a string.")

    cleaned = ui_action.strip().upper()
    mapping = {
        "PASS": "ACCEPT",
        "MONITOR": "HOLD",
        "RETEST": "RETEST",
        "REJECT": "REJECT",
    }
    if cleaned not in mapping:
        raise ValueError(
            f"INVALID_UI_ACTION: '{ui_action}' is not a valid UI action. "
            f"Allowed actions: {UI_ACTION_TAXONOMY}"
        )
    return mapping[cleaned]


def map_backend_to_ui_disposition(backend_disp: str) -> Dict[str, Any]:
    """
    Maps a backend governance disposition to its UI representation.
    Ensures that ESCALATE is not lost and carries an explicit escalation indicator.
    """
    if not isinstance(backend_disp, str):
        raise ValueError("INVALID_BACKEND_DISPOSITION: Backend disposition must be a string.")

    cleaned = backend_disp.strip().upper()
    if cleaned == "ACCEPT":
        return {
            "ui_action": "PASS",
            "escalation_flag": False,
            "badge_class": "pass",
            "display_label": "PASS (ACCEPT)",
            "escalation_indicator": None,
        }
    elif cleaned == "HOLD":
        return {
            "ui_action": "MONITOR",
            "escalation_flag": False,
            "badge_class": "warning",
            "display_label": "MONITOR (HOLD)",
            "escalation_indicator": None,
        }
    elif cleaned == "RETEST":
        return {
            "ui_action": "RETEST",
            "escalation_flag": False,
            "badge_class": "info",
            "display_label": "RETEST",
            "escalation_indicator": None,
        }
    elif cleaned == "REJECT":
        return {
            "ui_action": "REJECT",
            "escalation_flag": False,
            "badge_class": "reject",
            "display_label": "REJECT",
            "escalation_indicator": None,
        }
    elif cleaned == "ESCALATE":
        return {
            "ui_action": "MONITOR",
            "escalation_flag": True,
            "badge_class": "critical",
            "display_label": "MONITOR (ESCALATED REVIEW REQUIRED)",
            "escalation_indicator": "ESCALATED_TO_QUALITY_ENGINEERING",
        }
    else:
        raise ValueError(
            f"INVALID_BACKEND_DISPOSITION: '{backend_disp}' is not a recognized backend disposition. "
            f"Allowed: {BACKEND_DISPOSITION_TAXONOMY}"
        )


def validate_governed_action(
    ui_action: str,
    reason_code: str,
    comment: Optional[str] = "",
) -> Dict[str, Any]:
    """
    Validates that a human operator action complies with governance rules:
    - UI action must be one of the four governed actions.
    - Controlled reason code is strictly required.
    - Comment length must not exceed 1000 characters.
    """
    backend_disp = map_ui_to_backend_disposition(ui_action)

    if not reason_code or not isinstance(reason_code, str):
        raise ValueError("REASON_CODE_REQUIRED: A valid controlled reason code is required for every governed disposition.")

    cleaned_reason = reason_code.strip().upper()
    if cleaned_reason not in REASON_CODE_TAXONOMY:
        raise ValueError(
            f"INVALID_REASON_CODE: '{reason_code}' is not in authoritative reason code taxonomy. "
            f"Allowed codes: {REASON_CODE_TAXONOMY}"
        )

    clean_comment = str(comment or "").strip()
    if len(clean_comment) > 1000:
        raise ValueError(f"COMMENT_TOO_LONG: Maximum allowed comment length is 1000 characters. Got: {len(clean_comment)}")

    return {
        "ui_action": ui_action.strip().upper(),
        "backend_disposition": backend_disp,
        "reason_code": cleaned_reason,
        "comment": clean_comment,
        "is_valid": True,
    }


def derive_operational_recommendation(
    ml_prediction: str,
    probability: float,
    anomaly_status: Optional[str] = None,
    drift_status: Optional[str] = None,
    physics_status: Optional[str] = None,
) -> str:
    """
    Synthesizes the multi-criteria operational recommendation (PASS, MONITOR, REJECT)
    from ML risk and reliability evidence without mutating the original ML prediction.
    """
    pred_upper = str(ml_prediction or "").strip().upper()
    anom_upper = str(anomaly_status or "").strip().upper()
    drift_upper = str(drift_status or "").strip().upper()
    phys_upper = str(physics_status or "").strip().upper()

    # Rule 1: High risk or critical violation -> REJECT
    if probability >= OPERATING_THRESHOLD or pred_upper == "FAIL" or anom_upper == "REJECT" or phys_upper == "VIOLATION":
        return "REJECT"

    # Rule 2: Warning evidence or elevated risk -> MONITOR
    if (
        anom_upper in ("MONITOR", "WARNING")
        or drift_upper in ("WARNING", "HIGH_DRIFT", "EXCEEDED_LIMIT")
        or phys_upper in ("DEGRADATION_FLAGGED", "WARNING")
        or probability >= (OPERATING_THRESHOLD / 2.0)  # e.g. >= 0.10
    ):
        return "MONITOR"

    # Rule 3: Nominal baseline -> PASS
    return "PASS"


def format_evidence_explainer_layers(evidence_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Formats the six WHY-FLAGGED evidence categories with fail-closed missing data handling.
    If any category is absent or unestablished, marks it as 'INSUFFICIENT EVIDENCE'
    without inventing placeholder values.
    """
    data = evidence_data or {}

    # Category 1: Lot Deviation
    raw_lot = data.get("lot_deviation")
    if isinstance(raw_lot, dict) and raw_lot.get("status") not in (None, "", "INSUFFICIENT_EVIDENCE"):
        lot_dev = {
            "status": raw_lot.get("status", "NORMAL"),
            "max_z_score": raw_lot.get("max_z_score", 0.0),
            "contributing_features": raw_lot.get("contributing_features", []),
            "has_evidence": True,
        }
    else:
        lot_dev = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "max_z_score": None,
            "contributing_features": [],
            "has_evidence": False,
        }

    # Category 2: Trajectory Drift
    raw_drift = data.get("trajectory_drift")
    if isinstance(raw_drift, dict) and raw_drift.get("has_history") is True:
        traj_drift = {
            "status": raw_drift.get("forecast_status", "STABLE"),
            "drift_rate_per_hour": raw_drift.get("drift_rate"),
            "has_history": True,
            "has_evidence": True,
        }
    else:
        traj_drift = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "drift_rate_per_hour": None,
            "has_history": False,
            "has_evidence": False,
        }

    # Category 3: 168h Prognostic Forecast
    raw_prog = data.get("forecast_168h") or data.get("prognostic_forecast_168h")
    if isinstance(raw_prog, dict) and (raw_prog.get("predicted_leakage_168h") is not None or raw_prog.get("predicted_delay_168h") is not None):
        forecast_168h = {
            "status": raw_prog.get("status", "WITHIN_LIMITS"),
            "predicted_leakage_168h": raw_prog.get("predicted_leakage_168h"),
            "predicted_delay_168h": raw_prog.get("predicted_delay_168h"),
            "lead_time_basis": LEAD_TIME_BASIS,
            "has_evidence": True,
        }
    else:
        forecast_168h = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "predicted_leakage_168h": None,
            "predicted_delay_168h": None,
            "lead_time_basis": LEAD_TIME_BASIS,
            "has_evidence": False,
        }

    # Category 4: Uncertainty Envelope
    raw_uncert = data.get("uncertainty_envelope") or data.get("conformal_uncertainty")
    if isinstance(raw_uncert, dict) and raw_uncert.get("coverage_probability") is not None:
        uncert_env = {
            "status": raw_uncert.get("status", "STABLE_ENVELOPE"),
            "coverage_probability": raw_uncert.get("coverage_probability"),
            "conformal_band": raw_uncert.get("conformal_band"),
            "has_evidence": True,
        }
    else:
        uncert_env = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "coverage_probability": None,
            "conformal_band": None,
            "has_evidence": False,
        }

    # Category 5: Physics Consistency
    raw_phys = data.get("physics_consistency")
    if isinstance(raw_phys, dict) and raw_phys.get("status") not in (None, "", "INSUFFICIENT_PHYSICS_EVIDENCE"):
        phys_cons = {
            "status": raw_phys.get("status", "CONSISTENT"),
            "consistency_score": raw_phys.get("consistency_score"),
            "checks_evaluated": raw_phys.get("checks_evaluated", []),
            "has_evidence": True,
        }
    else:
        phys_cons = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "consistency_score": None,
            "checks_evaluated": [],
            "has_evidence": False,
        }

    # Category 6: Risk Contribution (SHAP attributions)
    raw_risk = data.get("risk_contribution") or data.get("model_counterfactual")
    if isinstance(raw_risk, dict) and raw_risk.get("top_features"):
        risk_contrib = {
            "status": "ATTRIBUTION_COMPUTED",
            "top_features": raw_risk.get("top_features", []),
            "disclaimer": "MODEL ATTRIBUTION — NOT A CAUSAL CLAIM",
            "has_evidence": True,
        }
    else:
        risk_contrib = {
            "status": INSUFFICIENT_EVIDENCE_STATUS,
            "top_features": [],
            "disclaimer": "MODEL ATTRIBUTION — NOT A CAUSAL CLAIM",
            "has_evidence": False,
        }

    return {
        "lot_deviation": lot_dev,
        "trajectory_drift": traj_drift,
        "prognostic_forecast_168h": forecast_168h,
        "uncertainty_envelope": uncert_env,
        "physics_consistency": phys_cons,
        "risk_contribution": risk_contrib,
    }
