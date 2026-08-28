# System Overview: AI-Driven Predictive Screening (AIPS)
## High-Reliability Semiconductor Screening Engine

---

## 1. Project Context & Objectives

In the context of the **Indian Space Research Organisation (High-Reliability Semiconductor)**, spacecraft electronics are non-repairable and must operate continuously for 10–15 years in high-radiation, extreme-temperature vacuum environments. Minimizing the **Defect Parts Per Million (DPPM)** is the primary metric of success for component screening.

Conventional screening methods fail to capture **latent defects** that slowly degrade under stress. The **AI-Driven Predictive Screening (AIPS)** tool integrates semiconductor physics with machine learning to automate the detection of atypical components (outliers) and predict long-term wear-out (drift) early, reducing testing time and resource consumption.

---

## 2. Key Modules & Functional Capabilities

### Ingestion & Data Validation
*   Loads Automated Test Equipment (ATE) logs in standard CSV or STDF formats.
*   Performs automated unit checks, sequence alignments, and out-of-bounds error cleaning.
*   Enforces a statistical threshold of at least **30 components per lot** to ensure robust statistical modeling.

### Module A: Dynamic Outlier Detection
*   Standardizes parameters relative to the lot population using robust, outlier-insensitive scales (Median/MAD).
*   Applies **Copula-Based Outlier Detection (COPOD)** to model the joint dependencies of multiple test parameters (e.g., matching a leakage spike with a propagation delay slowdown).
*   Extracts Deterministic Engineering Feature Attributions to explain exactly which electrical parameters triggered the anomaly status.

### Module B: 168h Drift Prediction
*   Utilizes measurements at $0\text{h}$ and $24\text{h}$ to predict the parameter values at the end of the burn-in cycle ($168\text{h}$).
*   Uses **Physics-Informed Gaussian Process Regression (GPR)** with an NBTI power-law prior kernel to guarantee physically bounded extrapolations.
*   Provides uncertainty bounds (95% confidence intervals) to ensure risk-averse decision making.

### Combined Decision Engine
*   Aggregates Module A and Module B outputs to assign a status of **PASS**, **MONITOR**, or **REJECT** to each component.
*   Provides clear, explainable reasons for every rejection (e.g., *"Standby leakage drifts beyond dynamic safety slope"*).
*   Offers an early-stop prediction for lots that show high degradation rates at the 24h mark, preventing unnecessary resource overhead.
