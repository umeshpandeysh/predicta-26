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
from .metrics import (
    compute_binary_confusion_matrix,
    calculate_standardized_metrics,
    compute_pr_auc_trapz,
    compute_roc_auc_trapz
)
from .threshold_policy import (
    ThresholdPolicy,
    ThresholdSource,
    ForbiddenTestThresholdOptimizationError
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
    "compute_binary_confusion_matrix",
    "calculate_standardized_metrics",
    "compute_pr_auc_trapz",
    "compute_roc_auc_trapz",
    "ThresholdPolicy",
    "ThresholdSource",
    "ForbiddenTestThresholdOptimizationError",
]
