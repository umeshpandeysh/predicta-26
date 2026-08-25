def make_screening_decision(
    anomaly_score: float, safety_evaluations: dict, data_quality_status: str = "VALID"
) -> dict:
    """Combines unsupervised anomaly flags and parametric drift bounds into safety decisions."""
    if data_quality_status != "VALID":
        return {
            "status": "MONITOR",
            "risk_level": "HIGH",
            "reason": "Data quality validation failed or dataset was insufficient."
        }

    is_anomaly = anomaly_score > 8.5
    is_warning = anomaly_score > 5.0

    any_exceeded = any(s_eval["boundary_status"] == "EXCEEDED" for s_eval in safety_evaluations.values())
    any_warning = any(s_eval["boundary_status"] == "WARNING" for s_eval in safety_evaluations.values())

    if is_anomaly or any_exceeded:
        status = "REJECT"
        risk = "HIGH"
        reason = "Component flagged as multi-parameter lot outlier or predicted drift violates safety bounds."
    elif is_warning or any_warning:
        status = "MONITOR"
        risk = "MEDIUM"
        reason = "Component exhibits elevated lot variance or borderline predicted drift slope."
    else:
        status = "PASS"
        risk = "LOW"
        reason = "Parameter coordinates behave within nominal lot limits and predicted drifts remain safe."

    return {
        "status": status,
        "risk_level": risk,
        "reason": reason
    }
