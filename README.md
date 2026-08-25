# Predicta 26

## AI-Driven Predictive Burn-In Screening
### Smart India Hackathon (SIH) 2026 — Problem Statement 170
**Organization:** ISRO Space Applications Centre (SAC)  
**Theme:** Smart Automation  
**Team Leader:** Umesh Pandey  
**Co-Participants:** Anup Gupta, Swayam Jha, Shekhar Yadav, Harshima Joshi, Hans  

---

## 1. Project Overview

This repository contains the technical implementation for **SIH 2026 Problem Statement 170** sponsored by the **Indian Space Research Organisation (ISRO)**. 

Spacecraft and launch vehicles require semiconductor components with near-zero failure rates. Traditional Environmental Stress Screening (ESS) and Burn-In testing rely on **static datasheet limits** to screen out defective parts. However, this static approach fails to detect **latent defects**—components that pass initial absolute limits but possess manufacturing variations that cause rapid parametric drift and premature failure under operational stress.

**Predicta 26** is a dual-module machine learning and statistical framework that replaces retrospective static screening with proactive, physics-informed anomaly detection and drift forecasting.

```
Burn-In / Screening Data (Iddq, Leakage, Delay)
                     ↓
         Data Ingestion & Validation
                     ↓
        Robust Lot-Level Normalization
                     ↓
           ┌─────────┴─────────┐
           ▼                   ▼
       Module A            Module B
   Dynamic Outlier      168h Parametric
   Detection (IForest)  Drift Prediction
           ▼                   ▼
           └─────────┬─────────┘
                     ▼
          Combined Decision Engine
                     ▼
          PASS / MONITOR / REJECT
```

---

## 2. Core Technical Architecture

The system consists of two independent machine learning/statistical engines integrated into a unified risk-aware decision framework:

### Module A: Dynamic Outlier Detection
*   **Purpose:** Identify components whose electrical properties deviate from the lot population, even if they remain within static datasheet boundaries.
*   **Methodology:** 
    1.  Ingest multi-parameter measurements: quiescent current ($I_{ddq}$), gate leakage current ($I_{leak}$), and propagation delay ($t_{pd}$).
    2.  Perform **lot-level robust standardization** using Median and Median Absolute Deviation (MAD) to filter out wafer-level process variations.
    3.  Compute non-parametric copula tail probabilities using **COPOD (Copula-Based Outlier Detection)** to evaluate multivariate anomaly scores.
*   **Output:** Anomaly flag, parameter contribution attributions (XAI), and relative lot deviation.

### Module B: 168h Drift Prediction
*   **Purpose:** Predict the parameter values at the end of the burn-in cycle (168h) using early-stage measurements (0h and 24h), allowing for early rejection and test-time reduction.
*   **Methodology:**
    1.  Ingest $0\text{h}$ and $24\text{h}$ measurements along with temperature/voltage stress logs.
    2.  Apply **Physics-Informed Gaussian Process Regression (GPR)** with a customized power-law kernel modeling Negative Bias Temperature Instability (NBTI) degradation trends ($t^{0.2}$).
    3.  Extract predicted $Value_{168h}$ along with its corresponding prediction variance (uncertainty).
*   **Output:** Predicted 168h value, predicted drift slope, 95% confidence intervals, and safety-slope threshold checks.

### Decision Engine
The final component status is determined by combining the outputs of both modules:
*   **PASS:** Component is statistically normal within the lot and predicted to remain stable.
*   **MONITOR:** Component is slightly anomalous or exhibits marginal drift; requires secondary inspection.
*   **REJECT:** Component is flagged as a statistical outlier OR its predicted drift rate exceeds the safety slope OR its upper 95% confidence interval crosses specification limits.

---

## 3. Repository Structure

```text
ps170-ai-burnin-screening/
│
├── README.md                 <- Master technical overview
├── LICENSE                   <- Apache 2.0 License
├── CONTRIBUTING.md           <- Engineering guidelines
├── CODE_OF_CONDUCT.md        <- Contributor code of conduct
├── SECURITY.md               <- Security policy
├── CHANGELOG.md              <- Project history
│
├── docs/                     <- Detailed documentation
│   ├── problem-statement.md  <- Official requirements
│   ├── problem-analysis.md   <- Static vs. Dynamic screening analysis
│   ├── system-overview.md    <- High-level overview
│   ├── technical-architecture.md <- Module A/B pipelines
│   ├── physics-of-failure.md <- BTI and parameter drift physics
│   ├── data-strategy.md      <- Dataset registry and synthetic math
│   ├── ml-strategy.md        <- Algorithm benchmarking
│   ├── decision-engine.md    <- Safety-slope definitions
│   ├── validation-strategy.md <- Cost-weighted metrics
│   └── references.md         <- Citations
│
├── architecture/             <- System maps & diagrams
│   ├── system-architecture.md
│   ├── data-flow.md
│   ├── ml-pipeline.md
│   └── diagrams/
│
├── data/                     <- Dataset registry
│   ├── README.md             <- Data classifications
│   ├── raw/                  <- Raw downloaded logs
│   ├── processed/            <- Normalized ML-ready sets
│   ├── synthetic/            <- Physics-simulated datasets
│   ├── proxy/                <- NASA/STMicroelectronics proxy logs
│   └── sample/               <- CI-testing sample files
│
├── src/                      <- Source code
│   ├── ingestion/            <- STDF loaders
│   ├── preprocessing/        <- Robust normalization pipeline
│   ├── anomaly_detection/    <- COPOD & MAD outlier models
│   ├── drift_prediction/     <- GPR regression models
│   ├── physics/              <- BTI degradation equations
│   ├── decision_engine/      <- Safety-slope logic
│   └── api/                  <- FastAPI backend endpoints
│
├── models/                   <- Model persistence
│   ├── anomaly/              <- Saved COPOD parameters
│   └── drift/                <- Saved GPR kernels
│
├── notebooks/                <- Exploratory analysis notebooks
├── experiments/              <- Experiment logs
├── tests/                    <- Pytest test cases
├── frontend/                 <- UI source files
├── scripts/                  <- Pipeline execution scripts
└── configs/                  <- Formatting/linting configurations
```

