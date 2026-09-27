# PREDICTA-26
## Predictive Reliability Engine for Dynamic Identification, Component Testing & Analysis

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://sih.gov.in)
[![Problem Statement 170](https://img.shields.io/badge/PS--170-ISRO_%2F_DoS-blue.svg)](https://github.com/umeshpandeysh/predicta-26)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2F20-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Decision Model](https://img.shields.io/badge/Decision_Model-Native_XGBoost_v4-green.svg)](ml/models/production/predicta_xgboost_model.json)
[![Tests](https://img.shields.io/badge/Pytest-700%2B_tests_passing-informational.svg)](tests/)
[![Operating Threshold](https://img.shields.io/badge/Operating_Threshold-0.20_Locked-blueviolet.svg)](ml/reliability_twin/reliability_twin_contract.json)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

> 🚀 **SIH 2026 Evaluator Fast-Track:**
> * ⏱️ **60-Second Orientation:** [**Judge & Reviewer Guide**](docs/JUDGE_GUIDE.md) — Problem, detection, forecasting, decisions, and evidence in 60s.
> * 🗺️ **Canonical Production Path:** [**Architecture Specification**](docs/architecture/canonical-production-path.md) — Authoritative stage-by-stage data flow and source mapping.
> * 📋 **Model & Governance Catalog:** [**Model Registry**](docs/models/model-registry.md) — Definitive status (`PRODUCTION`, `BENCHMARK`, `CALIBRATION_PENDING`) for all algorithms.
> * 🌐 **Live Cloud Workstation:** [**https://predicta-26-pi.vercel.app**](https://predicta-26-pi.vercel.app) — Fully deployed zero-install production environment.

---

## Problem Context

In aerospace, defense, and high-reliability semiconductor qualification (Smart India Hackathon 2026, Problem Statement 170 — ISRO / Department of Space), integrated circuits undergo rigorous **burn-in thermal and electrical stress testing**. Conventional screening relies heavily on static, point-in-time limit checking (e.g., ATE pass/fail at 0h or 24h).

This introduces two critical failure modes in semiconductor manufacturing:
1. **Latent-Defect Escapes:** Marginal dies with internal gate-oxide, metallization, or interface defects pass static parametric limits at 0h and 24h, yet degrade progressively during burn-in stress, leading to premature mission failure in the field.
2. **False Alarms & Wasteful Scrap:** Normal wafer-to-wafer process variations cause benign parameter shifts that breach overly tight static limits, resulting in the wasteful scrapping of healthy, flight-grade silicon.

---

## What PREDICTA Does

**PREDICTA-26** is a comprehensive, physics-informed semiconductor qualification workstation that converts early burn-in telemetry into traceable, auditable screening decisions:

* **Module A (Dynamic Outlier Detection):** Lot-relative multivariate anomaly detection (Robust MAD/PAT, COPOD, Isolation Forest) to catch anomalous dies that pass static limits but deviate from their cohort baseline.
* **Module B (Time-Series Drift Prognostics):** Trajectory forecasting from early 0h+24h telemetry checkpoints through the **168h Burn-In Evaluation Horizon** to project parameter degradation before final packaging.
* **Physics & Risk Fusion:** Physics consistency validation against semiconductor degradation mechanisms (BTI, thermal acceleration, gate leakage, timing margin) combined with multi-criteria risk synthesis.
* **Governed Decision & Human-in-the-Loop:** Decoupled statistical inference from operational manufacturing actions ($\theta^* = 0.20$ locked) with append-only human disposition audit trails.
* **10-Stage Digital Reliability Twin:** An immutable read-model ledger preserving complete genealogy and lifecycle evidence from wafer sort to final disposition.

```mermaid
flowchart TD
    A["Raw Burn-In Telemetry (0h, 24h)"] --> B["Module A: Dynamic Outlier Detection (Robust MAD, PAT, COPOD)"]
    A --> C["Module B: Time-Series Drift Prognostics (168h Horizon Forecast)"]
    B --> D["Physics-Aware Validation (BTI, Leakage, Thermal, Timing)"]
    C --> D
    D --> E["Multi-Criteria Risk Fusion & Uncertainty Analysis"]
    E --> F["Governed Decision Engine (Threshold theta* = 0.20)"]
    F --> G["Operational Recommendation (PASS / MONITOR / RETEST / REJECT)"]
    G --> H["Human Disposition Ledger (Append-Only Governance)"]
    H --> I["Digital Reliability Twin (10-Stage Lineage & Audit Trail)"]
```

---

## 60-Second Demo & User Manual — How to Use PREDICTA

### 1. Open the Live Application
Launch the deployed PREDICTA production workstation in any modern web browser:
> **Production URL:** **[https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)**  
> *(Zero local installation or build steps required)*

### 2. Authenticate
Access the **Operator Login** modal from the navigation header. The system utilizes session-based signed JWT tokens stored securely in client session storage to authorize inference and disposition actions without exposing backend credentials.

### 3. Submit a Qualification Analysis
Operators can analyze individual dies or full wafer batches:
* **Single Die Qualification:** Enter the 14 parametric channels (Supply Voltage, Quiescent Leakage $I_{\text{ddq}}$, Gate Leakage $I_{\text{leak}}$, Propagation Delay $T_{\text{pd}}$, Threshold Voltage $V_{\text{th}}$, Temperature, etc.) or click one of the quick preset buttons.
* **Automated Data Quality Gate:** Out-of-bounds telemetry (e.g., negative physical delay or extreme temperature) is immediately intercepted and flagged prior to inference.

### 4. Understand the Screening Output
When analysis completes, PREDICTA delivers a multi-faceted assessment:
* **Failure Probability ($P_{\text{fail}}$):** Calibrated risk score produced by the 350-tree Native XGBoost classifier.
* **Operational Disposition:** Clear routing (`PASS`, `MONITOR`, `RETEST`, `REJECT`) governed by the fail-closed threshold ($\theta^* = 0.20$).
* **Anomaly & Outlier Attribution:** Z-score deviation relative to the active lot cohort via Part Average Testing (PAT) and COPOD copula tail probabilities.
* **168h Prognostic Horizon Forecast:** Projected parameter trajectory at the standard burn-in checkpoint.

### 5. Review Evidence & Decision Rationale
* **"WHY FLAGGED" Explanation:** Review the 6-layer evidence stack linking raw measurements, cohort statistics, physics limits, and model attribution.
* **Digital Reliability Twin:** Open the 10-stage lifecycle card to inspect the die's complete provenance from wafer sort to final screening.
* **Deterministic Trace ID:** Every qualification generates an immutable trace ID (`PRED-2026-XXXXXXXX`) persisted in cloud PostgreSQL for compliance auditing.

### 6. Quick 5-Step Demo Sequence for SIH Judges
1. Open **[https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)** and click **Decision Center** or **Judge Journey**.
2. Click **Case A (`NORMAL`)**: Observe nominal screening ($\text{PASS}$, $P < 1\%$).
3. Click **Case B (`LATENT_DEFECT`)**: Observe static limit escape detection—single-point ATE passed, but lot PAT outlier ($Z = 6.08$) and 168h drift trigger governed $\text{REJECT}$.
4. Click **Case C (`FALSE_ALARM`)**: Observe scrap prevention—benign process shift routed to non-destructive $\text{MONITOR}$ rather than wasteful scrap.
5. Inspect **Fleet Monitoring**: Observe the 50-lot cohort distribution, constituent wafers, and equipment variance.

---

## System Architecture & Manufacturing Data Flow

PREDICTA ingests telemetry directly from automated test equipment (ATE) and burn-in chambers across standard manufacturing splits:

```mermaid
flowchart TD
    subgraph Manufacturing ["1. Manufacturing & Fleet Ingestion"]
        L["Lot Split (LOT-SYN-001..050)"] --> W["Wafers (WFR-001..100)"]
        W --> D["Dies / Components (50 Dies / Wafer)"]
        D --> EQ["Test Equipment (EQP-101..105)"]
    end

    subgraph Telemetry ["2. Parametric Burn-In Observations"]
        EQ --> T0["0h Baseline ATE Telemetry"]
        EQ --> T24["24h Early Burn-In Checkpoint"]
    end

    subgraph Analytics ["3. PREDICTA Analytical Core"]
        T0 & T24 --> M1["Robust MAD / Part Average Testing (PAT)"]
        T0 & T24 --> M2["COPOD Copula Tail Outlier Engine"]
        T0 & T24 --> M3["Native 350-Tree XGBoost Probability"]
        T0 & T24 --> M4["168h Trajectory Degradation Forecaster"]
    end

    subgraph Synthesis ["4. Physics & Decision Governance"]
        M1 & M2 & M3 & M4 --> RF["Multi-Criteria Risk Fusion Matrix"]
        RF --> PHY["Semiconductor Physics Validator (BTI/Thermal)"]
        PHY --> GOV["Governed Decision Center (Locked theta* = 0.20)"]
    end

    subgraph Output ["5. Lifecycle & Action"]
        GOV --> DISP["Operator Disposition (Append-Only Ledger)"]
        DISP --> TWIN["Digital Reliability Twin (10-Stage Provenance)"]
    end
```

---

## Multi-Layer Evidence Pipeline

Rather than relying on a black-box model score, PREDICTA constructs a 6-layer evidence stack for every screening decision:

```mermaid
flowchart LR
    L1["Layer 1: Static Limits<br>(Absolute Spec Bounds)"] --> L2["Layer 2: Lot-Relative Outlier<br>(Robust MAD / PAT Z-Score)"]
    L2 --> L3["Layer 3: Parameter Drift<br>(0h to 24h Delta Vector)"]
    L3 --> L4["Layer 4: Physics Validity<br>(BTI, Thermal, Leakage)"]
    L4 --> L5["Layer 5: ML Risk Estimation<br>(Native XGBoost Classifier)"]
    L5 --> L6["Layer 6: Multi-Criteria Synthesis<br>(PASS / MONITOR / REJECT)"]
```

1. **Static Parametric Limits:** Verifies basic datasheet tolerances ($V_{\text{dd}}$, $I_{\text{leak}}$, $T_{\text{pd}}$, $V_{\text{th}}$).
2. **Lot-Relative Outlier Scoring:** Evaluates Part Average Testing (PAT) and COPOD scores relative to the specific lot cohort.
3. **Time-Series Parameter Drift:** Measures 0h $\to$ 24h degradation rate ($\Delta I_{\text{ddq}} / \Delta t$, $\Delta T_{\text{pd}} / \Delta t$).
4. **Physical Degradation Consistency:** Evaluates kinetic plausibility against Bias Temperature Instability (BTI) and Arrhenius thermal acceleration.
5. **Machine Learning Risk Estimation:** Evaluates native XGBoost failure probability calibrated via Platt scaling against operating threshold $\theta^* = 0.20$.
6. **Multi-Criteria Synthesis:** Produces final operational routing (`PASS`, `MONITOR`, `RETEST`, `REJECT`).

---

## Machine Learning & Statistical Anomaly Detection

* **Part Average Testing (PAT) & Robust MAD:** Univariate and bivariate median absolute deviation scoring relative to the active wafer and lot distribution.
* **COPOD (Copula-Based Outlier Detection):** Non-parametric multivariate tail-probability estimation to detect joint distribution shifts across leakage, delay, and current.
* **Isolation Forest:** High-dimensional recursive partitioning to detect subtle non-linear multi-parameter outliers.
* **Native XGBoost Classifier (`predicta_xgboost_model.json`):** 350-tree gradient boosted decision tree classifier operating on 28 engineered reliability features, calibrated via Platt scaling ($A = -1.0412, B = 1.0037$).

---

## Physics-Aware Reliability Analysis

PREDICTA cross-checks statistical ML outputs against physical degradation mechanisms:
* **Bias Temperature Instability (BTI):** Models threshold voltage shift $\Delta V_{\text{th}} \propto t^{n}$ ($n \approx 0.16\text{--}0.25$) to ensure drift is physically plausible.
* **Gate & Standby Leakage:** Evaluates Poole-Frenkel and trap-assisted tunneling leakage scaling relative to junction temperature.
* **Thermal Acceleration:** Arrhenius acceleration factor $AF = \exp\left(\frac{E_a}{k_B}\left(\frac{1}{T_1} - \frac{1}{T_2}\right)\right)$ calibrated with activation energy $E_a = 0.7\,\text{eV}$.
* **Timing Degradation:** Verifies propagation delay drift against dynamic operating frequency and setup/hold margins.

---

## Governed Decision & Disposition Architecture

PREDICTA strictly decouples raw statistical inference from operational manufacturing actions:

```text
Telemetry Ingestion
   │
   ▼
Dynamic Detection (PAT, COPOD, Isolation Forest)
   │
   ▼
Reliability & Drift Analysis (0h -> 24h -> 168h Trajectory)
   │
   ▼
Evidence & Uncertainty Assessment (Physics Consistency & Confidence)
   │
   ▼
Governed Decision Synthesis (Locked Threshold θ* = 0.20)
   │
   ▼
Operational Routing (PASS / MONITOR / RETEST / REJECT)
   │
   ▼
Human Operator Review & Append-Only Audit Traceability
```

### Architectural Principles:
1. **Telemetry Ingestion & Pre-Validation:** Automated validation checks that incoming electrical and thermal sensor readings meet data quality bounds prior to downstream processing.
2. **Dynamic Anomaly Detection:** Statistical engines evaluate individual die parameters against the active manufacturing lot cohort to catch population outliers.
3. **Reliability & Drift Prognostics:** Time-series algorithms project parameter drift from early burn-in intervals toward the 168-hour evaluation checkpoint.
4. **Evidence & Uncertainty Assessment:** Physics-of-failure constraints (BTI, thermal acceleration, junction leakage) cross-verify statistical anomalies to eliminate false mathematical artifacts.
5. **Governed Decision Synthesis:** Statistical probability is mapped against the locked operating threshold ($\theta^* = 0.20$). If either the statistical model or the independent anomaly engine flags critical risk, the system fails closed.
6. **Operational Disposition:** The system issues actionable recommendations (`PASS`, `MONITOR`, `RETEST`, `REJECT`) with explicit routing rationales.
7. **Human Operator Governance:** Quality engineers review flagged components and record formal dispositions (`PASS_CONFIRMED`, `MONITOR_EXTENDED`, `RETEST_ATE`, `SCRAP_AUTHORIZED`, `ESCALATE_TO_MRB`) in an append-only audit ledger without overwriting original inference records.

---

## Digital Reliability Twin & Cryptographic Traceability

Every semiconductor die evaluated by PREDICTA is tracked as a deterministic **Digital Reliability Twin** read model. This read model aggregates and preserves evidence across the entire component lifecycle without altering historical ground truth:

### 10-Stage Lifecycle Read Model:
1. **Stage 1 — Identity & Genealogy:** Tracks immutable manufacturing identifiers including Lot ID, Wafer ID, Die coordinates, and Test Station ID.
2. **Stage 2 — Raw Telemetry Observations:** Records multi-channel parametric measurements captured at 0h and 24h burn-in checkpoints.
3. **Stage 3 — Outlier & Anomaly Attribution:** Evaluates lot-relative deviation using Robust MAD Z-scores and COPOD copula tail probabilities.
4. **Stage 4 — Time-Series Degradation Trajectory:** Forecasts parameter drift across 24h $\to$ 96h $\to$ 168h burn-in horizons.
5. **Stage 5 — Physics Consistency Validation:** Validates kinetic degradation plausibility against Arrhenius thermal and BTI degradation models.
6. **Stage 6 — Multi-Criteria Risk Fusion:** Synthesizes anomalous signals, physics consistency, and historical lot distributions into a unified risk index.
7. **Stage 7 — Governed Decision:** Compares failure probability against the locked operating threshold ($\theta^* = 0.20$) to produce automated guidance.
8. **Stage 8 — Secondary Test Adjudication:** Logs optional automated retest evidence or specialized laboratory diagnostic outcomes.
9. **Stage 9 — Human Operator Disposition:** Captures authorized operator actions, root-cause notes, and disposition timestamps.
10. **Stage 10 — Cryptographic Provenance & Ledger:** Computes deterministic SHA-256 state hashes linking telemetry, model versions, and disposition history.

### Cryptographic Artifact Contracts:
* **Production XGBoost Model SHA-256:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
* **Production Dataset SHA-256:** `48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06`
* **Authoritative Operating Threshold:** `0.20` (locked in contract)

---

## Demonstration Cases

PREDICTA provides three authoritative, reproducible canonical cases derived directly from [`src/governance/canonical_demo_data.json`](src/governance/canonical_demo_data.json):

| Canonical Case | ID & Trace | Telemetry Profile | Detection & Evidence | Governed Decision | Operational Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A: NORMAL** | `COMP-NORMAL`<br>`TR-NORMAL-2026` | $I_{\text{leak}} = 111.7\,\mu\text{A}$<br>threshold_voltage $V_{\text{th}} = 0.45\,\text{V}$<br>$T = 28.6\,^\circ\text{C}$ | ML Probability $P = 0.0048$<br>Anomaly Score $= 0.1095$<br>168h Forecast $= 145.2\,\mu\text{A}$ | **PASS**<br>`ACCEPT` | Nominal baseline device operating safely within all static, lot-relative, and physical drift bounds. |
| **Case B: LATENT DEFECT** | `COMP-LATENT_DEFECT`<br>`TR-LATENT-2026` | $I_{\text{leak}} = 145.0\,\mu\text{A}$<br>*(Passes static $250\,\mu\text{A}$ limit)* | PAT Z-Score $= 6.08 > 3.0$<br>168h Forecast $= 278.4\,\mu\text{A}$<br>ML Probability $P = 0.0840$ | **REJECT**<br>`CRITICAL` | **Static Limit Escape:** Device passes single-point limits but lot-relative outlier score and 168h drift trajectory reveal severe latent degradation. |
| **Case C: FALSE ALARM** | `COMP-FALSE_ALARM`<br>`TR-FALSE-2026` | $T_{\text{pd}} = 11.89\,\text{ns}$<br>$I_{\text{leak}} = 108.2\,\mu\text{A}$ | Timing shift triggers PAT Monitor,<br>but ML Risk $P = 0.0048$<br>Physics = Stable | **MONITOR**<br>`HOLD` | **Scrap Avoidance:** Benign process shift flagged for non-destructive retest/monitoring without discarding healthy flight silicon. |

---

## Dataset Used

PREDICTA is built upon authoritative, cryptographically verified qualification telemetry data:

### 1. Primary Production Telemetry Dataset
* **File Path:** [`ml/data/synthetic/predicta_dataset_v3_50000.csv`](ml/data/synthetic/predicta_dataset_v3_50000.csv)
* **Dataset Size:** 50,000 complete telemetry records (17.77 MB).
* **Manufacturing Structure:** 50 disjoint lots (`LOT-SYN-001` through `LOT-SYN-050`), 100 constituent wafers (`WFR-001` through `WFR-100`), 50 dies per wafer (5,000 unique dies across 10 temporal steps).
* **Test Stations:** 5 equipment stations (`EQP-101` through `EQP-105`).
* **Telemetry Channels:** 14 primary parametric channels:
  * Electrical: Supply Voltage ($V_{\text{dd}}$), Output Voltage ($V_{\text{out}}$), Total Current ($I_{\text{dd}}$), Quiescent Leakage ($I_{\text{ddq}}$), Gate Leakage ($I_{\text{leak}}$), Threshold Voltage ($V_{\text{th}}$).
  * Timing & Performance: Propagation Delay ($T_{\text{pd}}$), Operating Frequency ($f_{\text{clk}}$), Setup Time, Hold Time, Timing Margin.
  * Thermal & Power: Temperature ($T$), Dynamic Power, Total Power, Test Duration.
* **Temporal Checkpoints:** Observations captured across 0h, 24h, 96h, and 168h burn-in intervals.
* **Disjoint Cohort Split (`split_manifest.json`):**
  * 35 Training Lots (`LOT-SYN-001` .. `LOT-SYN-035` / 3,500 dies)
  * 3 Validation Tune Lots (`LOT-SYN-036` .. `LOT-SYN-038` / 300 dies)
  * 4 Calibration Lots (`LOT-SYN-039` .. `LOT-SYN-042` / 400 dies)
  * 8 Independent Test Lots (`LOT-SYN-043` .. `LOT-SYN-050` / 800 dies)
* **Protected SHA-256 Checksum:** `48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06`

### 2. External & Reference Benchmarking Datasets
For scientific benchmarking and cross-validation, PREDICTA also references:
* **ST-AWFD (Semiconductor Wafer Defect Dataset):** Spatial defect cluster evaluation.
* **SECOM (Semiconductor Manufacturing Data):** Feature relevance benchmarking.
* **AI4I (Predictive Maintenance Dataset):** Multi-modal tool failure benchmarking.
* **NASA PCoE IGBT #8 (Power Semiconductor Accelerated Aging):** Thermal and electrical degradation validation.

> [!NOTE]
> The primary dataset is a synthetic qualification cohort modeled after JEDEC JESD22 burn-in standards. It is explicitly identified as synthetic data to preserve full scientific honesty and prevent confusion with proprietary fab silicon records.

---

## Scientific Rigor & Governance Boundaries

PREDICTA enforces strict scientific honesty and integrity standards:

1. **Evaluation Horizon Disclaimer:**
   > `168H_EVALUATION_HORIZON_NOT_FAILURE_TIME`  
   > 168 hours represents the standard semiconductor burn-in evaluation horizon, **not** a physical time-to-failure or Mean Time Between Failures (MTBF) claim.
2. **Model Attribution vs. Causality:**
   > `MODEL ATTRIBUTION — NOT A CAUSAL CLAIM`  
   > Feature contribution scores represent statistical model attribution within the trained feature space, not physical root-cause assertions.
3. **Read-Only Reliability Twin:**
   The Digital Reliability Twin is an authoritative **read model**. Requesting a twin record never triggers hidden background ML inference or mutates ground-truth datasets.
4. **Fail-Closed Security:**
   Missing fields, out-of-bounds telemetry, corrupted manifests, or unregistered lot/component queries fail closed safely without fabricating default values.
5. **Protected Artifact Cryptographic Lock:**
   * **Production XGBoost Model:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
   * **Production Dataset:** `48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06`
   * **Authoritative Operating Threshold:** `0.20`

---

## Technical Stack

* **Machine Learning & Analytics:** Python 3.11, Native XGBoost (`xgboost==2.0.3`), NumPy, SciPy, Scikit-Learn.
* **Backend API Gateway:** Node.js 18/20 HTTP REST Gateway, Express, crypto SHA-256 validation engines.
* **Physics & Degradation Models:** Custom BTI kinetic, Poole-Frenkel leakage, and Arrhenius thermal evaluators.
* **Frontend Workstation:** Pure HTML5/ES6 architecture with exact byte parity across root and `frontend/` mirrors (zero build-step dependency, zero third-party CDNs).
* **Test & Verification Framework:** Pytest 9.x, Node test runners, Ruff linter, multi-runtime parity test suites.

---

## Repository Map

```text
predicta-26/
├── src/
│   ├── api/                 Inference service, REST routes, schemas, server.js
│   ├── anomaly_detection/   MAD, PAT, COPOD, and statistical outlier engines
│   ├── features/            Feature contract, normalization, and bounds
│   ├── fleet/               Authoritative FleetManager (Python & Node.js)
│   ├── governance/          Disposition manager, taxonomies, canonical_demo_data.json
│   ├── physics/             BTI, thermal acceleration, and leakage consistency
│   ├── prognostics/         168h trajectory forecaster and governance gates
│   ├── reliability_twin/    10-stage Digital Reliability Twin read model
│   └── risk_fusion/         Multi-criteria risk fusion matrix
├── ml/
│   ├── data/                50k production dataset & 50-lot split manifest
│   ├── models/production/   Protected XGBoost model and calibration artifacts
│   ├── reliability_twin/    Reliability twin immutability contract
│   └── training/            Native XGBoost training & validation scripts
├── frontend/                100% byte-identical client mirror (index.html, script.js, api.js)
├── tests/                   700+ automated unit, integration, parity, and adversarial test suites
├── docs/                    API specifications, mathematical proofs, and runbooks
├── index.html               Main demonstration application & Guided Walkthrough
├── script.js                Frontend workstation application script
├── api.js                   REST API client library
└── style.css                Workstation styling & design system
```

---

## Local Development & Installation

For developers contributing to or running PREDICTA locally:

```bash
# 1. Clone Repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# 2. Install Python & Node.js Dependencies
pip install -r requirements.txt
npm install

# 3. Start Backend REST API Server (Port 3000)
node src/api/server.js

# 4. Open Application
# Open http://localhost:3000 in your browser or launch index.html
```

### Automated Verification & Test Commands

```bash
# 1. Run Complete Python Test Suite (700+ Tests)
python -m pytest tests/ -v

# 2. Run Phase 19 Test Suites (Fleet & Guided Journey)
python -m pytest tests/test_phase19_fleet.py tests/test_phase19_judge_journey.py -v
node tests/test_phase19_fleet.js
node tests/test_phase19_judge_journey.js

# 3. Run Cross-Runtime Parity & Production Certification Stack
npm test

# 4. Run Static Analysis & Linter
python -m ruff check src tests
```

---

## SIH Problem Statement Reference

* **Organization:** Smart India Hackathon (SIH 2026)
* **Problem Statement:** PS-170 — AI-Driven Anomaly Detection in Component Burn-In & Screening
* **Theme:** Smart Automation / Software
* **Ministry / Department:** ISRO • Department of Space

---

**PREDICTA-26** · Semiconductor Burn-In Telemetry & Latent Defect Screening  
[GitHub Repository](https://github.com/umeshpandeysh/predicta-26)
