# PREDICTA-26 — GPR Artifact Lineage & Provenance Specification

## 1. Executive Summary

This document establishes the verified cryptographic lineage, training origin, lot partitioning, and numerical reproducibility status for the runtime Gaussian Process Regression (GPR) degradation forecasting artifact in PREDICTA-26.

---

## 2. Artifact Identification & Lineage Ledger

| Lineage Attribute | Verified Value |
| :--- | :--- |
| **Artifact Path** | `ml/models/production/predicta_gpr_kernel_artifacts.json` |
| **Mirror Path** | `ml/models/predicta_gpr_kernel_artifacts.json` |
| **Model Version** | `2.2_calibrated_gpr_3way_split` |
| **Model Type** | `GaussianProcessRegressor_Calibrated` |
| **Kernel Specification** | `RBF(length_scale=1.2) + WhiteKernel(noise_level=0.02)` |
| **Artifact SHA-256** | `1D5FD207ECBD8FED31C09C9E0E8F4655B72F2596BA6C9FAF421C7D54FD6A3FCF` |
| **Historical Trainer Origin** | Commit `1971e8d0807977e641f876cac10cb1ef39224254` |
| **Preserved Historical Trainer** | `ml/training/legacy/train_calibrated_gpr_split.js.historical` |
| **Historical Training Dataset** | `data/synthetic/semiconductor_synthetic_full.csv` (Commit `7476c4cc14c9e7012367c404e312f9f3219210b3`) |
| **Dataset Record Count** | 5,000 components (20,000 telemetry rows across 0h, 24h, 48h, 168h checkpoints) |
| **Lot Partitioning Contract** | `strict_lot_split_train_001_030_calibration_031_035_test_036_050` |
| **Train Lots** | `LOT-SYN-001` through `LOT-SYN-030` ($N = 3,000$ components) |
| **Calibration Lots** | `LOT-SYN-031` through `LOT-SYN-035` ($N = 500$ components) |
| **Final Test Lots** | `LOT-SYN-036` through `LOT-SYN-050` ($N = 1,500$ components) — Untouched |
| **Runtime Contract** | `support_x_alpha_K_inv_full_matrix` (60 support points per parameter) |
| **Modeled Parameters** | `iddq`, `ileak`, `tpd` |
| **Provenance Classification** | `REPRODUCIBLE_HISTORICAL_LINEAGE` |

---

## 3. Mathematical Formulation & Runtime Contract

For each parameter $p \in \{\text{IDDQ}, I_{\text{leak}}, t_{\text{pd}}\}$, the GPR forecaster predicts degradation $\Delta p_{168} = p_{168} - p_{24}$ from early measurements $\mathbf{x} = [p_0, p_{24}, p_{24} - p_0]^T$:

1. **Standardization:**
   $$\tilde{\mathbf{x}} = \frac{\mathbf{x} - \boldsymbol{\mu}_x}{\boldsymbol{\sigma}_x}$$

2. **Kernel Vector Evaluation:**
   $$k_i = \sigma_f^2 \exp\left(-\frac{\|\tilde{\mathbf{x}} - \tilde{\mathbf{s}}_i\|^2}{2 \ell^2}\right), \quad i = 1, \dots, 60$$

3. **Mean Prediction:**
   $$\Delta \hat{p}_{168} = \mu_y + \sigma_y \sum_{i=1}^{60} \alpha_i k_i, \quad \hat{p}_{168} = p_{24} + \Delta \hat{p}_{168}$$

4. **Uncertainty & Calibrated Variance:**
   $$\sigma^2_{\text{norm}} = \max\left(10^{-6}, \sigma_f^2 + \sigma_n^2 - \mathbf{k}^T \mathbf{K}^{-1} \mathbf{k}\right)$$
   $$\sigma_{\text{total}} = \sqrt{\sigma_{\text{norm}}^2 \sigma_y^2 + \sigma_{\text{obs}}^2}$$

---

## 4. Reproducibility Verification Proof

Exact numerical byte equivalence was demonstrated by evaluating the preserved historical training algorithm against the preserved `data/synthetic/semiconductor_synthetic_full.csv` dataset:
- Total train components parsed: $3,000$
- Total calibration components parsed: $500$
- Computed parameters (`iddq`, `ileak`, `tpd`) matched `ml/models/production/predicta_gpr_kernel_artifacts.json` with zero discrepancy ($0.000000$ delta across all support points, alphas, $K^{-1}$ matrix entries, and $\sigma_{\text{obs}}$ values).

---

## 5. Architectural Authority Declaration

1. **Runtime Execution:** The active API inference engine (`src/api/inference.js`, `src/api/inference_service.py`) and prognostic trajectory engine (`src/prognostics/trajectory.js`, `src/prognostics/trajectory.py`) consume the pre-computed GPR kernel artifact (`ml/models/production/predicta_gpr_kernel_artifacts.json`) to perform in-process degradation forecasting without server-side model retraining.
2. **Prognostic Authority:** GPR degradation forecasts provide lead-time degradation indications and physical drift forecasting. In the SIH evaluation context, conformal intervals and prognostic bounds operate as `BENCHMARK_PROGNOSTIC_COMPONENT` under synthetic evaluation datasets without external commercial fab calibration claims.

---

## 6. Cryptographic Manifest Binding & Enforcement Boundary

1. **Manifest Binding:** The GPR artifact is cryptographically bound in `ml/models/production/predicta_production_manifest.json` under `models.drift_forecasting.sha256` with value `1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf`.
2. **Governance Enforcement Boundary:** Cryptographic SHA-256 verification is enforced at the release certification and artifact governance layer (`tests/test_gpr_provenance.js`, `tests/test_artifact_governance.js`). The validator reads the exact file bytes directly without JSON re-serialization, verifies existence and resolved paths, and fails closed upon any missing field or hash mismatch.
3. **Runtime Scope:** In-process inference consumes the validated artifact without incurring repetitive per-request cryptographic hashing overhead, preserving deterministic low-latency execution while ensuring strict upstream release gate certification.
