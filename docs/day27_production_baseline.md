# Predicta Day 27 — Frozen Production Baseline Documentation

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Frozen Configuration Summary

| Frozen Component | Configuration Value | Verification Status |
| :--- | :--- | :--- |
| **Git Commit Hash** | `c5aa1b9` (Branch `main`) | 🟢 **FROZEN** |
| **Production Model File** | `ml/models/predicta_final_xgboost.json` | 🟢 **FROZEN** |
| **Model SHA-256 Hash** | `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` | 🟢 **VERIFIED UNCHANGED** |
| **Operating Threshold** | `0.45` | 🟢 **STRICTLY PRESERVED** |
| **Locked Benchmark Test** | `ml/data/processed/test.csv` | 🟢 **ZERO ACCESS / UNTOUCHED** |
| **Production Web URL** | `https://ceenew.vercel.app` | 🟢 **LIVE / ONLINE** |
| **Cloud Database** | Supabase PostgreSQL (`prediction_runs`, `prediction_indicators`) | 🟢 **CONNECTED** |
| **Automated Test Coverage**| 27 Dedicated Test Suites (102 Total Test Cases) | 🟢 **100% PASS RATE** |
