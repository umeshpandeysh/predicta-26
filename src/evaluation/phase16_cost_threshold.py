"""
PREDICTA-26 — Phase 16 Cost-Sensitive Evaluation & Protected 0.20 Threshold Analysis
File: src/evaluation/phase16_cost_threshold.py

Features:
1. Configurable relative cost weight framework clearly labeled ASSUMPTION / EVALUATION-ONLY.
   Exposes sensitivity analysis across multiple relative FN-to-FP cost ratios (1.0, 2.0, 5.0, 10.0, 20.0).
   EXPLICIT DISCLAIMER: No real-world economic cost validation is claimed; values are evaluation assumptions.
2. Operating Threshold Sweep:
   Sweeps candidate operating thresholds theta in [0.05, 0.95] to analyze trade-offs.
   PRODUCION THRESHOLD IMMUTABILITY: Production threshold remains locked at 0.20.

PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional, Tuple
import os
import sys
import numpy as np
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService
from src.evaluation.phase16_ablation_study import calculate_metrics_from_cm
from src.evaluation.metrics import compute_binary_confusion_matrix


@dataclass
class CostScenarioResult:
    fn_to_fp_relative_cost_ratio: float
    relative_fn_weight: float
    relative_fp_weight: float
    relative_inspection_weight: float
    relative_retest_weight: float
    relative_escape_weight: float
    total_relative_weighted_cost: float
    normalized_cost_per_sample: float
    operating_threshold_used: float
    disclaimer: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ThresholdPointAnalysis:
    threshold: float
    tp: int
    tn: int
    fp: int
    fn: int
    recall: float
    fnr: float
    fpr: float
    precision: float
    f1_score: float
    escape_count: int
    inspection_count: int
    total_relative_cost_ratio_5: float
    is_production_threshold: bool

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class Phase16CostAndThresholdEvaluator:
    def __init__(self, dataset_path: Optional[str] = None):
        self.dataset_path = dataset_path or os.path.join(BASE_DIR, "ml", "data", "processed", "test.csv")
        self.inference_service = PredictaInferenceService()
        self.production_threshold = 0.20
        self.disclaimer = "ASSUMPTION / EVALUATION-ONLY: Configurable relative cost weights used for sensitivity analysis. No real-world economic cost validation is claimed."

    def load_eval_data(self) -> pd.DataFrame:
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(f"FAIL_CLOSED: Held-out test dataset missing at {self.dataset_path}")
        df = pd.read_csv(self.dataset_path)
        if len(df) == 0:
            raise ValueError("FAIL_CLOSED: Held-out test dataset is empty!")
        return df

    def _evaluate_dataset_probabilities(self, df: pd.DataFrame) -> Tuple[List[int], List[float]]:
        if getattr(self, "_cached_df_id", None) == id(df) and getattr(self, "_cached_prob", None) is not None:
            return self._cached_gt, self._cached_prob

        y_true = []
        y_prob = []
        for _, row in df.iterrows():
            gt = 1 if (row.get("result") == "FAIL" or row.get("is_latent") == 1 or row.get("defect_type") != "NORMAL") else 0
            y_true.append(gt)

            rec = row.to_dict()
            res = self.inference_service.predict_single(rec)
            y_prob.append(float(res["probability"]))

        self._cached_df_id = id(df)
        self._cached_gt = y_true
        self._cached_prob = y_prob
        return y_true, y_prob

    def evaluate_cost_sensitivity(self, df: pd.DataFrame, threshold: float = 0.20) -> List[CostScenarioResult]:
        """
        Runs sensitivity analysis across multiple relative-cost scenarios (ratio 1.0, 2.0, 5.0, 10.0, 20.0).
        Labels all outputs explicitly as EVALUATION-ONLY ASSUMPTIONS.
        """
        y_true, y_prob = self._evaluate_dataset_probabilities(df)

        y_pred = [1 if p >= threshold else 0 for p in y_prob]
        cm = compute_binary_confusion_matrix(y_true, y_pred)
        fp, fn = cm["fp"], cm["fn"]
        n_total = len(y_true)

        scenarios = []
        ratios = [1.0, 2.0, 5.0, 10.0, 20.0]

        for ratio in ratios:
            w_fn = ratio
            w_fp = 1.0
            w_insp = 0.2
            w_retest = 0.5
            w_escape = ratio * 2.0

            total_rel_cost = (fn * w_fn) + (fp * w_fp) + (fp * w_insp) + (fn * w_escape)
            norm_cost = total_rel_cost / max(1, n_total)

            scenarios.append(CostScenarioResult(
                fn_to_fp_relative_cost_ratio=ratio,
                relative_fn_weight=w_fn,
                relative_fp_weight=w_fp,
                relative_inspection_weight=w_insp,
                relative_retest_weight=w_retest,
                relative_escape_weight=w_escape,
                total_relative_weighted_cost=round(float(total_rel_cost), 4),
                normalized_cost_per_sample=round(float(norm_cost), 4),
                operating_threshold_used=threshold,
                disclaimer=self.disclaimer,
            ))

        return scenarios

    def evaluate_threshold_sweep(self, df: pd.DataFrame) -> List[ThresholdPointAnalysis]:
        """
        Sweeps candidate operating thresholds theta in [0.05, 0.95] in steps of 0.05.
        Locks production threshold at 0.20.
        """
        y_true, y_prob = self._evaluate_dataset_probabilities(df)

        threshold_points = []
        candidates = np.round(np.arange(0.05, 0.96, 0.05), 2)

        for t in candidates:
            y_pred = [1 if p >= t else 0 for p in y_prob]
            cm = compute_binary_confusion_matrix(y_true, y_pred)
            tp, tn, fp, fn = cm["tp"], cm["tn"], cm["fp"], cm["fn"]
            metrics = calculate_metrics_from_cm(tp, tn, fp, fn)

            w_cost_5 = (fn * 5.0) + (fp * 1.0) + (fp * 0.2) + (fn * 10.0)

            threshold_points.append(ThresholdPointAnalysis(
                threshold=float(t),
                tp=tp, tn=tn, fp=fp, fn=fn,
                recall=metrics["recall"],
                fnr=metrics["fnr"],
                fpr=metrics["fpr"],
                precision=metrics["precision"],
                f1_score=metrics["f1_score"],
                escape_count=fn,
                inspection_count=fp,
                total_relative_cost_ratio_5=round(float(w_cost_5), 4),
                is_production_threshold=bool(abs(t - 0.20) < 1e-4),
            ))

        return threshold_points
