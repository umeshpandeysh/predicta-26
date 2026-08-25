# Public Proxy Dataset Evaluations
## Assessing Candidate Datasets for Validation and Model Calibration

This report documents the characteristics, limitations, and utility of public semiconductor proxy datasets for the AIPS screening system.

---

## 1. NASA Power MOSFET Dataset

*   **Classification:** `STRONG PROXY`
*   **Utility:** Calibrating Module B's drift forecasting models.
*   **Analysis:**
    *   *Features:* Gate leakage current ($I_{gate\_leakage}$), drain-source leakage current ($I_{drain\_leakage}$), threshold voltage ($V_{gs(th)}$), and temperature logs.
    *   *Strengths:* Contains continuous time-series degradation logs under accelerated stress ($175^\circ\text{C}$ + gate voltage stress), tracking parameters until device failure.
    *   *Limitations:* Small sample size (32 parts). Accelerated conditions are highly aggressive and run to failure, which exceeds standard non-destructive burn-in conditions.

---

## 2. STMicroelectronics Wafer Fault Dataset (ST-AWFD)

*   **Classification:** `STRONG PROXY`
*   **Utility:** Benchmarking wafer-level dynamic outlier detection.
*   **Analysis:**
    *   *Features:* 14 electronic parametric test (E-test) variables mapped across wafer coordinates ($X, Y$).
    *   *Strengths:* Very large sample size (2,500 wafers, thousands of dies). Captures spatial lot variations and process-induced outliers.
    *   *Limitations:* Static, end-of-line test snapshots. Does not contain time-series degradation steps (no burn-in stress intervals).

---

## 3. UCI SECOM Process Dataset

*   **Classification:** `MODERATE PROXY`
*   **Utility:** Testing high-dimensional feature selection.
*   **Analysis:**
    *   *Features:* 590 sensor measurement columns with a binary pass/fail label.
    *   *Strengths:* Represents real-world semiconductor process variation and highly imbalanced failure rates (104 fails vs. 1,463 passes).
    *   *Limitations:* Features are anonymized (e.g. `feature_001`), making physical validation impossible. Static data points with no time-series degradation steps.

---

## 4. WM-811K Wafer Map Dataset

*   **Classification:** `MODERATE PROXY`
*   **Utility:** Spatial wafer anomaly categorization.
*   **Analysis:**
    *   *Features:* Wafer bin maps showing spatial layout anomalies (ring, scratch, edge failures).
    *   *Strengths:* Largest available wafer-grid database (811,110 wafers).
    *   *Limitations:* Image-based classification rather than time-series parametric currents. Used only for lot-level spatial anomaly validation.