---

## 4. Physics-of-Failure & Data Strategy

### Semiconductor Aging Physics
Our models are grounded in the physical mechanisms that govern transistor wear-out under thermal and electrical stress:
*   **Threshold Voltage Drift:** Bias Temperature Instability (BTI) traps charges in the gate dielectric, causing threshold voltage ($V_{th}$) to drift upward following a power-law: $\Delta V_{th}(t) \propto t^n$ ($n \approx 0.20$).
*   **Delay Degradation:** An increase in $V_{th}$ degrades saturation current, causing the propagation delay ($t_{pd}$) to **increase** over time.
*   **Leakage Spikes:** While healthy subthreshold leakage decreases, latent defects (such as gate oxide micro-shorts) undergo localized thermal breakdown, causing quiescent current ($I_{ddq}$) to **drift upward or spike**.

### Data Registry and Classifications
We strictly separate data categories to preserve scientific integrity:
1.  **Confirmed Public Proxy Data:** We utilize the public **NASA Power MOSFET Thermal Overstress Dataset** and the **STMicroelectronics ST-AWFD Wafer Fault Dataset** to train and validate our predictive pipelines.
2.  **Physics-Based Synthetic Data:** We run a python-based degradation simulator (`scripts/generate_synthetic_data.py`) to generate a synthetic dataset matching the specific 0h, 24h, 96h, and 168h intervals required by ISRO, incorporating log-normal lot variations and simulated latent defects.
3.  **Real Flight Data:** Flight-grade burn-in logs are proprietary to ISRO; no proprietary data is committed to this repository.

---

## 5. Development Roadmap & Completed Phases

All 6 development phases have been successfully implemented, tested, and validated:
*   **Phase 1: Project Foundation [COMPLETED]** — Scaffolding, technical and physical documentation, linting configs, and CI validation scripts.
*   **Phase 2: UI/UX Console Prototype [COMPLETED]** — Developed the interactive semiconductor screening dashboard displaying lot maps, drift plots, and GPR confidence intervals.
*   **Phase 3: Data Acquisition [COMPLETED]** — Downloaded and registered the ST-AWFD, NASA MOSFET, and UCI SECOM proxy datasets.
*   **Phase 4: Data Engineering & Simulator [COMPLETED]** — Implemented the physics-informed synthetic data generator (`generate_synthetic_data.py`) and executed schema validation checks.
*   **Phase 5: Module A Outlier Screening [COMPLETED]** — Built the Isolation Forest and Robust MAD detectors, evaluating them at the 24h Early Screening window.
*   **Phase 6: Module B & Decision Engine Integration [COMPLETED]** — Implemented GPR trend prediction, safety-slope calculators, unified decision logic, and end-to-end unit test validation.

---

## 6. Model Benchmarks (24h Early Screening Window)

### Module A: Outlier Screening (800 Parts Test Set)
*   **Isolation Forest Ensemble (Active):** Recall = **88.9%**, Precision = **61.5%**, FNR = **11.1%**, FPR = **1.9%**.
*   **Robust MAD Baseline:** Recall = **81.5%**, Precision = **59.5%**, FNR = **18.5%**, FPR = **1.9%**.
*   **COPOD Unsupervised Copulas:** Recall = **29.6%**, Precision = **20.5%**, FNR = **70.4%**, FPR = **4.0%**.

### Module B: 168h Drift Forecasting (MAE Scores)
*   **Supply Current (Iddq):** GPR MAE = **23.59 µA** (vs. Persistence = 26.27 µA).
*   **Gate Leakage (Ileak):** GPR MAE = **3.23 µA** (vs. Persistence = 3.63 µA).
*   **Propagation Delay (tpd):** GPR MAE = **2.12 ns** (vs. Persistence = 4.12 ns — **48.6% error reduction**).

---

## 7. Installation & Quick Start

### Prerequisites
*   Node.js (v18+) - for the automated test runners and local dashboard execution.
*   Python (3.10+) - for the backend machine learning model execution.

### Quick Start & Testing
To execute the complete automated test suite verifying registries, data schemas, frontend files, and ML model mathematics:
```bash
# Clone the repository
git clone https://github.com/umeshpandeysh/HBD-main-ak.git
cd ceenew

# Run all 5 automated integrity test suites
node tests/test_frontend.js
node tests/test_registries.js
node tests/test_phase4.js
node tests/test_anomaly.js
node tests/test_drift.js
```

---

## 8. References & Standards

*   **AEC-Q001:** *Guidelines for Part Average Testing* (Automotive Electronics Council).
*   **MIL-STD-883 Method 1015:** *Microelectronics Burn-In Test* (US Department of Defense).
*   **ISRO-PAS-206:** *Qualification Requirements for Thick Film Hybrid Microcircuits* (ISRO Space Applications Centre).
*   **Dobbelaere, W. et al. (2016):** *Analog fault coverage improvement using final-test dynamic part average testing*, IEEE International Test Conference (ITC).
*   **Singh, K. & Kalra, S. (2022):** *Analysis of Negative-Bias Temperature Instability Utilizing SVR*, IEEE Transactions on Device and Materials Reliability.
