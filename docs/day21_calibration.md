# Predicta Day 21 — Research Calibration & Brier Score Audit

> [!NOTE]
> **HISTORICAL / EXPERIMENTAL CONFIGURATION**
> This document records an earlier milestone experiment where an operating threshold of 0.45 was evaluated.
> This threshold is not used by the current production system.
> The current authoritative production ML operating threshold is **0.20**.

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Reliability & Calibration Analysis

- **Brier Score Baseline V1**: `0.3421`
- **Brier Score Research V2**: **`0.2639`** (Improved calibration)
- **Calibration Observation**: Under V2 specification-violation data generation, Brier score improved from `0.3421` to `0.2639`. Raw tree probabilities reflect a conservative screening posture designed to prevent false negatives.
