# LEGACY — Archived JavaScript GBDT Trainers

> **DO NOT USE THESE FILES IN PRODUCTION**

These files implement a **custom Fast Histogram Gradient Boosted Decision Tree** (GBDT) trainer written entirely in JavaScript. They are **NOT** native XGBoost and **must not** be used as a substitute.

## Files Archived Here

| File | Description |
|------|-------------|
| `train_real_xgboost.js.legacy` | Custom JavaScript Fast Histogram GBDT (500 trees). NOT native XGBoost. Generates the same artifact paths as the native pipeline — running this file would overwrite the production model with a non-XGBoost artifact. |
| `train_xgboost_v1.js.legacy` | Older version of the custom JavaScript GBDT trainer. Same caveats apply. |

## Current Production Pipeline

The **authoritative production training pipeline** is:

```
ml/training/train_native_xgboost.py
```

This uses the **genuine native XGBoost library** (`import xgboost as xgb`) trained on the **Synthetic Semiconductor Dataset** (`predicta_dataset_v3_50000.csv`, 50,000 records).

Run via:
```bash
python ml/training/train_native_xgboost.py
# or
npm run train:model
```

## Why Archived (Not Deleted)

Kept for historical reference only. The custom GBDT achieved comparable accuracy but:
1. Was not compatible with the native XGBoost `.json` model format.
2. Could not be loaded by `xgb.XGBClassifier.load_model()`.
3. Used terminology ("real dataset") that was inconsistent with the project's accurate description of the training data as a **Synthetic Semiconductor Dataset**.
