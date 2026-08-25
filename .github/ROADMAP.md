# Project Roadmap & Local Issue Tracker

This file documents the milestones and task issues for each development phase. Since the remote GitHub repository is currently offline/unreachable, this file serves as our local, single-source-of-truth backlog for task tracking.

---

## Milestone: Phase 2 — UI/UX Design & Console Prototype
*   **Description:** Design and implement a working React/Vanilla-based frontend console prototype for semiconductor reliability and burn-in analysis, using a mock data layer to decouple from backend ML.
*   **Target Completion:** Phase 2.
*   **Status:** [x] Completed (HTML, CSS, JS Router, dynamic SVG trends, and mock database loaded).

---

## Phase 2 Issues (Completed)

*   `[x]` **Issue #1:** `[TASK] [UI] Design visual theme, color tokens, and layout grid for AIPS Console`
*   `[x]` **Issue #2:** `[TASK] [UI] Build Overview Panel showing lot metrics and burn-in status`
*   `[x]` **Issue #3:** `[TASK] [UI] Build Lot Overview and parameter distribution charts`
*   `[x]` **Issue #4:** `[TASK] [UI] Build Component Detail panel and time-series extrapolation chart`
*   `[x]` **Issue #5:** `[TASK] [UI] Build Anomaly Explanation (XAI) and Decision panel`
*   `[x]` **Issue #6:** `[TASK] [FRONTEND] Develop mock-data loading layers and schemas`

---

## Milestone: Phase 3 — Dataset Acquisition & Registry
*   **Description:** Download, audit, verify, and register the primary public proxy and benchmark datasets required to train and validate our anomaly and drift prediction models.
*   **Target Completion:** Phase 3.
*   **Status:** [x] Completed (YAML registries, parameter matrices, literature evidence, and download scripts verified).

---

## Phase 3 Issues (Completed)

*   `[x]` **Issue #7:** `[TASK] [DATA] Download and unpack STMicroelectronics ST-AWFD dataset`
*   `[x]` **Issue #8:** `[TASK] [DATA] Acquire NASA Ames PCoE Power MOSFET aging dataset`
*   `[x]` **Issue #9:** `[TASK] [DATA] Ingest and parse UCI SECOM semiconductor manufacturing logs`
*   `[x]` **Issue #10:** `[TASK] [DOCS] Establish dataset registry inventory and license verification`

---

## Milestone: Phase 4 — Data Engineering & Simulator
*   **Description:** Build the common data schemas, preprocessing pipelines, and a physics-of-failure synthetic degradation generator to output ML-ready test lot sets.
*   **Target Completion:** Phase 4.
*   **Status:** [x] Completed (BTI/TDDB aging simulators, canonical schemas, unit normalizers, lot-safe splitters, and quality reports implemented).

---

## Phase 4 Issues (Completed)

*   `[x]` **Issue #11:** `[TASK] [DATA] Implement Common Data Schema and parser interface`
*   `[x]` **Issue #12:** `[TASK] [PHYSICS] Build physics-of-failure synthetic burn-in generator`
*   `[x]` **Issue #13:** `[TASK] [DATA] Create automated dataset validation and quality pipeline`

---

## Milestone: Phase 5 — Module A — Dynamic Multivariate Anomaly Detection (Planned)
*   **Description:** Implement robust statistical and unsupervised ML outlier detectors (PAT, Isolation Forest, and COPOD) to isolate anomaly components from their manufacturing lots.
*   **Target Completion:** Phase 5.
*   **Status:** [ ] Planned.

---

## Phase 5 Issues

### Issue #14: Implement Robust PAT Statistical Screening Baselines
*   **Title:** `[TASK] [MODEL] Build Robust Median/MAD PAT screening model`
*   **Labels:** `phase-5`, `anomaly`, `baseline`
*   **Assignee:** ML Engineer
*   **Description:** 
    Implement the AEC-Q001 Guideline Part Average Testing calculations using Median and robust standard deviation (1.4826 * MAD) per lot.
*   **Acceptance Criteria:**
    - [ ] Calculate limits dynamically on lot groups: Median +/- 6 * robust_sigma.
    - [ ] Evaluate false-positive and false-negative rates on ST-AWFD wafer maps.
*   **Dependencies:** Phase 4 Complete.

---

### Issue #15: Implement Isolation Forest Outlier Detector
*   **Title:** `[TASK] [MODEL] Build Isolation Forest lot outlier detector`
*   **Labels:** `phase-5`, `anomaly`, `ml`
*   **Assignee:** ML Engineer
*   **Description:** 
    Implement an Isolation Forest module to detect multi-parameter lot-level outliers.
*   **Acceptance Criteria:**
    - [ ] Wrap scikit-learn Isolation Forest with hyperparameters optimized for imbalanced anomalies.
    - [ ] Verify that model takes robust Z-scores as input to prevent lot-bias bleeding.
*   **Dependencies:** Issue #14.

---

### Issue #16: Implement COPOD Unsupervised Copula Outlier Detector
*   **Title:** `[TASK] [MODEL] Build COPOD copula-based tail probability outlier detector`
*   **Labels:** `phase-5`, `anomaly`, `ml`
*   **Assignee:** ML Engineer / Researcher
*   **Description:** 
    Implement the COPOD algorithm that constructs empirical cumulative distribution functions (ECDFs) for features and determines multivariate tail probability density.
*   **Acceptance Criteria:**
    - [ ] Build ECDF calculators for each input parameter.
    - [ ] Compute joint left/right tail probabilities and derive final outlier scores.
    - [ ] Evaluate F-3 scores against standard Isolation Forest.
*   **Dependencies:** Issue #15.

---

### Issue #17: Build SHAP-based Anomaly Attribution Explainability
*   **Title:** `[TASK] [MODEL] Implement explainable anomaly attribution (XAI) engine`
*   **Labels:** `phase-5`, `xai`
*   **Assignee:** ML Engineer
*   **Description:** 
    Develop an explainability engine that computes feature contributions (SHAP values or ECDF contributions) to provide clear justifications for screening rejections.
*   **Acceptance Criteria:**
    - [ ] Extract marginal feature tail probabilities from COPOD to use as attribution metrics.
    - [ ] Output a structured JSON of parameter contributions for the frontend detail views.
*   **Dependencies:** Issue #16.

---

### Issue #18: Develop Automated Model Evaluation & Benchmarks
*   **Title:** `[TASK] [MODEL] Create dynamic anomaly detection validation benchmark`
*   **Labels:** `phase-5`, `evaluation`, `testing`
*   **Assignee:** QA Engineer / ML Researcher
*   **Description:** 
    Create evaluation scripts that test precision, recall, F-3 score, and ROC-AUC on imbalanced datasets, comparing PAT vs. IForest vs. COPOD.
*   **Acceptance Criteria:**
    - [ ] Write benchmark tests evaluating models on the synthetic latent defect class.
    - [ ] Generate comparative metrics tables comparing algorithm false alarm rates.
*   **Dependencies:** Issue #17.
