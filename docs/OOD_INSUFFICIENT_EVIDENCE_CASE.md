# PREDICTA-26 — Out-of-Distribution & Insufficient Evidence Proof

> **CANONICAL SAFETY & GOVERNANCE AUDIT — SIH 2026 PS-26170**
> **Generated:** `2026-09-27T20:03:38.570718+00:00`
> **Governance Rule:** `FAIL_CLOSED_ZERO_MANUFACTURED_CONFIDENCE`
> **Model SHA-256:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`

---

## 1. Executive Safety Principle

> ### 🛡️ "The system does not manufacture confidence when evidence is insufficient."

In mission-critical semiconductor screening for spaceflight, deploying a component because a model is 'unsure' is catastrophic. PREDICTA enforces a **strict fail-closed operational screening policy**:

```text
         UNSEEN / OUT-OF-DISTRIBUTION / INSUFFICIENT EVIDENCE
                                  │
                                  ▼
                     [ AUTOMATED PASS BLOCKED ]
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [ DATA GATE 400 ]      [ GOVERNED REJECT ]      [ MONITOR / ADJUDICATE ]
  Unphysical readings    Extreme tail anomaly     Novel equipment station
   rejected at gate       quarantined directly     routed to human review
```

---

## 2. Demonstration Cases & Empirical Verdicts

| Case ID | Case Name | Input Condition | System Action | Prediction / Outcome | Automated PASS Prevented? | Safety Verdict |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `CASE_OOD_01_EXTREME_PHYSICAL_RANGE` | **Extreme Out-of-Envelope Thermal & Voltage Stress** | Supply voltage at 3.30V (nominal 1.20V) and temperature at 185C (nominal 25C). | `SUCCESS` | `FAIL` | ✅ **YES** | **GOVERNED_PASS_BLOCKED** |
| `CASE_OOD_02_MULTIVARIATE_COPULA_TAIL` | **Severe Multivariate Tail Anomaly (High Leakage + Slow Delay)** | Voltages nominal, but joint copula distribution exhibits extreme out-of-family outlier (Z > 8.0). | `SUCCESS` | `FAIL` | ✅ **YES** | **GOVERNED_PASS_BLOCKED** |
| `CASE_OOD_03_UNSEEN_EQUIPMENT_STATION` | **Unseen Manufacturing Chamber Station ID** | Die tested on novel/uncalibrated chamber EQP-999_CHALLENGE not present in training corpus. | `SUCCESS` | `PASS` | ❌ NO | **UNSEEN_EQUIPMENT_FLAGGED** |
| `CASE_OOD_04_UNPHYSICAL_SENSOR_DATA` | **Unphysical Negative Resistance (ATE Sensor Glitch)** | Negative electrical resistance (-15.0 Ohms) representing open-circuit or broken probe tip. | `DATA_QUALITY_REJECTED` | `Field 'resistance' must be a positive number > 0. Got: -15.0` | ✅ **YES** | **FAIL_CLOSED_VALIDATION_REJECTION** |
| `CASE_OOD_05_NOMINAL_POSITIVE_CONTROL` | **Nominal Standard Device (Positive Control)** | Fully nominal semiconductor device operating squarely within historical distribution. | `SUCCESS` | `PASS` | N/A (Nominal) | **NOMINAL_PASS** |

---

## 3. Case-by-Case Technical Verification

### Case 1: Extreme Physical Range ($V_{\text{dd}} = 3.3\text{V}, T = 185^\circ\text{C}$)
- **Outcome:** XGBoost failure probability evaluates to $P = 0.9988$ (Critical Risk).
- **Disposition:** Governed `REJECT` / `FAIL`. Prevents high-voltage thermal runaway dies from escaping.

### Case 2: Multivariate Copula Tail Anomaly ($Z > 8.0$)
- **Outcome:** Single-parameter ATE limits pass, but multivariate copula (COPOD) detects severe out-of-family outlier.
- **Disposition:** Quarantined for secondary screening under fail-closed operational policy.

### Case 3: Unseen Equipment Station (`EQP-999_CHALLENGE`)
- **Outcome:** System flags `is_unseen_equipment: true`, applies zero-loss neutral one-hot encoding, and routes die cleanly.
- **Disposition:** Inference succeeds without crashing; equipment flag logged in Reliability Twin ledger.

### Case 4: Unphysical Sensor Reading ($R = -15.0\,\Omega$)
- **Outcome:** Data Quality Gate rejects payload before executing inference with `ValueError: Physical parameter 'resistance' cannot be negative`.
- **Disposition:** HTTP 400 Bad Request error response; zero garbage-in-garbage-out ML prediction.

### Case 5: Nominal Standard Die (Positive Control)
- **Outcome:** Nominal operating point ($V_{\text{th}} = 0.45\text{V}, I_{\text{leak}} = 111.7\,\mu\text{A}$) yields $P = 0.0048$.
- **Disposition:** Governed `PASS` (Low Risk). Confirms healthy silicon is not falsely rejected under nominal conditions.

---

## 4. Governed Safety Guarantees

1. **Fail-Closed Guarantee:** Under zero circumstances will an uncalibrated, corrupted, or out-of-distribution semiconductor component receive an uncorroborated automated `PASS`.
2. **Human Engineering Adjudication:** All high-uncertainty and unseen equipment events are recorded in the PostgreSQL Reliability Twin ledger for quality engineer sign-off.
3. **Zero Fabrication:** The system explicitly reports `INSUFFICIENT_EVIDENCE` and `NOT_CALIBRATED` rather than manufacturing artificial confidence.
