"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Continuous Prognostics Evaluation Runner
File: src/prognostics/evaluate_continuous_prognostics.py

Executes:
1. Authoritative contract verification (continuous trajectory specification)
2. Synthetic dataset ingestion and four-way lot-held-out disjoint partitioning:
   - TRAIN: LOT-SYN-001..035 (35 lots, 3500 components)
   - VALIDATION_TUNE: LOT-SYN-036..038 (3 lots, 300 components)
   - CALIBRATION: LOT-SYN-039..042 (4 lots, 400 components)
   - TEST: LOT-SYN-043..050 (8 lots, 800 components)
3. Multi-horizon continuous trajectory evaluation for Persistence Baseline vs Deterministic Continuous Degradation Model
4. Evaluation of metrics: MAE, RMSE, MedAE, MaxAE, Normalized RMSE across 96h and 168h
5. Parametric screening limit projections and threshold breach evaluation
6. Empirical uncertainty diagnostics (empirical validation-tune residual intervals, flagged NOT_CALIBRATED)
7. Legacy GPR artifact governance audit
8. Generation of JSON and Markdown benchmark reports with full synthetic disclaimers
"""

import os
import sys
import json
import datetime
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.prognostics.conformal import build_authoritative_horizon_matrix
from src.prognostics.trajectory import (
    load_authoritative_prognostic_contract,
    get_authoritative_continuous_spec,
    compute_sha256,
    calculate_continuous_regression_metrics,
    ContinuousTrajectoryDatasetBuilder,
    ContinuousPersistenceBaseline,
    DeterministicContinuousDegradationModel,
    evaluate_threshold_projections,
    evaluate_legacy_gpr_governance,
)


def evaluate_model_on_cohort(
    model: DeterministicContinuousDegradationModel,
    records: List[Dict[str, Any]],
    horizons: List[int] = [96, 168]
) -> Dict[str, Any]:
    """
    Evaluates frozen point forecaster on an arbitrary cohort without mutating model state.
    """
    results = {}
    for param in ["iddq", "ileak", "tpd"]:
        results[param] = {}
        for h in horizons:
            y_true = []
            y_pred = []
            for r in records:
                gt = r["ground_truth_trajectories"].get(param, {}).get(h)
                if gt is not None:
                    fc = model.forecast_trajectory(r["early_features_dict"])
                    pred_val = fc["forecast_trajectories"][param][h]
                    y_true.append(gt)
                    y_pred.append(pred_val)
            results[param][f"{h}h"] = calculate_continuous_regression_metrics(y_true, y_pred)
    return results


def run_continuous_prognostic_benchmark() -> Dict[str, Any]:
    print("================================================================================")
    print("PREDICTA-26 — AUTHORITATIVE CONTINUOUS 168H PROGNOSTIC BENCHMARK")
    print("================================================================================")

    # 1. Load Contract & Spec
    contract_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "ml", "prognostics", "prognostic_contract.json")
    )
    contract = load_authoritative_prognostic_contract(contract_path)
    spec = get_authoritative_continuous_spec(contract_path)
    contract_sha = compute_sha256(contract_path)

    # 2. Dataset Ingestion & Partitioning
    dataset_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "synthetic", "semiconductor_synthetic_full.csv")
    )
    dataset_sha = compute_sha256(dataset_path)

    manifest_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "ml", "data", "split_manifest.json")
    )
    manifest_sha = compute_sha256(manifest_path)

    print(f"Contract SHA-256: {contract_sha}")
    print(f"Dataset SHA-256:  {dataset_sha}")
    print(f"Manifest SHA-256: {manifest_sha}")

    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=dataset_path, contract_path=contract_path)
    ds = builder.build_dataset()
    records = ds["records"]
    splits = builder.split_dataset(records, split_manifest_path=manifest_path)

    train_recs = splits["train"]
    val_tune_recs = splits["validation_tune"]
    calib_recs = splits["calibration"]
    test_recs = splits["test"]

    print(f"Dataset Partitioning: Train={len(train_recs)}, ValidationTune={len(val_tune_recs)}, Calibration={len(calib_recs)}, Test={len(test_recs)}")
    assert len(train_recs) == 3500
    assert len(val_tune_recs) == 300
    assert len(calib_recs) == 400
    assert len(test_recs) == 800

    # 3. Evaluate Persistence Baseline
    print("\nEvaluating Continuous Persistence Baseline...")
    persistence = ContinuousPersistenceBaseline()
    persistence_val_metrics = persistence.evaluate(val_tune_recs, horizons=[96, 168])
    persistence_test_metrics = persistence.evaluate(test_recs, horizons=[96, 168])

    # 4. Train & Evaluate Deterministic Continuous Degradation Model
    print("Fitting & Tuning Deterministic Continuous Degradation Model on ValidationTune (LOT-SYN-036..038)...")
    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(train_recs, val_tune_recs, split_manifest_path=manifest_path)
    assert model.is_frozen, "Model must be frozen after fitting & tuning."

    print("Evaluating Frozen Degradation Model on Held-Out Test Cohort (LOT-SYN-043..050)...")
    test_eval = model.evaluate_frozen_test(test_recs, tune_on_test=False)
    degradation_test_metrics = test_eval["metrics"]
    degradation_test_coverage = test_eval["coverage"]

    # Also evaluate on validation tune for hyperparameter validation report
    degradation_val_metrics = evaluate_model_on_cohort(model, val_tune_recs, horizons=[96, 168])
    # Also evaluate on calibration cohort for diagnostic reporting
    degradation_calib_metrics = evaluate_model_on_cohort(model, calib_recs, horizons=[96, 168])

    # 5. Threshold Screening Projections on Test Cohort
    print("Evaluating Projected Threshold Breaches on Held-Out Test Cohort...")
    test_breach_counts = {"iddq": 0, "ileak": 0, "tpd": 0, "overall": 0}
    test_sample_projections = []

    for r in test_recs:
        fc = model.forecast_trajectory(r["early_features_dict"])
        proj = evaluate_threshold_projections(fc["forecast_trajectories"], contract_path=contract_path)
        if proj["overall_breach_projected"]:
            test_breach_counts["overall"] += 1
        for p in ["iddq", "ileak", "tpd"]:
            if proj["parameter_projections"][p]["breach_projected"]:
                test_breach_counts[p] += 1

        if len(test_sample_projections) < 5:
            test_sample_projections.append({
                "component_id": r["component_id"],
                "lot_id": r["lot_id"],
                "overall_breach": proj["overall_breach_projected"],
                "earliest_breach_hour": proj["earliest_breach_hour"],
                "parameter_projections": {
                    p: {
                        "breach": proj["parameter_projections"][p]["breach_projected"],
                        "earliest_hour": proj["parameter_projections"][p]["earliest_crossing_hour"],
                        "forecast_168h": proj["parameter_projections"][p]["forecast_at_168h"]
                    }
                    for p in ["iddq", "ileak", "tpd"]
                }
            })

    # 6. Legacy GPR Audit
    print("Auditing Legacy GPR Artifact Governance...")
    gpr_audit = evaluate_legacy_gpr_governance()

    # 7. Assemble Report Object
    horizon_matrix_info = build_authoritative_horizon_matrix(
        declared_horizons=spec["supported_horizons"],
        supported_dataset_horizons=spec["evaluated_ground_truth_horizons"],
        target_parameters=spec["target_parameters"]
    )

    report = {
        "report_metadata": {
            "title": "Authoritative Stage 5 Continuous Prognostics Benchmark Report",
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "contract_version": contract["contract_version"],
            "contract_sha256": contract_sha,
            "dataset_sha256": dataset_sha,
            "manifest_sha256": manifest_sha,
            "dataset_path": "data/synthetic/semiconductor_synthetic_full.csv",
            "execution_status": "SUCCESS",
            "synthetic_disclaimer": "All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified."
        },
        "continuous_specification": {
            "task_name": spec["task_name"],
            "forecast_origin_hours": spec["forecast_origins"],
            "supported_horizons": spec["supported_horizons"],
            "evaluated_ground_truth_horizons": spec["evaluated_ground_truth_horizons"],
            "target_parameters": spec["target_parameters"],
            "target_units": spec["target_units"],
            "allowed_early_observation_features": spec["allowed_early_observation_features"],
            "forbidden_future_fields": spec["forbidden_future_fields"],
            "screening_criteria_type": spec["screening_criteria_type"],
            "parametric_screening_limits": spec["parametric_screening_limits"],
            "model_status": spec["model_status"],
            "calibration_status": spec["calibration_status"]
        },
        "horizon_governance_matrix": {
            "matrix": horizon_matrix_info["matrix"],
            "accounting": {
                "total_contract_declared_groups": horizon_matrix_info["total_declared_groups"],
                "currently_data_supported_groups": horizon_matrix_info["calibrated_groups_count"],
                "currently_evaluated_calibration_candidate_groups": horizon_matrix_info["calibrated_groups_count"],
                "not_evaluated_groups": horizon_matrix_info["not_evaluated_groups_count"],
                "data_unavailable_groups": horizon_matrix_info["unavailable_groups_count"]
            }
        },
        "split_cohorts": {
            "train": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                "lot_count": 35,
                "sample_count": len(train_recs),
                "role": "POINT_MODEL_FITTING"
            },
            "validation_tune": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(36, 39)],
                "lot_count": 3,
                "sample_count": len(val_tune_recs),
                "role": "HYPERPARAMETER_SELECTION_ONLY"
            },
            "calibration": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(39, 43)],
                "lot_count": 4,
                "sample_count": len(calib_recs),
                "role": "CONFORMAL_CALIBRATION_ONLY_FORBIDDEN_FROM_TUNING"
            },
            "test": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(43, 51)],
                "lot_count": 8,
                "sample_count": len(test_recs),
                "role": "FROZEN_HELD_OUT_EVALUATION_ONLY"
            },
            "historical_validation_aggregate": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(36, 43)],
                "lot_count": 7,
                "sample_count": len(val_tune_recs) + len(calib_recs),
                "status": "NON-AUTHORITATIVE AGGREGATE / HISTORICAL COMPATIBILITY VIEW"
            }
        },
        "models_evaluated": [
            {
                "model_name": persistence.name,
                "algorithm": persistence.algorithm,
                "status": persistence.status,
                "calibration_status": "NOT_APPLICABLE"
            },
            {
                "model_name": model.name,
                "algorithm": model.algorithm,
                "status": model.status,
                "calibration_status": model.calibration_status,
                "hyperparameters_frozen": True,
                "optimal_hyperparameters_tuned_on_validation_tune": model.optimal_alphas,
                "calibration_cohort_used_for_fitting": False
            }
        ],
        "benchmark_metrics": {
            "validation_tune_cohort": {
                "persistence_baseline": persistence_val_metrics,
                "deterministic_degradation_model": degradation_val_metrics
            },
            "calibration_cohort_diagnostics": {
                "deterministic_degradation_model": degradation_calib_metrics
            },
            "held_out_test_cohort": {
                "persistence_baseline": persistence_test_metrics,
                "deterministic_degradation_model": degradation_test_metrics,
                "empirical_uncertainty_coverage_diagnostics": degradation_test_coverage
            }
        },
        "threshold_screening_projections": {
            "screening_criteria_source": "PROJECT_DEFINED_SCREENING_CRITERION",
            "test_sample_count": len(test_recs),
            "projected_breach_counts": test_breach_counts,
            "projected_breach_percentages": {
                p: round((cnt / len(test_recs)) * 100.0, 2)
                for p, cnt in test_breach_counts.items()
            },
            "sample_component_projections": test_sample_projections
        },
        "legacy_gpr_audit": gpr_audit
    }

    # 8. Save JSON Report
    out_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "experiments", "prognostics")
    )
    os.makedirs(out_dir, exist_ok=True)

    json_path = os.path.join(out_dir, "continuous_prognostic_benchmark_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved benchmark JSON report to: {json_path}")

    # 9. Generate & Save Markdown Report
    md_path = os.path.join(out_dir, "continuous_prognostic_benchmark_report.md")
    md_content = generate_markdown_report(report)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"Saved benchmark Markdown report to: {md_path}")

    print("\n================================================================================")
    print("CONTINUOUS PROGNOSTIC BENCHMARK COMPLETED SUCCESSFULLY")
    print("================================================================================")

    return report


def generate_markdown_report(report: Dict[str, Any]) -> str:
    r_meta = report["report_metadata"]
    spec = report["continuous_specification"]
    splits = report["split_cohorts"]
    test_metrics = report["benchmark_metrics"]["held_out_test_cohort"]
    coverage = test_metrics["empirical_uncertainty_coverage_diagnostics"]
    gpr = report["legacy_gpr_audit"]
    breach = report["threshold_screening_projections"]

    p_test = test_metrics["persistence_baseline"]
    m_test = test_metrics["deterministic_degradation_model"]

    md = f"""# Authoritative Stage 5 Continuous Prognostics Benchmark Report

