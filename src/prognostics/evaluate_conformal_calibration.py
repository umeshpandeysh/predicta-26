"""
Authoritative Stage 6 Conformal Residual Calibration Benchmark Runner (Python)
=============================================================================
Executes the full conformal uncertainty evaluation pipeline:
1. Loads authoritative contract and calibration specification.
2. Ingests synthetic dataset and creates four-way lot-disjoint partitions:
   - TRAIN (LOT-SYN-001..035, n=3500)
   - VALIDATION_TUNE (LOT-SYN-036..038, n=300)
   - CALIBRATION (LOT-SYN-039..042, n=400)
   - TEST (LOT-SYN-043..050, n=800)
3. Fits the continuous deterministic degradation forecaster on Train (tuned on ValTune).
4. Freezes the point forecasting model configuration.
5. Fits ConformalResidualCalibrator on CALIBRATION split residuals ONLY.
6. Freezes calibration artifact with cryptographic content hashing.
7. Evaluates frozen conformal prediction intervals on the held-out TEST cohort.
8. Computes empirical coverage, coverage errors, and interval widths.
9. Generates comprehensive JSON and Markdown calibration benchmark reports.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict

import numpy as np

# Ensure project root is on sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.prognostics.conformal import (
    DATASET_PATH,
    SPLIT_MANIFEST_PATH,
    ConformalResidualCalibrator,
    export_calibration_artifact,
    get_authoritative_calibration_spec,
    partition_four_way_dataset,
)
from src.prognostics.trajectory import (
    CONTRACT_PATH,
    ContinuousTrajectoryDatasetBuilder,
    DeterministicContinuousDegradationModel,
    compute_sha256,
    load_authoritative_prognostic_contract,
)


def run_conformal_calibration_benchmark(
    dataset_path: str = DATASET_PATH,
    contract_path: str = CONTRACT_PATH,
) -> Dict[str, Any]:
    """Runs the authoritative Stage 6 conformal calibration benchmark."""
    print("=" * 80)
    print("PREDICTA-26 — AUTHORITATIVE CONFORMAL CALIBRATION BENCHMARK (PYTHON)")
    print("=" * 80)

    # 1. Load Contract & Specs
    contract = load_authoritative_prognostic_contract(contract_path)
    calib_spec = get_authoritative_calibration_spec(contract_path)

    contract_sha = compute_sha256(contract_path)
    dataset_sha = compute_sha256(dataset_path)
    manifest_sha = compute_sha256(SPLIT_MANIFEST_PATH)

    print(f"Contract SHA-256: {contract_sha}")
    print(f"Dataset SHA-256:  {dataset_sha}")
    print(f"Manifest SHA-256: {manifest_sha}")

    # 2. Ingest & Split Dataset into 4 cohorts
    print("\nIngesting dataset and partitioning into 4 lot-disjoint cohorts...")
    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=dataset_path, contract_path=contract_path)
    ds = builder.build_dataset()
    splits = partition_four_way_dataset(ds["records"], split_manifest_path=SPLIT_MANIFEST_PATH)
    train_data = splits["train"]
    val_tune_data = splits["validation_tune"]
    calib_data = splits["calibration"]
    test_data = splits["test"]

    print(f"  Train:           {len(train_data)} components (LOT-SYN-001..035) -> Model Fitting")
    print(f"  Validation Tune: {len(val_tune_data)} components (LOT-SYN-036..038) -> Hyperparameter Tuning")
    print(f"  Calibration:     {len(calib_data)} components (LOT-SYN-039..042) -> CALIBRATION SPLIT ONLY")
    print(f"  Test:            {len(test_data)} components (LOT-SYN-043..050) -> FROZEN EVAL SPLIT")

    # 3. Fit and Tune Continuous Degradation Model on TRAIN + VALIDATION_TUNE ONLY
    print("\nFitting Continuous Deterministic Forecaster on Train (Tuned on ValTune)...")
    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(train_data, val_tune_data)

    # Extract frozen model config
    frozen_config = {
        "model_identity": "Deterministic_Continuous_Degradation_Forecaster",
        "tuning_split": "VALIDATION_TUNE",
        "training_samples": len(train_data),
        "tuning_samples": len(val_tune_data),
        "hyperparameters_frozen": True,
    }

    # 4. Generate Calibration Predictions & Targets
    print("\nExtracting calibration predictions & targets using frozen model...")
    calib_preds: Dict[str, Dict[int, Any]] = {"iddq": {}, "ileak": {}, "tpd": {}}
    calib_targets: Dict[str, Dict[int, Any]] = {"iddq": {}, "ileak": {}, "tpd": {}}

    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            p_list = []
            t_list = []
            for r in calib_data:
                fc = model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h]
                gt = r["ground_truth_trajectories"][param][h]
                p_list.append(fc)
                t_list.append(gt)
            calib_preds[param][h] = np.array(p_list, dtype=np.float64)
            calib_targets[param][h] = np.array(t_list, dtype=np.float64)

    # 5. Fit Calibrator on CALIBRATION split ONLY
    print("\nFitting Conformal Residual Calibrator on CALIBRATION split ONLY...")
    calibrator = ConformalResidualCalibrator(contract_path=contract_path)
    frozen_artifact = calibrator.fit(
        calibration_predictions=calib_preds,
        calibration_targets=calib_targets,
        split_name="CALIBRATION",
        calibration_lots=[f"LOT-SYN-{i:03d}" for i in range(39, 43)],
        validation_tune_lots=[f"LOT-SYN-{i:03d}" for i in range(36, 39)],
        train_lots=[f"LOT-SYN-{i:03d}" for i in range(1, 36)],
        test_lots=[f"LOT-SYN-{i:03d}" for i in range(43, 51)],
        dataset_sha256=dataset_sha,
        split_manifest_sha256=manifest_sha,
        model_identity="Deterministic_Continuous_Degradation_Forecaster",
        frozen_model_config=frozen_config,
    )
    print(f"  Calibration Artifact Hash: {frozen_artifact['calibration_artifact_sha256']}")

    # 6. Generate Held-Out Test Predictions
    print("\nApplying frozen calibrator to held-out TEST cohort...")
    test_preds: Dict[str, Dict[int, Any]] = {"iddq": {}, "ileak": {}, "tpd": {}}
    test_targets: Dict[str, Dict[int, Any]] = {"iddq": {}, "ileak": {}, "tpd": {}}

    for param in ["iddq", "ileak", "tpd"]:
        for h in [96, 168]:
            p_list = []
            t_list = []
            for r in test_data:
                fc = model.forecast_trajectory(r["early_features_dict"])["forecast_trajectories"][param][h]
                gt = r["ground_truth_trajectories"][param][h]
                p_list.append(fc)
                t_list.append(gt)
            test_preds[param][h] = np.array(p_list, dtype=np.float64)
            test_targets[param][h] = np.array(t_list, dtype=np.float64)

    # 7. Apply Calibrator to Test Predictions ONLY
    test_intervals = calibrator.apply(test_preds)

    # 8. Evaluate Empirical Test Coverage
    print("\nEvaluating empirical test coverage and interval widths...")
    coverage_results = calibrator.evaluate_coverage(test_intervals, test_targets)

    for param in ["iddq", "ileak", "tpd"]:
        for h_str in ["96h", "168h"]:
            for lvl_str in ["0.80", "0.90", "0.95"]:
                res = coverage_results[param][h_str][lvl_str]
                print(
                    f"  [{param.upper()} @ {h_str} | Nominal {float(lvl_str)*100:.0f}%] "
                    f"Observed Coverage: {res['observed_coverage_pct']:.2f}% "
                    f"(Error: {res['coverage_error']:+.4f}) | "
                    f"Avg Width: {res['avg_interval_width']} | q: {res['conformal_quantile_q']:.4f}"
                )

    # 9. Build Complete Benchmark Report
    report = {
        "report_metadata": {
            "title": "Authoritative Stage 6 Conformal Calibration Benchmark Report",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "contract_version": contract["contract_version"],
            "contract_sha256": contract_sha,
            "dataset_sha256": dataset_sha,
            "split_manifest_sha256": manifest_sha,
            "dataset_path": dataset_path,
            "execution_status": "SUCCESS",
            "synthetic_disclaimer": "All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.",
        },
        "calibration_specification": calib_spec,
        "split_cohorts": {
            "train": {
                "lot_count": 35,
                "component_count": len(train_data),
                "lots": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                "purpose": "Point model parameter fitting",
            },
            "validation_tune": {
                "lot_count": 3,
                "component_count": len(val_tune_data),
                "lots": [f"LOT-SYN-{i:03d}" for i in range(36, 39)],
                "purpose": "Model selection & hyperparameter tuning",
            },
            "calibration": {
                "lot_count": 4,
                "component_count": len(calib_data),
                "lots": [f"LOT-SYN-{i:03d}" for i in range(39, 43)],
                "purpose": "Conformal residual quantile estimation ONLY",
            },
            "test": {
                "lot_count": 8,
                "component_count": len(test_data),
                "lots": [f"LOT-SYN-{i:03d}" for i in range(43, 51)],
                "purpose": "Final frozen held-out coverage evaluation",
            },
        },
        "horizon_governance_matrix": frozen_artifact["horizon_status_matrix"],
        "horizon_accounting": {
            "declared_contract_groups": frozen_artifact["declared_groups_count"],
            "calibrated_candidate_groups": frozen_artifact["calibrated_groups_count"],
            "data_unavailable_groups": frozen_artifact["unavailable_groups_count"],
        },
        "calibration_artifact": frozen_artifact,
        "empirical_test_evaluation": coverage_results,
        "governance_status": {
            "calibration_status": "NOT_CALIBRATED",
            "model_status": "BENCHMARK_ONLY",
            "promotion_lock_active": True,
        },
    }

    # 10. Write Artifacts to Disk
    artifact_path = os.path.join(
        project_root, "ml", "models", "production", "conformal_calibration_artifacts.json"
    )
    export_calibration_artifact(frozen_artifact, artifact_path)
    print(f"\nSaved frozen calibration artifact to: {artifact_path}")

    report_json_path = os.path.join(
        project_root, "experiments", "prognostics", "conformal_calibration_report.json"
    )
    os.makedirs(os.path.dirname(report_json_path), exist_ok=True)
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Saved benchmark JSON report to: {report_json_path}")

    report_md_path = os.path.join(
        project_root, "experiments", "prognostics", "conformal_calibration_report.md"
    )
    write_markdown_calibration_report(report, report_md_path)
    print(f"Saved benchmark Markdown report to: {report_md_path}")

    print("=" * 80)
    print("CONFORMAL CALIBRATION BENCHMARK (PYTHON) COMPLETED SUCCESSFULLY")
    print("=" * 80)
    return report


def write_markdown_calibration_report(report: Dict[str, Any], filepath: str) -> None:
    """Generates human-readable Markdown calibration report."""
    calib = report["calibration_artifact"]
    eval_res = report["empirical_test_evaluation"]
    meta = report["report_metadata"]
    matrix = report["horizon_governance_matrix"]

    md = f"""# PREDICTA-26 — Stage 6 Task 1A Conformal Calibration Benchmark Report

