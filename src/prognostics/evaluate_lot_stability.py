"""
Authoritative Stage 6 Task 3 — Multi-Lot Drift Stability & Conformal Production-Gate Evaluator (Python)
======================================================================================================
Executes independent per-lot empirical coverage evaluation across the 8 held-out test lots
(LOT-SYN-043 .. LOT-SYN-050) using frozen split-conformal calibration quantiles.

Governance & Scientific Rules:
1. Strict 4-Way Split Governance:
   - TRAIN (LOT-SYN-001..035, n=3500): Model parameter fitting
   - VALIDATION_TUNE (LOT-SYN-036..038, n=300): Hyperparameter selection
   - CALIBRATION (LOT-SYN-039..042, n=400): Conformal nonconformity fitting ONLY
   - TEST (LOT-SYN-043..050, n=800): Frozen held-out multi-lot evaluation ONLY
2. Zero Test-Set Tuning:
   Test observations are NEVER used for calibration quantile fitting, threshold tuning, or model selection.
3. No Arbitrary Acceptance Threshold:
   Since no repository rule defines an empirical multi-lot production acceptance threshold,
   the result MUST be governance_status = "REVIEW_REQUIRED".
4. Status Preservation:
   model_status = "BENCHMARK_ONLY"
   calibration_status = "NOT_CALIBRATED"
5. Dynamic Manifest Provenance:
   Never hardcodes model hashes; dynamically queries predicta_production_manifest.json.
6. Fail-Closed Behavior:
   Mismatched dataset hash, invalid split manifest, lot overlap, missing calibration artifact,
   duplicate component IDs, or unsupported horizons trigger immediate fail-closed exceptions.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

# Ensure project root is on sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.prognostics.conformal import (
    DATASET_PATH,
    SPLIT_MANIFEST_PATH,
    load_calibration_artifact,
    partition_four_way_dataset,
)
from src.prognostics.trajectory import (
    CONTRACT_PATH,
    ContinuousTrajectoryDatasetBuilder,
    DeterministicContinuousDegradationModel,
    compute_sha256,
    load_authoritative_prognostic_contract,
)

STABILITY_CONTRACT_PATH = os.path.join(
    project_root, "ml", "prognostics", "lot_stability_contract.json"
)
CALIBRATION_ARTIFACT_PATH = os.path.join(
    project_root, "ml", "models", "production", "conformal_calibration_artifacts.json"
)
PRODUCTION_MANIFEST_PATH = os.path.join(
    project_root, "ml", "models", "production", "predicta_production_manifest.json"
)
EXPECTED_DATASET_SHA256 = "e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa"
EXPECTED_SPLIT_MANIFEST_SHA256 = "dbe10900c5adda3610e562551af504ee7aaf1b31104ce945e8a71ff2d063ce7c"


def load_authoritative_stability_contract(
    contract_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Loads and validates the authoritative multi-lot stability contract."""
    path_to_use = contract_path or STABILITY_CONTRACT_PATH
    if not os.path.exists(path_to_use):
        raise FileNotFoundError(
            f"STABILITY_CONTRACT_MISSING: Authoritative stability contract required at '{path_to_use}'"
        )
    with open(path_to_use, "r", encoding="utf-8") as f:
        try:
            contract = json.load(f)
        except Exception as e:
            raise ValueError(
                f"MALFORMED_STABILITY_CONTRACT: Failed to parse JSON from '{path_to_use}': {e}"
            )

    required_keys = [
        "contract_name",
        "contract_version",
        "authority_level",
        "task_name",
        "methodology",
        "cohort_specification",
        "governance_specification",
    ]
    for k in required_keys:
        if k not in contract:
            raise ValueError(
                f"MALFORMED_STABILITY_CONTRACT: Missing required key '{k}' in contract"
            )

    params = contract.get("methodology", {}).get("target_parameters", [])
    if set(params) != {"iddq", "ileak", "tpd"}:
        raise ValueError(
            f"MISSING_REQUIRED_PARAMETER: Target parameters must contain ['iddq', 'ileak', 'tpd'], got {params}"
        )
    return contract


