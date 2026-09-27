"""
PREDICTA-26 — Comprehensive Economic & Financial Decision Impact Model
File: src/evaluation/economic_impact_model.py

Authoritative, reproducible economic impact model evaluating:
1. Baseline standard 168h burn-in screening cost vs PREDICTA early screening.
2. Explicit distinction between "144h potential early-termination window" and "realized savings".
3. Strict classification of all economic inputs (SOURCE_BACKED, PROJECT_DEFINED, ILLUSTRATIVE/ASSUMPTION).
4. Conservative, Base, and Optimistic scenario analyses.
5. Multi-dimensional sensitivity analysis across FN:FP cost ratios and chamber hourly rates.
6. Absolute immutability of operating threshold theta* = 0.20 (no test-set threshold tuning).
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict
import numpy as np

# Project root setup
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import hashlib


def compute_file_sha256(file_path: str) -> str:
    """Computes SHA-256 checksum of raw file bytes."""
    if not os.path.exists(file_path):
        return "FILE_NOT_FOUND"
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

OUTPUT_JSON_PATH = os.path.join(PROJECT_ROOT, "experiments", "benchmarks", "economic_impact_model.json")
OUTPUT_MD_PATH = os.path.join(PROJECT_ROOT, "docs", "ECONOMIC_IMPACT_MODEL.md")
BENCHMARK_JSON_PATH = os.path.join(PROJECT_ROOT, "experiments", "benchmarks", "01_ps26170_final_benchmark.json")
TEST_CSV_PATH = os.path.join(PROJECT_ROOT, "ml", "data", "processed", "test.csv")
MODEL_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")


@dataclass
class EconomicInputParameter:
    """Represents an economic parameter with strict governance classification."""
    name: str
    value: Any
    unit: str
    classification: str  # SOURCE_BACKED, PROJECT_DEFINED, ILLUSTRATIVE_ASSUMPTION
    source_rationale: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ScenarioParameters:
    """Parameters for a specific economic scenario."""
    scenario_name: str
    chamber_cost_per_hour_per_lot: float  # $ / chamber-hour
    dies_per_chamber_slot: int           # dies per thermal chamber slot
    catastrophic_fn_escape_cost: float   # $ cost of orbital/in-flight latent escape
    secondary_fp_review_cost: float      # $ cost of secondary ATE re-test & inspection
    predicta_compute_cost_per_die: float # $ inference compute cost
    annual_software_maintenance: float   # $ fixed platform maintenance cost
    annual_production_volume_dies: int   # Annual factory screening volume


def build_authoritative_parameters() -> Dict[str, EconomicInputParameter]:
    """Catalog all economic input parameters with strict provenance classifications."""
    return {
        "baseline_burn_in_duration": EconomicInputParameter(
            name="baseline_burn_in_duration",
            value=168.0,
            unit="hours",
            classification="SOURCE_BACKED",
            source_rationale="PS-26170 Problem Statement specification & JEDEC JESD22-A108 standard 168-hour HTOL qualification interval."
        ),
        "early_checkpoint_horizon": EconomicInputParameter(
            name="early_checkpoint_horizon",
            value=24.0,
            unit="hours",
            classification="SOURCE_BACKED",
            source_rationale="PS-26170 Problem Statement early telemetry read-point specification."
        ),
        "potential_early_termination_window": EconomicInputParameter(
            name="potential_early_termination_window",
            value=144.0,
            unit="hours",
            classification="PROJECT_DEFINED",
            source_rationale="Max theoretical window (168h - 24h = 144h); distinct from realized savings."
        ),
        "production_operating_threshold": EconomicInputParameter(
            name="production_operating_threshold",
            value=0.20,
            unit="probability_theta",
            classification="PROJECT_DEFINED",
            source_rationale="Locked production threshold theta* = 0.20 governed by FINAL_AUTHORITY.md."
        ),
        "locked_test_cohort_size": EconomicInputParameter(
            name="locked_test_cohort_size",
            value=7500,
            unit="dies",
            classification="PROJECT_DEFINED",
            source_rationale="Authoritative held-out test split (test.csv) size."
        ),
        "locked_test_defect_count": EconomicInputParameter(
            name="locked_test_defect_count",
            value=3700,
            unit="dies",
            classification="PROJECT_DEFINED",
            source_rationale="Ground-truth latent defect count in held-out test split."
        ),
        "predicta_defect_recall": EconomicInputParameter(
            name="predicta_defect_recall",
            value=0.946216,
            unit="fraction",
            classification="PROJECT_DEFINED",
            source_rationale="Measured recall on locked test split (3,501 / 3,700 defects caught)."
        ),
        "predicta_false_positive_rate": EconomicInputParameter(
            name="predicta_false_positive_rate",
            value=0.6462,
            unit="fraction",
            classification="PROJECT_DEFINED",
            source_rationale="Measured fail-closed operational false positive screening rate on test split."
        ),
        "baseline_static_recall": EconomicInputParameter(
            name="baseline_static_recall",
            value=0.0411,
            unit="fraction",
            classification="PROJECT_DEFINED",
            source_rationale="Stage 1 static limits escape benchmark recall at 24h (152 / 3,700 defects caught)."
        ),
        "chamber_cost_per_hour_normalized": EconomicInputParameter(
            name="chamber_cost_per_hour_normalized",
            value=1.20,
            unit="USD / chamber-slot-hour",
            classification="ILLUSTRATIVE_ASSUMPTION",
            source_rationale="Industrial estimate for thermal chamber energy, nitrogen purging, and depreciation."
        ),
        "catastrophic_fn_escape_cost_normalized": EconomicInputParameter(
            name="catastrophic_fn_escape_cost_normalized",
            value=50000.0,
            unit="USD / escaped_defect",
            classification="ILLUSTRATIVE_ASSUMPTION",
            source_rationale="Estimated spaceflight payload failure / orbital mission risk exposure cost."
        ),
        "secondary_fp_review_cost_normalized": EconomicInputParameter(
            name="secondary_fp_review_cost_normalized",
            value=500.0,
            unit="USD / quarantined_die",
            classification="ILLUSTRATIVE_ASSUMPTION",
            source_rationale="Estimated cost of secondary ATE bench re-test, decapsulation, or non-destructive QA."
        ),
        "predicta_inference_cost_normalized": EconomicInputParameter(
            name="predicta_inference_cost_normalized",
            value=0.005,
            unit="USD / die_inference",
            classification="ILLUSTRATIVE_ASSUMPTION",
            source_rationale="Cloud edge serverless compute & database persistence cost per prediction."
        ),
        "annual_maintenance_overhead": EconomicInputParameter(
            name="annual_maintenance_overhead",
            value=12000.0,
            unit="USD / year",
            classification="ILLUSTRATIVE_ASSUMPTION",
            source_rationale="Platform monitoring, drift tracking, and model governance overhead."
        ),
    }


def evaluate_cohort_economic_impact(
    cohort_size: int,
    defect_prevalence: float,
    scenario: ScenarioParameters,
    predicta_recall: float = 0.946216,
    predicta_fpr: float = 0.6462,
    baseline_recall: float = 0.0411,
    baseline_fpr: float = 0.0000,
    early_disposition_fraction: float = 0.65,
) -> Dict[str, Any]:
    """
    Computes rigorous comparative economic metrics between Conventional Baseline and PREDICTA-26.
    """
    total_defects = int(round(cohort_size * defect_prevalence))
    total_healthy = cohort_size - total_defects

    # ── 1. Baseline Accounting (Static Screening + Full 168h Burn-In)
    baseline_tp = int(round(total_defects * baseline_recall))
    baseline_fn = total_defects - baseline_tp
    baseline_fp = int(round(total_healthy * baseline_fpr))

    baseline_chamber_hours = cohort_size * 168.0
    baseline_chamber_cost = baseline_chamber_hours * (scenario.chamber_cost_per_hour_per_lot / scenario.dies_per_chamber_slot)
    baseline_fn_exposure_cost = baseline_fn * scenario.catastrophic_fn_escape_cost
    baseline_fp_cost = baseline_fp * scenario.secondary_fp_review_cost
    baseline_total_cost = baseline_chamber_cost + baseline_fn_exposure_cost + baseline_fp_cost

    # ── 2. PREDICTA-26 Accounting (24h AI Screening + Governed Early Disposition)
    predicta_tp = int(round(total_defects * predicta_recall))
    predicta_fn = total_defects - predicta_tp
    predicta_fp = int(round(total_healthy * predicta_fpr))

    # Dispositions at 24h:
    # High-confidence dies (early pass or early reject) terminate at 24h;
    # Borderline/Monitor dies continue for full 168h burn-in verification.
    dies_early_disposition = int(round(cohort_size * early_disposition_fraction))
    dies_full_burn_in = cohort_size - dies_early_disposition

    # Realized avoided chamber hours:
    # Potential window = 144h. Realized = dies_early_disposition * 144h.
    realized_avoided_chamber_hours = dies_early_disposition * 144.0
    predicta_chamber_hours = (dies_early_disposition * 24.0) + (dies_full_burn_in * 168.0)
    predicta_chamber_cost = predicta_chamber_hours * (scenario.chamber_cost_per_hour_per_lot / scenario.dies_per_chamber_slot)

    gross_chamber_cost_avoided = realized_avoided_chamber_hours * (scenario.chamber_cost_per_hour_per_lot / scenario.dies_per_chamber_slot)

    predicta_fn_exposure_cost = predicta_fn * scenario.catastrophic_fn_escape_cost
    predicta_fp_review_cost = predicta_fp * scenario.secondary_fp_review_cost
    predicta_compute_cost = cohort_size * scenario.predicta_compute_cost_per_die
    predicta_annual_overhead = scenario.annual_software_maintenance * (cohort_size / max(scenario.annual_production_volume_dies, 1))

    predicta_total_cost = (
        predicta_chamber_cost
        + predicta_fn_exposure_cost
        + predicta_fp_review_cost
        + predicta_compute_cost
        + predicta_annual_overhead
    )

    # ── 3. Net Economic Comparison & Value Attribution
    escapes_prevented = baseline_fn - predicta_fn
    escape_cost_prevented = escapes_prevented * scenario.catastrophic_fn_escape_cost
    secondary_review_cost_increase = predicta_fp_review_cost - baseline_fp_cost

    net_economic_benefit = baseline_total_cost - predicta_total_cost
    total_predicta_investment = predicta_compute_cost + predicta_annual_overhead + secondary_review_cost_increase

    roi_percentage = (
        ((net_economic_benefit) / total_predicta_investment * 100.0)
        if total_predicta_investment > 0
        else 0.0
    )

    payback_dies = (
        int(round(scenario.annual_software_maintenance / (net_economic_benefit / max(cohort_size, 1))))
        if net_economic_benefit > 0
        else -1
    )

    return {
        "scenario_name": scenario.scenario_name,
        "cohort_accounting": {
            "total_dies": cohort_size,
            "latent_defects": total_defects,
            "healthy_dies": total_healthy,
            "defect_prevalence": round(defect_prevalence, 4),
            "early_disposition_rate": round(early_disposition_fraction, 4),
            "dies_early_disposition_24h": dies_early_disposition,
            "dies_full_burn_in_168h": dies_full_burn_in,
        },
        "chamber_hours_and_savings": {
            "potential_early_termination_window_per_die_hours": 144.0,
            "baseline_total_chamber_hours": round(baseline_chamber_hours, 1),
            "predicta_total_chamber_hours": round(predicta_chamber_hours, 1),
            "realized_avoided_chamber_hours": round(realized_avoided_chamber_hours, 1),
            "chamber_hour_reduction_percentage": round(
                (realized_avoided_chamber_hours / baseline_chamber_hours) * 100.0, 2
            ),
            "gross_chamber_cost_avoided_usd": round(gross_chamber_cost_avoided, 2),
        },
        "screening_reliability_comparison": {
            "baseline": {
                "recall": round(baseline_recall, 4),
                "true_positives": baseline_tp,
                "false_negatives_escapes": baseline_fn,
                "false_positives": baseline_fp,
                "fn_risk_exposure_usd": round(baseline_fn_exposure_cost, 2),
                "fp_review_cost_usd": round(baseline_fp_cost, 2),
                "chamber_cost_usd": round(baseline_chamber_cost, 2),
                "total_screening_cost_usd": round(baseline_total_cost, 2),
                "cost_per_die_usd": round(baseline_total_cost / cohort_size, 2),
            },
            "predicta": {
                "recall": round(predicta_recall, 4),
                "true_positives": predicta_tp,
                "false_negatives_escapes": predicta_fn,
                "false_positives": predicta_fp,
                "escapes_prevented": escapes_prevented,
                "fn_risk_exposure_usd": round(predicta_fn_exposure_cost, 2),
                "fp_review_cost_usd": round(predicta_fp_review_cost, 2),
                "chamber_cost_usd": round(predicta_chamber_cost, 2),
                "compute_and_platform_overhead_usd": round(predicta_compute_cost + predicta_annual_overhead, 2),
                "total_screening_cost_usd": round(predicta_total_cost, 2),
                "cost_per_die_usd": round(predicta_total_cost / cohort_size, 2),
            },
        },
        "net_economic_verdict": {
            "net_economic_benefit_usd": round(net_economic_benefit, 2),
            "net_savings_per_die_usd": round(net_economic_benefit / cohort_size, 2),
            "escape_cost_prevented_usd": round(escape_cost_prevented, 2),
            "gross_chamber_savings_usd": round(gross_chamber_cost_avoided, 2),
            "secondary_review_cost_increase_usd": round(secondary_review_cost_increase, 2),
            "roi_percentage": round(roi_percentage, 1),
            "payback_die_count": payback_dies,
        },
    }


def run_comprehensive_economic_analysis() -> Dict[str, Any]:
    """Runs standard scenarios and sensitivity grid for PREDICTA-26."""
    input_catalog = build_authoritative_parameters()

    # Define Three Primary Scenarios
    scenarios = [
        ScenarioParameters(
            scenario_name="Conservative",
            chamber_cost_per_hour_per_lot=0.60,
            dies_per_chamber_slot=1,
            catastrophic_fn_escape_cost=25000.0,
            secondary_fp_review_cost=750.0,
            predicta_compute_cost_per_die=0.010,
            annual_software_maintenance=20000.0,
            annual_production_volume_dies=50000,
        ),
        ScenarioParameters(
            scenario_name="Base_Case",
            chamber_cost_per_hour_per_lot=1.20,
            dies_per_chamber_slot=1,
            catastrophic_fn_escape_cost=50000.0,
            secondary_fp_review_cost=500.0,
            predicta_compute_cost_per_die=0.005,
            annual_software_maintenance=12000.0,
            annual_production_volume_dies=50000,
        ),
        ScenarioParameters(
            scenario_name="Optimistic",
            chamber_cost_per_hour_per_lot=2.50,
            dies_per_chamber_slot=1,
            catastrophic_fn_escape_cost=100000.0,
            secondary_fp_review_cost=300.0,
            predicta_compute_cost_per_die=0.002,
            annual_software_maintenance=8000.0,
            annual_production_volume_dies=100000,
        ),
    ]

    cohort_size = 7500
    defect_prevalence = 3700 / 7500  # 49.33% in test split

    scenario_results = {}
    for sc in scenarios:
        early_frac = 0.45 if sc.scenario_name == "Conservative" else (0.65 if sc.scenario_name == "Base_Case" else 0.80)
        scenario_results[sc.scenario_name] = evaluate_cohort_economic_impact(
            cohort_size=cohort_size,
            defect_prevalence=defect_prevalence,
            scenario=sc,
            early_disposition_fraction=early_frac,
        )

    # ── Sensitivity Analysis: FN:FP Cost Ratio & Chamber Hourly Rate
    fn_fp_ratios = [10.0, 50.0, 100.0, 250.0, 500.0]
    chamber_rates = [0.50, 1.00, 2.00, 5.00]
    sensitivity_grid = []

    base_sc = scenarios[1]
    for r in fn_fp_ratios:
        for cr in chamber_rates:
            temp_sc = ScenarioParameters(
                scenario_name=f"Ratio_{int(r)}_Chamber_{cr:.2f}",
                chamber_cost_per_hour_per_lot=cr,
                dies_per_chamber_slot=1,
                catastrophic_fn_escape_cost=500.0 * r,
                secondary_fp_review_cost=500.0,
                predicta_compute_cost_per_die=base_sc.predicta_compute_cost_per_die,
                annual_software_maintenance=base_sc.annual_software_maintenance,
                annual_production_volume_dies=base_sc.annual_production_volume_dies,
            )
            res = evaluate_cohort_economic_impact(
                cohort_size=cohort_size,
                defect_prevalence=defect_prevalence,
                scenario=temp_sc,
                early_disposition_fraction=0.65,
            )
            sensitivity_grid.append({
                "fn_to_fp_cost_ratio": r,
                "catastrophic_fn_cost_usd": 500.0 * r,
                "chamber_rate_usd_per_hour": cr,
                "net_benefit_usd": res["net_economic_verdict"]["net_economic_benefit_usd"],
                "net_benefit_per_die_usd": res["net_economic_verdict"]["net_savings_per_die_usd"],
                "gross_chamber_savings_usd": res["chamber_hours_and_savings"]["gross_chamber_cost_avoided_usd"],
                "roi_percentage": res["net_economic_verdict"]["roi_percentage"],
            })

    # Sensitivity across Early Disposition Fraction (10% to 90%)
    early_disposition_sensitivity = []
    for frac in np.linspace(0.10, 0.90, 9):
        res = evaluate_cohort_economic_impact(
            cohort_size=cohort_size,
            defect_prevalence=defect_prevalence,
            scenario=base_sc,
            early_disposition_fraction=float(frac),
        )
        early_disposition_sensitivity.append({
            "early_disposition_fraction": round(float(frac), 2),
            "realized_avoided_hours": res["chamber_hours_and_savings"]["realized_avoided_chamber_hours"],
            "gross_chamber_savings_usd": res["chamber_hours_and_savings"]["gross_chamber_cost_avoided_usd"],
            "net_benefit_usd": res["net_economic_verdict"]["net_economic_benefit_usd"],
            "net_benefit_per_die_usd": res["net_economic_verdict"]["net_savings_per_die_usd"],
        })

    master_report = {
        "report_metadata": {
            "title": "PREDICTA-26 Authoritative Economic & Financial Impact Analysis",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "problem_statement": "SIH 2026 PS-26170",
            "production_model_sha256": compute_file_sha256(MODEL_PATH) if os.path.exists(MODEL_PATH) else "UNAVAILABLE",
            "test_dataset_sha256": compute_file_sha256(TEST_CSV_PATH) if os.path.exists(TEST_CSV_PATH) else "UNAVAILABLE",
            "operating_threshold": 0.20,
            "operating_threshold_status": "LOCKED_IMMUTABLE",
        },
        "parameter_catalog": {k: v.to_dict() for k, v in input_catalog.items()},
        "critical_semantic_rule": {
            "declaration": "POTENTIAL_EARLY_TERMINATION_WINDOW_NOT_EQUAL_GUARANTEED_SAVINGS",
            "explanation": (
                "The 144-hour duration (168h - 24h) represents the maximum potential early-termination window. "
                "Realized savings depend strictly on eligible dies, high-confidence disposition fractions, "
                "and plant-specific chamber operating costs."
            ),
        },
        "scenarios": scenario_results,
        "sensitivity_analysis": {
            "fn_fp_ratio_and_chamber_rate_grid": sensitivity_grid,
            "early_disposition_fraction_sweep": early_disposition_sensitivity,
        },
        "governance_and_limitations": [
            "Operating threshold theta* = 0.20 remains strictly locked; economic analysis does NOT optimize or tune test thresholds.",
            "Monetary currency figures ($) represent normalized project-defined scenario assumptions for comparative sensitivity analysis.",
            "Actual enterprise ROI and cost savings require plant-specific equipment depreciation, electricity tariffs, and mission failure liability schedules.",
            "Economic benefits are downstream decision impacts and do not alter physical or statistical ML metrics (Recall, FPR, ROC-AUC).",
        ],
    }

    # Write JSON output
    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(master_report, f, indent=2)

    # Write Markdown documentation
    generate_economic_markdown_report(master_report, OUTPUT_MD_PATH)

    print(f"Saved Economic Model JSON: {os.path.relpath(OUTPUT_JSON_PATH, PROJECT_ROOT)}")
    print(f"Saved Economic Model Markdown: {os.path.relpath(OUTPUT_MD_PATH, PROJECT_ROOT)}")
    return master_report


def generate_economic_markdown_report(report: Dict[str, Any], out_path: str) -> None:
    """Generates a comprehensive judge-facing Markdown report."""
    meta = report["report_metadata"]
    params = report["parameter_catalog"]
    scenarios = report["scenarios"]
    sens = report["sensitivity_analysis"]

    lines = [
        "# PREDICTA-26 — Economic & Financial Decision Model",
        "",
        "> **CANONICAL ECONOMIC AUDIT — SIH 2026 PS-26170**  ",
        f"> **Generated:** `{meta['generated_at_utc']}`  ",
        "> **Governance Status:** `LOCKED_IMMUTABLE_THRESHOLD (θ* = 0.20)`  ",
        "",
        "---",
        "",
        "## 1. Executive Summary & Critical Semantic Distinction",
        "",
        "> [!IMPORTANT]",
        "> **CRITICAL SEMANTIC DISTINCTION — 144 HOURS:**",
        "> **Potential Early-Termination Window ≠ Guaranteed Savings.**  ",
        "> 144 hours ($168\\text{h} - 24\\text{h}$) represents the *maximum available observation window* for early screening. ",
        "> Realized financial savings are strictly modeled as:  ",
        "> $$\\text{Realized Savings} = N_{\\text{eligible}} \\times \\eta_{\\text{early}} \\times 144\\text{h} \\times \\text{ChamberCost}_{\\text{hour}}$$",
        "> where $\\eta_{\\text{early}}$ is the fraction of components receiving high-confidence early disposition (`PASS` or `REJECT`) at $24\\text{h}$, while borderline devices continue full $168\\text{h}$ burn-in verification (`MONITOR`).",
        "",
        "---",
        "",
        "## 2. Parameter Provenance & Input Classification",
        "",
        "Every economic input parameter is strictly categorized by governance provenance:",
        "",
        "| Parameter Name | Value | Unit | Classification | Provenance & Source Rationale |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for p in params.values():
        lines.append(f"| `{p['name']}` | **{p['value']}** | {p['unit']} | `{p['classification']}` | {p['source_rationale']} |")

    lines += [
        "",
        "---",
        "",
        "## 3. Comparative Scenario Analysis (Held-Out Test Cohort $N=7,500$)",
        "",
        "| Metric / Dimension | Baseline (Static Limits) | PREDICTA Conservative | PREDICTA Base Case | PREDICTA Optimistic |",
        "| :--- | :--- | :--- | :--- | :--- |",
        "| **Chamber Hourly Rate** | $1.20/hr | $0.60/hr | $1.20/hr | $2.50/hr |",
        "| **Early Disposition Fraction ($\\eta$)** | 0% (All 168h) | 45% (3,375 dies) | 65% (4,875 dies) | 80% (6,000 dies) |",
        "| **Total Chamber Hours** | 1,260,000 hrs | 774,000 hrs | 558,000 hrs | 396,000 hrs |",
        "| **Chamber Hours Avoided** | 0 hrs (0%) | 486,000 hrs (38.6%) | 702,000 hrs (55.7%) | 864,000 hrs (68.6%) |",
        f"| **Gross Chamber Cost Avoided** | $0 | ${scenarios['Conservative']['chamber_hours_and_savings']['gross_chamber_cost_avoided_usd']:,} | ${scenarios['Base_Case']['chamber_hours_and_savings']['gross_chamber_cost_avoided_usd']:,} | ${scenarios['Optimistic']['chamber_hours_and_savings']['gross_chamber_cost_avoided_usd']:,} |",
        "| **Defect Escapes (FNs)** | 3,548 Escapes | 199 Escapes | 199 Escapes | 199 Escapes |",
        "| **Escapes Prevented** | 0 (Baseline) | **3,349 Escapes** | **3,349 Escapes** | **3,349 Escapes** |",
        f"| **Escape Cost Prevented** | $0 | ${scenarios['Conservative']['net_economic_verdict']['escape_cost_prevented_usd']:,} | ${scenarios['Base_Case']['net_economic_verdict']['escape_cost_prevented_usd']:,} | ${scenarios['Optimistic']['net_economic_verdict']['escape_cost_prevented_usd']:,} |",
        f"| **Secondary FP Review Cost** | $0 | ${scenarios['Conservative']['screening_reliability_comparison']['predicta']['fp_review_cost_usd']:,} | ${scenarios['Base_Case']['screening_reliability_comparison']['predicta']['fp_review_cost_usd']:,} | ${scenarios['Optimistic']['screening_reliability_comparison']['predicta']['fp_review_cost_usd']:,} |",
        f"| **Net Economic Benefit** | $0 (Reference) | **${scenarios['Conservative']['net_economic_verdict']['net_economic_benefit_usd']:,}** | **${scenarios['Base_Case']['net_economic_verdict']['net_economic_benefit_usd']:,}** | **${scenarios['Optimistic']['net_economic_verdict']['net_economic_benefit_usd']:,}** |",
        f"| **Net Savings Per Die** | $0.00 | **${scenarios['Conservative']['net_economic_verdict']['net_savings_per_die_usd']}** | **${scenarios['Base_Case']['net_economic_verdict']['net_savings_per_die_usd']}** | **${scenarios['Optimistic']['net_economic_verdict']['net_savings_per_die_usd']}** |",
        f"| **Model ROI** | N/A | **{scenarios['Conservative']['net_economic_verdict']['roi_percentage']}%** | **{scenarios['Base_Case']['net_economic_verdict']['roi_percentage']}%** | **{scenarios['Optimistic']['net_economic_verdict']['roi_percentage']}%** |",
        "",
        "---",
        "",
        "## 4. Multi-Dimensional Sensitivity Analysis",
        "",
        "### A. Sensitivity to Asymmetric Cost Ratio ($C_{\\text{FN}} : C_{\\text{FP}}$) and Chamber Rates",
        "",
        "| FN:FP Cost Ratio | Escape Risk Cost ($C_{\\text{FN}}$) | Chamber Cost ($/hr) | Avoided Chamber ($) | Net Economic Benefit ($) | Net Value per Die ($) | ROI (%) |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for row in sens["fn_fp_ratio_and_chamber_rate_grid"]:
        lines.append(
            f"| **{int(row['fn_to_fp_cost_ratio'])}:1** | ${row['catastrophic_fn_cost_usd']:,} | "
            f"${row['chamber_rate_usd_per_hour']:.2f} | ${row['gross_chamber_savings_usd']:,} | "
            f"**${row['net_benefit_usd']:,}** | **${row['net_benefit_per_die_usd']}** | {row['roi_percentage']:.1f}% |"
        )

    lines += [
        "",
        "### B. Sensitivity to Early Disposition Fraction ($\\eta_{\\text{early}}$)",
        "",
        "| Early Disposition Fraction ($\\eta$) | Realized Avoided Chamber Hours | Gross Chamber Cost Avoided ($) | Net Economic Benefit ($) | Net Savings Per Die ($) |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for row in sens["early_disposition_fraction_sweep"]:
        lines.append(
            f"| **{int(row['early_disposition_fraction']*100)}%** | {row['realized_avoided_hours']:,} hrs | "
            f"${row['gross_chamber_savings_usd']:,} | **${row['net_benefit_usd']:,}** | **${row['net_benefit_per_die_usd']}** |"
        )

    lines += [
        "",
        "---",
        "",
        "## 5. Governance & Boundary Disclaimers",
        "",
        "1. **Immutability of Operating Threshold ($\\theta^* = 0.20$):** The economic analysis is strictly downstream decision analysis. It evaluates the financial consequences of the governed $\\theta^* = 0.20$ threshold and does NOT optimize or alter the test threshold.",
        "2. **Normalized Units Disclaimer:** Monetary values represent normalized project-defined model parameters. Full commercial ROI requires customer-specific fab amortization and payload liability schedules.",
        "3. **Zero Impact on Scientific Benchmarks:** Economic metrics do NOT modify or inflate scientific classification performance (Recall = 94.62%, FNR = 5.38%, ROC-AUC = 0.9631).",
    ]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    run_comprehensive_economic_analysis()
