# Stage 6 Task 3: Multi-Lot Drift Stability & Conformal Production-Gate Evaluation

**Status**: `BENCHMARK_ONLY`  
**Calibration Status**: `NOT_CALIBRATED`  
**Governance Status**: `REVIEW_REQUIRED`  
**Acceptance Threshold Status**: `NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED`  
**Contract**: `ml/prognostics/lot_stability_contract.json` (Version `1.0.0`)  
**Methodology**: `MULTI_LOT_CONFORMAL_RESIDUAL_STABILITY_EVALUATION`  

---

> [!WARNING]
> **CRITICAL GOVERNANCE DISCLAIMER**  
> Multi-lot drift stability evaluation is a benchmark/gate-review artifact only. It does not constitute production calibration, external validation, qualification, or production approval.
> 
> A model or calibration module may not be promoted to production or marked `CALIBRATED` merely because calibration and stability infrastructure exists. Formal production release requires offline physical ATE validation, empirical fab qualification, and formal committee authorization.

---

## 1. Overview & Industrial Motivation

In semiconductor manufacturing qualification, global aggregate metrics often disguise critical lot-level failure modes. A prognostic forecasting model might exhibit a seemingly acceptable aggregate test-set coverage (e.g. 84.75% empirical coverage against a 90% nominal interval), but beneath that global average, individual wafer lots subjected to thermal or equipment stress may experience severe coverage collapse.

**Stage 6 Task 3** establishes an authoritative, leakage-safe evaluation framework that:
1. Breaks down held-out empirical conformal coverage across **every individual held-out test lot (`LOT-SYN-043` through `LOT-SYN-050`, $n=800$, 100 components per lot)**.
2. Quantifies cross-lot dispersion (minimum, maximum, range, mean, and standard deviation) across all 6 supported parameter × horizon groups (`iddq@96h`, `iddq@168h`, `ileak@96h`, `ileak@168h`, `tpd@96h`, `tpd@168h`) and all 3 nominal levels (`0.80`, `0.90`, `0.95`).
3. Enforces that no arbitrary "production-ready" threshold (e.g. $\pm 5\%$) is silently fabricated. Because the repository does not authorize an empirical multi-lot acceptance boundary, the governance verdict fails closed to **`REVIEW_REQUIRED`**.

---

## 2. Four-Way Lot-Disjoint Partitioning Architecture

The four-way partition established in Stage 6 Task 1 is strictly preserved:

| Cohort Name | Lot Range | Lots Count | Component Count | Purpose / Governance Rule |
| :--- | :--- | :--- | :--- | :--- |
| **TRAIN** | `LOT-SYN-001` .. `LOT-SYN-035` | 35 | 3,500 | Point model parameter fitting |
| **VALIDATION_TUNE** | `LOT-SYN-036` .. `LOT-SYN-038` | 3 | 300 | Model selection & hyperparameter tuning |
| **CALIBRATION** | `LOT-SYN-039` .. `LOT-SYN-042` | 4 | 400 | Conformal nonconformity quantile estimation **ONLY** |
| **TEST** | `LOT-SYN-043` .. `LOT-SYN-050` | 8 | 800 | Frozen held-out multi-lot stability evaluation **ONLY** |

### Leakage & Isolation Rules:
- **Zero Test Tuning:** Test cohort observations are strictly prohibited from entering point model training, validation tuning, calibration quantile estimation, or threshold selection.
- **Model Freeze:** The point degradation model is tuned on `TRAIN + VALIDATION_TUNE` and frozen. Conformal quantiles are computed on `CALIBRATION` and frozen. Only then is the held-out `TEST` cohort evaluated.

---

## 3. Mathematical Formulation

### Per-Lot Empirical Conformal Coverage
For a specific lot $L \in \{\text{LOT-SYN-043}, \dots, \text{LOT-SYN-050}\}$, parameter $p$, horizon $h$, and nominal coverage $1 - \alpha$:

$$\hat{C}_L(p, h, 1-\alpha) = \frac{1}{|S_L|} \sum_{i \in S_L} \mathbb{I}\left(\hat{y}_i(p, h) - q_{1-\alpha} \le y_i(p, h) \le \hat{y}_i(p, h) + q_{1-\alpha}\right)$$

where $|S_L| = 100$ is the component count in lot $L$, and $q_{1-\alpha}$ is the frozen conformal quantile estimated strictly from `CALIBRATION`.

### Coverage Deviation & Absolute Deviation
$$\text{Deviation}_L = \hat{C}_L - (1 - \alpha)$$
$$\text{Absolute Deviation}_L = |\hat{C}_L - (1 - \alpha)|$$

### Cross-Lot Dispersion Statistics
Across the $K = 8$ held-out test lots:
- **Minimum Lot Coverage:** $\min_{L} \hat{C}_L$
- **Maximum Lot Coverage:** $\max_{L} \hat{C}_L$
- **Lot Coverage Range:** $\max_L \hat{C}_L - \min_L \hat{C}_L$
- **Mean Lot Coverage:** $\bar{C} = \frac{1}{K} \sum_{L=1}^K \hat{C}_L$
- **Sample Standard Deviation:** $s = \sqrt{\frac{1}{K - 1} \sum_{L=1}^K (\hat{C}_L - \bar{C})^2}$
- **Worst-Performing Lot:** $\arg\min_L \hat{C}_L$
- **Best-Performing Lot:** $\arg\max_L \hat{C}_L$

---

## 4. Governance Status & Production Gate Rules

| Evaluation Dimension | Value / Status | Governance Meaning |
| :--- | :--- | :--- |
| **Model Status** | `BENCHMARK_ONLY` | Production model weights and thresholds frozen |
| **Calibration Status** | `NOT_CALIBRATED` | Conformal intervals remain benchmark candidate only |
| **Governance Status** | `REVIEW_REQUIRED` | Requires formal engineering review; cannot auto-promote |
| **Acceptance Threshold Status** | `NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED` | No arbitrary pass/fail boundary is authorized |
| **Promotion Lock** | `ACTIVE` | Automated promotion to production is locked |

---

## 5. Unsupported Group Accounting ($3 \times 7 = 21$ Groups)

- **Forecast Origin (24h Checkpoint):** Marked `NOT_EVALUATED` across all 3 parameters. Telemetry at $t=24\text{h}$ is the early screening checkpoint from which future trajectories originate.
- **Unrecorded Horizons (48h, 72h, 120h, 144h):** Marked `DATA_UNAVAILABLE` across all 3 parameters. Fabricating synthetic data for intermediate checkpoints is strictly prohibited.
- **Evaluated Horizons (96h, 168h):** Evaluated across all 3 parameters ($3 \times 2 = 6$ supported groups).

---

## 6. Cryptographic Provenance & Lineage

All multi-lot stability benchmark runs require:
- Dataset SHA-256: `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
- Split Manifest SHA-256: Verified against `ml/data/split_manifest.json`
- Calibration Artifact SHA-256: Verified against `ml/models/production/conformal_calibration_artifacts.json`
- Production Manifest: Dynamically verified against `ml/models/production/predicta_production_manifest.json`
