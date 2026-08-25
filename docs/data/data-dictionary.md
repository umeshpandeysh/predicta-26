# Data Dictionary

This document registers every variable processed in the AIPS data platform.

---

## 1. `component_id`
*   **Meaning:** Unique identifier for each physical semiconductor package.
*   **Unit:** None
*   **Data Type:** String
*   **Allowed Range:** Standard serial syntax (e.g. `COMP-SYN-001-042`)
*   **Source:** Lot screening registration records.
*   **Observed/Synthetic:** Both (observed in NASA/ST; synthetic in AIPS generator).
*   **Module A Relevance:** Low (key identifier).
*   **Module B Relevance:** Low (key identifier).

---

## 2. `lot_id`
*   **Meaning:** Identifies the manufacturing cohort batch/wafer run.
*   **Unit:** None
*   **Data Type:** String
*   **Allowed Range:** Standard lot identifier syntax (e.g. `LOT-SYN-001`)
*   **Source:** Lot screening registration records.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** High (grouping key to calculate lot Medians and MADs).
*   **Module B Relevance:** Medium (captures lot-specific kernel priors).

---

## 3. `burn_in_hour`
*   **Meaning:** Elapsed time interval under high-temperature stress conditions.
*   **Unit:** Hours (h)
*   **Data Type:** Integer
*   **Allowed Range:** `0`, `24`, `96`, `168`
*   **Source:** ATE stress testing logs.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** Medium (specifies screening step).
*   **Module B Relevance:** High (independent variable $t$ for degradation forecasting).

---

## 4. `temperature_c`
*   **Meaning:** Constant ambient stress temperature within the test chamber.
*   **Unit:** Celsius (°C)
*   **Data Type:** Float
*   **Allowed Range:** `-55.0` to `200.0`
*   **Source:** Oven temperature controllers.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** Low (normalization covariate).
*   **Module B Relevance:** High (drives Arrhenius rate acceleration factor).

---

## 5. `voltage_v`
*   **Meaning:** Applied electrical bias overstress voltage.
*   **Unit:** Volts (V)
*   **Data Type:** Float
*   **Allowed Range:** `0.0` to `100.0`
*   **Source:** ATE power supply monitors.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** Low (constant stress condition).
*   **Module B Relevance:** High (voltage-dependent oxide trap factor).

---

## 6. `iddq`
*   **Meaning:** Quiescent supply current under static logic states.
*   **Unit:** Microamperes (µA)
*   **Data Type:** Float
*   **Allowed Range:** `0.0` to `1000.0`
*   **Source:** High-precision ATE source measure units (SMUs).
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** High (core parameter checked for lot outliers).
*   **Module B Relevance:** High (target parameter for early prediction).

---

## 7. `ileak`
*   **Meaning:** Gate dielectric leakage current under bias voltage.
*   **Unit:** Microamperes (µA)
*   **Data Type:** Float
*   **Allowed Range:** `0.0` to `500.0`
*   **Source:** High-precision ATE SMUs.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** High (outlier detection indicator).
*   **Module B Relevance:** High (target parameter for early prediction).

---

## 8. `tpd`
*   **Meaning:** Cell signal propagation transition delay.
*   **Unit:** Nanoseconds (ns)
*   **Data Type:** Float
*   **Allowed Range:** `0.0` to `1000.0`
*   **Source:** High-speed ATE pin comparator units.
*   **Observed/Synthetic:** Both.
*   **Module A Relevance:** Medium (outlier detection).
*   **Module B Relevance:** High (forecasting parameter indicating timing margins).

---

## 9. `vth`
*   **Meaning:** Shift in threshold voltage caused by charge trapping.
*   **Unit:** Volts (V)
*   **Data Type:** Float
*   **Allowed Range:** `0.0` to `5.0`
*   **Source:** Parametric transistor characterization curves.
*   **Observed/Synthetic:** Derived / Synthetic.
*   **Module A Relevance:** Low (internal physical parameter).
*   **Module B Relevance:** High (primary degradation metric driving GPR kernels).

---

## 10. `health_state`
*   **Meaning:** Assessed condition category of the component.
*   **Unit:** None
*   **Data Type:** String (`HEALTHY`, `BORDERLINE`, `LATENT_DEFECT`, `FAILED`)
*   **Source:** Physical wear-out modeling annotations.
*   **Observed/Synthetic:** Model-derived.
*   **Module A Relevance:** Low (validation label).
*   **Module B Relevance:** Low (validation label).

---

## 11. `anomaly_label`
*   **Meaning:** Ground-truth classification flag indicating whether a part is abnormal.
*   **Unit:** None
*   **Data Type:** Integer (`0` = Normal, `1` = Anomaly)
*   **Source:** Model-derived classification.
*   **Observed/Synthetic:** Model-derived.
*   **Module A Relevance:** High (supervised benchmark target).
*   **Module B Relevance:** Low.
