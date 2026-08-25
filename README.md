# Predicta 26

### AI-Driven Predictive Burn-In Screening

**Smart India Hackathon 2026 · Problem Statement 170**

[![Python CI Pipeline](https://github.com/umeshpandeysh/predicta-sih2026-ps170/actions/workflows/ci.yml/badge.svg)](https://github.com/umeshpandeysh/predicta-sih2026-ps170/actions/workflows/ci.yml)
![SIH 2026](https://img.shields.io/badge/SIH%202026-PS%20170-blue?style=flat-square)
![ISRO SAC](https://img.shields.io/badge/Organization-ISRO%20SAC-orange?style=flat-square)
![Python 3.10](https://img.shields.io/badge/Python-3.10-green?style=flat-square)
![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-lightgrey?style=flat-square)

---

Predicta 26 is an advanced machine learning and statistical physics framework designed for early defect identification and parametric drift forecasting in high-reliability semiconductor burn-in testing. Built for **Smart India Hackathon 2026 (Problem Statement 170)** sponsored by the **ISRO Space Applications Centre (SAC)**.

---

## Problem

Spacecraft and launch vehicle electronics demand microelectronic components with near-zero failure rates. Traditional Environmental Stress Screening (ESS) and Burn-In testing subject components to elevated temperatures ($125^\circ\text{C}$) and electrical stress for $168\text{ hours}$. 

However, conventional screening relies on **static datasheet limits** to flag defects:
- **Latent Defects Missed:** Components with subtle manufacturing flaws can pass static datasheet limits at $0\text{h}$ and $24\text{h}$, yet undergo rapid non-linear degradation under stress.
- **High Resource Cost:** Retrospective $168\text{h}$ testing requires full stress duration for all components, wasting oven capacity, energy, and cycle time.
- **Process Variation Masking:** Lot-to-lot and wafer-level manufacturing shifts can mask early individual parameter anomalies.

---

## Predicta 26 Approach

Predicta 26 introduces a dynamic, dual-module framework that shifts screening from static retrospective testing to proactive, physics-informed early decision making:

1. **Early Stress Data Ingestion:** Evaluates initial $0\text{h}$ baseline and early $24\text{h}$ stress measurements ($I_{ddq}$, $I_{leak}$, $t_{pd}$).
2. **Lot-Relative Normalization:** Uses Median and Median Absolute Deviation (MAD) standardization to decouple wafer-level process shifts from individual component defects.
3. **Module A (Dynamic Outlier Detection):** Employs non-parametric copula models (COPOD) and Isolation Forests to flag multivariate statistical outliers within the lot population at $24\text{h}$.
4. **Module B (168h Drift Prediction):** Leverages Physics-Informed Gaussian Process Regression (GPR) with Negative Bias Temperature Instability (NBTI) power-law degradation kernels ($t^{0.2}$) to forecast $168\text{h}$ parameter values and 95% confidence bounds.
5. **Uncertainty-Aware Risk Assessment:** Combines anomaly scores, predicted $168\text{h}$ parameter drift, and safety-slope threshold checks into a unified **PASS / MONITOR / REJECT** classification.

---

## System Architecture

```text
       Burn-In Electrical Logs (0h & 24h: Iddq, Ileak, tpd)
                                 │
                     Data Ingestion & Validation
                                 │
                   Robust Lot-Level Standardization (MAD)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
            Module A                          Module B
     Dynamic Outlier Screening        168h Parametric Drift Prediction
     (Isolation Forest & COPOD)       (Gaussian Process Regression)
                │                                 │
                └────────────────┬────────────────┘
                                 ▼
                     Unified Risk Decision Engine
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
          PASS                MONITOR               REJECT
     (Qualified Part)    (Secondary Check)   (Early Screening Outlier)
```

---

## Technology Stack

Predicta 26 utilizes robust open-source data science and web technologies:

- **Core Analytics:** `Python` `Pandas` `NumPy` `Scikit-Learn`
- **Anomaly Detection (Module A):** `Isolation Forest` `Robust MAD` `COPOD`
- **Drift Prediction (Module B):** `Gaussian Process Regression (GPR)` `NBTI Physics Kernels`
- **Model Interpretability:** `SHAP` `Parameter Attribution`
- **Application & API:** `REST API` `Streamlit` `Plotly`
- **Frontend Dashboard:** `HTML5` `Vanilla CSS` `JavaScript (ES6)`

---

## ML Pipeline

### Module A: Dynamic Outlier Screening
- **Inputs:** $0\text{h}$ and $24\text{h}$ measurements ($I_{ddq}$, $I_{leak}$, $t_{pd}$).
- **Normalizer:** Lot-level median absolute deviation ($Z_{\text{robust}} = \frac{x - \text{median}}{1.4826 \times \text{MAD}}$).
- **Outlier Engine:** Multi-parameter Isolation Forest & COPOD tail probability evaluation.

### Module B: 168h Drift Forecasting
- **Inputs:** $0\text{h}$ and $24\text{h}$ measurements with oven stress profiles ($125^\circ\text{C}$).
- **Predictor:** Physics-informed GPR with power-law covariance modeling $t^{0.2}$ BTI degradation.
- **Uncertainty Bounds:** 95% Bayesian prediction interval ($\mu_{168h} \pm 1.96 \times \sigma_{168h}$).

### Unified Decision Engine
- **PASS:** Statistically normal within lot population and predicted $168\text{h}$ parameters within specification.
- **MONITOR:** Marginal drift rate or mild single-parameter deviation; flagged for secondary verification.
- **REJECT:** Statistical outlier in Module A OR safety-slope limit exceeded OR upper 95% confidence interval crosses specification limit.

---

## Prototype

The Predicta 26 repository includes a light-mode/dark-mode interactive engineering dashboard (`index.html`) demonstrating:
- Real-time lot population health maps.
- Component-level parameter degradation curves ($0\text{h} \to 24\text{h} \to 168\text{h}$).
- GPR confidence interval visualizers.
- Automated PASS / MONITOR / REJECT decision matrices.

---

## Repository Structure

```text
predicta-sih2026-ps170/
├── index.html                <- Interactive dashboard prototype
├── style.css                 <- Engineering CSS design system
├── script.js                 <- Dashboard logic & visualization
├── README.md                 <- Master technical documentation
├── LICENSE                   <- Apache 2.0 License
│
├── docs/                     <- Architecture & physics documentation
├── data/                     <- Dataset registry (Raw, Processed, Synthetic)
├── src/                      <- Machine learning source modules
│   ├── ingestion/            <- Data acquisition parsers
│   ├── preprocessing/        <- Robust MAD normalization
│   ├── anomaly_detection/    <- Module A Isolation Forest & COPOD models
│   ├── drift_prediction/     <- Module B Physics GPR models
│   ├── physics/              <- Semiconductor aging equations
│   └── decision_engine/      <- Safety-slope decision logic
│
├── scripts/                  <- Generator & model training scripts
└── tests/                    <- Automated integrity test suites
```

---

## Results

Validated on 800 test components across 24h Early Screening Windows:

| Module / Metric | Model | Performance | Benefit |
|---|---|---|---|
| **Module A (Outliers)** | Isolation Forest | **88.9% Recall**, 61.5% Precision, 1.9% FPR | Detects latent micro-defects at 24h |
| **Module A (Baseline)** | Robust MAD | 81.5% Recall, 59.5% Precision | Lot-relative PAT baseline |
| **Module B (Iddq Drift)** | GPR | **23.59 µA MAE** (vs. 26.27 µA Persistence) | 10.2% Error Reduction |
| **Module B (tpd Delay)** | GPR | **2.12 ns MAE** (vs. 4.12 ns Persistence) | **48.6% Error Reduction** |
| **Stressing Saved** | Decision Engine | **144 Hours / Component** | Up to 85% burn-in time reduction |

---

## Dataset & Research

Predicta 26 incorporates public proxy datasets and physics-based degradation models:
- **NASA Power MOSFET Dataset:** Thermal overstress aging logs.
- **STMicroelectronics ST-AWFD:** Wafer fault dataset for spatial correlation.
- **Physics Simulator:** Log-normal lot simulator incorporating BTI aging ($t^{0.2}$) and thermal acceleration (Arrhenius equation).

---

## Limitations

- Prototype models are trained on simulated and public proxy semiconductor logs; flight-grade validation requires proprietary ISRO production lot datasets.
- GPR forecasting confidence bounds expand with sparse temporal sampling beyond 24h.

---

## Team

### Team Predicta 26

**Team Leader:**  
Umesh Pandey  

**Co-Participants:**  
Anup Gupta  
Swayam Jha  
Shekhar Yadav  
Harshima Joshi  
Hans  

---
