# PREDICTA-26 — Stage 4 Dynamic Anomaly Benchmark Report
**Generated:** 2026-09-18 16:50:26 UTC
**Authority:** Authoritative Dynamic Anomaly Engine & Production Foundation
**Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
**Split Manifest SHA-256:** `e3817e388c3481b7e8839c94afcb4696d742e22b47f8b0779cc609531f8dcf97`

---

## 1. Executive Summary & Objective
This report establishes the authoritative Stage 4 dynamic anomaly detection benchmark for early semiconductor die screening at the 24h burn-in decision point. Detectors are evaluated on canonical reliability metrics (`iddq`, `ileak`, `tpd`) under a strict lot-held-out protocol (Lots 1–35 Train, 36–42 Validation, 43–50 Test).

---

## 2. Quantitative Held-Out Test Set Performance (Frozen Thresholds)

| Detector Model | Frozen Threshold | Recall | False-Negative Rate (FNR) | Precision | F1-Score | F2-Score | ROC-AUC | PR-AUC | Specificity | Support (TP/Total) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Robust MAD (PAT)** | `2.6955` | 62.96% | 37.04% | 29.82% | 0.4048 | 0.5152 | 0.9454 | 0.2803 | 94.83% | 17/27 |
| **COPOD** | `3.9174` | 81.48% | 18.52% | 5.18% | 0.0973 | 0.2064 | 0.6853 | 0.0501 | 47.87% | 22/27 |
| **Isolation Forest** | `0.4987` | 74.07% | 25.93% | 15.38% | 0.2548 | 0.4202 | 0.8949 | 0.1888 | 85.77% | 20/27 |
| **Conservative Fusion** | `0.5000` | 88.89% | 11.11% | 5.59% | 0.1053 | 0.2235 | 0.6825 | 0.4743 | 47.61% | 24/27 |
| **Weighted Score Fusion** | `0.4665` | 62.96% | 37.04% | 15.32% | 0.2464 | 0.3881 | 0.8898 | 0.1913 | 87.84% | 17/27 |

---

## 3. Confusion Matrices Breakdown (Held-Out Test Set, N = 800)

| Detector Model | True Negatives (TN) | False Positives (FP) | False Negatives (FN) | True Positives (TP) |
| :--- | :--- | :--- | :--- | :--- |
| **Robust MAD** | 733 | 40 | 10 | 17 |
| **COPOD** | 370 | 403 | 5 | 22 |
| **Isolation Forest** | 663 | 110 | 7 | 20 |
| **Conservative Fusion** | 368 | 405 | 3 | 24 |
| **Weighted Score Fusion** | 679 | 94 | 10 | 17 |

---

## 4. Lot-Relative Behavior & Minimum Reference Governance
- **Known Lot:** Evaluated with lot-specific median and robust MAD.
- **Unseen / Missing / Undersized Lot:** Enforces strict fallback to global baseline statistics with explicit provenance tagging (`GLOBAL_FALLBACK_UNSEEN_OR_SMALL_LOT`).
- **Zero Fabrication:** The system does not fabricate lot-level statistics for lots with sample count < 10.

---

## 5. Artifact Foundation & Production Promotion Decision
- `predicta_anomaly_v2_artifacts.json` has been generated and validated.
- The existing production anomaly artifact `predicta_anomaly_artifacts.json` remains preserved for full operational backward compatibility.
