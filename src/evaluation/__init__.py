"""
PREDICTA — Authoritative Evaluation Module
"""

from .latent_trajectory import (
    TrajectoryState,
    AuthoritativeTarget,
    evaluate_component_state,
    build_trajectory_dataset,
    assert_no_temporal_leakage,
    split_trajectories_by_lot,
    calculate_latent_screening_metrics,
    evaluate_production_model_compatibility,
    run_latent_trajectory_evaluation,
)

__all__ = [
    "TrajectoryState",
    "AuthoritativeTarget",
    "evaluate_component_state",
    "build_trajectory_dataset",
    "assert_no_temporal_leakage",
    "split_trajectories_by_lot",
    "calculate_latent_screening_metrics",
    "evaluate_production_model_compatibility",
    "run_latent_trajectory_evaluation",
]
