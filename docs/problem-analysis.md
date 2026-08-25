# Problem Analysis: Static vs. Dynamic Screening
## Why Conventional Microelectronic Screening Fails in Space Hardware

---

## 1. Traditional Static Screening

Traditional semiconductor screening relies on absolute Upper Specification Limits (USL) and Lower Specification Limits (LSL) derived from the component's datasheet:

```text
Traditional Screening Flow:
         
   [ IC Parameter Value ] ───►  Is Value <= USL (e.g., Iddq <= 100 µA)?
                                       │
                               ┌───────┴───────┐
                               ▼               ▼
                             [YES]            [NO]
                               │               │
                             [PASS]          [FAIL]
                                               │
                                       (Escape Risk!)
```

### Limitations:
1.  **Process Tolerance Inflation:** To maintain high manufacturing yield, semiconductor foundries set datasheet specification limits (USL/LSL) very wide to cover all process corners (Fast-Fast, Slow-Slow) and wafer spatial zones (center vs. edge).
2.  **The Outlier Problem:** A component might exhibit a standby current of $45\,\mu\text{A}$ while its lot-mates average $10\,\mu\text{A}$. Because $45\,\mu\text{A}$ is well below the static spec of $100\,\mu\text{A}$, traditional screening accepts the part. However, in reliability engineering, this part is an **outlier** (a "freak" or "anomaly"). Statistics show that outlier components are highly likely to possess latent defects (such as gate oxide thinning or metal voids) that fail prematurely in orbit under thermal-cycling stress.
3.  **No Extrapolation:** Static screening only looks at retrospective snapshots (e.g., checking post-stress values). If a part is rapidly degrading, static screening won't catch it until the stress test is complete—or worse, if the drift remains just under the spec limit, it won't catch it at all.

---

## 2. Proposed AI-Driven Dynamic Screening

Our system replaces the static flow with a multi-layered, predictive outlier screening engine:

```text
Proposed AI-Driven Screening Flow:

             [ 0h & 24h Parametric Measurements ]
                              │
                              ▼
                 Robust Lot-Level Normalization
               (MAD-based Z-score relative to lot)
                              │
                              ▼
           ┌──────────────────┴──────────────────┐
           ▼                                     ▼
     [ Module A ]                          [ Module B ]
Unsupervised Outlier                  Physics-Informed GPR
Detection (COPOD Copulas)             Drift Predictor (t^0.2)
   - Multi-Parameter Anomaly Score       - Forecasts 168h wear-out
   - Identifies lot-relative freaks      - Outputs 95% Confidence Interval
           │                                     │
           └──────────────────┬──────────────────┘
                              ▼
                       [ Decision Engine ]
          Calculates Predicted Drift & Safety Slope
          Rejects if Anomaly Score > Lot Threshold
          OR worst-case Predicted 168h > Spec Limit
                              │
                              ▼
                    PASS / MONITOR / REJECT
```

---

## 3. Comparative Matrix: Traditional vs. Proposed

| Metric | Traditional Screening | Proposed AI-Driven Screening |
| :--- | :--- | :--- |
| **Outlier Detection** | None (Accepts parts within datasheet specs) | **Yes** (Identifies freaks relative to lot population using COPOD) |
| **Statistical Basis** | Fixed Spec Limits (Datasheet LSL/USL) | **Dynamic statistical boundaries** ($\text{Median} \pm 3\sigma_{\text{robust}}$) |
| **Time-Series Analysis** | Manual difference checks ($\text{Value}_{168h} - \text{Value}_{0h}$) | **Real-time forecasting** of $168\text{h}$ value using early $0\text{h}$ and $24\text{h}$ data |
| **Test Duration** | Mandatory 168 hours of burn-in for all components | **Early termination (24h)** for highly anomalous lots, saving 144 hours |
| **Parameter Scope** | Univariate (Parameters evaluated independently) | **Multivariate** (Evaluates joint dependencies of $I_{ddq}$ and delay) |
| **Reliability Risk** | Moderate (Escape of latent defect "freak" parts) | **Near-Zero** (Catches anomalies via confidence-bound safety limits) |
| **Cost Matrix** | Standard equal-weight classification | **Cost-Weighted $F_3$ Loss** (Heavily penalizes False Negatives) |
