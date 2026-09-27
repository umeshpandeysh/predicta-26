# PREDICTA-26 — Hidden Test Integrity & Partition Provenance

> **CANONICAL SCIENTIFIC GOVERNANCE AUDIT — SIH 2026 PS-26170**
> **Authoritative Baseline Commit:** `9c1880d0fe50077b390eea22f4fb545ff9044a74`
> **Production Operating Threshold:** `θ* = 0.20 (LOCKED_IMMUTABLE)`
> **Test Partition SHA-256:** `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`
> **Dataset Provenance SHA-256:** `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24`

---

## 1. Executive Question & Guarantee

### "How do you prove the locked test set was not indirectly tuned, leaked, or snooped?"

In high-reliability semiconductor qualification (PS-26170), evaluating statistical models against contaminated or indirectly tuned test partitions creates dangerous, unquantifiable escape risks.

This document establishes the **cryptographic, programmatic, and historical proof** that PREDICTA-26 enforces absolute isolation between model development (Training / Validation) and final benchmark verification (Locked Held-Out Test Split).

---

## 2. Authoritative Multi-Stage Provenance Chain

```text
                                RAW SYNTHETIC DATASET
             [ml/data/synthetic/predicta_dataset_v4_production.csv]
                   (50,000 records, 48 features, 16.7 MB)
            SHA-256: 9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24
                                      │
                                      ▼
                      LOT-LEVEL DISJOINT PARTITIONING
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
    TRAINING SPLIT            VALIDATION SPLIT              TEST SPLIT (LOCKED)
  [ml/data/processed/        [ml/data/processed/          [ml/data/processed/
       train.csv]               validation.csv]                test.csv]
    32,500 samples             10,000 samples               7,500 samples
     (65.0% total)              (20.0% total)               (15.0% total)
  Lots: LOT-001..013         Lots: LOT-014..017           Lots: LOT-018..020
  SHA: 7a9c81b2...           SHA: 820c4f1a...             SHA: 413ec0b7...
         │                            │                            │
         ▼                            │                            │
  FEATURE SCALING &           HYPERPARAMETER TUNING                │
  MODEL WEIGHT FITTING        & COST-SENSITIVE THRESHOLD           │
  (StandardScaler +           SWEEP (θ* = 0.20 Selected)           │
   Native XGBoost 300 Trees)          │                            │
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
                        CRYPTOGRAPHIC LOCK & FREEZE
                    • Model: predicta_xgboost_model.json
                      SHA-256: 91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98
                    • Threshold: θ* = 0.20 (LOCKED)
                    • Feature Contract: 28 Continuous Features
                                      │
                                      ▼
                        ONE-TIME FINAL BENCHMARK
                     [npm run benchmark:ps26170]
                   (Evaluated on frozen test.csv)
                                      │
                                      ▼
                        CANONICAL SCIENTIFIC REPORT
                   [docs/01_PS26170_FINAL_BENCHMARK.md]
                   Recall: 94.62% | FNR: 5.38% | ROC-AUC: 0.9631
```

---

## 3. Stage-by-Stage Governance & Audit Matrix

| Pipeline Stage | Dataset / File | Cryptographic SHA-256 | Test Partition Accessible? | Model Selection Occurred? | Threshold Tuning Occurred? | Governance Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1. Source Dataset** | `predicta_dataset_v4_production.csv` | `9a8367a96a7d...` | NO (Unsplit) | NO | NO | **AUDITED_SOURCE** |
| **2. Training Split** | `train.csv` (32,500 dies) | `7a9c81b2d41a...` | NO (Disjoint) | YES (Fitting) | NO | **FROZEN_TRAIN** |
| **3. Validation Split** | `validation.csv` (10,000 dies) | `820c4f1ae092...` | NO (Disjoint) | YES (Tuning) | YES ($\theta^*=0.20$) | **FROZEN_VALIDATION** |
| **4. Feature Contract** | `StandardScaler` (28 Features) | *Fitted on Train only* | NO | NO | NO | **LOCKED_CONTRACT** |
| **5. Model Weight Lock**| `predicta_xgboost_model.json` | `91bb598ae911...` | NO | FROZEN | LOCKED | **PRODUCTION_PRIMARY** |
| **6. Test Split Lock** | `test.csv` (7,500 dies) | `413ec0b7a517...` | **LOCKED** | **FORBIDDEN** | **FORBIDDEN** | **HELD_OUT_TEST** |
| **7. Final Evaluation** | `ps26170_final_benchmark.py` | *Dynamic Execution* | YES (Evaluation Only) | NO | NO | **ONE_TIME_EVAL** |

---

## 4. Programmatic Audit for Indirect Tuning & Snooping

We performed a deep repository search across all scripts, experiment directories, and evaluation runners for indirect snooping:

1. **Test-Set Threshold Sweeps:**
   - Evaluated via `src/evaluation/cost_contract.py` (`ThresholdPolicy.assert_split_allowed_for_optimization`).
   - Any attempt to optimize thresholds on `held_out_test` or `test.csv` immediately raises `ForbiddenTestThresholdOptimizationError`.
2. **Test-Set Feature Selection:**
   - The 28-feature engineering contract was defined strictly based on physical domain principles (Arrhenius, Black's EM, voltage/frequency ratios) and fitted using `train.csv` summary statistics.
3. **Synthetic Realism Difficulty Tuning:**
   - Evaluated in `src/evaluation/evaluate_synthetic_realism_benchmark.py`. The 10 difficulty tiers are evaluated as *post-lock controlled transformations* to test robustness, and never feedback into model training.
4. **Historical Experiment Classification:**
   - Exploratory scripts (e.g. Phase 9, Day 12 exploratory scripts) are explicitly bannered and cataloged as `HISTORICAL_EXPLORATORY`. None of these scripts overwrite or mutate the authoritative production model artifact or test set.

---

## 5. Explicit Guarantees for Reviewers & Judges

1. **Zero Data Snooping:** The test set was touched only after the 300-tree native XGBoost model, the 28-feature scaler, and the $\theta^* = 0.20$ operating threshold were completely frozen.
2. **Zero Information Leakage:** Future time-series features ($t > 24\text{h}$) are strictly excluded from the 28-feature contract (0 future tokens present).
3. **Zero Post-Hoc Fudging:** All metrics reported in canonical documentation are generated dynamically from executable benchmark scripts, matching the exact numbers in `experiments/benchmarks/01_ps26170_final_benchmark.json`.
