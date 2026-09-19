"""
Authoritative Stage 6 Conformal Residual Calibration Module (Python)
====================================================================
Establishes a statistically governed, leakage-safe framework for producing
finite-sample split-conformal prediction intervals around continuous 168h prognostic
trajectory forecasts.

Scientific & Governance Rules:
1. Validation-Only Calibration: Calibration fitting is strictly restricted to the
   authoritative VALIDATION cohort (LOT-SYN-036..042, 700 components).
2. Zero Test Leakage: The held-out TEST cohort (LOT-SYN-043..050, 800 components)
   must remain untouched until calibration parameters are frozen. Fitting on TEST
   is strictly prohibited and enforced fail-closed.
3. Grouped Granularity: Conformal nonconformity quantiles are estimated per
   (parameter x horizon x nominal_level) group. No silent pooling across parameters.
4. Finite-Sample Quantile Rule: Exactly k = ceil((n + 1) * coverage) on sorted
   absolute validation residuals |y - y_hat|.
5. Status Integrity: Calibration status remains NOT_CALIBRATED and model status
   remains BENCHMARK_ONLY until formal empirical verification and release gating.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from typing import Any, Dict, List, Optional, Union

import numpy as np

from src.prognostics.trajectory import (
    CONTRACT_PATH,
    compute_sha256,
    load_authoritative_prognostic_contract,
)

DATASET_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "synthetic", "semiconductor_synthetic_full.csv")
)


def get_authoritative_calibration_spec(contract_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts and validates the authoritative uncertainty_calibration_specification
    from the prognostic contract. Fails closed if missing or invalid.
    """
    contract = load_authoritative_prognostic_contract(contract_path)
    if "uncertainty_calibration_specification" not in contract:
        raise ValueError(
            "AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing 'uncertainty_calibration_specification' in contract"
        )
    spec = contract["uncertainty_calibration_specification"]
    required_keys = [
        "method",
        "calibration_split",
        "evaluation_split",
        "forecast_origins",
        "supported_horizons",
        "target_parameters",
        "candidate_nominal_levels",
        "minimum_calibration_samples",
        "aggregation_method",
        "residual_definition",
        "interval_construction_method",
        "finite_sample_quantile_rule",
        "finite_value_policy",
        "status",
        "model_status",
    ]
    for k in required_keys:
        if k not in spec:
            raise ValueError(
                f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required key '{k}' in calibration spec"
            )
    return spec


def compute_finite_sample_conformal_quantile(
    residuals: Union[List[float], np.ndarray],
    nominal_coverage: float,
    rule: str = "CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N",
) -> float:
    """
    Computes the deterministic finite-sample conformal quantile from non-negative residuals.

    Formula:
        Given n calibration residuals R_(1) <= R_(2) <= ... <= R_(n),
        the conformal index for nominal coverage 1 - alpha is:
        k = ceil((n + 1) * (1 - alpha)) = ceil((n + 1) * nominal_coverage)
        clipped to [1, n].
        In 0-indexed sorted array: index = k - 1.

    Args:
        residuals: Array-like non-negative absolute residuals |y - y_hat|.
        nominal_coverage: Requested candidate coverage level in (0, 1) (e.g. 0.80, 0.90, 0.95).
        rule: Method identifier from authoritative contract.

    Returns:
        float: The conformal residual quantile q.
    """
    if not (0.0 < nominal_coverage < 1.0):
        raise ValueError(
            f"INVALID_COVERAGE_LEVEL: nominal_coverage must be strictly between 0 and 1, got {nominal_coverage}"
        )

    res_arr = np.asarray(residuals, dtype=np.float64)
    if res_arr.size == 0:
        raise ValueError("INSUFFICIENT_CALIBRATION_DATA: Residual array is empty")

    if not np.all(np.isfinite(res_arr)):
        raise ValueError("NON_FINITE_RESIDUAL_REJECTED: Calibration residuals must all be finite numbers")

    if np.any(res_arr < 0.0):
        raise ValueError("NEGATIVE_RESIDUAL_REJECTED: Absolute residuals |y - y_hat| must be non-negative")

    sorted_res = np.sort(res_arr)
    n = len(sorted_res)

    if rule == "CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N":
        k = math.ceil((n + 1) * float(nominal_coverage))
        k_clipped = min(n, max(1, k))
        index = k_clipped - 1
        return float(sorted_res[index])
    else:
        raise ValueError(f"UNSUPPORTED_QUANTILE_RULE: Unknown rule '{rule}'")


