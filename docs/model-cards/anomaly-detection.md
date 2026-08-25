# Model Card: Predicta Module A (Outlier Screening)

*   **Project:** Predicta
*   **Competition:** Smart India Hackathon 2026
*   **Problem Statement:** PS 170

This model card describes the purpose, training data, and evaluation results of the dynamic anomaly detection module.

## Model Details
*   **Model Type:** Unsupervised Anomaly Detection (Robust MAD, Isolation Forest, and COPOD).
*   **Active Production Model:** Isolation Forest (Centroid Distance Proxy for static deployment).
*   **Release Version:** v1.0-beta
*   **Training Date:** 2026-08-25
*   **Parameters Processed:** absolute quiescent currents ($I_{ddq}$), gate leakages ($I_{leak}$), cell delays ($t_{pd}$), and their 24h drifts from 0h.

## Intended Use
*   **Target Domain:** Semiconductor screening and accelerated stress (burn-in) quality gates.
*   **Application:** Identifying latent microelectronic defect components at the **24h Early Screening Window**, saving up to 144 hours of physical stress cycles.
*   **Exclusions:** Not intended as a stand-alone safety gate; must be used to complement physical specification limits.

## Performance Benchmarks
Evaluated on the synthetic dataset `ps170-synthetic-v0.1` at the 24h Early Window:

| Model Algorithm | Precision | Recall | F1-Score | False Negative Rate (FNR) | False Positive Rate (FPR) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Robust MAD** | 0.595 | 0.815 | 0.688 | 0.185 | 0.019 |
| **Isolation Forest** | 0.615 | 0.889 | 0.727 | 0.111 | 0.019 |
| **COPOD** | 0.205 | 0.296 | 0.242 | 0.704 | 0.040 |

## Biases & Limitations
*   **Batch Lot Dependencies:** Outlier screening relies on lot-relative variance and requires a minimum lot size of **30 components** to calculate stable Medians and MADs.
*   **Correlation Constraints:** COPOD assumes feature independence, which reduces its recall on physically correlated parameters ($I_{ddq}$ and $I_{leak}$) compared to joint isolation trees.
