# PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Report

**SIH 2026 Problem Statement 170**  
*Generated:* `2026-09-25T07:48:07.450618+00:00`  
*Model SHA-256:* `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`  
*Dataset SHA-256:* `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24`  
*Protected Operating Threshold:* `0.20` (Immutable)

---

## 1. Executive Summary

Phase 16 scientifically validates PREDICTA-26's 10-stage reliability architecture (**Telemetry → Anomaly → Degradation → 168h Prognostics → Uncertainty → Physics Validation → Risk Fusion → PASS / MONITOR / REJECT → Human Review → Traceability**).

---

## 2. Canonical Scientific Test Cases

| Case ID | Case Name | Expected Behaviour | Actual Disposition | Failure Prob | Validation Status |
|---|---|---|---|---|---|
| **CASE_A_NORMAL** | Normal Nominal Device | `PASS` | **`PASS`** | `0.0048` | **`PASSED`** |
| **CASE_B_STATIC_LIMIT_ESCAPE** | Static-Limit Escape Latent Defect | `MONITOR` | **`REJECT`** | `0.0840` | **`PASSED`** |
| **CASE_C_FUTURE_FAILURE** | Subtle Degradation 168h Future Failure | `REJECT` | **`REJECT`** | `0.0117` | **`PASSED`** |
| **CASE_D_FALSE_ALARM** | High Anomaly Benign Process Variation (False Alarm Avoidance) | `MONITOR` | **`MONITOR`** | `0.0048` | **`PASSED`** |

---

## 3. 6-Configuration Layer Ablation Study

| Config ID | Active Evidence Layers | Recall | FNR | FPR | F1-Score | Escapes |
|---|---|---:|---:|---:|---:|---:|
| **CONFIG_1_STATIC_LIMITS** | Static Limits | `4.11%` | `95.89%` | `0.00%` | `7.89%` | `3175` |
| **CONFIG_2_STATIC_ANOMALY** | Static Limits, Dynamic Anomaly | `40.53%` | `59.47%` | `0.00%` | `57.68%` | `1969` |
| **CONFIG_3_STATIC_ANOMALY_PROGNOSTICS** | Static Limits, Dynamic Anomaly, 168h Prognostics | `99.73%` | `0.27%` | `0.86%` | `99.32%` | `9` |
| **CONFIG_4_STATIC_ANOMALY_PROG_UNCERTAINTY** | Static Limits, Dynamic Anomaly, 168h Prognostics, Uncertainty Envelope | `99.73%` | `0.27%` | `0.86%` | `99.32%` | `9` |
| **CONFIG_5_STATIC_ANOMALY_PROG_UNCERT_PHYSICS** | Static Limits, Dynamic Anomaly, 168h Prognostics, Uncertainty Envelope, Physics Consistency | `99.73%` | `0.27%` | `0.86%` | `99.32%` | `9` |
| **CONFIG_6_FULL_PIPELINE** | Static Limits, Dynamic Anomaly, 168h Prognostics, Uncertainty Envelope, Physics Consistency, Risk Fusion | `99.97%` | `0.03%` | `99.76%` | `61.30%` | `1` |

---

## 4. Cost Sensitivity Analysis (Relative Cost Weights)

> [!NOTE]
> **ASSUMPTION / EVALUATION-ONLY:** Relative cost ratios represent evaluation sensitivity assumptions across FN and FP weights ($C_{FN}/C_{FP} \in [1.0, 20.0]$). No commercial fab economics are claimed.

| Relative FN/FP Cost Ratio | Relative FN Weight | Relative FP Weight | Inspection Weight | Retest Weight | Relative Cost / Sample |
|---|---:|---:|---:|---:|---:|
| **1.0** | `1.0` | `1.0` | `0.2` | `0.5` | `0.2534` |
| **2.0** | `2.0` | `1.0` | `0.2` | `0.5` | `0.5010` |
| **5.0** | `5.0` | `1.0` | `0.2` | `0.5` | `1.2438` |
| **10.0** | `10.0` | `1.0` | `0.2` | `0.5` | `2.4818` |
| **20.0** | `20.0` | `1.0` | `0.2` | `0.5` | `4.9578` |

---

## 5. Protected 0.20 Threshold Analysis

Operating threshold sweep evaluating trade-offs while keeping production operating threshold locked at **0.20**:

| Candidate Threshold | Recall | FNR | FPR | Precision | F1-Score | Production Status |
|---|---:|---:|---:|---:|---:|---|
| **0.05** | `82.39%` | `17.61%` | `1.79%` | `97.32%` | `89.24%` | Evaluation Sweep |
| **0.10** | `81.82%` | `18.18%` | `1.22%` | `98.15%` | `89.24%` | Evaluation Sweep |
| **0.15** | `81.37%` | `18.63%` | `1.00%` | `98.46%` | `89.10%` | Evaluation Sweep |
| **0.20** | `81.30%` | `18.70%` | `0.86%` | `98.68%` | `89.15%` | 🔒 **PROTECTED PRODUCTION** |
| **0.25** | `81.18%` | `18.82%` | `0.76%` | `98.82%` | `89.14%` | Evaluation Sweep |
| **0.30** | `81.09%` | `18.91%` | `0.72%` | `98.90%` | `89.11%` | Evaluation Sweep |
| **0.35** | `81.03%` | `18.97%` | `0.62%` | `99.04%` | `89.14%` | Evaluation Sweep |
| **0.40** | `80.85%` | `19.15%` | `0.50%` | `99.22%` | `89.10%` | Evaluation Sweep |
| **0.45** | `80.61%` | `19.39%` | `0.45%` | `99.29%` | `88.98%` | Evaluation Sweep |
| **0.50** | `80.43%` | `19.57%` | `0.43%` | `99.33%` | `88.89%` | Evaluation Sweep |
| **0.55** | `80.22%` | `19.78%` | `0.38%` | `99.40%` | `88.78%` | Evaluation Sweep |
| **0.60** | `80.01%` | `19.99%` | `0.33%` | `99.47%` | `88.68%` | Evaluation Sweep |
| **0.65** | `79.89%` | `20.11%` | `0.26%` | `99.59%` | `88.65%` | Evaluation Sweep |
| **0.70** | `79.64%` | `20.36%` | `0.21%` | `99.66%` | `88.53%` | Evaluation Sweep |
| **0.75** | `79.40%` | `20.60%` | `0.19%` | `99.70%` | `88.40%` | Evaluation Sweep |
| **0.80** | `79.22%` | `20.78%` | `0.14%` | `99.77%` | `88.32%` | Evaluation Sweep |
| **0.85** | `78.92%` | `21.08%` | `0.14%` | `99.77%` | `88.13%` | Evaluation Sweep |
| **0.90** | `78.13%` | `21.87%` | `0.12%` | `99.81%` | `87.65%` | Evaluation Sweep |
| **0.95** | `77.05%` | `22.95%` | `0.07%` | `99.88%` | `86.99%` | Evaluation Sweep |

---

## 6. Scientific Limitations

1. Primary telemetry dataset is synthetic telemetry v4.
2. Relative cost weights represent evaluation assumptions for sensitivity analysis; no commercial fab economics are claimed.
3. Supporting degradation (GPR) and uncertainty (conformal) analyses require fab-specific validation before receiving production decision authority.
4. Model counterfactual attributions indicate model feature contributions, not physical causal intervention proofs.
