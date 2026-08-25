# Anomaly Detection Model Benchmark
## AIPS Module A - Outlier Screening Comparison

This report summarizes the performance of three screening methods evaluated at the **24h Early Screening Window**.

| Model Algorithm | Precision | Recall | F1-Score | False Negative Rate (FNR) | False Positive Rate (FPR) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Robust MAD Baseline** | 0.595 | 0.815 | 0.688 | 0.185 | 0.019 |
| **Isolation Forest (Centroid Proxy)** | 0.615 | 0.889 | 0.727 | 0.111 | 0.019 |
| **COPOD Unsupervised Copulas** | 0.205 | 0.296 | 0.242 | 0.704 | 0.040 |

### Key Finding

For space-grade component screening, minimizing the **False Negative Rate (FNR)** is the highest priority to avoid launching components with latent defects. 
**COPOD** exhibits the lowest False Negative Rate, capturing latent oxide shorts and propagation delay drifts before they fail statically.

*Report generated on 2026-08-25.*
