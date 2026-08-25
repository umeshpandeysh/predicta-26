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
            "boundary_status": status
        }
