"""
Predicta Semiconductor Intelligence Platform — Stage 7 Task 1
Authoritative Physics-Aware Reliability Engine: Physics Consistency Evidence
=============================================================================

Evaluates whether observed and forecasted semiconductor degradation trajectories
(0h -> 24h -> 168h) are physically consistent with PREDICTA domain physics models:
1. BTI (Bias Temperature Instability): Threshold voltage shift monotonicity
2. Timing Propagation Delay (Tpd): Non-negative timing degradation under Vth/thermal stress
3. Leakage Current (Ileak / Iddq): Subthreshold scaling and defect breakdown trajectory alignment
4. Temperature Acceleration: Arrhenius thermal acceleration monotonicity
5. Forecast Trajectory Consistency: Directional agreement across 24h -> 168h trajectory checkpoints

Reuses existing physics implementations:
- src.physics.aging.bti_threshold_drift
- src.physics.timing.calculate_propagation_delay
- src.physics.leakage.calculate_leakage
- src.physics.temperature.calculate_arrhenius_acceleration

Governed States:
- PHYSICS_CONSISTENT
- PHYSICS_INCONSISTENT
- INSUFFICIENT_PHYSICS_EVIDENCE

This module is an EVIDENCE layer for human/governance review.
It does NOT issue production approvals, qualification claims, or probability calibrations.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from src.physics.aging import bti_threshold_drift
from src.physics.leakage import calculate_leakage
from src.physics.temperature import calculate_arrhenius_acceleration
from src.physics.timing import calculate_propagation_delay


class PhysicsConsistencyStatus(str, Enum):
    """Authoritative physics consistency evaluation status."""
    PHYSICS_CONSISTENT = "PHYSICS_CONSISTENT"
    PHYSICS_INCONSISTENT = "PHYSICS_INCONSISTENT"
    INSUFFICIENT_PHYSICS_EVIDENCE = "INSUFFICIENT_PHYSICS_EVIDENCE"


# Authoritative Physics Check Identifiers
CHECK_BTI_MONOTONICITY = "PHYS_CHECK_001_BTI_MONOTONICITY"
CHECK_TIMING_DEGRADATION = "PHYS_CHECK_002_TIMING_DEGRADATION"
CHECK_LEAKAGE_TRAJECTORY = "PHYS_CHECK_003_LEAKAGE_TRAJECTORY"
CHECK_THERMAL_ARRHENIUS = "PHYS_CHECK_004_THERMAL_ARRHENIUS"
CHECK_FORECAST_TRAJECTORY = "PHYS_CHECK_005_FORECAST_TRAJECTORY_CONSISTENCY"

ALL_PHYSICS_CHECKS = [
    CHECK_BTI_MONOTONICITY,
    CHECK_TIMING_DEGRADATION,
    CHECK_LEAKAGE_TRAJECTORY,
    CHECK_THERMAL_ARRHENIUS,
    CHECK_FORECAST_TRAJECTORY,
]


def _is_finite(val: Any) -> bool:
    """Helper to verify if a numeric value is finite."""
    try:
        fval = float(val)
        return math.isfinite(fval)
    except (ValueError, TypeError):
        return False


class PhysicsReliabilityEngine:
    """Authoritative Physics-Aware Reliability Consistency Evaluator."""

    VERSION = "1.0.0"
    REUSED_FUNCTIONS = [
        "src.physics.aging.bti_threshold_drift",
        "src.physics.timing.calculate_propagation_delay",
        "src.physics.leakage.calculate_leakage",
        "src.physics.temperature.calculate_arrhenius_acceleration",
    ]

    def __init__(self, noise_tolerance_ps: float = 0.5, noise_tolerance_uA: float = 0.1):
        """
        Initialize the Physics Reliability Engine.
        
        Args:
            noise_tolerance_ps: Small measurement resolution margin for timing (ps).
            noise_tolerance_uA: Small measurement resolution margin for leakage (uA).
        """
        self.noise_tolerance_ps = noise_tolerance_ps
        self.noise_tolerance_uA = noise_tolerance_uA

    def evaluate_bti_consistency(
        self,
        time_hours_1: float,
        time_hours_2: float,
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        base_amp: float = 0.05,
        exponent_n: float = 0.25,
        activation_energy_ev: float = 0.12,
        observed_vth_shift_1: Optional[float] = None,
        observed_vth_shift_2: Optional[float] = None,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 1: BTI Vth Drift Monotonicity.
        Increasing stress duration (t2 >= t1) must produce non-negative Vth shift.
        """
        inputs = (time_hours_1, time_hours_2, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "Non-finite input parameter detected in BTI evaluation",
            }

        if time_hours_1 < 0 or time_hours_2 < 0 or temp_c <= -273.15 or voltage_v <= 0:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "BTI input parameters outside physical bounds",
            }

        try:
            expected_vth_1 = bti_threshold_drift(
                float(time_hours_1), float(temp_c), float(voltage_v),
                float(base_amp), float(exponent_n), float(activation_energy_ev)
            )
            expected_vth_2 = bti_threshold_drift(
                float(time_hours_2), float(temp_c), float(voltage_v),
                float(base_amp), float(exponent_n), float(activation_energy_ev)
            )
        except Exception as e:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": f"BTI physics model calculation error: {e}",
            }

        if time_hours_2 >= time_hours_1 and expected_vth_2 < expected_vth_1:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": f"Physics model output non-monotonic: Vth({time_hours_2}h)={expected_vth_2} < Vth({time_hours_1}h)={expected_vth_1}",
            }

        vth_1 = observed_vth_shift_1 if observed_vth_shift_1 is not None else expected_vth_1
        vth_2 = observed_vth_shift_2 if observed_vth_shift_2 is not None else expected_vth_2

        if not _is_finite(vth_1) or not _is_finite(vth_2):
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "Non-finite observed Vth shift value",
            }

        if vth_1 < 0 or vth_2 < 0:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": f"Negative Vth shift under BTI stress is physically unphysical (Vth1={vth_1}, Vth2={vth_2})",
            }

        if time_hours_2 >= time_hours_1 and vth_2 < vth_1 - 1e-6:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": f"Observed Vth shift decreased over stress duration: Vth({time_hours_2}h)={vth_2} < Vth({time_hours_1}h)={vth_1}",
            }

        return True, {
            "check": CHECK_BTI_MONOTONICITY,
            "status": "PASS",
            "expected_vth_1": expected_vth_1,
            "expected_vth_2": expected_vth_2,
            "evaluated_vth_1": vth_1,
            "evaluated_vth_2": vth_2,
            "delta_vth": vth_2 - vth_1,
        }

    def evaluate_timing_consistency(
        self,
        tpd_0h: float,
        tpd_24h: float,
        tpd_168h: float,
        temp_c: float = 125.0,
        vth_shift_24h: float = 0.01,
        vth_shift_168h: float = 0.05,
        beta: float = 17.5,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 2: Timing Propagation Delay Degradation.
        Increasing Vth shift and thermal stress must produce non-negative timing degradation (Tpd168h >= Tpd24h >= Tpd0h).
        """
        inputs = (tpd_0h, tpd_24h, tpd_168h, temp_c, vth_shift_24h, vth_shift_168h, beta)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": "Non-finite input parameter in timing evaluation",
            }

        if tpd_0h < 0 or tpd_24h < 0 or tpd_168h < 0 or temp_c <= -273.15 or beta < 0:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": "Timing parameters outside physical lower bounds",
            }

        try:
            expected_tpd_24h = calculate_propagation_delay(tpd_0h, temp_c, vth_shift_24h, beta)
            expected_tpd_168h = calculate_propagation_delay(tpd_0h, temp_c, vth_shift_168h, beta)
        except Exception as e:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": f"Timing physics model calculation error: {e}",
            }

        if tpd_24h < tpd_0h - self.noise_tolerance_ps:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": f"Spontaneous timing speedup at 24h under aging stress: Tpd(24h)={tpd_24h} < Tpd(0h)={tpd_0h}",
            }

        if tpd_168h < tpd_24h - self.noise_tolerance_ps:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": f"Spontaneous timing speedup at 168h under aging stress: Tpd(168h)={tpd_168h} < Tpd(24h)={tpd_24h}",
            }

        return True, {
            "check": CHECK_TIMING_DEGRADATION,
            "status": "PASS",
            "expected_tpd_24h": expected_tpd_24h,
            "expected_tpd_168h": expected_tpd_168h,
            "tpd_0h": float(tpd_0h),
            "tpd_24h": float(tpd_24h),
            "tpd_168h": float(tpd_168h),
            "tpd_drift_24h": float(tpd_24h - tpd_0h),
            "tpd_drift_168h": float(tpd_168h - tpd_24h),
        }

    def evaluate_leakage_consistency(
        self,
        ileak_0h: float,
        ileak_24h: float,
        ileak_168h: float,
        temp_c: float = 125.0,
        vth_shift_24h: float = 0.01,
        vth_shift_168h: float = 0.05,
        defect_type: str = "NORMAL",
        onset_hour: float = 0.0,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 3: Leakage Current Trajectory Alignment.
        Healthy and defect-breakdown leakage currents must follow direction defined by leakage physics model.
        """
        inputs = (ileak_0h, ileak_24h, ileak_168h, temp_c, vth_shift_24h, vth_shift_168h, onset_hour)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": "Non-finite input parameter in leakage evaluation",
            }

        if ileak_0h < 0 or ileak_24h < 0 or ileak_168h < 0 or temp_c <= -273.15 or onset_hour < 0:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": "Leakage current parameters outside physical bounds (negative current)",
            }

        if defect_type not in {"NORMAL", "NONE", "TIMING_OFFSET", "GATE_OXIDE_SHORT", "STEP_BREAKDOWN"}:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Unsupported defect_type: {defect_type}",
            }

        try:
            expected_leak_24h = calculate_leakage(ileak_0h, temp_c, vth_shift_24h, defect_type, 24.0, onset_hour)
            expected_leak_168h = calculate_leakage(ileak_0h, temp_c, vth_shift_168h, defect_type, 168.0, onset_hour)
        except Exception as e:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Leakage physics model calculation error: {e}",
            }

        if defect_type in {"GATE_OXIDE_SHORT", "STEP_BREAKDOWN"}:
            if ileak_168h < ileak_24h - self.noise_tolerance_uA:
                return False, {
                    "check": CHECK_LEAKAGE_TRAJECTORY,
                    "status": "FAIL",
                    "reason": f"Defect breakdown trajectory exhibits unphysical leakage drop: Ileak(168h)={ileak_168h} < Ileak(24h)={ileak_24h}",
                }

        return True, {
            "check": CHECK_LEAKAGE_TRAJECTORY,
            "status": "PASS",
            "defect_type": defect_type,
            "expected_leak_24h": expected_leak_24h,
            "expected_leak_168h": expected_leak_168h,
            "ileak_0h": float(ileak_0h),
            "ileak_24h": float(ileak_24h),
            "ileak_168h": float(ileak_168h),
        }

    def evaluate_thermal_acceleration_consistency(
        self,
        temp_c_use: float = 25.0,
        temp_c_test_1: float = 85.0,
        temp_c_test_2: float = 125.0,
        activation_energy_ev: float = 0.7,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 4: Arrhenius Temperature Acceleration Monotonicity.
        For T_stress_2 > T_stress_1 > T_use, AF(T_stress_2) > AF(T_stress_1) >= 1.0.
        """
        inputs = (temp_c_use, temp_c_test_1, temp_c_test_2, activation_energy_ev)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": "Non-finite input parameter in Arrhenius thermal acceleration evaluation",
            }

        if temp_c_use <= -273.15 or temp_c_test_1 <= -273.15 or temp_c_test_2 <= -273.15 or activation_energy_ev < 0:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": "Temperature or activation energy parameters outside physical bounds",
            }

        try:
            af_1 = calculate_arrhenius_acceleration(temp_c_use, temp_c_test_1, activation_energy_ev)
            af_2 = calculate_arrhenius_acceleration(temp_c_use, temp_c_test_2, activation_energy_ev)
        except Exception as e:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Arrhenius physics calculation error: {e}",
            }

        if temp_c_test_1 > temp_c_use and af_1 < 1.0 - 1e-6:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Arrhenius acceleration factor < 1.0 under elevated temperature (T_stress={temp_c_test_1}C, AF={af_1})",
            }

        if temp_c_test_2 <= temp_c_test_1:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Input test temperature sequence non-increasing: T_stress_2 ({temp_c_test_2}C) <= T_stress_1 ({temp_c_test_1}C)",
            }

        if af_2 <= af_1:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Arrhenius acceleration factor non-monotonic: AF({temp_c_test_2}C)={af_2} <= AF({temp_c_test_1}C)={af_1}",
            }

        return True, {
            "check": CHECK_THERMAL_ARRHENIUS,
            "status": "PASS",
            "temp_c_use": float(temp_c_use),
            "temp_c_test_1": float(temp_c_test_1),
            "temp_c_test_2": float(temp_c_test_2),
            "af_1": af_1,
            "af_2": af_2,
        }

    def evaluate_forecast_trajectory_consistency(
        self,
        iddq_0h: float,
        iddq_24h: float,
        iddq_168h: float,
        ileak_0h: float,
        ileak_24h: float,
        ileak_168h: float,
        tpd_0h: float,
        tpd_24h: float,
        tpd_168h: float,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 5: 24h -> 168h Forecast Trajectory Direction Alignment.
        Compares observed/prognostic trajectories against physical degradation expectations.
        """
        vals = (iddq_0h, iddq_24h, iddq_168h, ileak_0h, ileak_24h, ileak_168h, tpd_0h, tpd_24h, tpd_168h)
        if not all(_is_finite(v) for v in vals):
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": "Non-finite parameter value in 24h -> 168h forecast trajectory",
            }

        if any(v < 0 for v in vals):
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": "Negative parameter value in 24h -> 168h forecast trajectory",
            }

        tpd_drift_24h = tpd_24h - tpd_0h
        tpd_drift_168h = tpd_168h - tpd_24h
        if tpd_drift_24h > 1.0 and tpd_drift_168h < -5.0:
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Unphysical timing recovery from 24h to 168h: early drift={tpd_drift_24h:.2f}ps, 168h drift={tpd_drift_168h:.2f}ps",
            }

        iddq_drift_24h = iddq_24h - iddq_0h
        iddq_drift_168h = iddq_168h - iddq_24h
        if iddq_drift_24h > 50.0 and iddq_drift_168h < -100.0:
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Unphysical IDDQ recovery from 24h to 168h: early drift={iddq_drift_24h:.2f}uA, 168h drift={iddq_drift_168h:.2f}uA",
            }

        return True, {
            "check": CHECK_FORECAST_TRAJECTORY,
            "status": "PASS",
            "iddq_trajectory": [float(iddq_0h), float(iddq_24h), float(iddq_168h)],
            "ileak_trajectory": [float(ileak_0h), float(ileak_24h), float(ileak_168h)],
            "tpd_trajectory": [float(tpd_0h), float(tpd_24h), float(tpd_168h)],
        }

    def evaluate_physics_evidence(
        self,
        record: Dict[str, Any],
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        defect_type: str = "NORMAL",
    ) -> Dict[str, Any]:
        """
        Evaluate full physics consistency evidence for a given telemetry/forecast record.
        
        Args:
            record: Dictionary containing 0h, 24h, and 168h parameters (or early features + ground truth/forecast).
            temp_c: Operating/stress temperature in Celsius.
            voltage_v: Operating/stress voltage in Volts.
            defect_type: Semiconductor defect classification string.
            
        Returns:
            Authoritative physics consistency evidence dictionary.
        """
        component_id = str(record.get("component_id", record.get("id", "UNKNOWN_COMPONENT")))
        lot_id = str(record.get("lot_id", "UNKNOWN_LOT"))

        # Check for non-finite entries anywhere in record
        raw_numeric_vals = [v for k, v in record.items() if isinstance(v, (int, float))]
        if any(not math.isfinite(float(v)) for v in raw_numeric_vals):
            return {
                "physics_consistency_status": PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value,
                "physics_consistency_score": 0.0,
                "passed_physics_checks": [],
                "failed_physics_checks": ALL_PHYSICS_CHECKS,
                "evidence": {
                    "reason": "Non-finite or invalid numeric parameter detected in input record"
                },
                "input_provenance": {
                    "component_id": component_id,
                    "lot_id": lot_id,
                    "evaluated_checkpoints": ["INVALID_RECORD"],
                },
                "physics_model_provenance": {
                    "module_version": self.VERSION,
                    "reused_functions": self.REUSED_FUNCTIONS,
                },
            }

        # Check presence of required parameters
        has_iddq_0 = "iddq_0h" in record or "iddq_0" in record
        has_iddq_24 = "iddq_24h" in record or "iddq_24" in record
        
        has_ileak_0 = "ileak_0h" in record or "ileak_0" in record
        has_ileak_24 = "ileak_24h" in record or "ileak_24" in record

        has_tpd_0 = "tpd_0h" in record or "tpd_0" in record
        has_tpd_24 = "tpd_24h" in record or "tpd_24" in record

        if not (has_iddq_0 and has_iddq_24 and has_ileak_0 and has_ileak_24 and has_tpd_0 and has_tpd_24):
            return {
                "physics_consistency_status": PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value,
                "physics_consistency_score": 0.0,
                "passed_physics_checks": [],
                "failed_physics_checks": ALL_PHYSICS_CHECKS,
                "evidence": {
                    "reason": "Missing required 0h/24h early telemetry parameters for physics evaluation"
                },
                "input_provenance": {
                    "component_id": component_id,
                    "lot_id": lot_id,
                    "evaluated_checkpoints": ["MISSING_CHECKPOINTS"],
                },
                "physics_model_provenance": {
                    "module_version": self.VERSION,
                    "reused_functions": self.REUSED_FUNCTIONS,
                },
            }

        # Safe extraction
        iddq_0 = record.get("iddq_0h", record.get("iddq_0", 0.0))
        iddq_24 = record.get("iddq_24h", record.get("iddq_24", 0.0))
        iddq_168 = record.get("iddq_168h", record.get("iddq_168h_ground_truth", record.get("iddq_168", iddq_24)))

        ileak_0 = record.get("ileak_0h", record.get("ileak_0", 0.0))
        ileak_24 = record.get("ileak_24h", record.get("ileak_24", 0.0))
        ileak_168 = record.get("ileak_168h", record.get("ileak_168h_ground_truth", record.get("ileak_168", ileak_24)))

        tpd_0 = record.get("tpd_0h", record.get("tpd_0", 0.0))
        tpd_24 = record.get("tpd_24h", record.get("tpd_24", 0.0))
        tpd_168 = record.get("tpd_168h", record.get("tpd_168h_ground_truth", record.get("tpd_168", tpd_24)))

        passed_checks: List[str] = []
        failed_checks: List[str] = []
        evidence: Dict[str, Any] = {}

        # 1. BTI Monotonicity Check
        bti_pass, bti_ev = self.evaluate_bti_consistency(
            time_hours_1=24.0, time_hours_2=168.0, temp_c=temp_c, voltage_v=voltage_v
        )
        evidence["bti_consistency"] = bti_ev
        if bti_pass:
            passed_checks.append(CHECK_BTI_MONOTONICITY)
        else:
            failed_checks.append(CHECK_BTI_MONOTONICITY)

        # 2. Timing Degradation Check
        tpd_pass, tpd_ev = self.evaluate_timing_consistency(
            tpd_0h=tpd_0, tpd_24h=tpd_24, tpd_168h=tpd_168, temp_c=temp_c
        )
        evidence["timing_consistency"] = tpd_ev
        if tpd_pass:
            passed_checks.append(CHECK_TIMING_DEGRADATION)
        else:
            failed_checks.append(CHECK_TIMING_DEGRADATION)

        # 3. Leakage Trajectory Check
        leak_pass, leak_ev = self.evaluate_leakage_consistency(
            ileak_0h=ileak_0, ileak_24h=ileak_24, ileak_168h=ileak_168, temp_c=temp_c, defect_type=defect_type
        )
        evidence["leakage_consistency"] = leak_ev
        if leak_pass:
            passed_checks.append(CHECK_LEAKAGE_TRAJECTORY)
        else:
            failed_checks.append(CHECK_LEAKAGE_TRAJECTORY)

        # 4. Thermal Arrhenius Acceleration Check
        arrh_pass, arrh_ev = self.evaluate_thermal_acceleration_consistency(
            temp_c_use=25.0, temp_c_test_1=85.0, temp_c_test_2=125.0
        )
        evidence["thermal_acceleration_consistency"] = arrh_ev
        if arrh_pass:
            passed_checks.append(CHECK_THERMAL_ARRHENIUS)
        else:
            failed_checks.append(CHECK_THERMAL_ARRHENIUS)

        # 5. Forecast Trajectory Consistency Check
        fc_pass, fc_ev = self.evaluate_forecast_trajectory_consistency(
            iddq_0h=iddq_0, iddq_24h=iddq_24, iddq_168h=iddq_168,
            ileak_0h=ileak_0, ileak_24h=ileak_24, ileak_168h=ileak_168,
            tpd_0h=tpd_0, tpd_24h=tpd_24, tpd_168h=tpd_168,
        )
        evidence["forecast_trajectory_consistency"] = fc_ev
        if fc_pass:
            passed_checks.append(CHECK_FORECAST_TRAJECTORY)
        else:
            failed_checks.append(CHECK_FORECAST_TRAJECTORY)

        total_checks = len(ALL_PHYSICS_CHECKS)
        num_passed = len(passed_checks)

        if len(failed_checks) > 0:
            status = PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
        else:
            status = PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value

        score = float(num_passed / total_checks)

        has_168 = "iddq_168h" in record or "iddq_168h_ground_truth" in record or "iddq_168" in record
        return {
            "physics_consistency_status": status,
            "physics_consistency_score": score,
            "passed_physics_checks": passed_checks,
            "failed_physics_checks": failed_checks,
            "evidence": evidence,
            "input_provenance": {
                "component_id": component_id,
                "lot_id": lot_id,
                "evaluated_checkpoints": ["0h", "24h", "168h"] if has_168 else ["0h", "24h"],
            },
            "physics_model_provenance": {
                "module_version": self.VERSION,
                "reused_functions": self.REUSED_FUNCTIONS,
            },
        }


def evaluate_physics_consistency(
    record: Dict[str, Any],
    temp_c: float = 125.0,
    voltage_v: float = 1.1,
    defect_type: str = "NORMAL",
) -> Dict[str, Any]:
    """Convenience functional interface to evaluate physics consistency evidence."""
    engine = PhysicsReliabilityEngine()
    return engine.evaluate_physics_evidence(record, temp_c=temp_c, voltage_v=voltage_v, defect_type=defect_type)
