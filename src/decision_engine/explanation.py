def generate_decision_explanation(
    component_id: str,
    lot_id: str,
    anomaly_score: float,
    safety_evaluations: dict,
    decision: dict
) -> dict:
    """Generates user-friendly tracing audits for PASS/MONITOR/REJECT states."""
    reasons = []
    
    if anomaly_score > 8.5:
        reasons.append("Multi-parameter outlier score exceeds critical threshold.")
    elif anomaly_score > 5.0:
        reasons.append("Lot-relative variance is elevated (warning boundary).")
        
    for param, s_eval in safety_evaluations.items():
        if s_eval["boundary_status"] == "EXCEEDED":
            reasons.append(f"Predicted 168h {param.upper()} drift rate crosses allowed safety boundary.")
        elif s_eval["boundary_status"] == "WARNING":
            reasons.append(f"Mean predicted 168h {param.upper()} approaches spec margins.")
            
    if not reasons:
        reasons.append("All measurements and predicted parameters adhere to nominal space-grade quality rules.")
        
    explanation_str = f"Component screening result: {decision['status']}. " + " ".join(reasons)
    
    return {
        "component_id": component_id,
        "lot_id": lot_id,
        "final_decision": decision["status"],
        "risk_level": decision["risk_level"],
        "contributing_reasons": reasons,
        "explanation": explanation_str
    }
