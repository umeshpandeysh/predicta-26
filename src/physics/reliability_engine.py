"""
Predicta Semiconductor Intelligence Platform — Stage 7 Task 1
Authoritative Physics-Aware Reliability Engine: Physics Consistency Evidence
=============================================================================

Evaluates whether observed and forecasted semiconductor degradation trajectories
(0h -> 24h -> 168h) are physically consistent with PREDICTA domain physics models:
1. BTI (Bias Temperature Instability): Threshold voltage shift monotonicity
2. Timing Propagation Delay (Tpd): Non-negative timing degradation under Vth/thermal stress
3. Leakage Current (Ileak): Subthreshold scaling and defect breakdown trajectory alignment
4. Temperature Acceleration: Arrhenius thermal acceleration monotonicity
5. Forecast Trajectory Consistency: Directional agreement across 24h -> 168h trajectory checkpoints

Reuses existing physics implementations:
- src.physics.aging.bti_threshold_drift
- src.physics.timing.calculate_propagation_delay
- src.physics.leakage.calculate_leakage
- src.physics.temperature.calculate_arrhenius_acceleration

Authoritative Status Values (ONLY these three are permitted):
- PHYSICS_CONSISTENT
- PHYSICS_INCONSISTENT
- INSUFFICIENT_PHYSICS_EVIDENCE

Deterministic Engineering Evidence Score:
- physics_consistency_score is a deterministic engineering evidence fraction [0.0 - 1.0].
- It is NOT a reliability probability, confidence, calibration, failure probability,
  or production acceptance probability.
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
    """Authoritative physics consistency evaluation status (ONLY these three permitted)."""
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


def _classify_trajectory_direction(y0: float, y1: float, y2: float) -> str:
    """Derive deterministic 3-point trajectory direction classification using exact ordering semantics."""
    if y0 == y1 == y2:
        return "STABLE"
    if y0 <= y1 <= y2:
        return "NON_DECREASING"
    if y0 >= y1 >= y2:
        return "NON_INCREASING"
    return "NON_MONOTONIC"


def _classify_2point_direction(v1: float, v2: float) -> str:
    """Derive deterministic 2-point direction classification using exact ordering semantics."""
    if v2 == v1:
        return "STABLE"
    if v2 > v1:
        return "NON_DECREASING"
    return "DECREASING"


def _are_directions_consistent(observed_dir: str, model_dir: str) -> bool:
    """Check if observed trajectory direction is physically consistent with model direction."""
    if observed_dir == "NON_MONOTONIC":
        return False
    if observed_dir == model_dir:
        return True
    if model_dir == "NON_DECREASING" and observed_dir == "STABLE":
        return True
    if model_dir == "NON_INCREASING" and observed_dir == "STABLE":
        return True
    if model_dir == "NON_MONOTONIC" and observed_dir == "NON_DECREASING":
        return True
    return False



# Authoritative Physics Parameter Defaults (Reused from generator & research specifications)
DEFAULT_BTI_BASE_AMP = 1.2
DEFAULT_BTI_EXPONENT_N = 0.20
DEFAULT_BTI_ACTIVATION_ENERGY_EV = 0.12


class PhysicsReliabilityEngine:
    """Authoritative Physics-Aware Reliability Consistency Evaluator."""

    VERSION = "1.0.0"
    REUSED_FUNCTIONS = [
        "src.physics.aging.bti_threshold_drift",
        "src.physics.timing.calculate_propagation_delay",
        "src.physics.leakage.calculate_leakage",
        "src.physics.temperature.calculate_arrhenius_acceleration",
    ]

    def evaluate_bti_consistency(
        self,
        time_hours_1: float,
        time_hours_2: float,
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        base_amp: float = DEFAULT_BTI_BASE_AMP,
        exponent_n: float = DEFAULT_BTI_EXPONENT_N,
        activation_energy_ev: float = DEFAULT_BTI_ACTIVATION_ENERGY_EV,
        observed_vth_shift_1: Optional[float] = None,
        observed_vth_shift_2: Optional[float] = None,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 1: BTI Vth Drift Monotonicity.
        Derives model-defined direction from bti_threshold_drift() and compares observed Vth shift trajectory.
        If observed Vth values are absent, reports INSUFFICIENT_PHYSICS_EVIDENCE without fabricating data.
        Uses exact ordering semantics without arbitrary epsilon tolerances.
        """
        inputs = (time_hours_1, time_hours_2, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "Non-finite input parameter detected in BTI evaluation",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if time_hours_1 < 0 or time_hours_2 < 0 or temp_c <= -273.15 or voltage_v <= 0 or base_amp <= 0 or exponent_n < 0 or activation_energy_ev < 0:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "BTI input parameters outside physical bounds",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
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
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        model_direction = _classify_2point_direction(expected_vth_1, expected_vth_2)

        if observed_vth_shift_1 is None or observed_vth_shift_2 is None:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "An observed multi-checkpoint Vth trajectory is unavailable in the current telemetry schema",
                "expected_vth_1": float(expected_vth_1),
                "expected_vth_2": float(expected_vth_2),
                "model_direction": model_direction,
                "observed_evidence_status": "INSUFFICIENT_PHYSICS_EVIDENCE",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        vth_1 = float(observed_vth_shift_1)
        vth_2 = float(observed_vth_shift_2)

        if not _is_finite(vth_1) or not _is_finite(vth_2):
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": "Non-finite observed Vth shift value",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if vth_1 < 0 or vth_2 < 0:
            return False, {
                "check": CHECK_BTI_MONOTONICITY,
                "status": "FAIL",
                "reason": f"Negative Vth shift under BTI stress is physically unphysical (Vth1={vth_1}, Vth2={vth_2})",
                "consistency_conclusion": "INCONSISTENT",
            }

        observed_direction = _classify_2point_direction(vth_1, vth_2)

        is_consistent = (time_hours_2 >= time_hours_1 and observed_direction == model_direction)
        consistency_conclusion = "CONSISTENT" if is_consistent else "INCONSISTENT"

        evidence_dict = {
            "check": CHECK_BTI_MONOTONICITY,
            "status": "PASS" if is_consistent else "FAIL",
            "expected_vth_1": float(expected_vth_1),
            "expected_vth_2": float(expected_vth_2),
            "evaluated_vth_1": float(vth_1),
            "evaluated_vth_2": float(vth_2),
            "delta_vth": float(vth_2 - vth_1),
            "model_direction": model_direction,
            "observed_direction": observed_direction,
            "consistency_conclusion": consistency_conclusion,
        }

        if not is_consistent:
            evidence_dict["reason"] = (
                f"Observed Vth trajectory ({vth_1} -> {vth_2}) "
                f"contradicts bti_threshold_drift model direction ({model_direction})"
            )
            return False, evidence_dict

        return True, evidence_dict

    def evaluate_timing_consistency(
        self,
        tpd_0h: float,
        tpd_24h: float,
        tpd_168h: float,
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        base_amp: float = DEFAULT_BTI_BASE_AMP,
        exponent_n: float = DEFAULT_BTI_EXPONENT_N,
        activation_energy_ev: float = DEFAULT_BTI_ACTIVATION_ENERGY_EV,
        beta: float = 17.5,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 2: Timing Propagation Delay Degradation.
        Derives model-defined direction from calculate_propagation_delay() outputs
        driven strictly by authoritative BTI model outputs (bti_threshold_drift).
        Observed Vth shift is NEVER used as a substitute for model Vth generation.
        Uses exact ordering semantics without arbitrary epsilon tolerances.
        """
        inputs = (tpd_0h, tpd_24h, tpd_168h, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev, beta)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": "Non-finite input parameter in timing evaluation",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if tpd_0h < 0 or tpd_24h < 0 or tpd_168h < 0 or temp_c <= -273.15 or voltage_v <= 0 or base_amp <= 0 or exponent_n < 0 or activation_energy_ev < 0 or beta < 0:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": "Timing or BTI model parameters outside physical lower bounds",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        try:
            model_vth_24h = bti_threshold_drift(24.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))
            model_vth_168h = bti_threshold_drift(168.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))

            expected_tpd_0h = calculate_propagation_delay(tpd_0h, temp_c, 0.0, beta)
            expected_tpd_24h = calculate_propagation_delay(tpd_0h, temp_c, model_vth_24h, beta)
            expected_tpd_168h = calculate_propagation_delay(tpd_0h, temp_c, model_vth_168h, beta)
        except Exception as e:
            return False, {
                "check": CHECK_TIMING_DEGRADATION,
                "status": "FAIL",
                "reason": f"Timing physics model calculation error: {e}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        model_direction = _classify_trajectory_direction(expected_tpd_0h, expected_tpd_24h, expected_tpd_168h)
        observed_direction = _classify_trajectory_direction(tpd_0h, tpd_24h, tpd_168h)

        is_consistent = _are_directions_consistent(observed_direction, model_direction)
        consistency_conclusion = "CONSISTENT" if is_consistent else "INCONSISTENT"

        evidence_dict = {
            "check": CHECK_TIMING_DEGRADATION,
            "status": "PASS" if is_consistent else "FAIL",
            "observed_tpd_0h": float(tpd_0h),
            "observed_tpd_24h": float(tpd_24h),
            "observed_tpd_168h": float(tpd_168h),
            "model_vth_24h": float(model_vth_24h),
            "model_vth_168h": float(model_vth_168h),
            "expected_tpd_24h": float(expected_tpd_24h),
            "expected_tpd_168h": float(expected_tpd_168h),
            "model_direction": model_direction,
            "observed_direction": observed_direction,
            "consistency_conclusion": consistency_conclusion,
        }

        if not is_consistent:
            evidence_dict["reason"] = (
                f"Observed timing trajectory ({tpd_0h} -> {tpd_24h} -> {tpd_168h}) "
                f"contradicts calculate_propagation_delay model direction ({model_direction})"
            )
            return False, evidence_dict

        return True, evidence_dict

    def evaluate_leakage_consistency(
        self,
        ileak_0h: float,
        ileak_24h: float,
        ileak_168h: float,
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        base_amp: float = DEFAULT_BTI_BASE_AMP,
        exponent_n: float = DEFAULT_BTI_EXPONENT_N,
        activation_energy_ev: float = DEFAULT_BTI_ACTIVATION_ENERGY_EV,
        defect_type: str = "NORMAL",
        onset_hour: float = 0.0,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 3: Leakage Current Trajectory Alignment.
        Derives model-defined direction from calculate_leakage() outputs driven strictly by
        authoritative BTI primitive outputs (bti_threshold_drift).
        Observed Vth shift is NEVER used as a substitute for model Vth generation.
        Uses exact ordering semantics without arbitrary epsilon tolerances or ratios.
        """
        inputs = (ileak_0h, ileak_24h, ileak_168h, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev, onset_hour)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": "Non-finite input parameter in leakage evaluation",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if ileak_0h < 0 or ileak_24h < 0 or ileak_168h < 0 or temp_c <= -273.15 or voltage_v <= 0 or base_amp <= 0 or exponent_n < 0 or activation_energy_ev < 0 or onset_hour < 0:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": "Leakage current or BTI model parameters outside physical bounds (negative current)",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if defect_type not in {"NORMAL", "NONE", "TIMING_OFFSET", "GATE_OXIDE_SHORT", "STEP_BREAKDOWN"}:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Unsupported defect_type: {defect_type}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        try:
            model_vth_24h = bti_threshold_drift(24.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))
            model_vth_168h = bti_threshold_drift(168.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))

            expected_leak_0h = calculate_leakage(ileak_0h, temp_c, 0.0, defect_type, 0.0, onset_hour)
            expected_leak_24h = calculate_leakage(ileak_0h, temp_c, model_vth_24h, defect_type, 24.0, onset_hour)
            expected_leak_168h = calculate_leakage(ileak_0h, temp_c, model_vth_168h, defect_type, 168.0, onset_hour)
        except Exception as e:
            return False, {
                "check": CHECK_LEAKAGE_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Leakage physics model calculation error: {e}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        model_direction = _classify_trajectory_direction(expected_leak_0h, expected_leak_24h, expected_leak_168h)
        observed_direction = _classify_trajectory_direction(ileak_0h, ileak_24h, ileak_168h)

        is_consistent = _are_directions_consistent(observed_direction, model_direction)
        consistency_conclusion = "CONSISTENT" if is_consistent else "INCONSISTENT"

        evidence_dict = {
            "check": CHECK_LEAKAGE_TRAJECTORY,
            "status": "PASS" if is_consistent else "FAIL",
            "model_vth_24h": float(model_vth_24h),
            "model_vth_168h": float(model_vth_168h),
            "expected_leak_0h": float(expected_leak_0h),
            "expected_leak_24h": float(expected_leak_24h),
            "expected_leak_168h": float(expected_leak_168h),
            "observed_leak_0h": float(ileak_0h),
            "observed_leak_24h": float(ileak_24h),
            "observed_leak_168h": float(ileak_168h),
            "model_direction": model_direction,
            "observed_direction": observed_direction,
            "consistency_conclusion": consistency_conclusion,
        }

        if not is_consistent:
            evidence_dict["reason"] = (
                f"Observed leakage trajectory ({ileak_0h} -> {ileak_24h} -> {ileak_168h}) "
                f"contradicts calculate_leakage model direction ({model_direction})"
            )
            return False, evidence_dict

        return True, evidence_dict

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
        Uses exact ordering semantics without arbitrary epsilon tolerances.
        """
        inputs = (temp_c_use, temp_c_test_1, temp_c_test_2, activation_energy_ev)
        if not all(_is_finite(v) for v in inputs):
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": "Non-finite input parameter in Arrhenius thermal acceleration evaluation",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if temp_c_use <= -273.15 or temp_c_test_1 <= -273.15 or temp_c_test_2 <= -273.15 or activation_energy_ev < 0:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": "Temperature or activation energy parameters outside physical bounds",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        try:
            af_1 = calculate_arrhenius_acceleration(temp_c_use, temp_c_test_1, activation_energy_ev)
            af_2 = calculate_arrhenius_acceleration(temp_c_use, temp_c_test_2, activation_energy_ev)
        except Exception as e:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Arrhenius physics calculation error: {e}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        model_direction = "MONOTONICALLY_INCREASING_ACCELERATION"

        if temp_c_test_2 <= temp_c_test_1:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Input test temperature sequence non-increasing: T_stress_2 ({temp_c_test_2}C) <= T_stress_1 ({temp_c_test_1}C)",
                "model_direction": model_direction,
                "observed_direction": "NON_INCREASING_TEMPERATURE",
                "consistency_conclusion": "INCONSISTENT",
            }

        is_monotonic = (af_2 > af_1 and af_1 >= 1.0)
        observed_direction = "MONOTONICALLY_INCREASING" if is_monotonic else "NON_MONOTONIC"
        consistency_conclusion = "CONSISTENT" if is_monotonic else "INCONSISTENT"

        if not is_monotonic:
            return False, {
                "check": CHECK_THERMAL_ARRHENIUS,
                "status": "FAIL",
                "reason": f"Arrhenius acceleration factor non-monotonic: AF({temp_c_test_2}C)={af_2} <= AF({temp_c_test_1}C)={af_1}",
                "model_direction": model_direction,
                "observed_direction": observed_direction,
                "consistency_conclusion": consistency_conclusion,
                "af_1": float(af_1),
                "af_2": float(af_2),
            }

        return True, {
            "check": CHECK_THERMAL_ARRHENIUS,
            "status": "PASS",
            "temp_c_use": float(temp_c_use),
            "temp_c_test_1": float(temp_c_test_1),
            "temp_c_test_2": float(temp_c_test_2),
            "af_1": float(af_1),
            "af_2": float(af_2),
            "model_direction": model_direction,
            "observed_direction": observed_direction,
            "consistency_conclusion": consistency_conclusion,
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
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        base_amp: float = DEFAULT_BTI_BASE_AMP,
        exponent_n: float = DEFAULT_BTI_EXPONENT_N,
        activation_energy_ev: float = DEFAULT_BTI_ACTIVATION_ENERGY_EV,
        defect_type: str = "NORMAL",
        onset_hour: float = 0.0,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check 5: 24h -> 168h Forecast Trajectory Direction Alignment.
        Derives forecast model directions using calculate_propagation_delay() and calculate_leakage()
        driven strictly by bti_threshold_drift() model outputs rather than arbitrary defaults or observed Vth.
        IDDQ is declared INSUFFICIENT_PHYSICS_EVIDENCE as no dedicated IDDQ physics degradation law exists.
        """
        vals = (iddq_0h, iddq_24h, iddq_168h, ileak_0h, ileak_24h, ileak_168h, tpd_0h, tpd_24h, tpd_168h, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev, onset_hour)

        if not all(_is_finite(v) for v in vals):
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": "Non-finite parameter value in 24h -> 168h forecast trajectory",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        if any(v < 0 for v in (iddq_0h, iddq_24h, iddq_168h, ileak_0h, ileak_24h, ileak_168h, tpd_0h, tpd_24h, tpd_168h)) or temp_c <= -273.15 or voltage_v <= 0 or base_amp <= 0 or exponent_n < 0 or activation_energy_ev < 0 or onset_hour < 0:
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": "Negative parameter value or unphysical model parameters in 24h -> 168h forecast trajectory",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        try:
            model_vth_24h = bti_threshold_drift(24.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))
            model_vth_168h = bti_threshold_drift(168.0, float(temp_c), float(voltage_v), float(base_amp), float(exponent_n), float(activation_energy_ev))

            exp_tpd_0 = calculate_propagation_delay(tpd_0h, temp_c, 0.0, 17.5)
            exp_tpd_24 = calculate_propagation_delay(tpd_0h, temp_c, model_vth_24h, 17.5)
            exp_tpd_168 = calculate_propagation_delay(tpd_0h, temp_c, model_vth_168h, 17.5)
        except Exception as e:
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Forecast timing model error: {e}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        timing_model_direction = _classify_trajectory_direction(exp_tpd_0, exp_tpd_24, exp_tpd_168)
        timing_observed_direction = _classify_trajectory_direction(tpd_0h, tpd_24h, tpd_168h)
        timing_consistent = _are_directions_consistent(timing_observed_direction, timing_model_direction)
        timing_conclusion = "CONSISTENT" if timing_consistent else "INCONSISTENT"

        try:
            exp_leak_0 = calculate_leakage(ileak_0h, temp_c, 0.0, defect_type, 0.0, onset_hour)
            exp_leak_24 = calculate_leakage(ileak_0h, temp_c, model_vth_24h, defect_type, 24.0, onset_hour)
            exp_leak_168 = calculate_leakage(ileak_0h, temp_c, model_vth_168h, defect_type, 168.0, onset_hour)
        except Exception as e:
            return False, {
                "check": CHECK_FORECAST_TRAJECTORY,
                "status": "FAIL",
                "reason": f"Forecast leakage model error: {e}",
                "consistency_conclusion": "INSUFFICIENT_PHYSICS_EVIDENCE",
            }

        leakage_model_direction = _classify_trajectory_direction(exp_leak_0, exp_leak_24, exp_leak_168)
        leakage_observed_direction = _classify_trajectory_direction(ileak_0h, ileak_24h, ileak_168h)
        leakage_consistent = _are_directions_consistent(leakage_observed_direction, leakage_model_direction)
        leakage_conclusion = "CONSISTENT" if leakage_consistent else "INCONSISTENT"

        # IDDQ handling: No dedicated IDDQ degradation law exists in src/physics/.
        iddq_physics_evaluation = "INSUFFICIENT_PHYSICS_EVIDENCE"
        iddq_physics_note = "IDDQ monitored for non-negativity and finiteness; no dedicated physics model in src/physics/"

        is_consistent = (timing_consistent and leakage_consistent)

        evidence_dict = {
            "check": CHECK_FORECAST_TRAJECTORY,
            "status": "PASS" if is_consistent else "FAIL",
            "observed_tpd_trajectory": [float(tpd_0h), float(tpd_24h), float(tpd_168h)],
            "expected_tpd_trajectory": [float(exp_tpd_0), float(exp_tpd_24), float(exp_tpd_168)],
            "timing_model_direction": timing_model_direction,
            "timing_observed_direction": timing_observed_direction,
            "timing_consistency_conclusion": timing_conclusion,
            "observed_leak_trajectory": [float(ileak_0h), float(ileak_24h), float(ileak_168h)],
            "expected_leak_trajectory": [float(exp_leak_0), float(exp_leak_24), float(exp_leak_168)],
            "leakage_model_direction": leakage_model_direction,
            "leakage_observed_direction": leakage_observed_direction,
            "leakage_consistency_conclusion": leakage_conclusion,
            "iddq_physics_evaluation": iddq_physics_evaluation,
            "iddq_physics_note": iddq_physics_note,
        }

        if not is_consistent:
            reasons = []
            if not timing_consistent:
                reasons.append(f"Timing forecast direction ({timing_observed_direction}) contradicts model ({timing_model_direction})")
            if not leakage_consistent:
                reasons.append(f"Leakage forecast direction ({leakage_observed_direction}) contradicts model ({leakage_model_direction})")
            evidence_dict["reason"] = "; ".join(reasons)
            return False, evidence_dict

        return True, evidence_dict

    def evaluate_physics_evidence(
        self,
        record: Dict[str, Any],
        temp_c: float = 125.0,
        voltage_v: float = 1.1,
        defect_type: str = "NORMAL",
    ) -> Dict[str, Any]:
        """
        Evaluate full physics consistency evidence for a given telemetry/forecast record.
        Strict fail-closed for missing 168h evidence or non-finite inputs.
        
        Returns authoritative status (ONLY one of PHYSICS_CONSISTENT, PHYSICS_INCONSISTENT, INSUFFICIENT_PHYSICS_EVIDENCE)
        and deterministic engineering evidence score (0.0 to 1.0).
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

        # Check presence of optional observed Vth trajectory fields if explicitly provided in record schema:
        has_vth_24 = "vth_shift_24h" in record or "vth_shift_24" in record or "vth_24h" in record or "vth_24" in record
        has_vth_168 = "vth_shift_168h" in record or "vth_shift_168" in record or "vth_168h" in record or "vth_168" in record or "vth_168h_ground_truth" in record

        obs_vth_24 = record.get("vth_shift_24h", record.get("vth_shift_24", record.get("vth_24h", record.get("vth_24")))) if has_vth_24 else None
        obs_vth_168 = record.get("vth_shift_168h", record.get("vth_shift_168", record.get("vth_168h", record.get("vth_168h_ground_truth", record.get("vth_168"))))) if has_vth_168 else None

        # Check presence of required 168h trajectory telemetry (iddq, ileak, tpd):
        has_iddq_0 = "iddq_0h" in record or "iddq_0" in record
        has_iddq_24 = "iddq_24h" in record or "iddq_24" in record
        has_iddq_168 = "iddq_168h" in record or "iddq_168h_ground_truth" in record or "iddq_168" in record

        has_ileak_0 = "ileak_0h" in record or "ileak_0" in record
        has_ileak_24 = "ileak_24h" in record or "ileak_24" in record
        has_ileak_168 = "ileak_168h" in record or "ileak_168h_ground_truth" in record or "ileak_168" in record

        has_tpd_0 = "tpd_0h" in record or "tpd_0" in record
        has_tpd_24 = "tpd_24h" in record or "tpd_24" in record
        has_tpd_168 = "tpd_168h" in record or "tpd_168h_ground_truth" in record or "tpd_168" in record

        if not (has_iddq_0 and has_iddq_24 and has_iddq_168 and
                has_ileak_0 and has_ileak_24 and has_ileak_168 and
                has_tpd_0 and has_tpd_24 and has_tpd_168):
            return {
                "physics_consistency_status": PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value,
                "physics_consistency_score": 0.0,
                "passed_physics_checks": [],
                "failed_physics_checks": ALL_PHYSICS_CHECKS,
                "evidence": {
                    "reason": "Missing required 168h trajectory telemetry for physics evaluation; failing closed without manufacturing data"
                },
                "input_provenance": {
                    "component_id": component_id,
                    "lot_id": lot_id,
                    "evaluated_checkpoints": ["MISSING_REQUIRED_EVIDENCE"],
                },
                "physics_model_provenance": {
                    "module_version": self.VERSION,
                    "reused_functions": self.REUSED_FUNCTIONS,
                },
            }

        # Direct extraction of observed trajectories (no 24h fallback for 168h!)
        iddq_0 = record.get("iddq_0h", record.get("iddq_0"))
        iddq_24 = record.get("iddq_24h", record.get("iddq_24"))
        iddq_168 = record.get("iddq_168h", record.get("iddq_168h_ground_truth", record.get("iddq_168")))

        ileak_0 = record.get("ileak_0h", record.get("ileak_0"))
        ileak_24 = record.get("ileak_24h", record.get("ileak_24"))
        ileak_168 = record.get("ileak_168h", record.get("ileak_168h_ground_truth", record.get("ileak_168")))

        tpd_0 = record.get("tpd_0h", record.get("tpd_0"))
        tpd_24 = record.get("tpd_24h", record.get("tpd_24"))
        tpd_168 = record.get("tpd_168h", record.get("tpd_168h_ground_truth", record.get("tpd_168")))

        passed_checks: List[str] = []
        failed_checks: List[str] = []
        insufficient_checks: List[str] = []
        evidence: Dict[str, Any] = {}

        # 1. BTI Monotonicity Check (uses observed Vth if present in schema, or reports INSUFFICIENT_PHYSICS_EVIDENCE):
        bti_pass, bti_ev = self.evaluate_bti_consistency(
            time_hours_1=24.0, time_hours_2=168.0, temp_c=temp_c, voltage_v=voltage_v,
            observed_vth_shift_1=obs_vth_24, observed_vth_shift_2=obs_vth_168
        )
        evidence["bti_consistency"] = bti_ev
        if bti_pass:
            passed_checks.append(CHECK_BTI_MONOTONICITY)
        else:
            if bti_ev.get("consistency_conclusion") == "INSUFFICIENT_PHYSICS_EVIDENCE":
                insufficient_checks.append(CHECK_BTI_MONOTONICITY)
            else:
                failed_checks.append(CHECK_BTI_MONOTONICITY)

        # 2. Timing Degradation Check
        tpd_pass, tpd_ev = self.evaluate_timing_consistency(
            tpd_0h=tpd_0, tpd_24h=tpd_24, tpd_168h=tpd_168, temp_c=temp_c, voltage_v=voltage_v
        )
        evidence["timing_consistency"] = tpd_ev
        if tpd_pass:
            passed_checks.append(CHECK_TIMING_DEGRADATION)
        else:
            if tpd_ev.get("consistency_conclusion") == "INSUFFICIENT_PHYSICS_EVIDENCE":
                insufficient_checks.append(CHECK_TIMING_DEGRADATION)
            else:
                failed_checks.append(CHECK_TIMING_DEGRADATION)

        # 3. Leakage Trajectory Check
        leak_pass, leak_ev = self.evaluate_leakage_consistency(
            ileak_0h=ileak_0, ileak_24h=ileak_24, ileak_168h=ileak_168, temp_c=temp_c, voltage_v=voltage_v, defect_type=defect_type
        )
        evidence["leakage_consistency"] = leak_ev
        if leak_pass:
            passed_checks.append(CHECK_LEAKAGE_TRAJECTORY)
        else:
            if leak_ev.get("consistency_conclusion") == "INSUFFICIENT_PHYSICS_EVIDENCE":
                insufficient_checks.append(CHECK_LEAKAGE_TRAJECTORY)
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
            if arrh_ev.get("consistency_conclusion") == "INSUFFICIENT_PHYSICS_EVIDENCE":
                insufficient_checks.append(CHECK_THERMAL_ARRHENIUS)
            else:
                failed_checks.append(CHECK_THERMAL_ARRHENIUS)

        # 5. Forecast Trajectory Consistency Check
        fc_pass, fc_ev = self.evaluate_forecast_trajectory_consistency(
            iddq_0h=iddq_0, iddq_24h=iddq_24, iddq_168h=iddq_168,
            ileak_0h=ileak_0, ileak_24h=ileak_24, ileak_168h=ileak_168,
            tpd_0h=tpd_0, tpd_24h=tpd_24, tpd_168h=tpd_168,
            temp_c=temp_c, voltage_v=voltage_v, defect_type=defect_type
        )
        evidence["forecast_trajectory_consistency"] = fc_ev
        if fc_pass:
            passed_checks.append(CHECK_FORECAST_TRAJECTORY)
        else:
            if fc_ev.get("consistency_conclusion") == "INSUFFICIENT_PHYSICS_EVIDENCE":
                insufficient_checks.append(CHECK_FORECAST_TRAJECTORY)
            else:
                failed_checks.append(CHECK_FORECAST_TRAJECTORY)

        total_checks = len(ALL_PHYSICS_CHECKS)
        num_passed = len(passed_checks)

        # Status determination semantics:
        # 1. Any genuine physical inconsistency -> PHYSICS_INCONSISTENT
        # 2. Else any check is INSUFFICIENT_PHYSICS_EVIDENCE -> INSUFFICIENT_PHYSICS_EVIDENCE
        # 3. Only if ALL required checks pass -> PHYSICS_CONSISTENT
        if len(failed_checks) > 0:
            status = PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
        elif len(insufficient_checks) > 0:
            status = PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
        else:
            status = PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value

        score = float(num_passed / total_checks)

        return {
            "physics_consistency_status": status,
            "physics_consistency_score": score,
            "passed_physics_checks": passed_checks,
            "failed_physics_checks": failed_checks,
            "insufficient_physics_checks": insufficient_checks,
            "evidence": evidence,
            "input_provenance": {
                "component_id": component_id,
                "lot_id": lot_id,
                "evaluated_checkpoints": ["0h", "24h", "168h"],
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
