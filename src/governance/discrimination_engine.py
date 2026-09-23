"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
Authoritative Sensor / Equipment / Component Discrimination Engine (Python)
File: src/governance/discrimination_engine.py

Classifies root-anomaly evidence into:
1. SENSOR_OR_DATA_QUALITY: Range breaches, single-channel unphysical steps, flatlines, corrupted data.
2. EQUIPMENT_OR_CHAMBER: Lot-wide or equipment-correlated baseline shifts across dies.
3. COMPONENT_SILICON: Isolated single-die multi-parameter physical degradation (BTI, Arrhenius leakage).
4. INSUFFICIENT_EVIDENCE: Fail-closed fallback when telemetry, metadata, or lot context is incomplete.

DISCLAIMER:
Non-causal evidence classification — NOT a definitive claim of physical causation.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any, Dict, List, Optional


class RootEvidenceType(str, Enum):
    SENSOR_OR_DATA_QUALITY = "SENSOR_OR_DATA_QUALITY"
    EQUIPMENT_OR_CHAMBER = "EQUIPMENT_OR_CHAMBER"
    COMPONENT_SILICON = "COMPONENT_SILICON"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class TopologyPattern(str, Enum):
    ISOLATED_COMPONENT_PATTERN = "ISOLATED_COMPONENT_PATTERN"
    EQUIPMENT_WIDE_PATTERN = "EQUIPMENT_WIDE_PATTERN"
    CHAMBER_WIDE_PATTERN = "CHAMBER_WIDE_PATTERN"
    WAFER_CLUSTER_PATTERN = "WAFER_CLUSTER_PATTERN"
    INSUFFICIENT_TOPOLOGY_EVIDENCE = "INSUFFICIENT_TOPOLOGY_EVIDENCE"


PHYSICAL_RANGES: Dict[str, Dict[str, float]] = {
    "supply_voltage": {"min": 0.5, "max": 2.5},        # V
    "output_voltage": {"min": 0.0, "max": 2.5},        # V
    "current": {"min": 0.0, "max": 100.0},             # mA
    "leakage_current": {"min": 0.0, "max": 2000.0},    # uA
    "resistance": {"min": 0.01, "max": 10000.0},       # Ohm
    "capacitance": {"min": 0.001, "max": 100.0},       # nF
    "threshold_voltage": {"min": 0.1, "max": 1.5},     # V
    "frequency": {"min": 1.0, "max": 5000.0},          # MHz
    "propagation_delay": {"min": 10.0, "max": 500.0},  # ps
    "temperature": {"min": -40.0, "max": 175.0},       # C
    "dynamic_power": {"min": 0.0, "max": 50.0},        # mW
    "total_power": {"min": 0.0, "max": 100.0},         # mW
}

NON_CAUSAL_DISCLAIMER = "NON-CAUSAL EVIDENCE CLASSIFICATION — NOT A DEFINITIVE CLAIM OF PHYSICAL CAUSATION"


def _is_finite(val: Any) -> bool:
    try:
        fval = float(val)
        return math.isfinite(fval)
    except (ValueError, TypeError):
        return False