**Generated:** `{r_meta['generated_at_utc']}`
**Contract Version:** `{r_meta['contract_version']}`
**Dataset SHA-256:** `{r_meta['dataset_sha256']}`
**Manifest SHA-256:** `{r_meta.get('manifest_sha256', 'N/A')}`
**Dataset Path:** `{r_meta['dataset_path']}`

> **DISCLAIMER:** {r_meta['synthetic_disclaimer']}

---

## 1. Executive Summary & Specification

- **Task Name:** `{spec['task_name']}`
- **Forecast Origin:** `{spec['forecast_origin_hours']}h` (Strictly observable early features at 0h, 24h, and 24h drift)
- **Forecast Horizons:** `{spec['supported_horizons']}`
- **Evaluated Horizons:** `{spec['evaluated_ground_truth_horizons']}`
- **Target Parameters:** `iddq` (μA), `ileak` (μA), `tpd` (ns)
- **Model Status:** `{spec['model_status']}`
- **Calibration Status:** `{spec['calibration_status']}`

### Authoritative Four-Way Lot-Held-Out Partitions
- **Train Cohort (Model Fitting):** Lots `LOT-SYN-001` .. `LOT-SYN-035` ({splits['train']['sample_count']} samples)
- **Validation Tune Cohort (Hyperparameter Selection):** Lots `LOT-SYN-036` .. `LOT-SYN-038` ({splits['validation_tune']['sample_count']} samples)
- **Calibration Cohort (Conformal Residuals Only - Forbidden from Tuning):** Lots `LOT-SYN-039` .. `LOT-SYN-042` ({splits['calibration']['sample_count']} samples)
- **Held-Out Test Cohort (Frozen Evaluation Only):** Lots `LOT-SYN-043` .. `LOT-SYN-050` ({splits['test']['sample_count']} samples)

