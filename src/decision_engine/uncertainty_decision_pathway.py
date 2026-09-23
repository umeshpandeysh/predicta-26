"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
Governed Uncertainty Decision Pathway (Python)
File: src/decision_engine/uncertainty_decision_pathway.py

Implements the 4-way governed decision pathway:
1. PASS: Low probability (<0.10), nominal anomaly envelope, low prognostic uncertainty.
2. MONITOR: Moderate probability (0.10 - 0.199) or mild drift; safe for ongoing burn-in with logging.
3. HOLD (-> 96H_VERIFICATION): High prognostic uncertainty, OOD shift, or ambiguous chamber/sensor
   evidence requiring intermediate 96h burn-in verification.
   INVARIANT: Uncertainty is not automatically failure.
4. REJECT: High calibrated probability (>= 0.20), safety slope breach, physics violation,
   or severe silicon anomaly override.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any, Dict, List, Optional


class GovernedDecision(str, Enum):
    PASS = "PASS"
    MONITOR = "MONITOR"
    HOLD = "HOLD"
    REJECT = "REJECT"


class NextAction(str, Enum):
    RELEASE_TO_PRODUCTION = "RELEASE_TO_PRODUCTION"
    CONTINUE_MONITORED_BURN_IN = "CONTINUE_MONITORED_BURN_IN"
    ROUTE_TO_96H_VERIFICATION = "ROUTE_TO_96H_VERIFICATION"
    SCRAP_OR_FAILURE_ANALYSIS = "SCRAP_OR_FAILURE_ANALYSIS"
    EQUIPMENT_CHAMBER_AUDIT = "EQUIPMENT_CHAMBER_AUDIT"
    SENSOR_RECALIBRATION = "SENSOR_RECALIBRATION"


PROD_OPERATING_THRESHOLD = 0.20


def _is_finite(val: Any) -> bool:
    try:
        fval = float(val)
        return math.isfinite(fval)
    except (ValueError, TypeError):
        return False


