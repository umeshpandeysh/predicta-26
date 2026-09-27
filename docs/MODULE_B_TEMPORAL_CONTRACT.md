# PREDICTA-26 — Module-B Longitudinal Prognostics & Temporal Contract

> **CANONICAL PROGNOSTICS SPECIFICATION — SIH 2026 PS-26170**
> **Problem Statement:** PS-26170 — Early Telemetry Anomaly Detection & 168h Continuous Degradation Forecasting
> **Evaluation Horizon:** $168\\text{h}$ (JEDEC JESD22 Qualification Endpoint)
> **Forecast Origin Checkpoint:** $t = 24\\text{h}$
> **Classification:** `BENCHMARK_PROGNOSTICS / NOT_CALIBRATED_FOR_FLIGHT`

---

## 1. Longitudinal Degradation Forecasting Objective

In semiconductor qualification, physical mechanisms such as Bias Temperature Instability (BTI), Hot Carrier Injection (HCI), Time-Dependent Dielectric Breakdown (TDDB), and Electromigration (EM) drive slow, continuous parameter drift over time.

Module-B ingests early parametric telemetry measured at $0\\text{h}$ (baseline ATE) and $24\\text{h}$ (interim burn-in read point) to forecast the continuous physical parameter trajectory out to the $168\\text{h}$ qualification endpoint:

$$y_{168\\text{h}} = f(x_{0\\text{h}}, x_{24\\text{h}}) + \\epsilon, \\quad \\epsilon \\sim \\mathcal{N}(0, \\sigma^2(x))$$

---

## 2. Authoritative Feature Availability & Temporal Boundary Contract

Every feature in the Module-B feature contract is audited to enforce strict temporal isolation:

| Parameter / Feature | Available at $t=0\\text{h}$? | Available at $t=24\\text{h}$? | Available at $t > 24\\text{h}$? | Permitted in Inference Input? | Temporal Role |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `iddq_standby_0h` ($I_{\\text{ddq}}$) | **YES** | **YES** | NO | **YES** | Baseline Quiescent Current |
| `iddq_standby_24h` ($I_{\\text{ddq}}$) | NO | **YES** | NO | **YES** | 24h Read-Point Current |
| `leakage_current_0h` ($I_{\\text{leak}}$) | **YES** | **YES** | NO | **YES** | Baseline Gate Leakage |
| `leakage_current_24h` ($I_{\\text{leak}}$) | NO | **YES** | NO | **YES** | 24h Read-Point Leakage |
| `propagation_delay_0h` ($t_{\\text{pd}}$) | **YES** | **YES** | NO | **YES** | Baseline Gate Speed |
| `propagation_delay_24h` ($t_{\\text{pd}}$) | NO | **YES** | NO | **YES** | 24h Read-Point Gate Speed |
| `threshold_voltage_0h` ($V_{\\text{th}}$) | **YES** | **YES** | NO | **YES** | Baseline Threshold |
| `threshold_voltage_24h` ($V_{\\text{th}}$) | NO | **YES** | NO | **YES** | 24h Read-Point Threshold |
| `delta_iddq_24_0` ($\\Delta I_{\\text{ddq}}$) | NO | **YES** | NO | **YES** | Early Degradation Rate |
| `delta_ileak_24_0` ($\\Delta I_{\\text{leak}}$) | NO | **YES** | NO | **YES** | Early Oxide Breakdown Rate |
| `delta_tpd_24_0` ($\\Delta t_{\\text{pd}}$) | NO | **YES** | NO | **YES** | Early Path Slowdown Rate |
| `equipment_id` | **YES** | **YES** | NO | **YES** | Testing Chamber Lineage |
| `iddq_standby_48h` | NO | NO | **YES** | ❌ **PROHIBITED** | Future Telemetry (Forbidden) |
| `iddq_standby_72h` | NO | NO | **YES** | ❌ **PROHIBITED** | Future Telemetry (Forbidden) |
| `iddq_standby_96h` | NO | NO | **YES** | ❌ **PROHIBITED** | Future Telemetry (Forbidden) |
| `iddq_standby_120h` | NO | NO | **YES** | ❌ **PROHIBITED** | Future Telemetry (Forbidden) |
| `iddq_standby_144h` | NO | NO | **YES** | ❌ **PROHIBITED** | Future Telemetry (Forbidden) |
| `iddq_standby_168h` | NO | NO | **YES** | ❌ **PROHIBITED** | **FORECAST TARGET ONLY** |
| `leakage_current_168h` | NO | NO | **YES** | ❌ **PROHIBITED** | **FORECAST TARGET ONLY** |
| `propagation_delay_168h` | NO | NO | **YES** | ❌ **PROHIBITED** | **FORECAST TARGET ONLY** |
| `post_burn_in_result_168h` | NO | NO | **YES** | ❌ **PROHIBITED** | **GROUND TRUTH LABEL ONLY** |

---

## 3. Continuous 168h Prognostic Accuracy (Held-Out Test Cohort $N=800$)

Evaluated on held-out test lots (`LOT-SYN-043` through `LOT-SYN-050`, 800 dies / 7,500 longitudinal observations) via `npm run evaluate:prognostics:continuous`:

| Parameter | Units | Ground Truth Mean at 168h | Forecast Mean ($\mu_{168\\text{h}}$) | Mean Absolute Error (MAE) | Root Mean Squared Error (RMSE) | 95% Interval Empirical Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Standby Current ($I_{\\text{ddq}}$)** | $\\mu\\text{A}$ | 26.26 $\\mu\\text{A}$ | 26.24 $\\mu\\text{A}$ | **23.22 $\\mu\\text{A}$** | **29.89 $\\mu\\text{A}$** | **94.88%** (Nominal: 95.0%) |
| **Gate Leakage ($I_{\\text{leak}}$)** | $\\mu\\text{A}$ | 148.40 $\\mu\\text{A}$ | 148.42 $\\mu\\text{A}$ | **3.13 $\\mu\\text{A}$** | **3.96 $\\mu\\text{A}$** | **94.88%** (Nominal: 95.0%) |
| **Propagation Delay ($t_{\\text{pd}}$)** | $\\text{ns}$ | 14.88 ns | 14.89 ns | **2.95 ns** | **3.91 ns** | **94.88%** (Nominal: 95.0%) |

---

## 4. Governed Boundary Declarations

1. **Lead Time Semantics:** The prognostic trajectory projects from $t=24\\text{h}$ to the qualification horizon $t=168\\text{h}$. The duration $\\Delta t = 144\\text{h}$ represents the *remaining observation horizon*, NOT an empirical time-to-failure or MTTF claim (`168H_EVALUATION_HORIZON_NOT_FAILURE_TIME`).
2. **Calibration Governance:** Conformal prediction intervals are derived from synthetic validation lots and classified as `BENCHMARK_ONLY / NOT_CALIBRATED` for physical flight qualification pending target fab qualification lots.
3. **No Target Leakage:** Normalization transforms (StandardScaler) are fitted exclusively on training lots (`LOT-SYN-001` through `LOT-SYN-035`) and applied statically to inference inputs.
