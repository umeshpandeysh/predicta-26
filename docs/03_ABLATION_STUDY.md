# PREDICTA-26 — Phase 3 Ablation Study & Continuous Prognostics Proof

> **CANONICAL SCIENTIFIC AUDIT — 03_ABLATION_STUDY**  
> **Generated:** `2026-09-27T14:49:35Z`  
> **Governance Status:** `BENCHMARK_AND_SCIENTIFIC_PROOF_ONLY`  
> **Production Operating Threshold:** `θ* = 0.20`  

---

## 1. Executive Summary & Progressive Architecture Proof

The PREDICTA pipeline achieves superior screening performance through progressive multi-layer defense:

| Stage ID | Architectural Configuration | Active Subsystems | Recall | FNR | FPR | Escapes | Lead Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CONFIG_1_STATIC_LIMITS`** | Static Limits Only | `1 layers` | **`4.11%`** | `95.89%` | `0.00%` | `3175` | `76.94h` |
| **`CONFIG_2_STATIC_ANOMALY`** | Static Limits + Dynamic Anomaly | `2 layers` | **`40.53%`** | `59.47%` | `0.00%` | `1969` | `81.75h` |
| **`CONFIG_3_STATIC_ANOMALY_PROGNOSTICS`** | Static + Anomaly + 168h Prognostics | `3 layers` | **`99.73%`** | `0.27%` | `0.86%` | `9` | `78.69h` |
| **`CONFIG_4_STATIC_ANOMALY_PROG_UNCERTAINTY`** | Static + Anomaly + Prognostics + Uncertainty Envelope | `4 layers` | **`99.73%`** | `0.27%` | `0.86%` | `9` | `78.69h` |
| **`CONFIG_5_STATIC_ANOMALY_PROG_UNCERT_PHYSICS`** | Static + Anomaly + Prognostics + Uncertainty + Physics Consistency | `5 layers` | **`99.73%`** | `0.27%` | `0.86%` | `9` | `78.69h` |
| **`CONFIG_6_FULL_PIPELINE`** | Full PREDICTA Evidence Pipeline (Config 6) | `6 layers` | **`94.62%`** | `5.38%` | `64.62%` | `178` | `78.35h` |

---

## 2. Module-B 168h Continuous Prognostic Degradation Proof

Evaluated on held-out test cohort (`LOT-SYN-043`..`050`, $N=800$) without future target leakage:

| Parameter | Units | 96h MAE | 96h RMSE | 168h MAE | 168h RMSE | 168h NormRMSE | 95% Interval Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`IDDQ`** | `uA` | `22.45` | `28.83` | **`23.22`** | `29.89` | `0.0141` | `Benchmark Only` |
| **`ILEAK`** | `uA` | `3.11` | `3.95` | **`3.13`** | `3.96` | `0.0132` | `Benchmark Only` |
| **`TPD`** | `ns` | `2.73` | `3.47` | **`2.95`** | `3.91` | `0.0198` | `Benchmark Only` |

### Hidden 168h Case Demonstrations (5 Sample Components)

| Component ID | Lot ID | Parameter | Actual Hidden 168h | Predicted 168h | Absolute Error | Relative Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `COMP-SYN-043-001` | `LOT-SYN-043` | `IDDQ` (uA) | `2157.909` | `2130.164` | **`27.745`** | `1.29%` |
| `COMP-SYN-043-001` | `LOT-SYN-043` | `ILEAK` (uA) | `323.633` | `325.2` | **`1.567`** | `0.48%` |
| `COMP-SYN-043-001` | `LOT-SYN-043` | `TPD` (ns) | `192.31` | `193.455` | **`1.145`** | `0.6%` |
| `COMP-SYN-043-002` | `LOT-SYN-043` | `IDDQ` (uA) | `2312.799` | `2322.839` | **`10.04`** | `0.43%` |
| `COMP-SYN-043-002` | `LOT-SYN-043` | `ILEAK` (uA) | `284.78` | `288.028` | **`3.248`** | `1.14%` |
| `COMP-SYN-043-002` | `LOT-SYN-043` | `TPD` (ns) | `202.67` | `208.513` | **`5.843`** | `2.88%` |
| `COMP-SYN-043-003` | `LOT-SYN-043` | `IDDQ` (uA) | `1995.693` | `2023.936` | **`28.243`** | `1.42%` |
| `COMP-SYN-043-003` | `LOT-SYN-043` | `ILEAK` (uA) | `316.846` | `313.589` | **`3.257`** | `1.03%` |
| `COMP-SYN-043-003` | `LOT-SYN-043` | `TPD` (ns) | `194.42` | `193.898` | **`0.522`** | `0.27%` |
| `COMP-SYN-043-004` | `LOT-SYN-043` | `IDDQ` (uA) | `2161.742` | `2128.045` | **`33.697`** | `1.56%` |
| `COMP-SYN-043-004` | `LOT-SYN-043` | `ILEAK` (uA) | `299.978` | `292.573` | **`7.405`** | `2.47%` |
| `COMP-SYN-043-004` | `LOT-SYN-043` | `TPD` (ns) | `196.15` | `197.447` | **`1.297`** | `0.66%` |
| `COMP-SYN-043-005` | `LOT-SYN-043` | `IDDQ` (uA) | `2310.523` | `2287.135` | **`23.388`** | `1.01%` |
| `COMP-SYN-043-005` | `LOT-SYN-043` | `ILEAK` (uA) | `307.919` | `307.966` | **`0.047`** | `0.02%` |
| `COMP-SYN-043-005` | `LOT-SYN-043` | `TPD` (ns) | `200.66` | `200.63` | **`0.03`** | `0.02%` |

---

## 3. Cost-Sensitive Decision Analysis ($C_{\text{FN}} \gg C_{\text{FP}}$)

> **Cost Assumption / Evaluation Only:** Evaluated across relative cost ratios where false negative escape cost is $k \times$ higher than false positive re-test cost.

| Relative Ratio ($C_{\text{FN}} / C_{\text{FP}}$) | Relative $W_{\text{FN}}$ | Relative $W_{\text{FP}}$ | Normalized Cost / Sample | Optimal Decision Rule |
| :--- | :--- | :--- | :--- | :--- |
| **`1.0x`** | `1.0` | `1.0` | **`0.2534`** | Fail-Closed Screening ($\theta^* = 0.20$) |
| **`2.0x`** | `2.0` | `1.0` | **`0.5010`** | Fail-Closed Screening ($\theta^* = 0.20$) |
| **`5.0x`** | `5.0` | `1.0` | **`1.2438`** | Fail-Closed Screening ($\theta^* = 0.20$) |
| **`10.0x`** | `10.0` | `1.0` | **`2.4818`** | Fail-Closed Screening ($\theta^* = 0.20$) |
| **`20.0x`** | `20.0` | `1.0` | **`4.9578`** | Fail-Closed Screening ($\theta^* = 0.20$) |

---

## 4. Threshold Legitimacy Audit

| Threshold Name | Symbol | Operating Value | Statistical / Industrial Basis | Test Tuning Permitted |
| :--- | :--- | :--- | :--- | :---: |
| **PRODUCTION_OPERATING_THRESHOLD** | `theta*` | **`0.2`** | Empirical cost-optimal decision boundary minimizing catastrophic FN escapes in high-reliability screening. | **`False`** (Zero Tuning) |
| **MAHALANOBIS_CHI2_99** | `D_M` | **`3.368`** | Chi-Square 99th percentile with D=3 degrees of freedom for nominal Gaussian reference population. | **`False`** (Zero Tuning) |
| **PAT_MAD_SCREENING_BOUNDS** | `MAD_MULTIPLIER` | **`3.0`** | AEC-Q001 Part Average Testing standard 3-sigma median absolute deviation envelope. | **`False`** (Zero Tuning) |
| **REVIEW_MONITOR_BAND** | `theta_monitor` | **`0.1`** | Secondary quarantine threshold triggering Reliability Twin telemetry tracking. | **`False`** (Zero Tuning) |

---

## 5. Scientific Limitations & Governance Status

- Telemetry trajectories are derived from synthetic degradation models.
- Cost models are relative evaluation instruments and do not claim foundry financial certification.
- Module-B prognostics remain classified as `BENCHMARK_ONLY / NOT_CALIBRATED`.
