"""
PREDICTA-26 — Financial & Economic Decision-Cost Impact Engine
=============================================================
Calculates genuine decision costs and economic impacts for semiconductor burn-in screening.

Features:
- Explicit parameterized decision-cost matrix (C_FN, C_FP, C_TP, C_TN)
- Normalized cost calculations: total cost, cost per component, cost per 1,000, cost per lot
- Baseline comparisons (No-ML screening, static datasheet limits, legacy baseline)
- Financial sensitivity analysis across cost ratios (1:1, 2:1, 5:1, 10:1, 20:1)
- Latent defect economic impact modeling
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional



@dataclass
class CostMatrix:
    cost_fn: float = 50.0  # Cost of defect escape (field/assembly failure)
    cost_fp: float = 5.0   # Cost of false alarm (unnecessary scrap / re-test)
    cost_tp: float = 1.0   # Cost of true defect screening at burn-in stage
    cost_tn: float = 0.0   # Cost of healthy nominal component processing

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


class FinancialImpactEngine:
    def __init__(self, cost_matrix: Optional[CostMatrix] = None):
        self.cost_matrix = cost_matrix or CostMatrix()

    def calculate_decision_cost(
        self,
        tp: int,
        tn: int,
        fp: int,
        fn: int,
        num_lots: int = 3,
        matrix: Optional[CostMatrix] = None,
    ) -> Dict[str, Any]:
        """Compute decision costs from confusion matrix."""
        cm = matrix or self.cost_matrix
        total_units = tp + tn + fp + fn
        assert total_units > 0, "Total units must be > 0"

        fn_cost = fn * cm.cost_fn
        fp_cost = fp * cm.cost_fp
        tp_cost = tp * cm.cost_tp
        tn_cost = tn * cm.cost_tn
        total_cost = fn_cost + fp_cost + tp_cost + tn_cost

        cost_per_component = total_cost / total_units
        cost_per_1000 = cost_per_component * 1000.0
        cost_per_lot = total_cost / max(num_lots, 1)

        return {
            "total_cost": round(float(total_cost), 2),
            "cost_per_component": round(float(cost_per_component), 4),
            "cost_per_1000_components": round(float(cost_per_1000), 2),
            "cost_per_lot": round(float(cost_per_lot), 2),
            "fn_cost": round(float(fn_cost), 2),
            "fp_cost": round(float(fp_cost), 2),
            "tp_cost": round(float(tp_cost), 2),
            "tn_cost": round(float(tn_cost), 2),
            "cost_matrix_used": cm.to_dict(),
        }

    def compare_against_baselines(
        self,
        eval_cm: Dict[str, int],
        num_lots: int = 3,
    ) -> Dict[str, Any]:
        """Compare evaluated system against baseline screening strategies."""
        tp = eval_cm["tp"]
        tn = eval_cm["tn"]
        fp = eval_cm["fp"]
        fn = eval_cm["fn"]
        total_defects = tp + fn
        total_nominals = tn + fp

        # Baseline 1: No-ML (All pass -> all defects escape as FN)
        no_ml_cost = self.calculate_decision_cost(0, total_nominals, 0, total_defects, num_lots=num_lots)

        # Baseline 2: Static Datasheet Limits (recall=0.0411 -> TP=136, FN=3175, FP=0, TN=4189)
        static_tp = int(total_defects * 0.0411)
        static_fn = total_defects - static_tp
        static_cost = self.calculate_decision_cost(static_tp, total_nominals, 0, static_fn, num_lots=num_lots)

        # Evaluated system cost
        system_cost = self.calculate_decision_cost(tp, tn, fp, fn, num_lots=num_lots)

        avoided_vs_no_ml = no_ml_cost["total_cost"] - system_cost["total_cost"]
        avoided_vs_static = static_cost["total_cost"] - system_cost["total_cost"]

        return {
            "evaluated_system_cost": system_cost,
            "no_ml_baseline_cost": no_ml_cost,
            "static_limits_baseline_cost": static_cost,
            "avoided_cost_vs_no_ml": round(float(avoided_vs_no_ml), 2),
            "avoided_cost_vs_static_limits": round(float(avoided_vs_static), 2),
            "net_savings_percentage_vs_no_ml": round(float((avoided_vs_no_ml / no_ml_cost["total_cost"]) * 100), 2),
            "net_savings_percentage_vs_static": round(float((avoided_vs_static / static_cost["total_cost"]) * 100), 2),
        }

    def run_financial_sensitivity_analysis(
        self,
        tp: int,
        tn: int,
        fp: int,
        fn: int,
        num_lots: int = 3,
    ) -> List[Dict[str, Any]]:
        """Evaluate financial impact across standard semiconductor cost ratio scenarios."""
        scenarios = [
            {"ratio_name": "1:1 (Equal Scrap & Escape Cost)", "c_fn": 5.0, "c_fp": 5.0, "c_tp": 1.0, "c_tn": 0.0},
            {"ratio_name": "2:1 (Moderate Escape Cost)", "c_fn": 10.0, "c_fp": 5.0, "c_tp": 1.0, "c_tn": 0.0},
            {"ratio_name": "5:1 (High Reliability Standard)", "c_fn": 25.0, "c_fp": 5.0, "c_tp": 1.0, "c_tn": 0.0},
            {"ratio_name": "10:1 (Automotive / Mission-Critical Default)", "c_fn": 50.0, "c_fp": 5.0, "c_tp": 1.0, "c_tn": 0.0},
            {"ratio_name": "20:1 (Aerospace / Zero-Defect Standard)", "c_fn": 100.0, "c_fp": 5.0, "c_tp": 1.0, "c_tn": 0.0},
        ]

        results = []
        for s in scenarios:
            mat = CostMatrix(cost_fn=s["c_fn"], cost_fp=s["c_fp"], cost_tp=s["c_tp"], cost_tn=s["c_tn"])
            costs = self.calculate_decision_cost(tp, tn, fp, fn, num_lots=num_lots, matrix=mat)
            results.append({
                "scenario": s["ratio_name"],
                "fn_fp_ratio": s["c_fn"] / s["c_fp"],
                "total_cost": costs["total_cost"],
                "cost_per_component": costs["cost_per_component"],
                "fn_cost": costs["fn_cost"],
                "fp_cost": costs["fp_cost"],
            })

        return results

    def calculate_latent_defect_economic_impact(
        self,
        total_latent: int,
        detected_latent: int,
        missed_latent: int,
        latent_escape_multiplier: float = 5.0,
    ) -> Dict[str, Any]:
        """Compute economic impact of latent sub-threshold defect screening."""
        assert total_latent == detected_latent + missed_latent, "Total latent count mismatch"
        c_latent_fn = self.cost_matrix.cost_fn * latent_escape_multiplier

        unscreened_latent_loss = total_latent * c_latent_fn
        actual_latent_loss = missed_latent * c_latent_fn
        prevented_latent_loss = detected_latent * c_latent_fn

        return {
            "total_latent_defects": int(total_latent),
            "detected_latent_defects": int(detected_latent),
            "missed_latent_defects": int(missed_latent),
            "latent_escape_unit_cost": round(float(c_latent_fn), 2),
            "prevented_field_failure_cost": round(float(prevented_latent_loss), 2),
            "remaining_latent_risk_cost": round(float(actual_latent_loss), 2),
            "unscreened_baseline_latent_cost": round(float(unscreened_latent_loss), 2),
        }
