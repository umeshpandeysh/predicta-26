# Predicta Production 2026 — Day 20 Evidence Index Document

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## Technical Evidence Index for Production 2026 Judges

| File Artifact | Purpose | What It Proves |
| :--- | :--- | :--- |
| `ml/models/predicta_final_xgboost.json` | Frozen production XGBoost model | Verifies frozen model weights (SHA-256: `65A8B...`) |
| `ml/models/predicta_final_metadata.json` | Feature schema & hyperparameters | Proves threshold 0.45, 28 features, scale_pos_weight = 6.7413 |
| `ml/analysis/final_test_metrics.json` | Evaluation metrics on 10,000 test records | Proves 87.70% recall, 0.8630 ROC-AUC, 39.15% test FPR |
| `src/api/inference.js` | Inference engine & 3-zone decision engine | Proves 28-feature pipeline, threshold 0.45, and operator state machine |
| `src/api/server.js` | Vercel API HTTP server | Proves `/api/predict`, `/api/system/status`, `/api/prediction/detail` routes |
| `supabase/schema.sql` | Production relational database schema | Proves `prediction_runs`, `indicators`, `batch_runs` tables with indexes |
| `frontend/script.js` | Industrial workstation frontend controller | Proves real-time analytics polling and secondary test triage UI |
| `tests/test_workflow_validation.js` | Realistic physical fixture & chaos test | Proves NaN, Infinity, missing field, equipment OHE rejections |
| `tests/test_operator_workflow.js` | Operator lifecycle state machine test | Proves secondary test request/complete, immutability safeguards |
| `tests/test_observability.js` | Latency performance benchmark test | Proves sub-25ms CPU inference for $N=1000$ batch requests |
