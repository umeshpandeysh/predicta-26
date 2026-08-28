# Decision Engine & Safety-Slope Definition
## Automated PASS / MONITOR / REJECT Logic for Component Screening

---

## 1. Safety-Slope Formulation

The System Specification requires flagging components for rejection if their predicted drift rate exceeds a defined "safety slope". We implement three levels of safety slope limits to provide a robust, industrially defensible engineering implementation:

### 1. Absolute Drift Slope (ADS)
Tracks the absolute rate of change per hour from the 24h baseline to the predicted 168h end-of-test value:
$$\text{ADS} = \frac{\hat{Value}_{168h} - Value_{24h}}{144\text{ hours}}$$

### 2. Relative Percentage Drift Rate (RPDR)
Tracks the percentage drift per hour relative to the initial 24h baseline. This is highly useful for normalizing parameters across different magnitudes (e.g., $I_{ddq}$ in milliamperes vs. microamperes):
$$\text{RPDR} = \frac{\hat{Value}_{168h} - Value_{24h}}{Value_{24h} \cdot 144\text{ hours}} \times 100\%$$

### 3. Statistical Lot-Derived Safety Slope (SLDSS)
Rather than hardcoding arbitrary limits, we dynamically calculate the safety slope boundary based on the current lot population:
$$\text{Safety Limit}_{\text{lot}} = \text{Median}(\text{Slopes}_{\text{lot}}) + 3 \times \text{MAD}(\text{Slopes}_{\text{lot}})$$
Where $\text{MAD}$ is the Median Absolute Deviation of the drift slopes within the lot.

---

## 2. Decision Logic Flow

The Decision Engine combines the outputs of Module A (Dynamic Outlier Detection) and Module B (Drift Prediction) to route the components into one of three bins:

```text
                                 [ Component Ingest ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [ Outlier Check ]                               [ Drift Check ]
     Is Anomaly Score > Lot USL?                  Is Predicted Slope > SLDSS?
     (COPOD Multi-Param check)                     OR Worst-Case 168h > Datasheet Max?
                  │                                               │
          ┌───────┴───────┐                               ┌───────┴───────┐
          ▼               ▼                               ▼               ▼
        [YES]            [NO]                           [YES]            [NO]
          │               │                               │               │
      Flag Outlier   No Outlier                       Flag Drift       No Drift
          │               │                               │               │
          └───────────────┼───────────────┬───────────────┘               │
                          ▼               ▼                               ▼
                     [Outlier?]      [Drifter?]                      [Neither?]
                          │               │                               │
                          ▼               ▼                               ▼
                       MONITOR         REJECT                            PASS
```

### PASS
*   **Condition:** Component is statistically normal within the lot and predicted to remain stable.
*   **Action:** Accepted for flight assembly.

### MONITOR
*   **Condition:** Component's anomaly score is slightly elevated but remains within standard boundaries, and its predicted drift is stable.
*   **Action:** Quarantined for secondary inspection.

### REJECT
*   **Condition:** Component is flagged as a statistical outlier OR its predicted drift rate exceeds the safety slope OR its upper 95% confidence interval crosses datasheet limits.
*   **Action:** Discarded, and the rejection reason is logged.
