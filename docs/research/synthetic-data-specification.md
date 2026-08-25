# Synthetic Dataset Specification
## Requirements for Phase 4 Physics-Based Generation

This document defines the mathematical parameters and schema for the synthetic data generator (`scripts/generate_synthetic_data.py`) to be implemented in Phase 4.

---

## 1. Canonical Schema Definition

Every generated record must follow this exact structure:

```json
{
  "component_id": "COMP-00001",
  "lot_id": "LOT-2026-08-A17",
  "burn_in_hour": 24,
  "temperature": 125,
  "voltage": 1.2,
  "iddq": 10.42,
  "ileak": 1.48,
  "tpd": 120.35,
  "health_state": "HEALTHY",
  "defect_type": "NONE",
  "anomaly_label": 0,
  "source_type": "synthetic"
}
```

*Fields description:*
*   `health_state`: `["HEALTHY", "BORDERLINE", "LATENT_DEFECT", "FAILED"]`
*   `defect_type`: `["NONE", "GATE_OXIDE_SHORT", "TIMING_OFFSET", "STEP_BREAKDOWN"]`
*   `anomaly_label`: `0` (Normal) or `1` (Anomaly)
*   `source_type`: Set to `"synthetic"` to preserve data separation integrity.

---

## 2. Dynamic Trajectory Modeling

### Healthy Components (95% of lot population)
*   **Initial parameters:** Log-normal wafer variation:
    *   $I_{ddq\_0h} \sim \text{LogNormal}(2.3, 0.15) \approx 10\,\mu\text{A}$ median.
    *   $I_{leak\_0h} \sim \text{LogNormal}(0.35, 0.08) \approx 1.4\,\mu\text{A}$ median.
    *   $t_{pd\_0h} \sim \mathcal{N}(120, 4.0)\text{ ns}$.
*   **Aging path:** Standard BTI power-law drift ($t^{0.2}$) and HCI delay shift ($t^{0.15}$):
    *   $\Delta I_{ddq}(t) = 0.35 \cdot t^{0.2} + \epsilon_{\text{noise}}$
    *   $\Delta t_{pd}(t) = 0.12 \cdot t^{0.2} + \epsilon_{\text{noise}}$
    *   $\epsilon_{\text{noise}} \sim \mathcal{N}(0, 0.01^2)$ (1% measurement noise).

### Latent-Defect Components (3% of population)
*   **Initial parameters:** Start within normal datasheet specs but at the lot tail (e.g. $+3\sigma_{\text{robust}}$).
*   **Aging path:** Accelerated drift kinetics ($3\times$ pre-factor multiplier):
    *   $\Delta I_{ddq}(t) = 1.4 \cdot t^{0.2} + \epsilon_{\text{noise}}$
    *   $\Delta t_{pd}(t) = 0.48 \cdot t^{0.2} + \epsilon_{\text{noise}}$
*   *Relevance:* Flags drift-slope and worst-case predicted 168h limit checks.

### Catastrophic Step-Breakdown Components (2% of population)
*   **Initial parameters:** Start normal.
*   **Aging path:** Sudden dielectric breakdown (TDDB filament formation) between 24h and 96h:
    *   $I_{ddq}(t) = I_{ddq\_0h} + 0.35 \cdot t^{0.2} + \mathbb{I}(t \ge 96) \cdot \Delta_{\text{breakdown}}$
    *   $\Delta_{\text{breakdown}} \sim \text{LogNormal}(3.0, 0.5) \approx 20\,\mu\text{A} - 50\,\mu\text{A}$ step jump.
*   *Relevance:* Validates Module A's multi-parameter tail anomaly detector at mid-points.
