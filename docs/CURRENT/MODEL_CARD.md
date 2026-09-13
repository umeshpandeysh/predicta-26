# PREDICTA-26 ? Production Model Card
### Standard Model Governance & Transparency Specification

---

## 1. Model Purpose
Predicta-26 is a multi-task machine learning and statistical physics system designed to evaluate semiconductor wafer test telemetry, compute calibrated failure risk, classify physical defect mechanisms, detect novel open-set anomalies, and forecast parametric equipment degradation.

## 2. Intended Users
- Semiconductor Quality & Reliability Engineers
- Fab Process Integration & Defect Metrology Teams
- Automated Test Equipment (ATE) Test Operations Engineers
- Smart India Hackathon (SIH) Technical Reviewers & Judges

## 3. Intended Use
- Post-probe wafer sort screening and early burn-in screening.
- Automated quarantine of high-risk silicon components prior to expensive packaging and assembly.
- Early warning alerts for ATE test chamber contact resistance degradation and thermal drift.

## 4. Out-of-Scope Use
- Autonomous discard of mission-critical automotive/aerospace wafers without human engineering verification.
- Direct application to novel device architectures (e.g. GaN, SiC, or FinFET 3nm nodes) without retraining and recalibration.
- Real-time in-situ lithography control loop feedback without hardware-in-the-loop validation.

## 5. Input Features (Locked 28-Feature Schema)
1. **Raw Electrical & Timing (16):** `supply_voltage`, `output_voltage`, `current`, `leakage_current`, `resistance`, `capacitance`, `threshold_voltage`, `frequency`, `propagation_delay`, `setup_time`, `hold_time`, `timing_margin`, `temperature`, `dynamic_power`, `total_power`, `test_duration`.
2. **Physics-Engineered Ratios (7):** `voltage_headroom`, `voltage_utilization`, `leakage_fraction`, `power_per_current`, `normalized_timing_margin`, `frequency_delay_product`, `thermal_delta`.
3. **Equipment Encodings (5):** One-hot indicators for tools `EQP-101` through `EQP-105` (with all zeros baseline for novel equipment).

## 6. Output Predictions
- **Calibrated Failure Risk P(Fail):** Continuous probability in [0.0, 1.0].
- **Binary Classification:** PASS if P < 0.20, FAIL if P >= 0.20.
- **Defect Mechanism:** Classification across 8 known failure mechanisms.
- **Anomaly Score & Flag:** Unsupervised distance under Part Average Testing (Robust MAD) and COPOD.
- **Degradation Trajectory:** 168-hour parametric drift prediction with 95% Bayesian credible bounds.

## 7. Failure-Risk Interpretation
The output probability is an empirical **Calibrated Failure Risk** reflecting expected population failure rates under accelerated stress testing, **NOT** an unconditional guarantee of individual physical lifetime.

## 8. Defect Classification
The multiclass model classifies failures into 8 domain mechanisms: `NORMAL`, `HIGH_LEAKAGE`, `LOW_VOLTAGE`, `TIMING_FAILURE`, `THERMAL_ANOMALY`, `POWER_ANOMALY`, `PROCESS_VARIATION`, and `EQUIPMENT_DRIFT`.

## 9. Unknown Anomaly Detection
Unknown or open-set anomalies (defects not present during training) are isolated using Part Average Testing (PAT) with Robust MAD (Z > 6.0) and Copula Outlier Detection (COPOD score > 12.0).

## 10. Forecasting
Temporal equipment wear is modeled using Gaussian Process Regression (GPR) with an RBF plus White noise kernel, predicting drift in threshold voltage and contact resistance.

## 11. Decision Hierarchy
1. If Data Quality Gate fails -> **REJECT / MALFORMED**
2. If P(Fail) >= 0.65 -> **REJECT / CRITICAL**
3. If PAT / COPOD Anomaly flagged -> **QUARANTINE / ANOMALY**
4. If GPR Drift Limit exceeded -> **MONITOR / SERVICE_REQUIRED**
5. If 0.20 <= P(Fail) < 0.65 -> **MONITOR / SECONDARY_TEST**
6. If P(Fail) < 0.20 and all checks nominal -> **PASS**

## 12. Training Data
Trained on the **50,000-sample synthetic semiconductor dataset**, with 32,500 training dies across Lots 001-013.

## 13. Synthetic-Data Limitation
> **Mandatory Disclosure:** The training and evaluation data is physics-grounded synthetic telemetry. Performance on synthetic data does not guarantee identical performance on commercial fab ATE data.

## 14. Validation Methodology
Evaluated using strict **GroupShuffleSplit** on `lot_id` and `wafer_id`. Zero overlap between train, validation, and test partitions. Locked test set (Lots 18-20, 7,500 samples) evaluated exactly once.

## 15. Performance
- **ROC-AUC:** 0.9997
- **PR-AUC:** 0.9995
- **Recall (theta*=0.20):** 99.52% (FNR: 0.48%)
- **Precision (theta*=0.20):** 98.06% (FPR: 1.10%)
- **F1 Score:** 0.9878

## 16. Calibration
Platt logistic scaling (A = -1.0412, B = 1.0037) reduces Brier score to **0.0058** and Expected Calibration Error (ECE) to **0.0023**.

## 17. Known Failure Modes
Borderline dies near the 0.20 operating threshold with high thermal variance may experience probability fluctuation (+/- 0.03), requiring secondary diagnostic re-testing.

## 18. Distribution-Shift Limitations
Under extreme unmodeled process shifts (e.g. ambient fab temperature > 45 C or voltage sag > 15%), recall remains high (99.58%), but precision drops to 89.2% due to conservative over-rejection.

## 19. Human-in-the-Loop Recommendation
All dies receiving a **MONITOR** or **QUARANTINE** disposition must be routed to secondary automated probe verification and human product engineering sign-off.

## 20. Recalibration Strategy
When transitioning to a new fab node or test chamber, the 350-tree backbone should be fine-tuned using transfer learning with a minimum of 5,000 empirical ATE probe records.