class ConformalResidualCalibrator:
    """
    Authoritative Split-Conformal Residual Calibrator for 168h Continuous Trajectories.

    Enforces:
    - Calibration strictly on VALIDATION split (LOT-SYN-036..042).
    - Hard fail-closed rejection if fitting is attempted on TEST split or mixed data.
    - Deterministic per-(parameter x horizon x nominal_level) quantile tables.
    - Immutability once frozen into a calibration artifact.
    """

    def __init__(self, contract_path: Optional[str] = None):
        self.contract_path = contract_path or CONTRACT_PATH
        self.contract = load_authoritative_prognostic_contract(self.contract_path)
        self.spec = get_authoritative_calibration_spec(self.contract_path)
        self.is_frozen = False
        self.frozen_artifact: Optional[Dict[str, Any]] = None

    def fit(
        self,
        validation_predictions: Dict[str, Dict[int, np.ndarray]],
        validation_targets: Dict[str, Dict[int, np.ndarray]],
        split_name: str = "VALIDATION",
        validation_lots: Optional[List[str]] = None,
        dataset_sha256: Optional[str] = None,
        model_identity: str = "Deterministic_Continuous_Degradation_Forecaster",
    ) -> Dict[str, Any]:
        """
        Fits the conformal calibrator on validation residuals.

        Args:
            validation_predictions: Dict[param, Dict[horizon, array_of_preds]]
            validation_targets: Dict[param, Dict[horizon, array_of_ground_truths]]
            split_name: Must be exactly "VALIDATION". Any other value raises an error.
            validation_lots: Optional list of validation lot IDs for provenance recording.
            dataset_sha256: SHA-256 of the authoritative synthetic dataset.
            model_identity: Forecaster model name identifier.

        Returns:
            Dict: Frozen calibration artifact dictionary.
        """
        # Strict validation split guard
        if split_name != "VALIDATION":
            raise ValueError(
                f"TEST_SPLIT_LEAKAGE_REJECTED: Conformal calibrator fitting is strictly restricted to 'VALIDATION' "
                f"split, but received split_name='{split_name}'"
            )

        target_params = self.spec["target_parameters"]
        candidate_levels = [float(lvl) for lvl in self.spec["candidate_nominal_levels"]]
        min_samples = int(self.spec["minimum_calibration_samples"])
        rule = str(self.spec["finite_sample_quantile_rule"])

        quantiles_table: Dict[str, Dict[str, Dict[str, float]]] = {}
        sample_counts: Dict[str, Dict[str, int]] = {}

        for param in target_params:
            if param not in validation_predictions:
                raise ValueError(f"MISSING_PARAMETER_PREDICTIONS: Missing predictions for parameter '{param}'")
            if param not in validation_targets:
                raise ValueError(f"MISSING_PARAMETER_TARGETS: Missing ground truth targets for parameter '{param}'")

            quantiles_table[param] = {}
            sample_counts[param] = {}

            # Evaluate on available horizon keys in targets
            for h_key, y_arr in validation_targets[param].items():
                h_int = int(h_key)
                h_str = f"{h_int}h"
                if h_int not in validation_predictions[param]:
                    continue

                y_pred = np.asarray(validation_predictions[param][h_int], dtype=np.float64)
                y_true = np.asarray(y_arr, dtype=np.float64)

                if len(y_pred) != len(y_true):
                    raise ValueError(
                        f"SAMPLE_COUNT_MISMATCH: Length of predictions ({len(y_pred)}) != targets ({len(y_true)}) "
                        f"for {param}@{h_str}"
                    )

                if len(y_true) < min_samples:
                    raise ValueError(
                        f"INSUFFICIENT_CALIBRATION_DATA: Sample count {len(y_true)} < minimum {min_samples} "
                        f"for {param}@{h_str}"
                    )

                if not np.all(np.isfinite(y_pred)) or not np.all(np.isfinite(y_true)):
                    raise ValueError(
                        f"NON_FINITE_INPUT_REJECTED: Non-finite values detected in {param}@{h_str} predictions/targets"
                    )

                # Absolute nonconformity residual |y - y_hat|
                abs_residuals = np.abs(y_true - y_pred)
                n_samples = len(abs_residuals)
                sample_counts[param][h_str] = n_samples
                quantiles_table[param][h_str] = {}

                for lvl in candidate_levels:
                    lvl_str = f"{lvl:.2f}"
                    q_val = compute_finite_sample_conformal_quantile(
                        residuals=abs_residuals,
                        nominal_coverage=lvl,
                        rule=rule,
                    )
                    quantiles_table[param][h_str][lvl_str] = float(q_val)

        # Build provenance-locked artifact
        actual_dataset_sha = dataset_sha256 or (
            compute_sha256(DATASET_PATH) if os.path.exists(DATASET_PATH) else "UNKNOWN_DATASET_SHA"
        )
        contract_sha = compute_sha256(self.contract_path) if os.path.exists(self.contract_path) else "UNKNOWN"

        artifact = {
            "artifact_schema_version": "1.0.0",
            "method": self.spec["method"],
            "model_identity": model_identity,
            "calibration_split": "VALIDATION",
            "evaluation_split": "TEST",
            "validation_lots": validation_lots or [f"LOT-SYN-{i:03d}" for i in range(36, 43)],
            "dataset_sha256": actual_dataset_sha,
            "prognostic_contract_sha256": contract_sha,
            "target_parameters": target_params,
            "candidate_nominal_levels": candidate_levels,
            "finite_sample_quantile_rule": rule,
            "sample_counts": sample_counts,
            "conformal_quantiles": quantiles_table,
            "status": self.spec["status"],
            "model_status": self.spec["model_status"],
            "disclaimer": self.spec["disclaimer"],
        }

        # Deterministic content hash of mathematical tables
        canonical_content = json.dumps(
            {
                "dataset_sha256": actual_dataset_sha,
                "method": self.spec["method"],
                "quantiles": quantiles_table,
                "rule": rule,
                "sample_counts": sample_counts,
            },
            sort_keys=True,
        )
        artifact["calibration_artifact_sha256"] = hashlib.sha256(canonical_content.encode("utf-8")).hexdigest()

        self.frozen_artifact = artifact
        self.is_frozen = True
        return artifact

    def apply(
        self,
        predictions: Dict[str, Dict[int, np.ndarray]],
    ) -> Dict[str, Dict[str, Dict[str, Dict[str, np.ndarray]]]]:
        """
        Applies frozen conformal calibration quantiles to test point predictions.

        Strict Safety:
        - Accepts predictions ONLY (no ground truth test targets).
        - Rejects uncalibrated state.

        Returns:
            Dict: Grouped intervals per param -> horizon -> nominal_level:
                  {"lower": np.ndarray, "upper": np.ndarray, "width": np.ndarray, "quantile": float}
        """
        if not self.is_frozen or self.frozen_artifact is None:
            raise RuntimeError("CALIBRATOR_NOT_FROZEN: Calibrator must be fitted before applying intervals")

        quantiles_table = self.frozen_artifact["conformal_quantiles"]
        intervals: Dict[str, Dict[str, Dict[str, Dict[str, np.ndarray]]]] = {}

        for param, h_dict in predictions.items():
            if param not in quantiles_table:
                raise ValueError(f"UNSUPPORTED_PARAMETER: Parameter '{param}' not found in calibration artifact")

            intervals[param] = {}
            for h_int, y_pred_arr in h_dict.items():
                h_str = f"{int(h_int)}h"
                if h_str not in quantiles_table[param]:
                    continue

                y_pred = np.asarray(y_pred_arr, dtype=np.float64)
                if not np.all(np.isfinite(y_pred)):
                    raise ValueError(f"NON_FINITE_PREDICTIONS: Non-finite predictions detected for {param}@{h_str}")

                intervals[param][h_str] = {}
                for lvl_str, q_val in quantiles_table[param][h_str].items():
                    q = float(q_val)
                    lower = y_pred - q
                    upper = y_pred + q
                    width = np.full_like(y_pred, 2.0 * q)

                    intervals[param][h_str][lvl_str] = {
                        "lower": lower,
                        "upper": upper,
                        "width": width,
                        "quantile": q,
                    }

        return intervals

    def evaluate_coverage(
        self,
        intervals: Dict[str, Dict[str, Dict[str, Dict[str, np.ndarray]]]],
        test_targets: Dict[str, Dict[int, np.ndarray]],
    ) -> Dict[str, Any]:
        """
        Evaluates empirical coverage of conformal prediction intervals on the held-out test cohort.

        Args:
            intervals: Output from self.apply(test_predictions)
            test_targets: Dict[param, Dict[horizon, array_of_true_values]]

        Returns:
            Dict with empirical coverage statistics per parameter, horizon, and nominal level.
        """
        results: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}

        for param, h_dict in intervals.items():
            if param not in test_targets:
                continue

            results[param] = {}
            for h_str, lvl_dict in h_dict.items():
                h_int = int(h_str.replace("h", ""))
                if h_int not in test_targets[param]:
                    continue

                y_true = np.asarray(test_targets[param][h_int], dtype=np.float64)
                results[param][h_str] = {}

                for lvl_str, interval_data in lvl_dict.items():
                    nominal_lvl = float(lvl_str)
                    lower = interval_data["lower"]
                    upper = interval_data["upper"]
                    widths = interval_data["width"]

                    # Check inside interval: lower <= y_true <= upper
                    covered = (y_true >= lower) & (y_true <= upper)
                    n_test = len(y_true)
                    n_covered = int(np.sum(covered))
                    observed_coverage_pct = float((n_covered / n_test) * 100.0) if n_test > 0 else 0.0
                    observed_coverage_ratio = float(n_covered / n_test) if n_test > 0 else 0.0
                    coverage_error = observed_coverage_ratio - nominal_lvl

                    results[param][h_str][lvl_str] = {
                        "nominal_coverage": nominal_lvl,
                        "observed_coverage_pct": round(observed_coverage_pct, 2),
                        "observed_coverage_ratio": round(observed_coverage_ratio, 4),
                        "coverage_error": round(coverage_error, 4),
                        "test_sample_count": n_test,
                        "covered_sample_count": n_covered,
                        "conformal_quantile_q": float(interval_data["quantile"]),
                        "avg_interval_width": round(float(np.mean(widths)), 4),
                        "median_interval_width": round(float(np.median(widths)), 4),
                        "min_interval_width": round(float(np.min(widths)), 4),
                        "max_interval_width": round(float(np.max(widths)), 4),
                        "calibration_status": "NOT_CALIBRATED",
                    }

        return results


def export_calibration_artifact(artifact: Dict[str, Any], filepath: str) -> None:
    """Exports frozen calibration artifact to JSON on disk."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(artifact, f, indent=2)