class UncertaintyDecisionPathway:
    def __init__(self, threshold: float = PROD_OPERATING_THRESHOLD) -> None:
        self.operating_threshold = threshold

    def evaluate(self, input_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Evaluates the full evidence packet to synthesize a governed decision.
        """
        if not isinstance(input_data, dict):
            return self._fail_closed_decision("Missing or invalid input object")

        prob_raw = input_data.get("calibrated_probability")
        if not _is_finite(prob_raw):
            return self._fail_closed_decision(f"Invalid calibrated probability: {prob_raw}")

        prob = float(prob_raw)
        if prob < 0.0 or prob > 1.0:
            return self._fail_closed_decision(f"Probability outside [0, 1]: {prob}")

        anomaly = input_data.get("anomaly_evidence") or {}
        prog = input_data.get("prognostic_evidence") or {}
        physics = input_data.get("physics_evidence") or {}
        discrim = input_data.get("discrimination_evidence") or {}
        ood = input_data.get("ood_evidence") or {}
        safety = input_data.get("safety_slope") or {}

        decision_factors: List[str] = []
        decision = GovernedDecision.PASS.value
        next_action = NextAction.RELEASE_TO_PRODUCTION.value
        confidence = 0.90

        # Check 1: Root Discrimination overrides
        root_type = discrim.get("root_evidence_type")
        if root_type == "SENSOR_OR_DATA_QUALITY":
            return {
                "decision": GovernedDecision.HOLD.value,
                "next_action": NextAction.SENSOR_RECALIBRATION.value,
                "reason": "Sensor or data quality anomaly detected; silicon failure cannot be reliably inferred.",
                "decision_factors": ["SENSOR_DATA_QUALITY_OVERRIDE"] + discrim.get("findings", []),
                "governed_confidence": 0.85,
                "operating_threshold": self.operating_threshold,
                "requires_engineering_review": True,
                "uncertainty_routed_to_hold": True,
            }

        if root_type == "EQUIPMENT_OR_CHAMBER":
            return {
                "decision": GovernedDecision.HOLD.value,
                "next_action": NextAction.EQUIPMENT_CHAMBER_AUDIT.value,
                "reason": "Chamber/equipment-level shift detected across test cohort; die routed to hold pending chamber audit.",
                "decision_factors": ["EQUIPMENT_CHAMBER_CORRELATION_OVERRIDE"] + discrim.get("findings", []),
                "governed_confidence": 0.85,
                "operating_threshold": self.operating_threshold,
                "requires_engineering_review": True,
                "uncertainty_routed_to_hold": True,
            }

        # Check 2: Hard Rejection Criteria (Safety breach, severe physics violation, or Prob >= 0.20)
        any_safety_exceeded = any(
            isinstance(s, dict) and s.get("boundary_status") == "EXCEEDED"
            for s in safety.values()
        )
        is_physics_inconsistent = physics.get("status") == "PHYSICS_INCONSISTENT"
        is_severe_anomaly = (
            anomaly.get("status") == "REJECT"
            or (isinstance(anomaly.get("pat"), dict) and anomaly["pat"].get("status") == "REJECT")
        )

        if prob >= self.operating_threshold:
            decision = GovernedDecision.REJECT.value
            next_action = NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
            confidence = max(0.85, prob)
            decision_factors.append(f"CALIBRATED_PROBABILITY_BREACH (P={prob:.4f} >= {self.operating_threshold:.2f})")
        elif any_safety_exceeded:
            decision = GovernedDecision.REJECT.value
            next_action = NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
            confidence = 0.95
            decision_factors.append("SAFETY_SLOPE_BOUNDARY_EXCEEDED")
        elif is_physics_inconsistent:
            decision = GovernedDecision.REJECT.value
            next_action = NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
            confidence = 0.90
            decision_factors.append("PHYSICS_CONSISTENCY_VIOLATION")
        elif is_severe_anomaly and prob >= 0.15:
            decision = GovernedDecision.REJECT.value
            next_action = NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
            confidence = 0.88
            decision_factors.append("SEVERE_ANOMALY_WITH_ELEVATED_PROBABILITY")

        if decision == GovernedDecision.REJECT.value:
            return {
                "decision": decision,
                "next_action": next_action,
                "reason": f"Component rejected by safety/reliability rules: {'; '.join(decision_factors)}",
                "decision_factors": decision_factors,
                "governed_confidence": round(confidence, 3),
                "operating_threshold": self.operating_threshold,
                "requires_engineering_review": True,
                "uncertainty_routed_to_hold": False,
            }

        # Check 3: Governed HOLD (Uncertainty is not failure)
        high_uncertainty = False

        # OOD is only consumed if it is explicitly marked as an authoritative decision input
        is_auth_ood = bool(
            isinstance(ood, dict)
            and (
                ood.get("is_authoritative_decision_input") is True
                or (
                    isinstance(ood.get("governance_metadata"), dict)
                    and ood["governance_metadata"].get("is_authoritative_decision_input") is True
                )
            )
        )
        if is_auth_ood and (ood.get("classification") == "OOD" or ood.get("requires_hold") is True):
            high_uncertainty = True
            decision_factors.append(f"DISTRIBUTION_SHIFT_OOD ({ood.get('classification')})")

        # Conformal interval check
        conf_int = prog.get("conformal_interval")
        if isinstance(conf_int, dict):
            lower = float(conf_int.get("lower_bound", conf_int.get("lower", 0.0)))
            upper = float(conf_int.get("upper_bound", conf_int.get("upper", 0.0)))
            if (upper - lower) > 0.40:
                high_uncertainty = True
                decision_factors.append(f"WIDE_CONFORMAL_INTERVAL (width={upper - lower:.3f})")

        # GPR uncertainty std
        if _is_finite(prog.get("uncertainty_std")) and float(prog["uncertainty_std"]) > 0.25:
            high_uncertainty = True
            decision_factors.append(f"HIGH_GPR_PROGNOSTIC_UNCERTAINTY (std={float(prog['uncertainty_std']):.3f})")

        if high_uncertainty:
            return {
                "decision": GovernedDecision.HOLD.value,
                "next_action": NextAction.ROUTE_TO_96H_VERIFICATION.value,
                "reason": "Component exhibits elevated uncertainty or distribution divergence without confirmed failure signature; routed to 96h burn-in verification rather than scrap.",
                "decision_factors": decision_factors,
                "governed_confidence": 0.80,
                "operating_threshold": self.operating_threshold,
                "requires_engineering_review": True,
                "uncertainty_routed_to_hold": True,
            }

        # Check 4: MONITOR vs PASS
        any_safety_warning = any(
            isinstance(s, dict) and s.get("boundary_status") == "WARNING"
            for s in safety.values()
        )
        is_moderate_prob = (0.10 <= prob < self.operating_threshold)
        is_anomaly_monitor = anomaly.get("status") == "MONITOR"
        is_mild_shift = ood.get("classification") == "MILD_SHIFT"

        if is_moderate_prob or any_safety_warning or is_anomaly_monitor or is_mild_shift:
            decision = GovernedDecision.MONITOR.value
            next_action = NextAction.CONTINUE_MONITORED_BURN_IN.value
            if is_moderate_prob:
                decision_factors.append(f"MODERATE_PROBABILITY (P={prob:.4f})")
            if any_safety_warning:
                decision_factors.append("SAFETY_SLOPE_WARNING")
            if is_anomaly_monitor:
                decision_factors.append("ANOMALY_MONITOR_STATUS")
            if is_mild_shift:
                decision_factors.append("MILD_DISTRIBUTION_SHIFT")

            return {
                "decision": decision,
                "next_action": next_action,
                "reason": f"Component permitted to continue burn-in with telemetry monitoring: {'; '.join(decision_factors)}",
                "decision_factors": decision_factors,
                "governed_confidence": 0.85,
                "operating_threshold": self.operating_threshold,
                "requires_engineering_review": False,
                "uncertainty_routed_to_hold": False,
            }

        # Nominal PASS
        return {
            "decision": GovernedDecision.PASS.value,
            "next_action": NextAction.RELEASE_TO_PRODUCTION.value,
            "reason": f"Nominal operating telemetry and low failure probability (P={prob:.4f} < {self.operating_threshold:.2f}) within verified envelope.",
            "decision_factors": ["NOMINAL_TELEMETRY", "LOW_UNCERTAINTY", "PHYSICS_CONSISTENT"],
            "governed_confidence": 0.95,
            "operating_threshold": self.operating_threshold,
            "requires_engineering_review": False,
            "uncertainty_routed_to_hold": False,
        }

    def _fail_closed_decision(self, reason: str) -> Dict[str, Any]:
        return {
            "decision": GovernedDecision.HOLD.value,
            "next_action": NextAction.ROUTE_TO_96H_VERIFICATION.value,
            "reason": f"Fail-closed decision fallback: {reason}",
            "decision_factors": ["FAIL_CLOSED_FALLBACK", reason],
            "governed_confidence": 0.0,
            "operating_threshold": self.operating_threshold,
            "requires_engineering_review": True,
            "uncertainty_routed_to_hold": True,
        }