---

## 1.1 Authoritative 3×7 Target Horizon Governance Matrix

| Parameter | 24h (Origin) | 48h | 72h | 96h | 120h | 144h | 168h |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **Ileak** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **TPD** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |

### Horizon Accounting
- **Total Contract-Declared Groups:** 21 (3 parameters × 7 horizons)
- **Currently Data-Supported Groups:** 6 (IDDQ, Ileak, TPD @ 96h, 168h)
- **Currently Evaluated / Calibration-Candidate Groups:** 6
- **Not Evaluated Groups (Origin Checkpoint):** 3 (24h)
- **Data Unavailable Groups (Missing Checkpoints):** 12 (48h, 72h, 120h, 144h)

---

## 2. Continuous Trajectory Forecasting Performance (Held-Out Test Set)

### IDDQ Trajectory Forecasting (μA)
| Horizon | Model | MAE (μA) | RMSE (μA) | MedAE (μA) | MaxAE (μA) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | {p_test['iddq']['96h']['mae']:.4f} | {p_test['iddq']['96h']['rmse']:.4f} | {p_test['iddq']['96h']['median_absolute_error']:.4f} | {p_test['iddq']['96h']['max_absolute_error']:.4f} | {p_test['iddq']['96h']['normalized_rmse']:.4f} |
| **96h** | **Degradation Model** | **{m_test['iddq']['96h']['mae']:.4f}** | **{m_test['iddq']['96h']['rmse']:.4f}** | **{m_test['iddq']['96h']['median_absolute_error']:.4f}** | **{m_test['iddq']['96h']['max_absolute_error']:.4f}** | **{m_test['iddq']['96h']['normalized_rmse']:.4f}** |
| **168h** | Persistence Baseline | {p_test['iddq']['168h']['mae']:.4f} | {p_test['iddq']['168h']['rmse']:.4f} | {p_test['iddq']['168h']['median_absolute_error']:.4f} | {p_test['iddq']['168h']['max_absolute_error']:.4f} | {p_test['iddq']['168h']['normalized_rmse']:.4f} |
| **168h** | **Degradation Model** | **{m_test['iddq']['168h']['mae']:.4f}** | **{m_test['iddq']['168h']['rmse']:.4f}** | **{m_test['iddq']['168h']['median_absolute_error']:.4f}** | **{m_test['iddq']['168h']['max_absolute_error']:.4f}** | **{m_test['iddq']['168h']['normalized_rmse']:.4f}** |

