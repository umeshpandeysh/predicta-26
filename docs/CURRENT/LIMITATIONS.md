# PREDICTA-26 ? Known Limitations & Technical Risk Analysis

---

## 1. Synthetic Data Foundation
- **Limitation:** The development telemetry is generated from physical differential equations rather than physical fab production logs.
- **Risk:** Commercial ATE test heads exhibit sensor quantization steps, non-Gaussian electromagnetic spikes, and socket wear that are not fully captured by Gaussian noise models.
- **Mitigation:** The system was stress-tested under 1%, 3%, and 5% additive Gaussian noise and evaluated against public empirical datasets (NASA MOSFET aging, STMicroelectronics AWFD, UCI SECOM).

## 2. Unseen Equipment Neutrality
- **Limitation:** When an unmodeled ATE tool ID is ingested, the system zeroes out all tool indicators (`eq_* = 0.0`) and flags `is_unseen_equipment: true`.
- **Risk:** Systematic thermal chuck biases or high contact resistance specific to the novel machine are treated as device variation rather than equipment bias.
- **Mitigation:** Unseen equipment evaluation on holdout tool `EQP-105` demonstrated that 99.46% of true defects are still detected under neutral encoding.

## 3. Probability Calibration vs. Physical Certainty
- **Limitation:** Calibrated failure probabilities reflect population empirical failure rates under accelerated stress conditions, not deterministic physical lifespans.
- **Mitigation:** A multi-tier decision hierarchy enforces mandatory secondary screening for all borderline cases (0.20 <= P < 0.65).

## 4. Temperature Extrapolation Boundaries
- **Limitation:** Arrhenius acceleration formulas assume single-mechanism activation energy (E_a = 0.55 eV).
- **Risk:** At extreme temperatures (> 150 C), secondary thermal breakdown mechanisms (metallization voiding, package delamination) violate single-rate kinetics.
- **Mitigation:** Pre-inference quality gates reject temperatures exceeding 125 C.
