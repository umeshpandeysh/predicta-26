# UI/UX Console Architecture and Design Specifications
## High-Fidelity Semiconductor Reliability Screening Interface

---

## 1. Design Philosophy

The AIPS Console is designed specifically for semiconductor reliability and flight-qualification test engineers at ISRO. It avoids the styling tropes of general SaaS administration panels in favor of a clean, high-density, scientific layout.

### Styling Visual Tokens:
*   **Theme Background:** Deep Space Indigo (`#0B0F19`) reduces eye strain during long screening monitoring cycles.
*   **Component Cards:** Semi-transparent glassmorphic panels (`rgba(18, 26, 47, 0.4)`) with micro-borders (`rgba(255, 255, 255, 0.06)`) structure the grid layout.
*   **Typography:** Google Font `Inter` provides high readability for fractional data values, and `Outfit` is used for display headers.
*   **Status Color Semantics:**
    *   `Cyan` (`#00F2FE`): Identifies machine learning predictions, GPR path estimations, active selections, and calculations.
    *   `Green` (`#10B981`): PASS status. Indicative of components with normal aging trends.
    *   `Amber` (`#F59E0B`): MONITOR status. Highlights minor outliers or uncertainty ranges.
    *   `Red` (`#FF5E62`): REJECT status. Highlights critical anomalies, timing violations, and slope failures.

---

## 2. Page Structure & Navigation

The console is structured as a Single Page Application (SPA). A persistent sidebar navigation panel controls active page rendering by updating CSS classes on wrapper `<section>` views:

```text
  ┌────────────────────────────────────────────────────────┐
  │                   AIPS Console Layout                  │
  ├────────────────────────────────────────────────────────┤
  │                                                        │
  │  [Sidebar]               [Main Dynamic Page View]      │
  │  * Brand Header          * Header: Title & Lot Status  │
  │  * Nav Items:            * Top stats counters card     │
  │    - Overview            * Main visualization panels   │
  │    - Lot Analysis          (Histograms / SVGs / Tables)│
  │    - Component Details                                 │
  │    - Module A (Anomaly)                                │
  │    - Module B (Drift)                                  │
  │    - Decision Engine                                   │
  │    - Dataset Registry                                  │
  │    - Model Registry                                    │
  │    - System Info                                       │
  │  * Demo Mode Flag                                      │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Interactive Visualization Components

### A. Accelerated Aging Timeline (Overview Page)
*   **Concept:** A custom progress bar mapping standard qualification intervals: **0h, 24h, 96h, and 168h**.
*   **Visual Story:** The **24h Node** is explicitly highlighted as the **Early Prediction Window**. A neon cyan flag indicates that at this threshold, GPR algorithms forecast the remaining 144 hours of wear-out.

### B. Parametric Distributions (Overview & Module A Pages)
*   **Concept:** Histograms charting parameter frequencies across the active lot population.
*   **Dynamic Highlighting:** Bins exceeding statistical thresholds are colored in transparent warning red (`var(--critical)`) while stable regions remain cyan (`var(--accent)`). This highlights outliers.

### C. Dynamic Time-Series Trend Line (Component Details Page)
*   **Concept:** An SVG vector chart displaying parametric shift coordinates over test hours:
    *   **Observed Segment (0h to 24h):** Drawn as a solid green line representing measured, verified data points.
    *   **Predicted Segment (24h to 168h):** Drawn as a dotted cyan line mapping the GPR prior kernel estimation path.
    *   **Confidence Band:** A shaded, semi-transparent cyan polygon bounding the $\pm 5\%$ forecast margin around the mean path.
    *   **Safety Threshold:** A dashed red horizontal line representing the lot spec limit.
*   **Interactivity:** Automatically redraws when swapping parameters ($I_{ddq}$, $I_{leak}$, $t_{pd}$) or selecting different components.

### D. Explainability SHAP Attributions (Component Details Page)
*   **Concept:** Horizontal bar charts plotting individual feature weights (0% to 100%) contributing to the component's anomaly score, translating unsupervised ML into actionable engineering feedback.

---

## 4. Mock-Data Architecture

To decouple the interface from backend API development during Phase 2, a centralized mock database (`componentPool`) is implemented in `script.js` containing 128 components:
*   **Normal Population:** Programmatically generated using log-normal variations and standard BTI aging paths to yield realistic lot averages.
*   **Signature Test Cases:**
    1.  `COMP-00001` (PASS): Low leakage, stable delay, no anomalies.
    2.  `COMP-00042` (REJECT): High initial $I_{ddq}$ + rapid drift slope.
    3.  `COMP-00088` (MONITOR): Elevated $I_{ddq}$ outlier with a flat, stable drift rate.
    4.  `COMP-00105` (REJECT): Elevated propagation delay ($t_{pd}$) causing timing specification violations.
    5.  `COMP-00011` (MONITOR): Multi-parameter offset flagging joint outlier threshold.
    6.  `COMP-00027` (REJECT): Step-breakdown failure model showing oxide short circuit at 96h.

---

## 5. Future API Service Abstraction

The interface is structured to transition to production REST API endpoints in Phase 6:
*   **Phase 2 Mock Calls:** The UI pulls directly from the local `componentPool` database.
*   **Phase 6 Production Calls:** Local calls inside `script.js` will be mapped to standard `fetch()` API queries:
    *   `getLotSummary()` -> `GET /api/lot/LOT-2026-08-A17`
    *   `getComponentDetails(id)` -> `GET /api/component/id`
    *   `runOutlierDetection(lot_id)` -> `POST /api/anomaly-detect`
    *   `getDriftPrediction(id)` -> `POST /api/predict-drift`
*   **Decoupled Schema:** The JSON formats processed by the UI match the OpenAPI schemas defined in `architecture/data-flow.md`.
