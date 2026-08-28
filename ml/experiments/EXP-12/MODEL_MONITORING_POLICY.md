# PREDICTA MODEL MONITORING POLICY (v2.0.0)

## 1. Objectives
This policy defines the procedures for continuous post-deployment monitoring of PREDICTA (v2.0.0-FINAL) in production.

## 2. Statistical Drift Thresholds
- **Kolmogorov-Smirnov (KS) Test**: Evaluated daily per feature. KS_stat > 0.15 => MODERATE_DRIFT.
- **Population Stability Index (PSI)**:
  - PSI < 0.10: No Significant Drift (GREEN)
  - 0.10 <= PSI < 0.25: Moderate Drift / Investigation (YELLOW)
  - PSI >= 0.25: Significant Shift / Quarantine Trigger (RED)

## 3. Champion / Challenger Framework
- **Current Champion**: v2.0.0-FINAL
- **Retraining Approval**: New candidate models must be evaluated against the locked test set (test.csv) and exceed champion metrics (Recall >= 95.0%, FPR <= 10.0%, 100% Shift Immunity) prior to champion promotion.
- **Data Protection**: Production telemetry must NEVER automatically retrain models without explicit human verification.
