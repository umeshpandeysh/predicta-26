# PREDICTA SIH 2026 — Data & Evaluation Foundation Authority Chain

## 1. System Architecture & Authority Hierarchy

Predicta enforces an explicit, machine-verifiable chain of authority for all data engineering, model training, evaluation, and production inference:

```
DATASET MANIFEST (ml/data/dataset_manifest.json)
        ↓
FEATURE CONTRACT (ml/data/feature_contract.json)
        ↓
SPLIT MANIFEST (ml/data/split_manifest.json)
        ↓
EVALUATION CONTRACT (src/evaluation/latent_trajectory.py & metrics.py)
        ↓
MODEL ARTIFACT (ml/models/production/predicta_xgboost_model.json)
        ↓
EVALUATION REPORT (experiments/latent_evaluation/latent_trajectory_report.json)
        ↓
API / DASHBOARD (src/api/server.js & frontend/script.js)
```

---

## 2. Core Authority Components

### 2.1 Dataset Manifest (`ml/data/dataset_manifest.json`)
* **Role:** Single source of truth for dataset metadata, cryptographic SHA-256 hashes, record counts, and provenance.
* **Primary Latent Trajectory Dataset:** `data/synthetic/semiconductor_synthetic_full.csv` (SHA-256: `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`)
* **Benchmark Manufacturing Dataset:** `ml/data/synthetic/predicta_dataset_v4_production.csv` (SHA-256: `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24`)
* **Scientific Disclosure:** Datasets are explicitly designated as `SYNTHETIC_PHYSICS_GROUND_TRUTH` or `SYNTHETIC_BENCHMARK`. They represent mathematically rigorous algorithmic benchmarks and are not claimed as external flight-qualified silicon without empirical calibration.

### 2.2 Feature Contract (`ml/data/feature_contract.json`)
* **Role:** Classifies every telemetry parameter into strict governance buckets:
  - `EARLY_OBSERVABLE`: Measurements available at or before the 24h screening cutoff (`iddq_0h`, `ileak_0h`, `tpd_0h`, `iddq_24h`, `ileak_24h`, `tpd_24h`, and 0-24h drift deltas).
  - `FUTURE_GROUND_TRUTH`: Measurements at t > 24h (`iddq_168h_ground_truth`, `tpd_168h_ground_truth`, `ileak_168h_ground_truth`). STRICTLY FORBIDDEN in feature matrices.
  - `IDENTIFIER`: Entity keys (`component_id`, `die_id`, `test_id`) prohibited from model inputs.
  - `METADATA`: Grouping keys (`lot_id`, `wafer_id`, `package`) used solely for disjoint splitting.
  - `TARGET`: Target labels (`latent_168h_failure`, `trajectory_state`, `result`).
  - `FORBIDDEN_LEAKAGE`: Any column with future tokens (`168`, `96`, `48`, `future`, `target`).

### 2.3 Split Manifest (`ml/data/split_manifest.json`)
* **Role:** Enforces deterministic, lot-held-out evaluation splits.
* **Partitioning:**
  - **Train (35 Lots / 3,500 Components):** `LOT-SYN-001` through `LOT-SYN-035`
  - **Validation_Tune (3 Lots / 300 Components):** `LOT-SYN-036` through `LOT-SYN-038`
  - **Calibration (4 Lots / 400 Components):** `LOT-SYN-039` through `LOT-SYN-042`
  - **Held-Out Test (8 Lots / 800 Components):** `LOT-SYN-043` through `LOT-SYN-050`
* **Disjointness Guarantee:** 100% disjoint lot and component boundaries across all four partitions.

### 2.4 Decision Threshold Governance (`src/evaluation/threshold_policy.py`)
* **Operating Standard:** Authoritative production threshold is locked at **0.20**.
* **Test Split Optimization Policy:** Optimizing decision thresholds against the held-out test partition is strictly prohibited by code assertion (`ForbiddenTestThresholdOptimizationError`). Threshold calibration is permitted solely on training or validation_tune partitions.

### 2.6 Phase 9 Cost-Sensitive Evaluation Contract (`src/evaluation/cost_contract.py` & `cost_contract.js`)
* **Role:** Establishes an authoritative, leakage-safe evaluation layer measuring screening decisions against `latent_168h_failure` ground truth.
* **Population Eligibility:** Population consists strictly of components passing 24h screening with valid 168h ground truth (`PASS_24H_FAIL_168H` vs `PASS_24H_PASS_168H`). Components with missing 168h history are classified as `INSUFFICIENT_HISTORY` and never converted into negative labels.
* **Cost Contract Configuration:**
  - `false_negative_cost`: $500.0 (escaped latent defect reaching field/flight deployment)
  - `false_positive_cost`: $100.0 (false quarantine / unnecessary extended burn-in)
  - `cost_ratio_fn_to_fp`: 5.0 : 1
  - `cost_provenance`: `PROJECT_DEFINED_SYNTHETIC_BENCHMARK`
* **Total Decision Cost Calculation:** $\text{Total Cost} = 500 \cdot \text{FN} + 100 \cdot \text{FP}$
* **Threshold Governance Policy:** Decision threshold optimization occurs exclusively on validation partitions (`validation_tune` + `calibration`). The held-out test cohort is evaluated at a frozen threshold. Optimizing thresholds against test partitions is strictly forbidden.
* **Production Status:** `BENCHMARK_ONLY` (Production XGBoost model, weights, and operating threshold `0.20` remain locked and untouched).

---

## 3. Canonical Execution Commands

| Action | Canonical Command |
| :--- | :--- |
| **Run Authoritative Evaluation** | `npm run evaluate` (or `python src/evaluation/run_evaluation.py`) |
| **Run Phase 9 Cost Evaluation** | `python src/evaluation/run_phase9_evaluation.py` |
| **Run Phase 9 Unit Test Suite** | `python -m pytest tests/test_phase9_cost_sensitive_evaluation.py -v` |
| **Run Phase 9 JS Test Suite** | `node tests/test_phase9_cost_sensitive_evaluation.js` |
| **Run Parity Test Suite** | `npm run test:parity` |
| **Run Core Regression Suite** | `npm run test:core` |
| **Run Production Release Certification** | `npm run test:release` |
