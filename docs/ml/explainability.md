# Explainability Engine (XAI)

Unsupervised anomaly detection requires transparent justifications to allow engineers to verify and audit rejections.

## Marginal Attributions
AIPS computes parameter deviations using robust lot-relative standardizations:
$$Z_d = \frac{X_d - \text{Median}_{\text{lot}, d}}{1.4826 \times \text{MAD}_{\text{lot}, d}}$$
*   The parameter with the highest $Z$-score is flagged as the **primary contributor** to the anomaly.
*   Explanations avoid causal claims (e.g. "this caused a gate short") and focus on descriptive observations (e.g. "current exhibits a high deviation of $+8.2\sigma$ relative to lot median").