### Ileak Trajectory Forecasting (μA)
| Horizon | Model | MAE (μA) | RMSE (μA) | MedAE (μA) | MaxAE (μA) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | {p_test['ileak']['96h']['mae']:.4f} | {p_test['ileak']['96h']['rmse']:.4f} | {p_test['ileak']['96h']['median_absolute_error']:.4f} | {p_test['ileak']['96h']['max_absolute_error']:.4f} | {p_test['ileak']['96h']['normalized_rmse']:.4f} |
| **96h** | **Degradation Model** | **{m_test['ileak']['96h']['mae']:.4f}** | **{m_test['ileak']['96h']['rmse']:.4f}** | **{m_test['ileak']['96h']['median_absolute_error']:.4f}** | **{m_test['ileak']['96h']['max_absolute_error']:.4f}** | **{m_test['ileak']['96h']['normalized_rmse']:.4f}** |
| **168h** | Persistence Baseline | {p_test['ileak']['168h']['mae']:.4f} | {p_test['ileak']['168h']['rmse']:.4f} | {p_test['ileak']['168h']['median_absolute_error']:.4f} | {p_test['ileak']['168h']['max_absolute_error']:.4f} | {p_test['ileak']['168h']['normalized_rmse']:.4f} |
| **168h** | **Degradation Model** | **{m_test['ileak']['168h']['mae']:.4f}** | **{m_test['ileak']['168h']['rmse']:.4f}** | **{m_test['ileak']['168h']['median_absolute_error']:.4f}** | **{m_test['ileak']['168h']['max_absolute_error']:.4f}** | **{m_test['ileak']['168h']['normalized_rmse']:.4f}** |

