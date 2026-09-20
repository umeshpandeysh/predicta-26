"""
PREDICTA Physics Package
========================
Domain physics modeling functions and Stage 7 Physics-Aware Reliability Engine.
"""

from src.physics.aging import bti_threshold_drift
from src.physics.timing import calculate_propagation_delay
from src.physics.leakage import calculate_leakage
from src.physics.temperature import calculate_arrhenius_acceleration
from src.physics.reliability_engine import (
    PhysicsReliabilityEngine,
    PhysicsConsistencyStatus,
    evaluate_physics_consistency,
    CHECK_BTI_MONOTONICITY,
    CHECK_TIMING_DEGRADATION,
    CHECK_LEAKAGE_TRAJECTORY,
    CHECK_THERMAL_ARRHENIUS,
    CHECK_FORECAST_TRAJECTORY,
)

__all__ = [
    "bti_threshold_drift",
    "calculate_propagation_delay",
    "calculate_leakage",
    "calculate_arrhenius_acceleration",
    "PhysicsReliabilityEngine",
    "PhysicsConsistencyStatus",
    "evaluate_physics_consistency",
    "CHECK_BTI_MONOTONICITY",
    "CHECK_TIMING_DEGRADATION",
    "CHECK_LEAKAGE_TRAJECTORY",
    "CHECK_THERMAL_ARRHENIUS",
    "CHECK_FORECAST_TRAJECTORY",
]