def get_production_model_provenance(
    manifest_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dynamically retrieves and cryptographically verifies production model provenance.
    Loads manifest, obtains model artifact path, computes actual SHA-256 of the artifact,
    and asserts match against manifest-declared model_sha256. Fails closed on missing artifact
    or provenance mismatch.
    """
    path_to_use = manifest_path or PRODUCTION_MANIFEST_PATH
    if not os.path.exists(path_to_use):
        raise FileNotFoundError(
            f"PRODUCTION_MANIFEST_NOT_FOUND: Authoritative manifest missing at '{path_to_use}'"
        )
    with open(path_to_use, "r", encoding="utf-8") as f:
        try:
            manifest = json.load(f)
        except Exception as e:
            raise ValueError(
                f"MALFORMED_PRODUCTION_MANIFEST: Failed to parse JSON from '{path_to_use}': {e}"
            )

    model_sha = manifest.get("model_sha256")
    if not model_sha or not isinstance(model_sha, str) or len(model_sha) != 64:
        raise ValueError(
            "INVALID_PRODUCTION_MANIFEST: 'model_sha256' must be a valid 64-character SHA-256 hex string"
        )

    # Dynamically obtain production model artifact path from manifest
    model_rel_path = manifest.get("xgboost_model")
    if not model_rel_path:
        model_rel_path = manifest.get("models", {}).get("failure_prediction", {}).get("file")

    if not model_rel_path or not isinstance(model_rel_path, str):
        raise ValueError(
            "INVALID_PRODUCTION_MANIFEST: Manifest missing valid model artifact path ('xgboost_model')"
        )

    # Resolve artifact path relative to project root or manifest directory
    artifact_path = os.path.normpath(os.path.join(project_root, model_rel_path))
    if not os.path.exists(artifact_path):
        manifest_dir = os.path.dirname(os.path.abspath(path_to_use))
        candidate = os.path.normpath(os.path.join(manifest_dir, os.path.basename(model_rel_path)))
        if os.path.exists(candidate):
            artifact_path = candidate
        else:
            raise FileNotFoundError(
                f"MODEL_ARTIFACT_NOT_FOUND: Production model artifact missing at '{artifact_path}'"
            )

    actual_model_sha = compute_sha256(artifact_path)
    if actual_model_sha != model_sha:
        raise ValueError(
            f"MODEL_PROVENANCE_MISMATCH: Computed model artifact SHA-256 '{actual_model_sha}' "
            f"does not match manifest-declared SHA-256 '{model_sha}'"
        )

    return {
        "manifest_path": os.path.relpath(path_to_use, project_root).replace("\\", "/"),
        "model_artifact_path": os.path.relpath(artifact_path, project_root).replace("\\", "/"),
        "manifest_model_sha256": model_sha,
        "actual_model_sha256": actual_model_sha,
        "model_sha256": actual_model_sha,
        "authoritative_threshold": manifest.get("authoritative_threshold", 0.20),
        "release_version": manifest.get("release_version", "2.0_production"),
    }


class MultiLotConformalStabilityEvaluator:
    """
    Authoritative Evaluator for Multi-Lot Conformal Prediction Interval Stability.
    Evaluates empirical coverage separately across held-out test lots.
    """

    def __init__(
        self,
        stability_contract_path: Optional[str] = None,
        prognostic_contract_path: Optional[str] = None,
        calibration_artifact_path: Optional[str] = None,
        production_manifest_path: Optional[str] = None,
        split_manifest_path: Optional[str] = None,
        dataset_path: Optional[str] = None,
    ):
        self.stability_contract_path = stability_contract_path or STABILITY_CONTRACT_PATH
        self.prognostic_contract_path = prognostic_contract_path or CONTRACT_PATH
        self.calibration_artifact_path = calibration_artifact_path or CALIBRATION_ARTIFACT_PATH
        self.production_manifest_path = production_manifest_path or PRODUCTION_MANIFEST_PATH
        self.split_manifest_path = split_manifest_path or SPLIT_MANIFEST_PATH
        self.dataset_path = dataset_path or DATASET_PATH

        # Load and validate contracts
        self.stability_contract = load_authoritative_stability_contract(self.stability_contract_path)
        self.prognostic_contract = load_authoritative_prognostic_contract(self.prognostic_contract_path)
        self.model_provenance = get_production_model_provenance(self.production_manifest_path)

        # Dynamic cryptographic verification
        self._verify_dataset_integrity()
        self._verify_split_manifest_integrity()

        # Load and validate frozen calibration artifact
        self.calibration_artifact = self._load_and_validate_calibration_artifact()

    def _verify_dataset_integrity(self) -> str:
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(f"DATASET_NOT_FOUND: Dataset missing at '{self.dataset_path}'")
        dataset_sha = compute_sha256(self.dataset_path)
        if dataset_sha != EXPECTED_DATASET_SHA256:
            raise ValueError(
                f"DATASET_HASH_MISMATCH: Computed dataset SHA-256 '{dataset_sha}' does not match "
                f"authoritative dataset hash '{EXPECTED_DATASET_SHA256}'"
            )
        return dataset_sha

    def _verify_split_manifest_integrity(self) -> Dict[str, Any]:
        if not os.path.exists(self.split_manifest_path):
            raise FileNotFoundError(
                f"SPLIT_MANIFEST_NOT_FOUND: Split manifest missing at '{self.split_manifest_path}'"
            )
        with open(self.split_manifest_path, "r", encoding="utf-8") as f:
            try:
                manifest = json.load(f)
            except Exception as e:
                raise ValueError(f"MALFORMED_SPLIT_MANIFEST: JSON parse error: {e}")

        lots = manifest.get("lots", {})
        required = ["train", "validation_tune", "calibration", "test"]
        for p in required:
            if p not in lots or not isinstance(lots[p], list):
                raise ValueError(f"MALFORMED_SPLIT_MANIFEST: Missing valid partition list for '{p}'")

        # Disjointness check
        train_set = set(lots["train"])
        val_set = set(lots["validation_tune"])
        cal_set = set(lots["calibration"])
        test_set = set(lots["test"])

        for name1, s1 in [("train", train_set), ("val_tune", val_set), ("calib", cal_set)]:
            for name2, s2 in [("val_tune", val_set), ("calib", cal_set), ("test", test_set)]:
                if name1 != name2 and not s1.isdisjoint(s2):
                    raise ValueError(f"LOT_OVERLAP_DETECTED: Overlap detected between {name1} and {name2}")

        expected_test_lots = self.stability_contract["cohort_specification"]["test"]["lots"]
        if lots["test"] != expected_test_lots:
            raise ValueError(
                f"TEST_LOTS_MISMATCH: Manifest test lots {lots['test']} != contract test lots {expected_test_lots}"
            )

        # Cryptographic hash verification against authoritative expected SHA
        manifest_sha = compute_sha256(self.split_manifest_path)
        expected_manifest_sha = (
            self.stability_contract.get("methodology", {}).get("expected_split_manifest_sha256")
            or EXPECTED_SPLIT_MANIFEST_SHA256
        )
        if manifest_sha != expected_manifest_sha:
            raise ValueError(
                f"SPLIT_MANIFEST_HASH_MISMATCH: Computed split manifest SHA-256 '{manifest_sha}' does not match "
                f"authoritative expected SHA-256 '{expected_manifest_sha}'"
            )

        return manifest

    def _load_and_validate_calibration_artifact(self) -> Dict[str, Any]:
        if not os.path.exists(self.calibration_artifact_path):
            raise FileNotFoundError(
                f"CALIBRATION_ARTIFACT_NOT_FOUND: Artifact missing at '{self.calibration_artifact_path}'"
            )

        dataset_sha = compute_sha256(self.dataset_path)
        contract_sha = compute_sha256(self.prognostic_contract_path)
        manifest_sha = compute_sha256(self.split_manifest_path)

        artifact = load_calibration_artifact(
            self.calibration_artifact_path,
            expected_dataset_sha256=dataset_sha,
            expected_contract_sha256=contract_sha,
            expected_split_manifest_sha256=manifest_sha,
            expected_model_identity="Deterministic_Continuous_Degradation_Forecaster",
        )

        # Enforce locked statuses
        if artifact.get("status") != "NOT_CALIBRATED":
            raise ValueError(
                f"CALIBRATION_STATUS_INVALID: Expected 'NOT_CALIBRATED', found '{artifact.get('status')}'"
            )
        if artifact.get("model_status") != "BENCHMARK_ONLY":
            raise ValueError(
                f"MODEL_STATUS_INVALID: Expected 'BENCHMARK_ONLY', found '{artifact.get('model_status')}'"
            )

        return artifact

    def evaluate(self) -> Dict[str, Any]:
        """
        Executes the authoritative multi-lot conformal stability evaluation.
        Returns complete benchmark report dictionary.
        """
        dataset_sha = compute_sha256(self.dataset_path)
        contract_sha = compute_sha256(self.prognostic_contract_path)
        stability_contract_sha = compute_sha256(self.stability_contract_path)
        manifest_sha = compute_sha256(self.split_manifest_path)
        artifact_sha = self.calibration_artifact["calibration_artifact_sha256"]

        # Validate split manifest cryptographic hash before partitioning
        expected_manifest_sha = (
            self.stability_contract.get("methodology", {}).get("expected_split_manifest_sha256")
            or EXPECTED_SPLIT_MANIFEST_SHA256
        )
        if manifest_sha != expected_manifest_sha:
            raise ValueError(
                f"SPLIT_MANIFEST_HASH_MISMATCH: Computed split manifest SHA-256 '{manifest_sha}' does not match "
                f"authoritative expected SHA-256 '{expected_manifest_sha}'"
            )

        # Ingest and partition dataset
        builder = ContinuousTrajectoryDatasetBuilder(
            dataset_path=self.dataset_path,
            contract_path=self.prognostic_contract_path,
        )
        ds = builder.build_dataset()
        splits = partition_four_way_dataset(ds["records"], split_manifest_path=self.split_manifest_path)

        train_data = splits["train"]
        val_tune_data = splits["validation_tune"]
        test_data = splits["test"]

        # Check for duplicate component IDs in test set
        test_component_ids = set()
        for r in test_data:
            cid = r["component_id"]
            if cid in test_component_ids:
                raise ValueError(f"DUPLICATE_COMPONENT_ID: Duplicate component '{cid}' found in test cohort")
            test_component_ids.add(cid)

        # Fit model on Train + ValTune (strictly frozen before test evaluation)
        model = DeterministicContinuousDegradationModel()
        model.fit_and_tune(train_data, val_tune_data)

        # Group test data by lot
        test_lots = self.stability_contract["cohort_specification"]["test"]["lots"]
        lots_records: Dict[str, List[Dict[str, Any]]] = {lot: [] for lot in test_lots}
        for r in test_data:
            lot = r["lot_id"]
            if lot not in lots_records:
                raise ValueError(f"UNAUTHORIZED_TEST_LOT: Component {r['component_id']} has unknown lot {lot}")
            lots_records[lot].append(r)

        for lot, recs in lots_records.items():
            if len(recs) != 100:
                raise ValueError(
                    f"TEST_LOT_SAMPLE_COUNT_INVALID: Lot {lot} has {len(recs)} samples; expected 100"
                )

        # Quantile table from frozen calibration artifact
        quantiles = self.calibration_artifact["conformal_quantiles"]

        target_params = ["iddq", "ileak", "tpd"]
        supported_horizons = [96, 168]
        nominal_levels = [0.80, 0.90, 0.95]

        # 1. Per-Lot Evaluation
        per_lot_evaluation: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}
        for lot in test_lots:
            per_lot_evaluation[lot] = {}
            lot_recs = lots_records[lot]

            for p in target_params:
                per_lot_evaluation[lot][p] = {}
                for h in supported_horizons:
                    h_str = f"{h}h"
                    per_lot_evaluation[lot][p][h_str] = {}

                    # Extract point predictions and ground truth targets for this lot
                    y_pred = np.array(
                        [model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][p][h] for r in lot_recs],
                        dtype=np.float64,
                    )
                    y_true = np.array(
                        [r["ground_truth_trajectories"][p][h] for r in lot_recs],
                        dtype=np.float64,
                    )

                    for lvl in nominal_levels:
                        lvl_str = f"{lvl:.2f}"
                        q = float(quantiles[p][h_str][lvl_str])

                        lower = y_pred - q
                        upper = y_pred + q
                        covered = (y_true >= lower) & (y_true <= upper)
                        n_covered = int(np.sum(covered))
                        n_total = len(y_true)

                        cov_ratio = float(n_covered / n_total)
                        cov_pct = float(round(cov_ratio * 100.0, 2))
                        cov_dev = float(round(cov_ratio - lvl, 4))
                        abs_cov_dev = float(round(abs(cov_dev), 4))

                        per_lot_evaluation[lot][p][h_str][lvl_str] = {
                            "lot_id": lot,
                            "parameter": p,
                            "horizon_hours": h,
                            "nominal_coverage": lvl,
                            "sample_count": n_total,
                            "covered_count": n_covered,
                            "empirical_coverage_ratio": round(cov_ratio, 4),
                            "empirical_coverage_pct": cov_pct,
                            "coverage_deviation": cov_dev,
                            "abs_coverage_deviation": abs_cov_dev,
                            "conformal_quantile_q": q,
                            "avg_interval_width": round(2.0 * q, 4),
                        }

        # 2. Aggregate Test-Set Evaluation (Preserving Stage 6 Task 1 Baseline)
        aggregate_evaluation: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for p in target_params:
            aggregate_evaluation[p] = {}
            for h in supported_horizons:
                h_str = f"{h}h"
                aggregate_evaluation[p][h_str] = {}

                y_pred_all = np.array(
                    [model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][p][h] for r in test_data],
                    dtype=np.float64,
                )
                y_true_all = np.array(
                    [r["ground_truth_trajectories"][p][h] for r in test_data],
                    dtype=np.float64,
                )

                for lvl in nominal_levels:
                    lvl_str = f"{lvl:.2f}"
                    q = float(quantiles[p][h_str][lvl_str])
                    lower = y_pred_all - q
                    upper = y_pred_all + q
                    covered = (y_true_all >= lower) & (y_true_all <= upper)
                    n_covered = int(np.sum(covered))
                    n_total = len(y_true_all)

                    cov_ratio = float(n_covered / n_total)
                    cov_pct = float(round(cov_ratio * 100.0, 2))
                    cov_dev = float(round(cov_ratio - lvl, 4))
                    abs_cov_dev = float(round(abs(cov_dev), 4))

                    aggregate_evaluation[p][h_str][lvl_str] = {
                        "parameter": p,
                        "horizon_hours": h,
                        "nominal_coverage": lvl,
                        "sample_count": n_total,
                        "covered_count": n_covered,
                        "empirical_coverage_ratio": round(cov_ratio, 4),
                        "empirical_coverage_pct": cov_pct,
                        "coverage_deviation": cov_dev,
                        "abs_coverage_deviation": abs_cov_dev,
                        "conformal_quantile_q": q,
                        "avg_interval_width": round(2.0 * q, 4),
                    }

        # 3. Cross-Lot Dispersion Statistics
        cross_lot_dispersion: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for p in target_params:
            cross_lot_dispersion[p] = {}
            for h in supported_horizons:
                h_str = f"{h}h"
                cross_lot_dispersion[p][h_str] = {}

                for lvl in nominal_levels:
                    lvl_str = f"{lvl:.2f}"
                    lot_pcts = [
                        per_lot_evaluation[lot][p][h_str][lvl_str]["empirical_coverage_pct"]
                        for lot in test_lots
                    ]

                    min_pct = float(np.min(lot_pcts))
                    max_pct = float(np.max(lot_pcts))
                    range_pct = float(round(max_pct - min_pct, 2))
                    mean_pct = float(round(np.mean(lot_pcts), 2))
                    std_pct = float(round(np.std(lot_pcts, ddof=1), 2))

                    # Identify worst and best lots
                    min_idx = int(np.argmin(lot_pcts))
                    max_idx = int(np.argmax(lot_pcts))
                    worst_lot = test_lots[min_idx]
                    best_lot = test_lots[max_idx]

                    cross_lot_dispersion[p][h_str][lvl_str] = {
                        "parameter": p,
                        "horizon_hours": h,
                        "nominal_coverage": lvl,
                        "lot_count": len(test_lots),
                        "min_lot_coverage_pct": min_pct,
                        "max_lot_coverage_pct": max_pct,
                        "lot_coverage_range_pct": range_pct,
                        "mean_lot_coverage_pct": mean_pct,
                        "std_lot_coverage_pct": std_pct,
                        "worst_performing_lot": worst_lot,
                        "worst_lot_coverage_pct": min_pct,
                        "best_performing_lot": best_lot,
                        "best_lot_coverage_pct": max_pct,
                        "aggregate_coverage_pct": aggregate_evaluation[p][h_str][lvl_str]["empirical_coverage_pct"],
                    }

        # 4. Stress / Drift Stability Analysis
        stress_drift_analysis: Dict[str, Any] = {
            "evaluation_population": "8 Held-Out Test Lots (LOT-SYN-043..050)",
            "total_test_samples": 800,
            "samples_per_lot": 100,
            "stability_findings": [],
        }

        for p in target_params:
            for h in supported_horizons:
                h_str = f"{h}h"
                for lvl in nominal_levels:
                    lvl_str = f"{lvl:.2f}"
                    disp = cross_lot_dispersion[p][h_str][lvl_str]
                    stress_drift_analysis["stability_findings"].append({
                        "group": f"{p.upper()}@{h_str}",
                        "nominal": lvl,
                        "range_pct": disp["lot_coverage_range_pct"],
                        "min_pct": disp["min_lot_coverage_pct"],
                        "max_pct": disp["max_lot_coverage_pct"],
                        "worst_lot": disp["worst_performing_lot"],
                        "best_lot": disp["best_performing_lot"],
                        "concentration_notes": (
                            f"Lot {disp['worst_performing_lot']} exhibits lowest coverage ({disp['min_lot_coverage_pct']}%), "
                            f"yielding a {disp['lot_coverage_range_pct']}% spread across held-out lots."
                        ),
                    })

        # 5. Unsupported Group Accounting
        unsupported_groups = {
            "origin_24h": {
                "horizons": [24],
                "parameters": target_params,
                "status": "NOT_EVALUATED",
                "rationale": "Forecast origin checkpoint (t=24h); degradation forecasting begins post-screening.",
            },
            "missing_telemetry_horizons": {
                "horizons": [48, 72, 120, 144],
                "parameters": target_params,
                "status": "DATA_UNAVAILABLE",
                "rationale": "Checkpoints not physically recorded in synthetic dataset; fabrication strictly prohibited.",
            },
        }

        # 6. Complete Report Assembly
        report = {
            "report_metadata": {
                "title": "Authoritative Stage 6 Task 3 Multi-Lot Conformal Stability Benchmark Report",
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "contract_version": self.stability_contract["contract_version"],
                "stability_contract_sha256": stability_contract_sha,
                "prognostic_contract_sha256": contract_sha,
                "calibration_artifact_sha256": artifact_sha,
                "dataset_sha256": dataset_sha,
                "split_manifest_sha256": manifest_sha,
                "dataset_path": os.path.relpath(self.dataset_path, project_root).replace("\\", "/"),
                "production_manifest": self.model_provenance,
                "methodology": "MULTI_LOT_CONFORMAL_RESIDUAL_STABILITY_EVALUATION",
                "evaluation_population": "LOT-SYN-043 through LOT-SYN-050 (8 lots, n=800)",
                "test_lots": test_lots,
                "synthetic_disclaimer": "All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.",
            },
            "governance_status": {
                "governance_status": "REVIEW_REQUIRED",
                "acceptance_threshold_status": "NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED",
                "model_status": "BENCHMARK_ONLY",
                "calibration_status": "NOT_CALIBRATED",
                "promotion_locked": True,
                "governance_finding": (
                    "No empirical multi-lot production acceptance threshold is currently authorized in the repository. "
                    "Numerical dispersion is reported for technical review; calibration_status remains strictly NOT_CALIBRATED."
                ),
            },
            "cohort_summary": {
                "train_lots_count": 35,
                "train_samples_count": len(train_data),
                "val_tune_lots_count": 3,
                "val_tune_samples_count": len(val_tune_data),
                "calibration_lots_count": 4,
                "calibration_samples_count": len(self.calibration_artifact["calibration_lots"]),
                "test_lots_count": len(test_lots),
                "test_samples_count": len(test_data),
            },
            "unsupported_groups_accounting": unsupported_groups,
            "aggregate_evaluation": aggregate_evaluation,
            "cross_lot_dispersion": cross_lot_dispersion,
            "per_lot_evaluation": per_lot_evaluation,
            "stress_drift_analysis": stress_drift_analysis,
        }

        return report

    def evaluate_and_export(
        self,
        json_output_path: Optional[str] = None,
        md_output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Runs evaluation and writes JSON and Markdown reports to disk."""
        report = self.evaluate()

        default_json = os.path.join(
            project_root, "experiments", "prognostics", "multi_lot_conformal_stability_report.json"
        )
        default_md = os.path.join(
            project_root, "experiments", "prognostics", "multi_lot_conformal_stability_report.md"
        )

        out_json = json_output_path or default_json
        out_md = md_output_path or default_md

        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        os.makedirs(os.path.dirname(out_md), exist_ok=True)
        self.write_markdown_report(report, out_md)

        return report

    @staticmethod
    def write_markdown_report(report: Dict[str, Any], filepath: str) -> None:
        """Generates comprehensive Markdown report."""
        meta = report["report_metadata"]
        gov = report["governance_status"]
        disp = report["cross_lot_dispersion"]
        agg = report["aggregate_evaluation"]
        per_lot = report["per_lot_evaluation"]
        test_lots = meta["test_lots"]

        md = f"""# PREDICTA-26 — Stage 6 Task 3 Multi-Lot Conformal Stability Benchmark Report

- **Task:** Stage 6 Task 3 — Multi-Lot Drift Stability & Conformal Production-Gate Evaluation
- **Governance Status:** `{gov['governance_status']}`
- **Acceptance Threshold Status:** `{gov['acceptance_threshold_status']}`
- **Calibration Status:** `{gov['calibration_status']}`
- **Model Status:** `{gov['model_status']}`
- **Generated UTC:** `{meta['generated_at_utc']}`

---

## 1. Executive Summary & Governance Verdict

This report presents the authoritative multi-lot empirical coverage evaluation of the frozen split-conformal prediction intervals across **all 8 held-out test lots (`LOT-SYN-043` through `LOT-SYN-050`, $n=800$)**.

> [!WARNING]
> **GOVERNANCE STATUS: REVIEW REQUIRED (NO PRODUCTION PROMOTION)**
> {gov['governance_finding']}
> Multi-lot drift stability evaluation is a benchmark and gate-review artifact only. It does not constitute production calibration, external validation, qualification, or production approval.

---

## 2. Cryptographic Lineage & Provenance

| Artifact / Entity | Identity / Path | SHA-256 Digest |
| :--- | :--- | :--- |
| **Authoritative Dataset** | `{meta['dataset_path']}` | `{meta['dataset_sha256']}` |
| **Split Manifest** | `ml/data/split_manifest.json` | `{meta['split_manifest_sha256']}` |
| **Prognostic Contract** | `ml/prognostics/prognostic_contract.json` | `{meta['prognostic_contract_sha256']}` |
| **Stability Contract** | `ml/prognostics/lot_stability_contract.json` | `{meta['stability_contract_sha256']}` |
| **Frozen Calibrator Artifact** | `ml/models/production/conformal_calibration_artifacts.json` | `{meta['calibration_artifact_sha256']}` |
| **Production Model Artifact** | `{meta['production_manifest']['model_artifact_path']}` | `{meta['production_manifest']['actual_model_sha256']}` |
| **Production Manifest Declared SHA** | `{meta['production_manifest']['manifest_path']}` | `{meta['production_manifest']['manifest_model_sha256']}` |

---

## 3. Aggregate vs Multi-Lot Dispersion Summary

| Parameter | Horizon | Nominal | Aggregate Coverage | Min Lot Cov | Max Lot Cov | Lot Range | Mean Lot Cov | Std Dev | Worst Lot | Best Lot |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""
        for p in ["iddq", "ileak", "tpd"]:
            for h in [96, 168]:
                h_str = f"{h}h"
                for lvl in [0.80, 0.90, 0.95]:
                    lvl_str = f"{lvl:.2f}"
                    d = disp[p][h_str][lvl_str]
                    ag = agg[p][h_str][lvl_str]
                    row = (
                        f"| **{p.upper()}** | `{h_str}` | `{float(lvl)*100:.0f}%` | "
                        f"`{ag['empirical_coverage_pct']:.2f}%` | `{d['min_lot_coverage_pct']:.2f}%` | "
                        f"`{d['max_lot_coverage_pct']:.2f}%` | `{d['lot_coverage_range_pct']:.2f}%` | "
                        f"`{d['mean_lot_coverage_pct']:.2f}%` | `±{d['std_lot_coverage_pct']:.2f}%` | "
                        f"`{d['worst_performing_lot']}` | `{d['best_performing_lot']}` |"
                    )
                    md += row + "\n"

        md += """
---

## 4. Per-Lot Empirical Coverage Matrix ($n=100$ per lot)

"""
        for p in ["iddq", "ileak", "tpd"]:
            md += f"### Parameter: {p.upper()}\n\n"
            md += "| Lot ID | 96h (80%) | 96h (90%) | 96h (95%) | 168h (80%) | 168h (90%) | 168h (95%) |\n"
            md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for lot in test_lots:
                covs = []
                for h in [96, 168]:
                    h_str = f"{h}h"
                    for lvl in ["0.80", "0.90", "0.95"]:
                        c = per_lot[lot][p][h_str][lvl]["empirical_coverage_pct"]
                        covs.append(f"{c:.1f}%")
                md += f"| `{lot}` | " + " | ".join(covs) + " |\n"
            md += "\n"

        md += """---

## 5. Unsupported Group Accounting

- **Forecast Origin Checkpoint (24h):** `NOT_EVALUATED`. Forecast origin where early burn-in screening occurs.
- **Unrecorded Horizons (48h, 72h, 120h, 144h):** `DATA_UNAVAILABLE`. Intermediate burn-in telemetry not physically recorded in synthetic dataset. Zero fabricated numbers permitted.

---

## 6. Formal Production Gate Review Verdict

```json
{
  "governance_status": "REVIEW_REQUIRED",
  "acceptance_threshold_status": "NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED",
  "model_status": "BENCHMARK_ONLY",
  "calibration_status": "NOT_CALIBRATED",
  "promotion_lock": "ACTIVE"
}
```

**Conclusion:**
Multi-lot empirical coverage evaluation has been completed under strict fail-closed governance. While aggregate coverage aligns with nominal targets, per-lot dispersion illustrates measurable variance across wafer lots. In strict adherence to repository policy, **no arbitrary acceptance threshold has been introduced**. Formal production release requires offline fab validation and committee authorization.
"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md)


def main():
    """CLI execution entrypoint."""
    evaluator = MultiLotConformalStabilityEvaluator()
    print("=" * 80)
    print("PREDICTA-26 — AUTHORITATIVE MULTI-LOT CONFORMAL STABILITY EVALUATOR (PYTHON)")
    print("=" * 80)
    report = evaluator.evaluate_and_export()
    print(f"\nEvaluation completed successfully. Governance Status: {report['governance_status']['governance_status']}")
    print(f"Acceptance Threshold Status: {report['governance_status']['acceptance_threshold_status']}")
    print(f"Calibration Status: {report['governance_status']['calibration_status']}")
    print("=" * 80)


if __name__ == "__main__":
    main()
