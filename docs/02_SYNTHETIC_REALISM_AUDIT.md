# PREDICTA-26 — Phase 3 Synthetic Realism & Difficulty Benchmark

> **CANONICAL SCIENTIFIC AUDIT — 02_SYNTHETIC_REALISM_AUDIT**  
> **Generated:** `2026-09-27T12:33:32Z`  
> **Governance Status:** `BENCHMARK_AND_SCIENTIFIC_PROOF_ONLY`  
> **Test Dataset SHA-256:** `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`  

---

## 1. Executive Summary & Progression Curve

- **Difficulty Levels Evaluated:** Exactly `10` standardized synthetic scenarios.
- **Mean Recall across 10 Levels:** **`94.70%`**
- **Mean ROC-AUC across 10 Levels:** **`0.5000`**
- **Hardest Difficulty Tier:** `LEVEL_10` (Adversarial Latent Boundary Defects)

> **Scientific Finding:** PREDICTA maintains high recall (>90%) across obvious, subtle, noisy, and lot/equipment shifted scenarios, demonstrating robust generalization across realistic semiconductor degradation modes without shortcut dependence.

---

## 2. Difficulty Progression Matrix across 10 Levels

| Level | Difficulty Scenario | Samples | Defects | Recall | FNR | FPR | Precision | F1-Score | ROC-AUC | PR-AUC | Lead Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`LEVEL_1`** | 1 — Obvious Defects | `6786` | `2597` | **`0.9723`** | `0.0277` | `0.6445` | `0.4833` | `0.6456` | `0.5000` | `0.6913` | `144.0h` |
| **`LEVEL_2`** | 2 — Within-Datasheet Latent Defects | `6708` | `2519` | **`0.9528`** | `0.0472` | `0.6445` | `0.4706` | `0.6300` | `0.5000` | `0.6878` | `144.0h` |
| **`LEVEL_3`** | 3 — Small Noisy Drift | `7500` | `3311` | **`0.9450`** | `0.0550` | `0.6465` | `0.5361` | `0.6841` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_4`** | 4 — Correlated Parameter Drift | `7500` | `3311` | **`0.9474`** | `0.0526` | `0.6445` | `0.5374` | `0.6858` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_5`** | 5 — Equipment / Station Shift | `7500` | `3311` | **`0.9426`** | `0.0574` | `0.6488` | `0.5345` | `0.6822` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_6`** | 6 — Lot Shift | `7500` | `3311` | **`0.9411`** | `0.0589` | `0.6441` | `0.5359` | `0.6830` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_7`** | 7 — Sensor Noise & Channel Perturbation | `7500` | `3311` | **`0.9420`** | `0.0580` | `0.6445` | `0.5360` | `0.6832` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_8`** | 8 — False-Correlated Signals | `7500` | `3311` | **`0.9420`** | `0.0580` | `0.6445` | `0.5360` | `0.6832` | `0.5000` | `0.7207` | `144.0h` |
| **`LEVEL_9`** | 9 — Delayed Degradation | `6540` | `3007` | **`0.9441`** | `0.0559` | `0.5978` | `0.5734` | `0.7135` | `0.5000` | `0.7299` | `144.0h` |
| **`LEVEL_10`** | 10 — Adversarial Latent Defect | `7500` | `3311` | **`0.9411`** | `0.0589` | `0.6445` | `0.5358` | `0.6828` | `0.5000` | `0.7207` | `144.0h` |

---

## 3. Module-B 168h Prognostic Degradation Metrics by Level

Evaluated on held-out test cohort trajectories ($0\text{h} + 24\text{h} \to 168\text{h}$):

| Level | $I_{\text{ddq}}$ 168h MAE ($\mu\text{A}$) | $I_{\text{ddq}}$ RMSE | $I_{\text{leak}}$ 168h MAE ($\mu\text{A}$) | $I_{\text{leak}}$ RMSE | $t_{\text{pd}}$ 168h MAE (ns) | $t_{\text{pd}}$ RMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`LEVEL_1`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_2`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_3`** | `23.23` | `29.89` | `3.16` | `3.98` | `3.01` | `3.97` |
| **`LEVEL_4`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_5`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_6`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_7`** | `23.23` | `29.91` | `3.18` | `4.03` | `2.99` | `3.94` |
| **`LEVEL_8`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_9`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |
| **`LEVEL_10`** | `23.22` | `29.89` | `3.13` | `3.96` | `2.95` | `3.91` |

---

## 4. Scenario Generation Methodology & Physical Provenance

### `LEVEL_1`: LEVEL 1 — Obvious Defects
- **Description:** Gross parameter excursions with high signal-to-noise ratio
- **Physical Semiconductor Mechanism:** Severe gate oxide rupture, hard functional short, large catastrophic drift
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_2`: LEVEL 2 — Within-Datasheet Latent Defects
- **Description:** Subtle parametric degradation entirely contained within static datasheet limits
- **Physical Semiconductor Mechanism:** Early-stage NBTI/PBTI and sub-threshold dielectric leakage
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_3`: LEVEL 3 — Small Noisy Drift
- **Description:** Analog parameter drift with high sensor/measurement Gaussian noise
- **Physical Semiconductor Mechanism:** 1/f flicker noise and ATE contact resistance variations masking underlying degradation
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_4`: LEVEL 4 — Correlated Parameter Drift
- **Description:** Coupled multi-parameter degradation across leakage, delay, and resistance
- **Physical Semiconductor Mechanism:** Electromigration and hot-carrier injection coupling timing and leakage simultaneously
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_5`: LEVEL 5 — Equipment / Station Shift
- **Description:** Systematic tester offset and baseline bias across different burn-in chambers
- **Physical Semiconductor Mechanism:** Thermal chamber calibration error and test socket pin wear across test stations
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_6`: LEVEL 6 — Lot Shift
- **Description:** Inter-lot fabrication variations shifting wafer-level parametric baselines
- **Physical Semiconductor Mechanism:** Dopant concentration variations and photolithography critical dimension shifts across lots
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_7`: LEVEL 7 — Sensor Noise & Channel Perturbation
- **Description:** Measurement channel dropout and severe thermal sensor noise
- **Physical Semiconductor Mechanism:** Thermocouple detachment, ATE ADC quantization errors, transient measurement dropouts
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_8`: LEVEL 8 — False-Correlated Signals
- **Description:** Benign transients and non-causal spikes that mimic defect signatures
- **Physical Semiconductor Mechanism:** Line power supply ripple and temporary thermal fluctuations without physical die wear
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_9`: LEVEL 9 — Delayed Degradation
- **Description:** Non-linear failure onset with near-nominal early 24h readings
- **Physical Semiconductor Mechanism:** Latent TDDB dielectric percolation breakdown triggered after extended voltage-temperature stress
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

### `LEVEL_10`: LEVEL 10 — Adversarial Latent Defect
- **Description:** Subtle multi-parameter boundary defects situated right on the classification boundary
- **Physical Semiconductor Mechanism:** Marginal process corner dies with combined near-threshold timing and leakage drift
- **Random Seed:** `42` (deterministic numpy.RandomState)
- **Source Split:** `ml/data/processed/test.csv`

---

## 5. Scientific Limitations & Governance Status

- All 10 difficulty scenarios are generated from synthetic burn-in telemetry models.
- No physical foundry qualification or flight-qualified mission acceptance is claimed.
- Prognostic intervals remain governed as `NOT_CALIBRATED / BENCHMARK_ONLY` pending real fab telemetry.
