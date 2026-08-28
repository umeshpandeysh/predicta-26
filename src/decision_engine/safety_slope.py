"""
PREDICTA Phase 3 — Calculated Safety Slope & Prototype Screening Criteria Engine
File: src/decision_engine/safety_slope.py

Concept Flow:
  Predicted 168h Drift + Upper-95% Trajectory → Calculated Safety Slope / Criterion → Safety Margin

Provenance Note:
  The default thresholds (iddq: 5000nA, ileak: 500nA, tpd: 250ps) represent PROJECT-DEFINED
  PROTOTYPE SCREENING CRITERIA derived from the SEMICONDUCTOR_TELEMETRY domain, serving as configurable
  screening boundaries rather than universal datasheet specifications.
"""

class SafetySlopeCalculator:
    def __init__(self, max_limit: float, max_slope_per_hour: float):
        self.max_limit = max_limit
        self.max_slope_per_hour = max_slope_per_hour

    def calculate_slope(self, val_24h: float, pred_168h: float) -> float:
        # 168h - 24h = 144 hours elapsed
        return (pred_168h - val_24h) / 144.0

    def evaluate_trajectory(
        self,
        val_24h: float,
        pred_168h: float,
        pred_std: float,
        confidence_multiplier: float = 1.96
    ) -> dict:
        pred_slope = self.calculate_slope(val_24h, pred_168h)
        pred_upper_168h = pred_168h + confidence_multiplier * pred_std
        upper_slope = self.calculate_slope(val_24h, pred_upper_168h)

        denom = self.max_slope_per_hour if self.max_slope_per_hour > 0 else 1e-9
        margin = (self.max_slope_per_hour - pred_slope) / denom

        status = "WITHIN"
        if pred_upper_168h > self.max_limit or upper_slope > self.max_slope_per_hour:
            if pred_168h > self.max_limit or pred_slope > self.max_slope_per_hour:
                status = "EXCEEDED"
            else:
                status = "WARNING"

        return {
            "predicted_slope": float(pred_slope),
            "upper_bound_slope": float(upper_slope),
            "safety_margin": float(margin),
            "boundary_status": status,
            "criteria_source": "PROJECT_DEFINED_SCREENING_CRITERIA"
        }

    def evaluate_all_trajectories(
        self,
        drift_predictions: dict,
        spec_limits: dict = None
    ) -> dict:
        if spec_limits is None:
            # Prototype Screening Criteria
            spec_limits = {
                "iddq": {"max_limit": 5000.0, "max_slope_per_hour": 15.0},
                "ileak": {"max_limit": 500.0, "max_slope_per_hour": 2.0},
                "tpd": {"max_limit": 250.0, "max_slope_per_hour": 1.0}
            }

        results = {}
        for param, drift_item in drift_predictions.items():
            val_24h = drift_item.get("value_24h", 0.0)
            pred_168h = drift_item.get("predicted_168h", 0.0)
            pred_std = drift_item.get("uncertainty_std", 0.0)

            limit_cfg = spec_limits.get(param, {"max_limit": self.max_limit, "max_slope_per_hour": self.max_slope_per_hour})
            calc = SafetySlopeCalculator(limit_cfg["max_limit"], limit_cfg["max_slope_per_hour"])
            eval_res = calc.evaluate_trajectory(val_24h, pred_168h, pred_std)
            results[param] = eval_res

        return results
