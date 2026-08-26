# Predicta Final Prototype Completion — Baseline Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Baseline System State Summary

| System Property | Baseline Value | Status Verification |
| :--- | :--- | :--- |
| **Git Branch & Commit** | `a92579f` (Branch `main`) | 🟢 **VERIFIED** |
| **Production Model File** | `ml/models/predicta_final_xgboost.json` | 🟢 **FROZEN** |
| **Model SHA-256 Hash** | `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` | 🟢 **100% UNCHANGED** |
| **Operating Threshold** | `0.45` | 🟢 **STRICTLY PRESERVED** |
| **Locked Benchmark Test** | `ml/data/processed/test.csv` | 🟢 **UNTOUCHED** |
| **Production Web Deployment** | `https://ceenew.vercel.app` | 🟢 **LIVE / ONLINE** |
| **Cloud Database Backend** | Supabase PostgreSQL (`prediction_runs`, `prediction_indicators`) | 🟢 **CONNECTED** |
| **Automated Test Suite** | 27 Regression Test Suites (105 Total Cases) | 🟢 **100% PASS RATE** |