### TPD Trajectory Forecasting (ns)
| Horizon | Model | MAE (ns) | RMSE (ns) | MedAE (ns) | MaxAE (ns) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | {p_test['tpd']['96h']['mae']:.4f} | {p_test['tpd']['96h']['rmse']:.4f} | {p_test['tpd']['96h']['median_absolute_error']:.4f} | {p_test['tpd']['96h']['max_absolute_error']:.4f} | {p_test['tpd']['96h']['normalized_rmse']:.4f} |
| **96h** | **Degradation Model** | **{m_test['tpd']['96h']['mae']:.4f}** | **{m_test['tpd']['96h']['rmse']:.4f}** | **{m_test['tpd']['96h']['median_absolute_error']:.4f}** | **{m_test['tpd']['96h']['max_absolute_error']:.4f}** | **{m_test['tpd']['96h']['normalized_rmse']:.4f}** |
| **168h** | Persistence Baseline | {p_test['tpd']['168h']['mae']:.4f} | {p_test['tpd']['168h']['rmse']:.4f} | {p_test['tpd']['168h']['median_absolute_error']:.4f} | {p_test['tpd']['168h']['max_absolute_error']:.4f} | {p_test['tpd']['168h']['normalized_rmse']:.4f} |
| **168h** | **Degradation Model** | **{m_test['tpd']['168h']['mae']:.4f}** | **{m_test['tpd']['168h']['rmse']:.4f}** | **{m_test['tpd']['168h']['median_absolute_error']:.4f}** | **{m_test['tpd']['168h']['max_absolute_error']:.4f}** | **{m_test['tpd']['168h']['normalized_rmse']:.4f}** |

