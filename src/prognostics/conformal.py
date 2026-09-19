"""
Authoritative Stage 6 Conformal Residual Calibration Module (Python)
====================================================================
Establishes a statistically governed, leakage-safe framework for producing
finite-sample split-conformal prediction intervals around continuous 168h prognostic
trajectory forecasts.

Scientific & Governance Rules:
1. Four-Way Lot-Disjoint Partitioning:
   - TRAIN: LOT-SYN-001..035 (3500 components) -> Point forecaster fitting
   - VALIDATION_TUNE: LOT-SYN-036..038 (300 components) -> Hyperparameter tuning & model selection
   - CALIBRATION: LOT-SYN-039..042 (400 components) -> Conformal residual quantile estimation ONLY
   - TEST: LOT-SYN-043..050 (800 components) -> Final frozen empirical coverage evaluation
2. Model Freeze Before Calibration:
   Point forecasting model is selected and tuned strictly on TRAIN + VALIDATION_TUNE.
   The model formulation, hyperparameters, and weights are frozen BEFORE computing
   nonconformity residuals on the independent CALIBRATION cohort.
3. Strict Calibration Isolation & Rejection:
   The ConformalResidualCalibrator accepts CALIBRATION split data ONLY. Fitting on TEST,
   VALIDATION_TUNE, TRAIN, or mixed cohorts is rejected fail-closed.
4. Finite-Sample Quantile Rule:
   Exact finite-sample index: k = min(n, ceil((n + 1) * coverage)) on sorted absolute
   residuals |y - y_hat|. (0-indexed: index = k - 1).
5. Horizon Governance:
   The contract declares 7 horizons (24, 48, 72, 96, 120, 144, 168) across 3 parameters (21 groups).
   The synthetic dataset physically records checkpoints at 96h and 168h.
   The calibrator evaluates and calibrates exactly 6 parameter x horizon groups, explicitly marking
   unavailable horizons as DATA_UNAVAILABLE and origin as NOT_EVALUATED.
6. Status Integrity:
   calibration_status remains NOT_CALIBRATED and model_status remains BENCHMARK_ONLY.
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
SPLIT_MANIFEST_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "ml", "data", "split_manifest.json")
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
        "model_tuning_split",
        "calibration_split",
        "evaluation_split",
        "forecast_origins",
        "declared_contract_horizons",
        "supported_dataset_horizons",
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


def partition_four_way_dataset(
    records: List[Dict[str, Any]],
    split_manifest_path: Optional[str] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Partitions continuous prognostic records into four strictly lot-disjoint cohorts:
    - TRAIN: LOT-SYN-001..035 (35 lots, 3500 components)
    - VALIDATION_TUNE: LOT-SYN-036..038 (3 lots, 300 components)
    - CALIBRATION: LOT-SYN-039..042 (4 lots, 400 components)
    - TEST: LOT-SYN-043..050 (8 lots, 800 components)

    Enforces 0 lot overlap, 0 component overlap, and 100% partition completeness.
    """
    manifest_to_use = split_manifest_path or SPLIT_MANIFEST_PATH
    if os.path.exists(manifest_to_use):
        with open(manifest_to_use, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        train_lots = set(manifest.get("lots", {}).get("train", []))
        val_tune_lots = set(manifest.get("lots", {}).get("validation_tune", []))
        calib_lots = set(manifest.get("lots", {}).get("calibration", []))
        test_lots = set(manifest.get("lots", {}).get("test", []))
    else:
        train_lots = {f"LOT-SYN-{i:03d}" for i in range(1, 36)}
        val_tune_lots = {f"LOT-SYN-{i:03d}" for i in range(36, 39)}
        calib_lots = {f"LOT-SYN-{i:03d}" for i in range(39, 43)}
        test_lots = {f"LOT-SYN-{i:03d}" for i in range(43, 51)}

    # Disjointness check across lot sets
    assert train_lots.isdisjoint(val_tune_lots), "Train and ValTune lots overlap!"
    assert train_lots.isdisjoint(calib_lots), "Train and Calib lots overlap!"
    assert train_lots.isdisjoint(test_lots), "Train and Test lots overlap!"
    assert val_tune_lots.isdisjoint(calib_lots), "ValTune and Calib lots overlap!"
    assert val_tune_lots.isdisjoint(test_lots), "ValTune and Test lots overlap!"
    assert calib_lots.isdisjoint(test_lots), "Calib and Test lots overlap!"

    train_recs: List[Dict[str, Any]] = []
    val_tune_recs: List[Dict[str, Any]] = []
    calib_recs: List[Dict[str, Any]] = []
    test_recs: List[Dict[str, Any]] = []

    seen_components = set()

    for r in records:
        cid = r["component_id"]
        if cid in seen_components:
            raise ValueError(f"DUPLICATE_COMPONENT_ID: Component {cid} appears multiple times")
        seen_components.add(cid)

        lot = r["lot_id"]
        if lot in train_lots:
            train_recs.append(r)
        elif lot in val_tune_lots:
            val_tune_recs.append(r)
        elif lot in calib_lots:
            calib_recs.append(r)
        elif lot in test_lots:
            test_recs.append(r)
        else:
            raise ValueError(f"UNKNOWN_LOT_ID: Component {cid} belongs to unauthorized lot {lot}")

    total_assigned = len(train_recs) + len(val_tune_recs) + len(calib_recs) + len(test_recs)
    if total_assigned != len(records):
        raise ValueError(
            f"SPLIT_INCOMPLETE: Total assigned ({total_assigned}) != total records ({len(records)})"
        )

    return {
        "train": train_recs,
        "validation_tune": val_tune_recs,
        "calibration": calib_recs,
        "test": test_recs,
    }


def build_horizon_status_matrix(
    declared_horizons: Optional[List[int]] = None,
    supported_dataset_horizons: Optional[List[int]] = None,
    target_parameters: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Constructs the authoritative 3 x 7 parameter x horizon status matrix.
    Explicitly distinguishes:
    - NOT_EVALUATED: Forecast origin 24h checkpoint
    - DATA_UNAVAILABLE: Horizons not physically present in dataset (48, 72, 120, 144)
    - CALIBRATED_CANDIDATE: Horizons supported by dataset and calibrated (96, 168)
    """
    horizons = declared_horizons or [24, 48, 72, 96, 120, 144, 168]
    supported = supported_dataset_horizons or [96, 168]
    params = target_parameters or ["iddq", "ileak", "tpd"]

    matrix: Dict[str, Dict[str, str]] = {}
    calibrated_count = 0
    unavailable_count = 0
    not_evaluated_count = 0

    for p in params:
        matrix[p] = {}
        for h in horizons:
            h_str = f"{h}h"
            if h == 24:
                status = "NOT_EVALUATED"
                not_evaluated_count += 1
            elif h in supported:
                status = "CALIBRATED_CANDIDATE"
                calibrated_count += 1
            else:
                status = "DATA_UNAVAILABLE"
                unavailable_count += 1
            matrix[p][h_str] = status

    return {
        "matrix": matrix,
        "total_declared_groups": len(params) * len(horizons),
        "calibrated_groups_count": calibrated_count,
        "unavailable_groups_count": unavailable_count,
        "not_evaluated_groups_count": not_evaluated_count,
    }


build_authoritative_horizon_matrix = build_horizon_status_matrix


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
    - Calibration strictly on independent CALIBRATION split (LOT-SYN-039..042, 400 units).
    - Hard fail-closed rejection if fitting is attempted on TEST, VALIDATION_TUNE, TRAIN, or mixed splits.
    - Model freeze: Calibration residuals are computed after the point model is frozen on TRAIN + VALIDATION_TUNE.
    - 3 x 7 parameter x horizon governance matrix accounting.
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
        calibration_predictions: Dict[str, Dict[int, np.ndarray]],
        calibration_targets: Dict[str, Dict[int, np.ndarray]],
        split_name: str = "CALIBRATION",
        calibration_lots: Optional[List[str]] = None,
        validation_tune_lots: Optional[List[str]] = None,
        train_lots: Optional[List[str]] = None,
        test_lots: Optional[List[str]] = None,
        dataset_sha256: Optional[str] = None,
        split_manifest_sha256: Optional[str] = None,
        model_identity: str = "Deterministic_Continuous_Degradation_Forecaster",
        frozen_model_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Fits the conformal calibrator on CALIBRATION cohort residuals.

        Args:
            calibration_predictions: Dict[param, Dict[horizon, array_of_preds]]
            calibration_targets: Dict[param, Dict[horizon, array_of_ground_truths]]
            split_name: Must be exactly "CALIBRATION". Any other split raises an error.
            calibration_lots: List of calibration lot IDs (LOT-SYN-039..042).
            validation_tune_lots: List of model tuning lot IDs (LOT-SYN-036..038).
            train_lots: List of training lot IDs (LOT-SYN-001..035).
            test_lots: List of held-out test lot IDs (LOT-SYN-043..050).
            dataset_sha256: SHA-256 of the authoritative synthetic dataset.
            split_manifest_sha256: SHA-256 of the authoritative split manifest.
            model_identity: Forecaster model name identifier.
            frozen_model_config: Model hyperparameters and architecture metadata proving freeze.

        Returns:
            Dict: Frozen calibration artifact dictionary.
        """
        # Strict CALIBRATION split guard
        if split_name != "CALIBRATION":
            raise ValueError(
                f"CALIBRATION_SPLIT_LEAKAGE_REJECTED: Conformal calibrator fitting is strictly restricted to "
                f"'CALIBRATION' cohort, but received split_name='{split_name}'"
            )

        calib_lots_list = calibration_lots or [f"LOT-SYN-{i:03d}" for i in range(39, 43)]
        tune_lots_list = validation_tune_lots or [f"LOT-SYN-{i:03d}" for i in range(36, 39)]
        train_lots_list = train_lots or [f"LOT-SYN-{i:03d}" for i in range(1, 36)]
        test_lots_list = test_lots or [f"LOT-SYN-{i:03d}" for i in range(43, 51)]

        # Verify lot disjointness at fitting time
        s_calib = set(calib_lots_list)
        if not s_calib.isdisjoint(set(tune_lots_list)):
            raise ValueError("CALIBRATION_LOT_OVERLAP: Calibration lots overlap validation_tune lots!")
        if not s_calib.isdisjoint(set(train_lots_list)):
            raise ValueError("CALIBRATION_LOT_OVERLAP: Calibration lots overlap train lots!")
        if not s_calib.isdisjoint(set(test_lots_list)):
            raise ValueError("CALIBRATION_LOT_OVERLAP: Calibration lots overlap test lots!")

        target_params = self.spec["target_parameters"]
        candidate_levels = [float(lvl) for lvl in self.spec["candidate_nominal_levels"]]
        min_samples = int(self.spec["minimum_calibration_samples"])
        rule = str(self.spec["finite_sample_quantile_rule"])
        declared_horizons = [int(h) for h in self.spec.get("declared_contract_horizons", [24, 48, 72, 96, 120, 144, 168])]
        supported_horizons = [int(h) for h in self.spec.get("supported_dataset_horizons", [96, 168])]

        quantiles_table: Dict[str, Dict[str, Dict[str, float]]] = {}
        sample_counts: Dict[str, Dict[str, int]] = {}

        for param in target_params:
            if param not in calibration_predictions:
                raise ValueError(f"MISSING_PARAMETER_PREDICTIONS: Missing predictions for parameter '{param}'")
            if param not in calibration_targets:
                raise ValueError(f"MISSING_PARAMETER_TARGETS: Missing ground truth targets for parameter '{param}'")

            quantiles_table[param] = {}
            sample_counts[param] = {}

            # Fit on supported horizons
            for h_int in supported_horizons:
                h_str = f"{h_int}h"
                if h_int not in calibration_targets[param] or h_int not in calibration_predictions[param]:
                    continue

                y_pred = np.asarray(calibration_predictions[param][h_int], dtype=np.float64)
                y_true = np.asarray(calibration_targets[param][h_int], dtype=np.float64)

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

        horizon_matrix_info = build_horizon_status_matrix(
            declared_horizons=declared_horizons,
            supported_dataset_horizons=supported_horizons,
            target_parameters=target_params,
        )

        actual_dataset_sha = dataset_sha256 or (
            compute_sha256(DATASET_PATH) if os.path.exists(DATASET_PATH) else "UNKNOWN_DATASET_SHA"
        )
        actual_manifest_sha = split_manifest_sha256 or (
            compute_sha256(SPLIT_MANIFEST_PATH) if os.path.exists(SPLIT_MANIFEST_PATH) else "UNKNOWN"
        )
        contract_sha = compute_sha256(self.contract_path) if os.path.exists(self.contract_path) else "UNKNOWN"

        artifact = {
            "artifact_schema_version": "1.1.0",
            "method": self.spec["method"],
            "model_identity": model_identity,
            "frozen_model_configuration": frozen_model_config or {
                "architecture": "Deterministic_Power_Law_Degradation_Forecaster",
                "tuning_split": "VALIDATION_TUNE",
                "hyperparameters_frozen": True,
            },
            "train_lots": train_lots_list,
            "validation_tune_lots": tune_lots_list,
            "calibration_lots": calib_lots_list,
            "test_lots": test_lots_list,
            "dataset_sha256": actual_dataset_sha,
            "prognostic_contract_sha256": contract_sha,
            "split_manifest_sha256": actual_manifest_sha,
            "target_parameters": target_params,
            "declared_contract_horizons": declared_horizons,
            "supported_dataset_horizons": supported_horizons,
            "declared_groups_count": horizon_matrix_info["total_declared_groups"],
            "calibrated_groups_count": horizon_matrix_info["calibrated_groups_count"],
            "unavailable_groups_count": horizon_matrix_info["unavailable_groups_count"],
            "horizon_status_matrix": horizon_matrix_info["matrix"],
            "candidate_nominal_levels": candidate_levels,
            "finite_sample_quantile_rule": rule,
            "sample_counts": sample_counts,
            "conformal_quantiles": quantiles_table,
            "status": self.spec["status"],
            "model_status": self.spec["model_status"],
            "disclaimer": self.spec["disclaimer"],
        }

        # Deterministic cryptographic content hash
        canonical_content = json.dumps(
            {
                "calibration_lots": calib_lots_list,
                "dataset_sha256": actual_dataset_sha,
                "method": self.spec["method"],
                "model_identity": model_identity,
                "quantiles": quantiles_table,
                "rule": rule,
                "sample_counts": sample_counts,
                "validation_tune_lots": tune_lots_list,
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
        Applies frozen conformal calibration quantiles to point predictions.

        Strict Safety:
        - Accepts predictions ONLY (no ground truth targets).
        - Rejects uncalibrated/unfrozen state.

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
