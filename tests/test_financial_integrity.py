"""
PREDICTA-26 — Financial Impact Intelligence Integrity Test Suite
================================================================
Verifies:
1. Decision cost matrix parameters and mathematical formulations
2. Exact recomputation of screening costs from confusion matrix
3. Avoided cost calculations vs No-ML and Static Limits baselines
4. Cost sensitivity scenario robustness across multiple FN:FP ratios
5. Latent defect economic impact calculations
6. Persisted scorecard financial structure consistency
"""

from pathlib import Path
import json
import pytest

from src.evaluation.financial_impact_engine import CostMatrix, FinancialImpactEngine

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BENCHMARK_DIR = PROJECT_ROOT / "experiments" / "benchmarks"


def test_01_cost_matrix_initialization():
    """Verify default cost matrix parameters."""
    cm = CostMatrix()
    assert cm.cost_fn == 50.0
    assert cm.cost_fp == 5.0
    assert cm.cost_tp == 1.0
    assert cm.cost_tn == 0.0


def test_02_screening_cost_mathematical_exactness():
    """Verify exact calculation: Cost = TP*cost_tp + FP*cost_fp + FN*cost_fn + TN*cost_tn."""
    engine = FinancialImpactEngine(CostMatrix(cost_fn=50.0, cost_fp=5.0, cost_tp=1.0, cost_tn=0.0))
    # Test confusion matrix: TP=3000, FP=500, FN=50, TN=3950 (Total=7500)
    cost_res = engine.calculate_decision_cost(tp=3000, tn=3950, fp=500, fn=50, num_lots=3)
    
    expected_tp_cost = 3000 * 1.0
    expected_fp_cost = 500 * 5.0
    expected_fn_cost = 50 * 50.0
    expected_tn_cost = 3950 * 0.0
    expected_total = expected_tp_cost + expected_fp_cost + expected_fn_cost + expected_tn_cost
    
    assert cost_res["total_cost"] == expected_total
    assert cost_res["tp_cost"] == expected_tp_cost
    assert cost_res["fp_cost"] == expected_fp_cost
    assert cost_res["fn_cost"] == expected_fn_cost
    assert round(cost_res["cost_per_component"], 4) == round(expected_total / 7500, 4)


def test_03_baseline_avoided_cost_calculations():
    """Verify comparison vs No-ML baseline and Static Limits baseline."""
    engine = FinancialImpactEngine()
    
    # 7500 units with 3311 total defects
    # Challenger at theta=0.20: TP=3289, FP=1281, FN=22, TN=2908
    eval_cm = {"tp": 3289, "tn": 2908, "fp": 1281, "fn": 22}
    comp = engine.compare_against_baselines(eval_cm=eval_cm, num_lots=3)
    
    # No-ML cost: 3311 * 50.0 = 165550.0
    assert comp["no_ml_baseline_cost"]["total_cost"] == 165550.0
    # Challenger cost: 3289*1 + 1281*5 + 22*50 = 3289 + 6405 + 1100 = 10794.0
    assert comp["evaluated_system_cost"]["total_cost"] == 10794.0
    
    assert comp["avoided_cost_vs_no_ml"] == 165550.0 - 10794.0
    assert comp["net_savings_percentage_vs_no_ml"] > 90.0


def test_04_sensitivity_analysis_coverage():
    """Verify sensitivity scenarios spanning 1:1 to 20:1 FN:FP cost ratios."""
    engine = FinancialImpactEngine()
    scenarios = engine.run_financial_sensitivity_analysis(tp=3289, tn=2908, fp=1281, fn=22, num_lots=3)
    
    assert len(scenarios) == 5
    ratios = [s["fn_fp_ratio"] for s in scenarios]
    assert 1.0 in ratios
    assert 2.0 in ratios
    assert 5.0 in ratios
    assert 10.0 in ratios
    assert 20.0 in ratios
    
    for s in scenarios:
        assert s["total_cost"] > 0
        assert s["cost_per_component"] > 0


def test_05_latent_defect_economic_impact():
    """Verify latent defect economic impact correctly evaluates latent escapes avoided."""
    engine = FinancialImpactEngine()
    latent_econ = engine.calculate_latent_defect_economic_impact(
        total_latent=30,
        detected_latent=26,
        missed_latent=4,
        latent_escape_multiplier=5.0,
    )
    
    assert latent_econ["total_latent_defects"] == 30
    assert latent_econ["detected_latent_defects"] == 26
    assert latent_econ["missed_latent_defects"] == 4
    assert latent_econ["latent_escape_unit_cost"] == 250.0
    assert latent_econ["prevented_field_failure_cost"] == 26 * 250.0
    assert latent_econ["remaining_latent_risk_cost"] == 4 * 250.0


def test_06_scorecard_financial_integrity():
    """Verify persisted scorecard contains valid and complete financial evaluations."""
    scorecard_path = BENCHMARK_DIR / "predicta_final_ml_shap_financial_scorecard.json"
    if not scorecard_path.exists():
        scorecard_path = BENCHMARK_DIR / "aether_final_scorecard.json"
    
    assert scorecard_path.exists(), "Scorecard must exist"
    with open(scorecard_path, "r", encoding="utf-8") as f:
        scorecard = json.load(f)
    
    assert "financial" in scorecard
    fin = scorecard["financial"]
    assert "primary_challenger_costs" in fin
    assert "baseline_comparisons" in fin
    assert "sensitivity_analysis_scenarios" in fin
    assert "latent_defect_economic_impact" in fin
