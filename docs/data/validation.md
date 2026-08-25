# Pre-ML Validation Pipeline

Our validation script (`src/preprocessing/validation.py`) enforces strict schema, numerical, physical, and temporal checks before data reaches model training.

## Enforced Checks

*   **Structure:** Confirms presence of required core fields: `component_id`, `lot_id`, `burn_in_hour`, `iddq`, `ileak`, `tpd`.
*   **NaN / Infinite Checks:** Blocks any records containing nulls or infinite values in core features.
*   **Temporal Ordering:** Asserts that for every component, the sequence of hours is strictly ascending ($0\text{h} \le 24\text{h} \le 96\text{h} \le 168\text{h}$).
*   **Physical Bounds:**
    *   No negative propagation delays or currents ($t_{pd} \ge 0$, $I_{ddq} \ge 0$, $I_{leak} \ge 0$).
    *   Stress temperature must remain within $[-100^\circ\text{C}, 300^\circ\text{C}]$.
    *   Out-of-bound variables trigger an immediate `INVALID` status.
