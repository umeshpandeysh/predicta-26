# PREDICTA — SIH 2026 Live Demonstration Script (Problem Statement 170)

**Target Duration**: 3 – 5 Minutes  
**Audience**: SIH Technical & Domain Evaluation Panel  

---

## Executive Pitch (30 Seconds)
> "Respected Judges, semiconductor qualification currently consumes up to 168 hours of expensive high-temperature burn-in testing. **PREDICTA** is an early-screening decision-support platform designed to analyze early 0h and 24h telemetry measurements to detect lot outliers, forecast 168h parameter drift with calibrated uncertainty, evaluate safety trajectories against screening criteria, and provide explainable QA disposition recommendations."

---

## 1. Input Telemetry Ingestion (45 Seconds)
- **Demonstration**: Load single test record (e.g. `EQP-101`, early burn-in readings at 0h and 24h).
- **Key Point**: "Notice that PREDICTA consumes ONLY 0h and 24h measurements. It does NOT use future 96h or 168h data during runtime inference, eliminating data leakage."

---

## 2. Multi-Dimensional Anomaly Detection (45 Seconds)
- **Demonstration**: Point to Phase 1 Anomaly Detection card (PAT Robust MAD + COPOD).
- **Key Point**: "Phase 1 runs Part Average Testing Z-score calculation to detect single-parameter lot outliers, alongside COPOD empirical copula tail-odds to capture subtle multi-variate interactions."

---

## 3. Calibrated GPR 168h Drift Forecasting (45 Seconds)
- **Demonstration**: Highlight GPR Forecast & 95% Confidence Interval graphs ($I_{\text{ddq}}$, $I_{\text{leak}}$, $T_{\text{pd}}$).
- **Key Point**: "Instead of static linear extrapolation, PREDICTA executes full-matrix Gaussian Process Regression calibrated on Lots 31–35. On held-out Lots 36–50, the calibrated model achieves 96.3% interval coverage on timing propagation delay."

---

## 4. Safety Trajectory & Multi-Criteria Risk Fusion (45 Seconds)
- **Demonstration**: Show Phase 3 Safety Slope & Phase 4 Risk Engine card.
- **Key Point**: "Phase 3 projects the upper 95% confidence trajectory against project-defined screening criteria. Phase 4 fuses anomaly scores, forecasted drift, and safety margins into a dimensionless 0–100 Risk Score, classifying components into **SAFE**, **MONITOR**, or **AT RISK**."

---

## 5. Explainability & QA Screening Action (45 Seconds)
- **Demonstration**: Expand Phase 5 Engineering Trace & Top Risk Factors panel.
- **Key Point**: "PREDICTA provides full engineering explainability. It isolates top risk factors (e.g. `HIGH_TPD_DRIFT`), maps out a 5-stage decision trace, and generates an actionable QA screening recommendation (`RECOMMEND_SECONDARY_QA_REVIEW` or `QUARANTINE_REJECT`)."

---

## 6. Summary & System Impact (30 Seconds)
- **Key Takeaway**: "PREDICTA empowers semiconductor QA teams to flag abnormal components early at 24h, optimizing burn-in oven capacity, accelerating production throughput, and preventing high-risk silicon from entering mission-critical space/aerospace systems."