## 1. Executive Summary & Calibration Status
- **Method:** Split-Conformal Residual Calibration (`CONFORMAL_RESIDUAL_CALIBRATION`)
- **Status:** `{report['governance_status']['calibration_status']}` (Promotion Lock Active)
- **Model Status:** `{report['governance_status']['model_status']}`
- **Evaluation Timestamp (UTC):** `{meta['generated_at_utc']}`
- **Dataset SHA-256:** `{meta['dataset_sha256']}`
- **Contract SHA-256:** `{meta['contract_sha256']}`
- **Split Manifest SHA-256:** `{meta['split_manifest_sha256']}`
- **Calibration Artifact SHA-256:** `{calib['calibration_artifact_sha256']}`

---

## 2. Four-Way Lot-Disjoint Cohort Partitioning
| Cohort | Lots | Count | Purpose |
| :--- | :--- | :--- | :--- |
| **TRAIN** | LOT-SYN-001..035 (35 lots) | 3500 | Point forecaster parameter fitting |
| **VALIDATION_TUNE** | LOT-SYN-036..038 (3 lots) | 300 | Model selection & hyperparameter tuning |
| **CALIBRATION** | LOT-SYN-039..042 (4 lots) | 400 | Conformal nonconformity quantile estimation ONLY |
| **TEST** | LOT-SYN-043..050 (8 lots) | 800 | Final frozen empirical coverage evaluation |