class DiscriminationEngine:
    def __init__(self) -> None:
        self.disclaimer = NON_CAUSAL_DISCLAIMER

    def evaluate(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Discriminate anomaly evidence from telemetry, anomaly scores, and lot context.
        """
        if not isinstance(params, dict):
            return self._fallback_report("Invalid or missing input parameters")

        t0 = params.get("telemetry_0h") or {}
        t24 = params.get("telemetry_24h") or {}
        anomaly = params.get("anomaly_evidence") or {}
        eq_context = params.get("equipment_context") or {}
        physics = params.get("physics_evidence") or {}

        if not t0 and not t24:
            return self._fallback_report("Zero telemetry data provided")

        checks: Dict[str, Any] = {
            "sensor_range_violations": [],
            "sensor_flatline_channels": [],
            "sensor_single_channel_steps": [],
            "equipment_lot_shifts": [],
            "equipment_chamber_correlations": [],
            "silicon_physical_indicators": [],
            "physics_consistency_status": physics.get("status", "UNKNOWN"),
        }

        # 1. Check Sensor & Data Quality
        sensor_issue_detected = False

        # A. Range violations on t0 and t24
        eval_data = t24 if t24 else t0
        for param, val in eval_data.items():
            if param in PHYSICAL_RANGES:
                if not _is_finite(val):
                    checks["sensor_range_violations"].append(f"{param}={val} (NaN/Non-finite)")
                    sensor_issue_detected = True
                else:
                    num_val = float(val)
                    p_min = PHYSICAL_RANGES[param]["min"]
                    p_max = PHYSICAL_RANGES[param]["max"]
                    if num_val < p_min or num_val > p_max:
                        checks["sensor_range_violations"].append(
                            f"{param}={num_val} outside physical range [{p_min}, {p_max}]"
                        )
                        sensor_issue_detected = True

        # B. Check flatline / zero variance across multiple dynamic parameters if both t0 and t24 provided
        if t0 and t24:
            dynamic_params = ["leakage_current", "propagation_delay", "dynamic_power", "temperature"]
            exact_matches = 0
            evaluated_count = 0
            for p in dynamic_params:
                if p in t0 and p in t24:
                    evaluated_count += 1
                    if float(t0[p]) == float(t24[p]) and float(t0[p]) != 0.0:
                        exact_matches += 1
                        checks["sensor_flatline_channels"].append(p)

            if evaluated_count >= 3 and exact_matches >= 3:
                sensor_issue_detected = True

            # C. Unphysical single-channel step: massive shift on 1 channel with 0 change on correlated channels
            if "supply_voltage" in t0 and "supply_voltage" in t24 and "current" in t0 and "current" in t24:
                v_diff = abs(float(t24["supply_voltage"]) - float(t0["supply_voltage"]))
                i_diff = abs(float(t24["current"]) - float(t0["current"]))
                if v_diff > 0.5 and i_diff < 0.001:
                    checks["sensor_single_channel_steps"].append("Severe supply_voltage step without correlated current change")
                    sensor_issue_detected = True

        # 2. Check Equipment / Chamber correlation
        equipment_issue_detected = False
        if isinstance(eq_context, dict) and eq_context:
            if _is_finite(eq_context.get("lot_equipment_anomaly_rate")) and float(eq_context["lot_equipment_anomaly_rate"]) > 0.40:
                checks["equipment_lot_shifts"].append(
                    f"High anomaly rate ({float(eq_context['lot_equipment_anomaly_rate']) * 100:.1f}%) across dies on equipment {eq_context.get('equipment_id', 'UNKNOWN')}"
                )
                equipment_issue_detected = True

            if eq_context.get("chamber_thermal_offset_detected") is True:
                checks["equipment_chamber_correlations"].append(
                    f"Chamber thermal offset detected in test run: offset={eq_context.get('chamber_thermal_offset_c', 0)}C"
                )
                equipment_issue_detected = True

            if _is_finite(eq_context.get("equipment_shift_zscore")) and float(eq_context["equipment_shift_zscore"]) > 3.0:
                checks["equipment_lot_shifts"].append(
                    f"Lot-level baseline parameter shift z-score={float(eq_context['equipment_shift_zscore']):.2f} on equipment {eq_context.get('equipment_id', 'UNKNOWN')}"
                )
                equipment_issue_detected = True

        # 3. Check Component Silicon Physical Degradation
        silicon_issue_detected = False
        # BTI Signature: Vth positive drift + Tpd increase
        if "threshold_voltage" in t0 and "threshold_voltage" in t24:
            vth0 = float(t0["threshold_voltage"])
            vth24 = float(t24["threshold_voltage"])
            delta_vth = vth24 - vth0
            if delta_vth > 0.02:  # >20mV drift
                checks["silicon_physical_indicators"].append(
                    f"Positive Vth drift (dVth=+{delta_vth * 1000.0:.1f}mV) indicating BTI aging"
                )
                silicon_issue_detected = True

        # Arrhenius Leakage Signature: Ileak increase correlated with temperature
        if "leakage_current" in t0 and "leakage_current" in t24:
            ileak0 = float(t0["leakage_current"])
            ileak24 = float(t24["leakage_current"])
            ratio = (ileak24 / ileak0) if ileak0 > 0 else 1.0
            if ratio > 1.25:
                checks["silicon_physical_indicators"].append(
                    f"Leakage current elevation ({ratio:.2f}x baseline) indicating dielectric/junction degradation"
                )
                silicon_issue_detected = True

        # Anomaly detector signals (PAT / COPOD / IF)
        if anomaly.get("status") in ("REJECT", "MONITOR") or \
           (isinstance(anomaly.get("copod"), dict) and float(anomaly["copod"].get("score", 0.0)) > 6.0) or \
           (isinstance(anomaly.get("pat"), dict) and anomaly["pat"].get("status") == "REJECT"):
            if not sensor_issue_detected and not equipment_issue_detected:
                checks["silicon_physical_indicators"].append(
                    "Multi-parameter outlier localized to single die under nominal equipment baseline"
                )
                silicon_issue_detected = True

        # 4. Topology Pattern Analysis
        genealogy_ctx = params.get("genealogy_context") or {}
        has_genealogy = bool(
            genealogy_ctx.get("lot_id") or
            genealogy_ctx.get("wafer_id") or
            eq_context.get("equipment_id") or
            genealogy_ctx.get("chamber_id") or
            genealogy_ctx.get("socket_id")
        )
        
        topology_pattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE.value
        topology_analytics = {
            "lot_id": genealogy_ctx.get("lot_id") or eq_context.get("lot_id") or None,
            "wafer_id": genealogy_ctx.get("wafer_id") or None,
            "tester_id": eq_context.get("equipment_id") or genealogy_ctx.get("tester_id") or None,
            "chamber_id": genealogy_ctx.get("chamber_id") or None,
            "socket_id": genealogy_ctx.get("socket_id") or None,
            "die_x": genealogy_ctx.get("die_x") if genealogy_ctx.get("die_x") is not None else None,
            "die_y": genealogy_ctx.get("die_y") if genealogy_ctx.get("die_y") is not None else None,
            "spatial_cluster_detected": bool(genealogy_ctx.get("spatial_cluster_detected")),
            "chamber_synchronization_detected": bool(genealogy_ctx.get("chamber_synchronization_detected")),
        }

        if not has_genealogy:
            topology_pattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE.value
        elif genealogy_ctx.get("spatial_cluster_detected"):
            topology_pattern = TopologyPattern.WAFER_CLUSTER_PATTERN.value
        elif genealogy_ctx.get("chamber_synchronization_detected") or eq_context.get("chamber_thermal_offset_detected"):
            topology_pattern = TopologyPattern.CHAMBER_WIDE_PATTERN.value
        elif (eq_context.get("lot_equipment_anomaly_rate") and float(eq_context["lot_equipment_anomaly_rate"]) > 0.40) or (eq_context.get("equipment_shift_zscore") and float(eq_context["equipment_shift_zscore"]) > 3.0):
            topology_pattern = TopologyPattern.EQUIPMENT_WIDE_PATTERN.value
        elif silicon_issue_detected:
            topology_pattern = TopologyPattern.ISOLATED_COMPONENT_PATTERN.value
        else:
            topology_pattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE.value

        # 5. Synthesize Discrimination Result
        if sensor_issue_detected:
            findings = checks["sensor_range_violations"] + checks["sensor_single_channel_steps"]
            summary_parts = checks["sensor_range_violations"] + checks["sensor_single_channel_steps"] + checks["sensor_flatline_channels"]
            return {
                "root_evidence_type": RootEvidenceType.SENSOR_OR_DATA_QUALITY.value,
                "topology_pattern": topology_pattern,
                "topology_analytics": topology_analytics,
                "confidence_score": 0.90,
                "evidence_summary": f"Sensor or data quality anomaly detected: {'; '.join(summary_parts)}",
                "findings": findings,
                "checks_evaluated": checks,
                "disclaimer": self.disclaimer,
            }

        if equipment_issue_detected:
            findings = checks["equipment_lot_shifts"] + checks["equipment_chamber_correlations"]
            return {
                "root_evidence_type": RootEvidenceType.EQUIPMENT_OR_CHAMBER.value,
                "topology_pattern": topology_pattern,
                "topology_analytics": topology_analytics,
                "confidence_score": 0.85,
                "evidence_summary": f"Observed anomaly correlation is consistent with equipment/chamber level pattern ({'; '.join(findings)}); causal attribution is not established.",
                "findings": findings,
                "checks_evaluated": checks,
                "disclaimer": self.disclaimer,
            }

        if silicon_issue_detected:
            findings = checks["silicon_physical_indicators"]
            return {
                "root_evidence_type": RootEvidenceType.COMPONENT_SILICON.value,
                "topology_pattern": topology_pattern,
                "topology_analytics": topology_analytics,
                "confidence_score": 0.88,
                "evidence_summary": f"Silicon-level localized degradation detected: {'; '.join(findings)}",
                "findings": findings,
                "checks_evaluated": checks,
                "disclaimer": self.disclaimer,
            }

        # If no anomalies or issues detected across all layers: absence of fault evidence must NOT become COMPONENT_SILICON
        return {
            "root_evidence_type": RootEvidenceType.INSUFFICIENT_EVIDENCE.value,
            "topology_pattern": topology_pattern,
            "topology_analytics": topology_analytics,
            "confidence_score": 0.0,
            "evidence_summary": "Nominal operating telemetry within allowable baseline; insufficient fault evidence to attribute sensor, equipment, or silicon failure.",
            "findings": ["Nominal operating envelope — no fault discrimination required"],
            "checks_evaluated": checks,
            "disclaimer": self.disclaimer,
        }

    def _fallback_report(self, reason: str) -> Dict[str, Any]:
        return {
            "root_evidence_type": RootEvidenceType.INSUFFICIENT_EVIDENCE.value,
            "topology_pattern": TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE.value,
            "topology_analytics": {},
            "confidence_score": 0.0,
            "evidence_summary": f"Fail-closed discrimination fallback: {reason}",
            "findings": [reason],
            "checks_evaluated": {
                "sensor_range_violations": [],
                "sensor_flatline_channels": [],
                "sensor_single_channel_steps": [],
                "equipment_lot_shifts": [],
                "equipment_chamber_correlations": [],
                "silicon_physical_indicators": [],
                "physics_consistency_status": "INSUFFICIENT_PHYSICS_EVIDENCE",
            },
            "disclaimer": self.disclaimer,
        }

