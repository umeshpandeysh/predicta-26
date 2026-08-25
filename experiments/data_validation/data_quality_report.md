# Data Quality Report
## Dataset: AIPS PS170 Synthetic v0.1

This report presents the validation results and statistical profile of the generated physics-based burn-in dataset.

### 1. Dataset Profile

*   **Identifier:** `ps170_synthetic_full`
*   **Version:** v0.1
*   **Release Date:** 2026-08-25
*   **Number of Lots:** 50
*   **Components per Lot:** 100
*   **Total Component Count:** 5000
*   **Total Time Series Rows:** 20000
*   **Stress Temperature:** 125°C
*   **Stress Voltage:** 1.5V

### 2. Component Class Distribution

| Health State Class | Count | Percentage | Description |
| :--- | :--- | :--- | :--- |
| **HEALTHY** | 4733 | 94.66% | Normal drift parameters |
| **BORDERLINE** | 107 | 2.14% | Process tails outliers |
| **LATENT_DEFECT** | 101 | 2.02% | Drift slope rejects |
| **FAILED** | 59 | 1.18% | Catastrophic breakdowns |

### 3. Pipeline Validation Checks

*   **Canonical Schema Verification:** `PASS`
*   **Null/Infinite Bounds Check:** `PASS`
*   **Temporal Ordering Asserts:** `PASS`
*   **Physical Bounds Check:** `PASS`
*   **Lot Leakage Prevention:** `PASS`

---

## Technical Audit & Verification Status

The synthetic dataset reproduces the screening challenges described in the **ISRO PS170** specifications. It successfully models the physical aging trajectories derived from **NBTI Reaction-Diffusion** power laws and **TDDB localized dielectric breakdown**.

*Report generated automatically by `scripts/generate_report.js` on 2026-08-25.*
