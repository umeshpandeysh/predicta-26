"""
PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Master Runner
File: src/evaluation/run_phase16_scientific_proof.py

Master execution script orchestrating:
1. Canonical Scientific Test Cases (Cases A, B, C, D)
2. 0h -> 24h -> 96h -> 168h Timelines & 'Why Flagged' Explanations
3. 6-Configuration Layer Ablation Study
4. Configurable Relative Cost Sensitivity Analysis (ASSUMPTION / EVALUATION-ONLY)
5. Operating Threshold Sweep & Protected 0.20 Threshold Analysis

Generates structured JSON reports & Markdown summary report in ml/reports/.

PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
"""

import datetime
import json
import os
import sys
from typing import Dict, Any

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.evaluation.phase16_canonical_cases import Phase16CanonicalCaseSuite
from src.evaluation.phase16_evidence_explainer import Phase16EvidenceExplainer
from src.evaluation.phase16_ablation_study import Phase16AblationStudyEngine
from src.evaluation.phase16_cost_threshold import Phase16CostAndThresholdEvaluator


def run_phase16_master_suite() -> Dict[str, Any]:
    print("=" * 80)
    print("PREDICTA SIH 2026 — PHASE 16: SCIENTIFIC PROOF & DECISION VALIDATION")
    print("=" * 80)

    reports_dir = os.path.join(BASE_DIR, "ml", "reports")
    os.makedirs(reports_dir, exist_ok=True)

    # 1. Canonical Cases & Timelines / Explanations
    print("\n[STEP 1/5] Executing 4 Canonical Scientific Test Cases (Cases A, B, C, D)...")
    canonical_suite = Phase16CanonicalCaseSuite()
    canonical_results = canonical_suite.execute_all()

    explainer = Phase16EvidenceExplainer()
    canonical_outputs = []
    for case_res in canonical_results:
        raw_dict = case_res.raw_telemetry
        case_dict = case_res.to_dict()

        # Re-run inference dictionary format for explainer
        inf_res = canonical_suite.inference_service.predict_single(raw_dict)
        timeline = explainer.build_evidence_timeline(raw_dict, inf_res)
        why_flagged = explainer.generate_why_flagged_explanation(inf_res)

        case_dict["evidence_timeline_0h_168h"] = timeline
        case_dict["why_flagged_explanation"] = why_flagged
        canonical_outputs.append(case_dict)
        print(f"  [OK] [{case_res.validation_status}] {case_res.case_id}: Decision={case_res.decision}, Prob={case_res.prognostic_evidence.get('failure_probability'):.4f}")

    # 2. 6-Configuration Ablation Study
    print("\n[STEP 2/5] Executing 6-Configuration Progressive Layer Ablation Study...")
    ablation_engine = Phase16AblationStudyEngine()
    ablation_results = ablation_engine.execute_all_ablation_configs()
    ablation_outputs = [a.to_dict() for a in ablation_results]

    for a in ablation_results:
        print(f"  [OK] {a.config_id} ({a.config_name}): Recall={a.recall*100:.2f}%, FNR={a.fnr*100:.2f}%, FPR={a.fpr*100:.2f}%, Escapes={a.escape_count}")

    # 3. Cost Sensitivity Analysis (Configurable Relative Weights — ASSUMPTION / EVALUATION-ONLY)
    print("\n[STEP 3/5] Executing Cost-Sensitive Relative Weight Sensitivity Analysis...")
    cost_evaluator = Phase16CostAndThresholdEvaluator()
    eval_df = cost_evaluator.load_eval_data()

    cost_scenarios = cost_evaluator.evaluate_cost_sensitivity(eval_df, threshold=0.20)
    cost_outputs = [c.to_dict() for c in cost_scenarios]

    for c in cost_scenarios:
        print(f"  [OK] Relative Cost Ratio FN/FP={c.fn_to_fp_relative_cost_ratio}: NormCost/Sample={c.normalized_cost_per_sample:.4f}")

    # 4. Protected 0.20 Threshold Sweep Analysis
    print("\n[STEP 4/5] Executing Threshold Sweep & Protected 0.20 Threshold Analysis...")
    threshold_points = cost_evaluator.evaluate_threshold_sweep(eval_df)
    threshold_outputs = [t.to_dict() for t in threshold_points]

    prod_t = next((t for t in threshold_points if t.is_production_threshold), None)
    if prod_t:
        print(f"  [OK] Protected Production Threshold (theta=0.20): Recall={prod_t.recall*100:.2f}%, FNR={prod_t.fnr*100:.2f}%, FPR={prod_t.fpr*100:.2f}%, Escapes={prod_t.escape_count}")

    # 5. Build Master Reports & Save Artifacts
    print("\n[STEP 5/5] Generating Phase 16 JSON & Markdown Reports...")

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    master_report = {
        "report_id": "PREDICTA_PHASE16_SCIENTIFIC_PROOF_REPORT",
        "phase": 16,
        "title": "Scientific Proof & Decision Validation Report",
        "timestamp": timestamp,
        "authoritative_model_sha256": "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98",
        "production_dataset_sha256": "9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24",
        "protected_operating_threshold": 0.20,
        "cost_model_disclaimer": "ASSUMPTION / EVALUATION-ONLY: Configurable relative cost weights used for sensitivity analysis. No real-world economic cost validation is claimed.",
        "canonical_cases_summary": {
            "cases_evaluated": len(canonical_outputs),
            "all_passed": all(c["validation_status"] == "PASSED" for c in canonical_outputs),
        },
        "ablation_study_summary": {
            "configurations_evaluated": len(ablation_outputs),
            "full_pipeline_recall": ablation_results[-1].recall,
            "full_pipeline_fnr": ablation_results[-1].fnr,
            "full_pipeline_fpr": ablation_results[-1].fpr,
        },
        "cost_sensitivity_summary": {
            "scenarios_evaluated": len(cost_outputs),
            "disclaimer": cost_evaluator.disclaimer,
        },
        "threshold_analysis_summary": {
            "thresholds_evaluated": len(threshold_outputs),
            "protected_production_threshold": 0.20,
            "production_threshold_recall": prod_t.recall if prod_t else 0.0,
            "production_threshold_fnr": prod_t.fnr if prod_t else 0.0,
        },
        "scientific_limitations": [
            "Primary dataset is controlled synthetic telemetry v4.",
            "Relative cost weights represent evaluation assumptions for sensitivity analysis; no commercial fab economics are claimed.",
            "Supporting degradation and uncertainty analyses require fab-specific validation before receiving production decision authority.",
            "Model counterfactual attributions indicate model feature contributions, not physical causal intervention proofs."
        ]
    }

    # Save JSON files
    with open(os.path.join(reports_dir, "phase16_scientific_proof_report.json"), "w", encoding="utf-8") as f:
        json.dump(master_report, f, indent=2)

    with open(os.path.join(reports_dir, "phase16_canonical_cases.json"), "w", encoding="utf-8") as f:
        json.dump(canonical_outputs, f, indent=2)

    with open(os.path.join(reports_dir, "phase16_ablation_results.json"), "w", encoding="utf-8") as f:
        json.dump(ablation_outputs, f, indent=2)

    with open(os.path.join(reports_dir, "phase16_cost_threshold_analysis.json"), "w", encoding="utf-8") as f:
        json.dump({"cost_sensitivity": cost_outputs, "threshold_sweep": threshold_outputs}, f, indent=2)

    # Save Markdown Report
    md_content = f"""# PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Report

**SIH 2026 Problem Statement 170**
*Generated:* `{timestamp}`
*Model SHA-256:* `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
*Dataset SHA-256:* `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24`
*Protected Operating Threshold:* `0.20` (Immutable)

---

## 1. Executive Summary

Phase 16 scientifically validates PREDICTA-26's 10-stage reliability architecture (**Telemetry → Anomaly → Degradation → 168h Prognostics → Uncertainty → Physics Validation → Risk Fusion → PASS / MONITOR / REJECT → Human Review → Traceability**).

---

## 2. Canonical Scientific Test Cases

| Case ID | Case Name | Expected Behaviour | Actual Disposition | Failure Prob | Validation Status |
|---|---|---|---|---|---|
"""
    for c in canonical_outputs:
        md_content += f"| **{c['case_id']}** | {c['case_name']} | `{c['expected_behaviour']}` | **`{c['decision']}`** | `{c['prognostic_evidence']['failure_probability']:.4f}` | **`{c['validation_status']}`** |\n"

    md_content += """
---

## 3. 6-Configuration Layer Ablation Study

| Config ID | Active Evidence Layers | Recall | FNR | FPR | F1-Score | Escapes |
|---|---|---:|---:|---:|---:|---:|
"""
    for a in ablation_outputs:
        md_content += f"| **{a['config_id']}** | {', '.join(a['active_layers'])} | `{a['recall']*100:.2f}%` | `{a['fnr']*100:.2f}%` | `{a['fpr']*100:.2f}%` | `{a['f1_score']*100:.2f}%` | `{a['escape_count']}` |\n"

    md_content += """
---

## 4. Cost Sensitivity Analysis (Relative Cost Weights)

> [!NOTE]
> **ASSUMPTION / EVALUATION-ONLY:** Relative cost ratios represent evaluation sensitivity assumptions across FN and FP weights ($C_{{FN}}/C_{{FP}} \in [1.0, 20.0]$). No commercial fab economics are claimed.

| Relative FN/FP Cost Ratio | Relative FN Weight | Relative FP Weight | Inspection Weight | Retest Weight | Relative Cost / Sample |
|---|---:|---:|---:|---:|---:|
"""
    for c in cost_outputs:
        md_content += f"| **{c['fn_to_fp_relative_cost_ratio']}** | `{c['relative_fn_weight']}` | `{c['relative_fp_weight']}` | `{c['relative_inspection_weight']}` | `{c['relative_retest_weight']}` | `{c['normalized_cost_per_sample']:.4f}` |\n"

    md_content += """
---

## 5. Protected 0.20 Threshold Analysis

Operating threshold sweep evaluating trade-offs while keeping production operating threshold locked at **0.20**:

| Candidate Threshold | Recall | FNR | FPR | Precision | F1-Score | Production Status |
|---|---:|---:|---:|---:|---:|---|
"""
    for t in threshold_outputs:
        is_prod = "🔒 **PROTECTED PRODUCTION**" if t["is_production_threshold"] else "Evaluation Sweep"
        md_content += f"| **{t['threshold']:.2f}** | `{t['recall']*100:.2f}%` | `{t['fnr']*100:.2f}%` | `{t['fpr']*100:.2f}%` | `{t['precision']*100:.2f}%` | `{t['f1_score']*100:.2f}%` | {is_prod} |\n"

    md_content += """
---

## 6. Scientific Limitations

1. Primary telemetry dataset is synthetic telemetry v4.
2. Relative cost weights represent evaluation assumptions for sensitivity analysis; no commercial fab economics are claimed.
3. Supporting degradation (GPR) and uncertainty (conformal) analyses require fab-specific validation before receiving production decision authority.
4. Model counterfactual attributions indicate model feature contributions, not physical causal intervention proofs.
"""

    with open(os.path.join(reports_dir, "phase16_scientific_proof_report.md"), "w", encoding="utf-8") as f:
        f.write(md_content)

    # STEP 10: Single-Source Documentation Generation for docs/phase16_methodology_and_proof.md
    docs_dir = os.path.join(BASE_DIR, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    doc_path = os.path.join(docs_dir, "phase16_methodology_and_proof.md")

    doc_md = f"""# PREDICTA-26 — Phase 16 Methodology, Scientific Proof & Decision Validation

**SIH 2026 Problem Statement 170**
*Title:* Semiconductor Burn-In Telemetry & Latent Defect Screening
*Generated:* `{timestamp}`
*Model SHA-256:* `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
*Test Dataset Artifact:* `ml/data/processed/test.csv`
*Test Dataset SHA-256:* `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`
*Protected Operating Threshold:* $\\theta^* = 0.20$ (Immutable)

---

## 1. Executive Summary & Purpose

Phase 16 scientifically validates PREDICTA-26's 10-stage reliability architecture (**Telemetry → Anomaly → Degradation → 168h Prognostics → Uncertainty → Physics Validation → Risk Fusion → PASS / MONITOR / REJECT → Human Review → Traceability**).

---

## 2. 4 Canonical Scientific Test Cases

| Case ID | Case Name | Expected Behaviour | Actual Disposition | Failure Prob | Validation Status |
|---|---|---|---|---|---|
"""
    for c in canonical_outputs:
        doc_md += f"| **{c['case_id']}** | {c['case_name']} | `{c['expected_behaviour']}` | **`{c['decision']}`** | `{c['prognostic_evidence']['failure_probability']:.4f}` | **`{c['validation_status']}`** |\n"

    doc_md += """
---

## 3. 6-Configuration Layer Ablation Study

Single-source programmatic results computed on held-out test partition (`ml/data/processed/test.csv`):

| Config ID | Active Evidence Layers | Recall | FNR | FPR | F1-Score | Escapes | Lead Time |
|---|---|---:|---:|---:|---:|---:|---:|
"""
    for a in ablation_outputs:
        lt_str = f"{a['early_warning_lead_time_hours']}h" if isinstance(a['early_warning_lead_time_hours'], (int, float)) else str(a['early_warning_lead_time_hours'])
        doc_md += f"| **{a['config_id']}** | {', '.join(a['active_layers'])} | `{a['recall']*100:.2f}%` | `{a['fnr']*100:.2f}%` | `{a['fpr']*100:.2f}%` | `{a['f1_score']*100:.2f}%` | `{a['escape_count']}` | `{lt_str}` |\n"

    doc_md += """
---

## 4. Cost Sensitivity Analysis (Relative Cost Weights)

> [!NOTE]
> **ASSUMPTION / EVALUATION-ONLY:** Relative cost ratios represent evaluation sensitivity assumptions across FN and FP weights ($C_{FN}/C_{FP} \\in [1.0, 20.0]$). No commercial fab economics are claimed.

| Relative FN/FP Cost Ratio | Relative FN Weight | Relative FP Weight | Inspection Weight | Retest Weight | Relative Cost / Sample |
|---|---:|---:|---:|---:|---:|
"""
    for c in cost_outputs:
        doc_md += f"| **{c['fn_to_fp_relative_cost_ratio']}** | `{c['relative_fn_weight']}` | `{c['relative_fp_weight']}` | `{c['relative_inspection_weight']}` | `{c['relative_retest_weight']}` | `{c['normalized_cost_per_sample']:.4f}` |\n"

    doc_md += """
---

## 5. Protected 0.20 Threshold Analysis

Operating threshold sweep evaluating trade-offs while keeping production operating threshold locked at **0.20**:

| Candidate Threshold | Recall | FNR | FPR | Precision | F1-Score | Production Status |
|---|---:|---:|---:|---:|---:|---|
"""
    for t in threshold_outputs:
        is_prod = "🔒 **PROTECTED PRODUCTION**" if t["is_production_threshold"] else "Evaluation Sweep"
        doc_md += f"| **{t['threshold']:.2f}** | `{t['recall']*100:.2f}%` | `{t['fnr']*100:.2f}%` | `{t['fpr']*100:.2f}%` | `{t['precision']*100:.2f}%` | `{t['f1_score']*100:.2f}%` | {is_prod} |\n"

    doc_md += """
---

## 6. Scientific Limitations

1. Evaluated on certified held-out test split (`ml/data/processed/test.csv`, 7,500 samples, 3 disjoint lots).
2. Relative cost weights represent evaluation assumptions for sensitivity analysis; no commercial fab economics are claimed.
3. Supporting degradation (GPR) and uncertainty (conformal) analyses require fab-specific validation before receiving production decision authority.
4. Model counterfactual attributions indicate model feature contributions, not physical causal intervention proofs.
"""

    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(doc_md)

    print("[SUCCESS] Phase 16 Master Report & Documentation Generated cleanly.")
    print("=" * 80)
    return master_report


if __name__ == "__main__":
    run_phase16_master_suite()
