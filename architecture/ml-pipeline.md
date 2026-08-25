# Machine Learning Pipeline Map

This document describes the offline training and online inference execution flows for the machine learning modules.

---

## 1. Offline Training & Calibration Pipeline

Since true labeled failures are extremely rare, the anomaly detection module is calibrated in an unsupervised manner, and the drift prediction model uses physics-informed constraints:

```text
[ Proxy / Historical Data ] ──► Data Ingest ──► Validate Units ──► Impute Missing
                                                                          │
                                                                          ▼
[ Offline Feature Engineering ] ◄──────────────────────────────── Robust Scaling
  - Extract delta shifts (24h - 0h)
  - Compute log scale of leakage currents
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [ Model Calibration: A ]              [ Model Calibration: B ]
     - Ingest normal lot parameters        - Calibrate GPR prior kernel
     - Train COPOD Copula dependencies      - Fit power-law exponent (n ~ 0.2)
     - Establish lot anomaly thresholds     - Tune hyperparameters via MLE
            │                                     │
            ▼                                     ▼
   Pickle: models/anomaly/copod.pkl      Pickle: models/drift/gpr.pkl
```

---

## 2. Online Inference Pipeline

During active screening on the test bench, components are processed sequentially or in batch lots:

```text
         [ Live ATE Lot Measurements (N >= 30) ]
                            │
                            ▼
                  Standardize Lot Batch
          (using current lot's Median and MAD)
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
     Load copod.pkl                  Load gpr.pkl
            │                               │
            ▼                               ▼
    Evaluate Anomaly Score           Predict Mean & Variance
    & Feature Attributions           at 168h test point
            │                               │
            └───────────────┬───────────────┘
                            ▼
                    Combined Decisions
           Check lot limits & safety slopes
                            │
                            ▼
                 PASS / MONITOR / REJECT
```
