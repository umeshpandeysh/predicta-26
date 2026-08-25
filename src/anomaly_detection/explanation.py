import pandas as pd

def explain_component_anomaly(
    component_id: str,
    lot_id: str,
    row_features: dict,
    lot_medians: dict,
    lot_mads: dict,
    model_name: str,
    score: float,
    threshold: float
) -> dict:
    """Generates structured parameter contributions and human explanations."""
    contributors = []
    
    for key in row_features.keys():
        val = row_features[key]
        median = lot_medians.get(key, 0.0)
        mad = lot_mads.get(key, 1e-9)
        robust_sigma = 1.4826 * mad
        z = abs(val - median) / (robust_sigma if robust_sigma > 0 else 1e-9)
        
        contributors.append({
            "feature": key,
            "value": float(val),
            "lot_median": float(median),
            "lot_relative_deviation": "HIGH" if z > 4.5 else "MODERATE" if z > 2.5 else "NORMAL",
            "contribution_score": float(z)
        })
        
    contributors.sort(key=lambda x: x["contribution_score"], reverse=True)
    
    top_param = contributors[0]["feature"].upper()
    top_dev = contributors[0]["lot_relative_deviation"]
    
    explanation_str = f"Component behaves abnormally relative to lot {lot_id}. "
    explanation_str += f"Primary contributor is parameter {top_param} showing {top_dev} deviation. "
    explanation_str += f"Joint anomaly score is {score:.2f} (threshold {threshold:.2f})."
    
    return {
        "component_id": component_id,
        "lot_id": lot_id,
        "anomaly_score": float(score),
        "anomaly_flag": bool(score > threshold),
        "model": model_name,
        "contributors": contributors,
        "explanation": explanation_str
    }
