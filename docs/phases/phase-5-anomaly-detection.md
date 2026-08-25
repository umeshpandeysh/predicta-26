# Phase 5: Module A Outlier Screening

This document audits the dynamic multi-parameter outlier detectors evaluated at the 24h early screening point.

## 1. Outlier Screening Math
*   **Robust MAD:** Analyzes individual parameters, rejecting components with z-scores exceeding the `8.5` Prototype Engineering Threshold.
*   **Isolation Forest:** Constructs random trees to isolate multivariate anomalies ($I_{ddq}$, $I_{leak}$, $t_{pd}$ combined).
*   **COPOD:** Leverages empirical copula tails to calculate outlier probabilities.

## 2. Experimental Benchmarks
Isolation Forest won the screening benchmark:

| Algorithm Model | Recall | Precision | False Negative Rate (FNR) |
| :--- | :--- | :--- | :--- |
| **Robust MAD Baseline** | 81.5% | 59.5% | 18.5% |
| **Isolation Forest (Active)** | **88.9%** | **61.5%** | **11.1%** |
| **COPOD Unsupervised** | 29.6% | 20.5% | 70.4% |