> [!IMPORTANT]
> The point forecasting model was trained on `TRAIN` and tuned on `VALIDATION_TUNE`.
> The model configuration was frozen before nonconformity residuals were calculated on `CALIBRATION`.
> The `TEST` cohort remained strictly isolated until final coverage evaluation.

---

## 3. Parameter × Horizon Governance Status Matrix ($3 \\times 7 = 21$ Groups)
| Parameter | 24h | 48h | 72h | 96h | 120h | 144h | 168h |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `{matrix['iddq']['24h']}` | `{matrix['iddq']['48h']}` | `{matrix['iddq']['72h']}` | `{matrix['iddq']['96h']}` | `{matrix['iddq']['120h']}` | `{matrix['iddq']['144h']}` | `{matrix['iddq']['168h']}` |
| **Ileak** | `{matrix['ileak']['24h']}` | `{matrix['ileak']['48h']}` | `{matrix['ileak']['72h']}` | `{matrix['ileak']['96h']}` | `{matrix['ileak']['120h']}` | `{matrix['ileak']['144h']}` | `{matrix['ileak']['168h']}` |
| **TPD** | `{matrix['tpd']['24h']}` | `{matrix['tpd']['48h']}` | `{matrix['tpd']['72h']}` | `{matrix['tpd']['96h']}` | `{matrix['tpd']['120h']}` | `{matrix['tpd']['144h']}` | `{matrix['tpd']['168h']}` |

