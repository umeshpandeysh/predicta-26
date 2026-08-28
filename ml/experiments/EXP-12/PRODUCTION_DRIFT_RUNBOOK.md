# PREDICTA PRODUCTION DRIFT RUNBOOK (v2.0.0)

## Configuration Integrity Note (Phase 0 Audit Finding)
- **Certified Operating Threshold**: theta* = 0.20 (v2.0.0 RC1 Model Artifact).
- **Express Health Endpoint Notice**: Displays legacy 0.45 threshold for backward compatibility. Inference calculations utilize lot Z-score normalized features.

## Incident Escalation Procedures

### 1. Alert Level YELLOW (Moderate Feature Drift)
- **Trigger**: 0.10 <= PSI < 0.25 on temperature or voltage features.
- **Action**: Check fab cleanroom HVAC logs and test head power supply calibration.

### 2. Alert Level ORANGE (Equipment Degradation)
- **Trigger**: GPR forecast predicts H+5 resistance >= 13.5 Ohm.
- **Action**: Issue preventive maintenance ticket for target equipment (EQP-101 .. EQP-105).

### 3. Alert Level RED (Critical Process Shift)
- **Trigger**: PSI >= 0.25 AND static failure rate > 15%.
- **Action**: Initiate QA quarantine, halt affected wafer lot, and trigger retraining investigation.
