# Model Card: Predicta Safety Decision Engine

*   **Project:** Predicta
*   **Competition:** Smart India Hackathon 2026
*   **Problem Statement:** PS 170

Details of the rules combining Module A and Module B metrics.

## Decision Matrix Rules

```text
IF (Anomaly Score > 8.5) OR (Upper Bound Slope > Max Limit)
    ==> REJECT

ELSE IF (Anomaly Score > 5.0) OR (Mean Slope > Max Limit) OR (Upper Bound crosses Limit)
    ==> MONITOR

ELSE
    ==> PASS
```

## Intended Purpose
Provides a multi-layer safety check:
1.  **Anomaly Layer (Module A):** Catches point/spatial outliers.
2.  **Drift Layer (Module B):** Forecasts temporal wear-out.
3.  **Uncertainty Layer:** Automatically flags components with high prediction variance as **MONITOR**, ensuring high-reliability safety gates.
