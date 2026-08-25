# Model Selection Analysis

This report documents the selection of **Isolation Forest** over COPOD and MAD as the primary active algorithm.

## Benchmark Analysis
*   *Isolation Forest:* Recall $88.9\%$, FNR $11.1\%$, FPR $1.9\%$.
*   *Robust MAD:* Recall $81.5\%$, FNR $18.5\%$, FPR $1.9\%$.
*   *COPOD:* Recall $29.6\%$, FNR $70.4\%$, FPR $4.0\%$.

## Rationale
*   *Why Isolation Forest Wins:* Isolation Forest constructs multi-dimensional isolation trees. By evaluating joint parameter spaces, it identifies complex correlated outliers (e.g., simultaneous increases in gate leakage and quiescent current) that univariate MAD boundaries treat as marginal.
*   *Why COPOD Performed Poorly:* COPOD evaluates marginal cumulative tail probabilities assuming parameters are independent. In physical CMOS components, $I_{ddq}$ and $I_{leak}$ are coupled. COPOD's independent copula modeling dilutes its joint anomaly sensitivity, yielding a high False Negative Rate ($70.4\%$).
