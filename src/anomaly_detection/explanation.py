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

    for key in row_features:
        val = row_features[key]
        median = lot_medians.get(key, 0.0)
        mad = lot_mads.get(key)
        if mad is None:
            continue
        robust_sigma = 1.4826 * mad
        if robust_sigma == 0:
            z = 0.0 if abs(val - median) <= 1e-12 else float("inf")
        else:
            z = abs(val - median) / robust_sigma

        contributors.append({
            "feature": key,
            "value": float(val),
            "lot_median": float(median),
            "lot_relative_deviation": "HIGH" if z > 4.5 else "MODERATE" if z > 2.5 else "NORMAL",
            "contribution_score": float(z)
        })

    contributors.sort(key=lambda x: x["contribution_score"], reverse=True)

    if not contributors:
        raise ValueError("No valid anomaly contributors available for explanation")
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