- **Total Declared Groups:** {report['horizon_accounting']['declared_contract_groups']}
- **Calibrated Candidate Groups:** {report['horizon_accounting']['calibrated_candidate_groups']}
- **Data Unavailable Groups:** {report['horizon_accounting']['data_unavailable_groups']}

---

## 4. Empirical Test Cohort Coverage & Interval Widths (Held-Out $n=800$)
| Parameter | Horizon | Nominal Level | Observed Coverage | Coverage Error | Mean Width | Conformal Quantile ($q$) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""

    for param in ["iddq", "ileak", "tpd"]:
        for h_str in ["96h", "168h"]:
            for lvl_str in ["0.80", "0.90", "0.95"]:
                res = eval_res[param][h_str][lvl_str]
                md += (
                    f"| **{param.upper()}** | {h_str} | {float(lvl_str)*100:.0f}% | "
                    f"**{res['observed_coverage_pct']:.2f}%** | {res['coverage_error']:+.4f} | "
                    f"{res['avg_interval_width']:.4f} | {res['conformal_quantile_q']:.4f} |\n"
                )

    md += """
---

## 5. Methodological Notes & Limitations
1. **Marginal Coverage Property:** Split-conformal calibration provides finite-sample marginal coverage guarantees over exchangeable lot distributions.
2. **Homoscedastic Bounds:** Residual quantiles produce fixed-width prediction intervals per horizon. Heteroscedastic conformal prediction may be explored in Stage 7.
3. **Synthetic Ground Truth Disclosure:** All evaluations are conducted on synthetic degradation trajectories. Not flight qualified.
"""

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md)


if __name__ == "__main__":
    run_conformal_calibration_benchmark()
