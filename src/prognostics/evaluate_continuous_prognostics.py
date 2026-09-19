"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Continuous Prognostics Evaluation Runner
File: src/prognostics/evaluate_continuous_prognostics.py

Executes:
1. Authoritative contract verification (continuous trajectory specification)
2. Synthetic dataset ingestion and lot-held-out disjoint partitioning (35 Train, 7 Val, 8 Test)
3. Multi-horizon continuous trajectory evaluation for Persistence Baseline vs Deterministic Continuous Degradation Model
4. Evaluation of metrics: MAE, RMSE, MedAE, MaxAE, Normalized RMSE across 96h and 168h
5. Parametric screening limit projections and threshold breach evaluation
6. Empirical uncertainty diagnostics (validation residual intervals, flagged NOT_CALIBRATED)
7. Legacy GPR artifact governance audit
8. Generation of JSON and Markdown benchmark reports with full synthetic disclaimers
"""

import os
import sys
import json
import datetime
from typing import Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.prognostics.trajectory import (
    load_authoritative_prognostic_contract,
    get_authoritative_continuous_spec,
    compute_sha256,
    ContinuousTrajectoryDatasetBuilder,
    ContinuousPersistenceBaseline,
    DeterministicContinuousDegradationModel,
    evaluate_threshold_projections,
    evaluate_legacy_gpr_governance,
)


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

    print(f"Contract SHA-256: {contract_sha}")
    print(f"Dataset SHA-256:  {dataset_sha}")

    builder = ContinuousTrajectoryDatasetBuilder(dataset_path=dataset_path, contract_path=contract_path)
    ds = builder.build_dataset()
    records = ds["records"]
    splits = builder.split_dataset(records)

    train_recs = splits["train"]
    val_recs = splits["validation"]
    test_recs = splits["test"]

    print(f"Dataset Partitioning: Train={len(train_recs)}, Validation={len(val_recs)}, Test={len(test_recs)}")
    assert len(train_recs) == 3500
    assert len(val_recs) == 700
    assert len(test_recs) == 800

    # 3. Evaluate Persistence Baseline
    print("\nEvaluating Continuous Persistence Baseline...")
    persistence = ContinuousPersistenceBaseline()
    persistence_val_metrics = persistence.evaluate(val_recs, horizons=[96, 168])
    persistence_test_metrics = persistence.evaluate(test_recs, horizons=[96, 168])

    # 4. Train & Evaluate Deterministic Continuous Degradation Model
    print("Fitting & Tuning Deterministic Continuous Degradation Model on Validation...")
    model = DeterministicContinuousDegradationModel()
    model.fit_and_tune(train_recs, val_recs)

    print("Evaluating Frozen Degradation Model on Held-Out Test Cohort...")
    test_eval = model.evaluate_frozen_test(test_recs, tune_on_test=False)
    degradation_test_metrics = test_eval["metrics"]
    degradation_test_coverage = test_eval["coverage"]

    # Also evaluate on validation for comparison
    val_eval = model.evaluate_frozen_test(val_recs, tune_on_test=False)
    degradation_val_metrics = val_eval["metrics"]

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
    report = {
        "report_metadata": {
            "title": "Authoritative Stage 5 Continuous Prognostics Benchmark Report",
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "contract_version": contract["contract_version"],
            "contract_sha256": contract_sha,
            "dataset_sha256": dataset_sha,
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
        "split_cohorts": {
            "train": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(1, 36)],
                "lot_count": 35,
                "sample_count": len(train_recs)
            },
            "validation": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(36, 43)],
                "lot_count": 7,
                "sample_count": len(val_recs)
            },
            "test": {
                "lots": [f"LOT-SYN-{i:03d}" for i in range(43, 51)],
                "lot_count": 8,
                "sample_count": len(test_recs)
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
                "optimal_hyperparameters_tuned_on_validation": model.optimal_alphas
            }
        ],
        "benchmark_metrics": {
            "validation_cohort": {
                "persistence_baseline": persistence_val_metrics,
                "deterministic_degradation_model": degradation_val_metrics
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

### Lot-Held-Out Partitions
- **Train Cohort:** Lots `LOT-SYN-001` .. `LOT-SYN-035` ({splits['train']['sample_count']} samples)
- **Validation Cohort:** Lots `LOT-SYN-036` .. `LOT-SYN-042` ({splits['validation']['sample_count']} samples)
- **Held-Out Test Cohort:** Lots `LOT-SYN-043` .. `LOT-SYN-050` ({splits['test']['sample_count']} samples)

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
