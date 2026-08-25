# Data Splitting Strategy

To evaluate dynamic screening realistically, AIPS enforces a strict **Lot-Level Split** rather than random component-level or row-level partitioning.

```text
Lots 1-35 (70%)  â”€â”€â–º Training Cohort (Calibrates lot thresholds)
Lots 36-42 (15%) â”€â”€â–º Validation Cohort (Tune hyper-parameters)
Lots 43-50 (15%) â”€â”€â–º Test Cohort (Zero leakage evaluation)
```

## Why Component-Level Splitting is Defective
*   *Temporal Leakage:* Placing a component's 0h row in train and its 168h row in test exposes future trajectories, rendering forecasting tests trivial.
*   *Lot Leakage:* Lots share wafer coordinates and baseline offsets. Splitting parts of the same lot across train/test allows the model to learn localized lot baselines, inflating performance metrics.
*   *Solution:* Grouping by `lot_id` ensures that validation and test sets evaluate completely unseen wafer lots, matching real spacecraft production lines.
