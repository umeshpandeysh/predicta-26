# Phase 6: Module B & Decision Engine

This document details the Gaussian Process Regression prediction model, safety thresholds, and unified routing logic.

## 1. Module B Prediction Math
*   **GPR Regression:** Interpolates 168h timing values using $0\text{h}$ and $24\text{h}$ points with an RBF prior kernel.
*   **Uncertainty Bands:** Calculates the posterior predictive standard deviation ($\sigma_*$) to establish a 95% confidence interval boundary:
    $$CI_{95\%} = \hat{y} \pm 1.96 \cdot \sigma_*$$

## 2. Unified Safety Decision Matrix
*   **PASS:** Component is statistically normal within the lot and predicted to remain stable.
*   **MONITOR:** Normal mean drift but upper confidence interval bound crosses specification limits (representing high prediction uncertainty).
*   **REJECT:** Flagged as a Module A outlier ($>8.5$ Z-score) OR GPR predicted mean crosses specification limits.
