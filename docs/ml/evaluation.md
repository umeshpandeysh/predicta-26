# Model Evaluation Strategy

Semiconductor qualification for aerospace programs requires a strict, risk-averse metric prioritization.

## Metric Prioritization

1.  **False Negative Rate (FNR) - HIGH:** Represents components with latent defects that escape screening. Must be minimized to avoid spacecraft failures.
2.  **Recall - HIGH:** Represents the percentage of defects correctly captured.
3.  **False Positive Rate (FPR) - MEDIUM:** Represents yield loss (healthy components thrown away). Needs to remain under 3.0% to keep production lines cost-efficient.
4.  **PR-AUC - HIGH:** Tracks model precision/recall thresholds under strong class imbalance.