---

## 3. Empirical Uncertainty Diagnostics (Uncalibrated)

> **IMPORTANT:** Prediction intervals are derived from validation empirical residuals and are designated **`NOT_CALIBRATED`**. They represent uncalibrated empirical diagnostic bands, not formal conformal or Bayesian coverage guarantees.

| Parameter | Horizon | Nominal Level | Observed Test Coverage (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | 96h | 90.0% | {coverage['iddq']['96h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |
| **IDDQ** | 168h | 90.0% | {coverage['iddq']['168h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |
| **Ileak** | 96h | 90.0% | {coverage['ileak']['96h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |
| **Ileak** | 168h | 90.0% | {coverage['ileak']['168h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |
| **TPD** | 96h | 90.0% | {coverage['tpd']['96h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |
| **TPD** | 168h | 90.0% | {coverage['tpd']['168h']['observed_coverage_pct']:.2f}% | NOT_CALIBRATED |

---

## 4. Screening Threshold Crossing Projections

Projected against authoritative project-defined screening criteria:
- `iddq_max_uA`: {spec['parametric_screening_limits']['iddq_max_uA']} μA
- `ileak_max_uA`: {spec['parametric_screening_limits']['ileak_max_uA']} μA
- `tpd_max_ns`: {spec['parametric_screening_limits']['tpd_max_ns']} ns

**Test Cohort Breach Summary ({breach['test_sample_count']} devices):**
- Overall Projected Breaches: **{breach['projected_breach_counts']['overall']}** ({breach['projected_breach_percentages']['overall']}%)
- IDDQ Projected Breaches: **{breach['projected_breach_counts']['iddq']}** ({breach['projected_breach_percentages']['iddq']}%)
- Ileak Projected Breaches: **{breach['projected_breach_counts']['ileak']}** ({breach['projected_breach_percentages']['ileak']}%)
- TPD Projected Breaches: **{breach['projected_breach_counts']['tpd']}** ({breach['projected_breach_percentages']['tpd']}%)

---

## 5. Legacy GPR Governance Audit

- **Artifact Name:** `{gpr.get('model_name')}`
- **Artifact Path:** `{gpr.get('model_path')}`
- **Artifact SHA-256:** `{gpr.get('model_sha256')}`
- **Compatibility Status:** `{gpr.get('compatibility_status')}`
- **Promotion Eligible:** `{gpr.get('promotion_eligible')}`
- **Rejection Reason:** {gpr.get('rejection_reason')}
"""
    return md


if __name__ == "__main__":
    run_continuous_prognostic_benchmark()
