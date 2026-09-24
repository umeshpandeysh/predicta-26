# PREDICTA-26
## Semiconductor Burn-In Telemetry & Latent Defect Screening

<p align="center">
  <strong>Smart India Hackathon 2026 · Problem Statement 170</strong><br>
  Early burn-in evidence → anomaly screening → degradation analysis → physics checks → risk fusion → disposition → traceable reliability evidence
</p>

<p align="center">
  <a href="#1-what-is-predicta">What is PREDICTA</a> ·
  <a href="#2-ps-170-problem-to-system-mapping">PS-170 Mapping</a> ·
  <a href="#3-system-architecture">Architecture</a> ·
  <a href="#7-machine-learning-stack">ML Stack</a> ·
  <a href="#17-verification">Verification</a> ·
  <a href="#19-production-vs-benchmark">Boundaries</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Runtime-Node.js-339933?logo=node.js&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Analysis-Python-3776AB?logo=python&logoColor=white">
  <img alt="XGBoost" src="https://img.shields.io/badge/ML-XGBoost-EC6C00">
  <img alt="Supabase" src="https://img.shields.io/badge/Persistence-Supabase-3FCF8E?logo=supabase&logoColor=white">
  <img alt="SIH" src="https://img.shields.io/badge/SIH-2026%20PS--170-0B3D91">
  <img alt="License" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg">
</p>

> **Judge's one-line view:** PREDICTA is a governed semiconductor burn-in screening system that combines a production XGBoost failure-risk model with lot-relative anomaly evidence, 168-hour prognostics, physics consistency checks, risk fusion, engineering disposition, and traceable reliability evidence.

---

# 1. What is PREDICTA?

Semiconductor qualification is not only a binary pass/fail classification problem.

A device can pass an early observation while its electrical, timing, leakage or thermal behavior is already moving toward a later failure state. PREDICTA therefore connects **early telemetry** with **abnormal behavior, degradation, physics evidence, failure risk and the evidence used for disposition**.

### The system answers five engineering questions

| Question | PREDICTA layer |
|---|---|
| Is the observation valid and usable? | Schema, finite-value and physical-bound validation |
| Is the device or lot abnormal? | Robust MAD, COPOD, Isolation Forest and anomaly fusion |
| Could an apparently acceptable device degrade later? | 168-hour trajectory / prognostic analysis |
| Is the observed behavior physically consistent? | BTI/timing, leakage and thermal reliability checks |
| Can the final decision be reconstructed? | Risk fusion, disposition, evidence and Reliability Twin |

---

# 2. PS-170 problem to system mapping

**SIH 2026 Problem Statement 170 — Semiconductor Burn-In Telemetry & Latent Defect Screening**

PREDICTA is organized around the PS-170 requirement to identify reliability-relevant behavior from burn-in telemetry before a later failure becomes directly observable.

~~~text
                 SEMICONDUCTOR BURN-IN
                         │
                early ATE observations
                         │
                         ▼
              ┌─────────────────────┐
              │ Telemetry validation │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      ML failure      Anomaly /       168 h
        risk           drift         forecast
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                Physics consistency
                         │
                         ▼
                    Risk fusion
                         │
                         ▼
              Engineering disposition
                         │
                         ▼
             Evidence + traceability
                         │
                         ▼
               Reliability history
~~~

| PS-170 capability | PREDICTA implementation | Evidence |
|---|---|---|
| Early screening / temporal leakage control | API + feature contracts + temporal analysis | <code>ml/analysis/ps170_temporal_leakage_proof.py</code> |
| Dynamic outlier screening | MAD + COPOD + Isolation Forest + fusion | <code>src/anomaly_detection/</code> |
| Failure-risk scoring | Authoritative calibrated XGBoost | <code>ml/models/production/</code> |
| 168-hour prognostics | Continuous trajectory layer | <code>src/prognostics/</code> |
| Physics consistency | Reliability-oriented physics modules | <code>src/physics/</code> |
| Sensor/equipment/silicon discrimination | Governance/discrimination components | PS-170 intelligence tests |
| OOD / distribution screening | Governance OOD components | Robustness suite |
| Governed decision path | Decision/governance contracts | Release tests |
| Evidence card | Governance evidence layer | Traceability demo |
| Reliability history | Reliability Twin | <code>src/reliability_twin/</code> |
| Multi-layer evaluation | Stack-ablation analysis | <code>ml/analysis/ps170_stack_ablation.py</code> |
| External transfer | Transfer experiments | <code>ml/analysis/ps170_external_transfer_experiment.py</code> |
| Adversarial evaluation | Reliability benchmark | <code>ml/benchmarks/ps170_adversarial_reliability_benchmark.py</code> |
| Temporal replay | Replay governance | <code>src/governance/temporal_replay.*</code> |
| Champion/challenger governance | Comparison harness | <code>ml/analysis/ps170_champion_challenger_harness.py</code> |

Full matrix: [docs/PS170_TRACEABILITY_MATRIX.md](docs/PS170_TRACEABILITY_MATRIX.md)

---

# 3. System architecture

## 3.1 End-to-end architecture

~~~mermaid
flowchart TD
    A["ATE / Burn-in Telemetry"] --> B["Input + Schema Validation"]
    B --> C["28-Feature Contract"]

    C --> D["Production XGBoost<br/>P(FAIL)"]
    C --> E["Dynamic Anomaly Engine"]
    C --> F["168 h Prognostics"]

    E --> E1["Robust MAD<br/>Lot-relative"]
    E --> E2["COPOD<br/>Tail behavior"]
    E --> E3["Isolation Forest<br/>Multivariate"]
    E1 --> E4["Anomaly Fusion"]
    E2 --> E4
    E3 --> E4

    F --> F1["0 h + 24 h evidence"]
    F1 --> F2["48 / 72 / 96 / 120 / 144 / 168 h"]

    D --> G["Evidence Layer"]
    E4 --> G
    F2 --> G

    C --> H["Physics Reliability"]
    H --> H1["BTI / Timing"]
    H --> H2["Leakage"]
    H --> H3["Thermal"]

    G --> I["Governed Risk Fusion"]
    H --> I
    I --> J["PASS / MONITOR / REJECT"]
    J --> K["Operator / Secondary Test"]
    K --> L["Adjudication"]
    L --> M["Reliability Twin"]
    M --> N["Traceable Evidence"]
~~~

## 3.2 Six-layer mental model

~~~text
01 OBSERVE
   Burn-in / ATE telemetry
        ↓
02 SCREEN
   XGBoost + anomaly + lot-relative behavior
        ↓
03 FORECAST
   168 h degradation / trajectory evidence
        ↓
04 CHECK PHYSICS
   timing · leakage · thermal · BTI-related consistency
        ↓
05 DECIDE
   risk fusion · disposition · secondary-test requirement
        ↓
06 REMEMBER
   evidence · provenance · operator action · adjudication
~~~

The layers do not all have the same authority. The production classifier, benchmark components and historical records are explicitly separated.

---

# 4. Repository at a glance

~~~text
predicta-26/
├── api/                         deployment entry point
├── src/
│   ├── api/                     inference + API runtime
│   ├── anomaly/                 anomaly evaluation
│   ├── anomaly_detection/       MAD / COPOD / Isolation Forest / fusion
│   ├── decision_engine/         decision contracts
│   ├── explainability/          counterfactual explanations
│   ├── features/                feature contracts
│   ├── governance/              disposition / OOD / evidence / replay
│   ├── physics/                 reliability-oriented checks
│   ├── prognostics/             168 h trajectory logic
│   ├── reliability_twin/        longitudinal evidence representation
│   └── risk_fusion/             governed risk combination
├── ml/
│   ├── data/                    synthetic / processed / external data
│   ├── models/production/       protected production artifacts
│   ├── training/                authoritative training
│   ├── analysis/                offline analysis / audits
│   ├── benchmarks/              reproducible benchmarks
│   └── experiments/             historical experiments
├── frontend/                    operator-facing UI
├── tests/                       regression / parity / security / release
├── supabase/                    schema and migrations
├── docs/                        current + historical evidence
├── index.html                   judge/operator entry page
├── CONTENT.md                   repository navigation
└── README.md                    this system overview
~~~

---

# 5. Production authority

The current production decision model is the native XGBoost artifact.

| Item | Current value |
|---|---|
| System release | <code>2.0_production</code> |
| Model lineage | <code>4.0.0_authoritative</code> |
| Operating threshold | **0.20** |
| Production records | **50,000 synthetic records** |
| Feature schema | **28 features** |
| Model | <code>ml/models/production/predicta_xgboost_model.json</code> |
| Model SHA-256 | <code>91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98</code> |
| Dataset | <code>ml/data/synthetic/predicta_dataset_v4_production.csv</code> |
| Dataset SHA-256 | <code>9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24</code> |

Primary authority documents:

- [docs/REPOSITORY_AUTHORITY.md](docs/REPOSITORY_AUTHORITY.md)
- [docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md](docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md)
- [ml/models/production/predicta_production_manifest.json](ml/models/production/predicta_production_manifest.json)

---

# 6. Production feature contract

The authoritative model consumes **28 features**.

### 16 raw numerical features

<code>supply_voltage</code> · <code>output_voltage</code> · <code>current</code> · <code>leakage_current</code> · <code>resistance</code> · <code>capacitance</code> · <code>threshold_voltage</code> · <code>frequency</code> · <code>propagation_delay</code> · <code>setup_time</code> · <code>hold_time</code> · <code>timing_margin</code> · <code>temperature</code> · <code>dynamic_power</code> · <code>total_power</code> · <code>test_duration</code>

### 7 engineered features

<code>voltage_headroom</code> · <code>voltage_utilization</code> · <code>leakage_fraction</code> · <code>power_per_current</code> · <code>normalized_timing_margin</code> · <code>frequency_delay_product</code> · <code>thermal_delta</code>

### 5 equipment indicators

<code>eq_EQP-101</code> · <code>eq_EQP-102</code> · <code>eq_EQP-103</code> · <code>eq_EQP-104</code> · <code>eq_EQP-105</code>

~~~text
RAW ATE TELEMETRY
       │
       ├── electrical
       ├── timing
       ├── thermal
       ├── power
       └── duration
       │
       ▼
ENGINEERED FEATURES
       │
       ▼
EQUIPMENT CONTEXT
       │
       ▼
28-FEATURE CONTRACT
       │
       ▼
XGBoost
~~~

The exact feature order is contractual. Runtime validation rejects invalid schema, non-finite values and unsupported inputs.

---

# 7. Machine learning stack

## 7.1 Model inventory

| Component | Method | Purpose | Status |
|---|---|---|---|
| Model 1 | XGBoost binary | <code>P(FAIL)</code> | **Production-authorized** |
| Model 2 | XGBoost multiclass | Known defect mechanism | Production artifact |
| Anomaly layer | Robust MAD + COPOD + Isolation Forest | Open-set abnormality evidence | Governed screening |
| Prognostic model | Gaussian Process Regression | Degradation trajectory | **Benchmark / prognostic** |
| Uncertainty | Conformal calibration | Uncertainty intervals | **Benchmark-only / locked** |
| Physics | Deterministic reliability calculations | Physical consistency | Supporting evidence |
| Risk fusion | Contract-governed evidence combination | Decision synthesis | Production decision path |

## 7.2 Binary XGBoost configuration

| Parameter | Value |
|---|---:|
| Algorithm | XGBoost |
| Objective | <code>binary:logistic</code> |
| Estimators | 350 |
| Max depth | 5 |
| Learning rate | 0.04 |
| Subsample | 0.85 |
| Column subsample | 0.85 |
| Random seed | 42 |
| Class weighting | <code>scale_pos_weight = PASS / FAIL</code> |
| Calibration | Platt sigmoid |
| Operating threshold | **0.20** |

## 7.3 Training controls

The authoritative training pipeline implements:

- lot-group-aware train/validation/test splitting;
- wafer-overlap assertions;
- validation-only threshold optimization;
- asymmetric false-negative cost;
- validation-only Platt calibration;
- a single untouched locked-test evaluation;
- model metadata generation;
- production manifest generation;
- SHA-256 artifact checks.

Target split:

- 70% train;
- 15% validation;
- 15% locked test.

The split is group-aware rather than a random row split.

---

# 8. Model evaluation

Current locked-test metadata:

| Metric | Value |
|---|---:|
| ROC-AUC | **0.9997** |
| PR-AUC | **0.9995** |
| Accuracy | **0.9912** |
| Recall | **0.9952** |
| Precision | **0.9806** |
| F1 | **0.9878** |
| FNR | **0.0048** |
| FPR | **0.0110** |
| Log loss | **0.0200** |
| Brier | **0.0058** |
| ECE | **0.0023** |
| Multiclass defect accuracy | **0.9467** |

Locked-test confusion matrix:

~~~text
                 PREDICTED
              PASS       FAIL
ACTUAL PASS   4761        53
ACTUAL FAIL     13      2673
~~~

These values are **synthetic governed benchmark results**. They are not commercial-fab validation or field-performance claims.

---

# 9. Calibration and threshold

## Platt calibration

The production probability path uses sigmoid calibration fitted on validation logits.

Current coefficients:

~~~text
A = -1.041229
B =  1.003718
~~~

Recorded calibration values:

- Brier score: 0.0058
- ECE: 0.0023

## Operating threshold

~~~text
θ* = 0.20
~~~

The training pipeline evaluates asymmetric error cost with false negatives weighted more heavily than false positives.

Historical threshold values may remain in historical reports. They do not override the current production manifest.

---

# 10. Defect taxonomy

The current model metadata defines:

1. NORMAL
2. HIGH_LEAKAGE
3. LOW_VOLTAGE
4. TIMING_FAILURE
5. THERMAL_ANOMALY
6. POWER_ANOMALY
7. PROCESS_VARIATION
8. EQUIPMENT_DRIFT

The binary classifier answers the primary failure-risk question. The multiclass model adds known-mechanism classification. The anomaly layer provides an additional path for behavior that does not cleanly map to the known taxonomy.

---

# 11. Dynamic anomaly engine

PREDICTA uses three complementary detectors.

## Robust MAD

Canonical anomaly features:

- <code>iddq</code>
- <code>ileak</code>
- <code>tpd</code>

The detector uses median/MAD-derived robust scale and can use valid lot-relative references.

Default detector thresholds:

- warning: Z > 3.0
- reject: Z > 6.0

## COPOD

COPOD evaluates tail behavior from empirical distributions.

Default thresholds:

- warning score: 6.5
- reject score: 9.5

## Isolation Forest

Provides a complementary multivariate outlier signal for combinations of variables.

## Fusion policy

The fusion engine supports:

- conservative alarm fusion;
- weighted score fusion;
- dynamic weight renormalization across active detectors;
- monitor/reject thresholds;
- lot-reference context;
- detector-level evidence;
- fail-closed handling.

If no detector is active, the result is:

~~~text
INSUFFICIENT_EVIDENCE
~~~

rather than an implicit PASS.

---

# 12. 168-hour continuous prognostics

Burn-in is temporal, so PREDICTA evaluates trajectory evidence rather than only a single observation.

Early observations include:

<code>iddq_0h</code> · <code>ileak_0h</code> · <code>tpd_0h</code> · <code>iddq_24h</code> · <code>ileak_24h</code> · <code>tpd_24h</code>

Forecast/evaluation horizon:

~~~text
0 h → 24 h → 48 h → 72 h → 96 h → 120 h → 144 h → 168 h
                  │       │       │        │        │
                  └────── degradation trajectory ────┘
~~~

The repository evaluates the latent trajectory framing:

~~~text
PASS at 24 h  AND  FAIL at 168 h
~~~

This is the central temporal interpretation of a latent reliability defect.

---

# 13. GPR degradation forecaster

The repository retains a Gaussian Process Regression lineage for degradation forecasting.

| Property | Current status |
|---|---|
| Artifact | <code>ml/models/production/predicta_gpr_kernel_artifacts.json</code> |
| SHA-256 | <code>1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf</code> |
| Lineage | <code>2.2_calibrated_gpr_3way_split</code> |
| Type | GaussianProcessRegressor_Calibrated |
| Role | Prognostic / benchmark |
| Production failure classifier | **No** |

The GPR artifact has documented lineage and integrity, but it is not silently promoted into the production failure-decision role.

See [docs/GPR_LINEAGE_AND_PROVENANCE.md](docs/GPR_LINEAGE_AND_PROVENANCE.md).

---

# 14. Physics-aware reliability engine

The physics layer provides an additional engineering consistency check.

It covers project-defined relationships associated with:

- BTI-related aging;
- timing degradation;
- leakage behavior;
- thermal acceleration;
- electrical/timing feature relationships.

The system distinguishes:

~~~text
PHYSICS_CONSISTENT
PHYSICS_INCONSISTENT
INSUFFICIENT_PHYSICS_EVIDENCE
~~~

Physics evidence is not presented as a fabricated root-cause claim. It is a defined consistency layer coupled to the ML evidence.

---

# 15. Risk fusion and decision policy

The risk path combines the evidence streams rather than treating one score as the entire qualification decision.

~~~text
             XGBoost P(FAIL)
                    │
                    ├───────────────┐
                    │               │
              anomaly evidence   prognostics
                    │               │
                    └──────┬────────┘
                           │
                    physics evidence
                           │
                           ▼
                    GOVERNED FUSION
                           │
                           ▼
                   DISPOSITION POLICY
~~~

Established disposition policy:

| Condition | Result |
|---|---|
| P ≥ 0.65 | REJECT |
| 0.20 ≤ P < 0.65 | MONITOR |
| P < 0.20 | PASS unless anomaly/safety override |
| Safety slope exceeded | REJECT |
| Safety warning | MONITOR |
| Anomaly reject condition | REJECT |

Node.js and Python disposition implementations are checked for parity.

---

# 16. Explainability and evidence

## Counterfactual explanations

The counterfactual layer answers a constrained model question:

> What feature changes, within defined limits, could move the prediction toward a requested target state?

It enforces:

- exact 28-feature schema;
- finite values;
- physical bounds;
- immutable identifiers;
- model SHA verification;
- threshold consistency;
- explanation-contract validation.

The repository explicitly treats the result as:

**MODEL COUNTERFACTUAL — NOT A CAUSAL CLAIM**

## Human disposition

The governance layer supports:

- operator disposition;
- secondary-test evidence;
- outcome evidence;
- adjudication;
- rationale;
- provenance;
- role-based access;
- durable persistence.

Recorded human feedback is evidence. It is not silently treated as automatic retraining data.

---

# 17. Reliability Twin

The Reliability Twin is an evidence-history representation, not a simulated physical semiconductor.

### Ten evidence stages

~~~text
01 Manufacturing Observation
02 ML Evaluation
03 Anomaly Evidence
04 Prognostic Evidence
05 Physics Reliability Evidence
06 Risk Fusion Decision
07 Operator Disposition
08 Secondary Test
09 Outcome Evidence
10 Adjudication
~~~

A twin can preserve:

- component ID;
- trace ID;
- test ID;
- lot / wafer / die;
- equipment;
- synthetic-data status;
- model version;
- model SHA;
- threshold;
- evidence blocks;
- longitudinal timeline;
- operator/adjudicator data;
- ground-truth status.

This makes the decision history inspectable instead of storing only the final PASS/MONITOR/REJECT label.

---

# 18. Security and runtime controls

The runtime includes explicit controls for the inference and evidence paths.

### Controls

- authorization checks;
- operator-role checks;
- fail-closed authorization;
- request payload limits;
- malformed JSON rejection;
- client-taint rejection for protected persistence controls;
- model integrity checks;
- provenance checks;
- durable persistence requirements;
- typed API errors;
- protected disposition/evidence routes.

### Core API surface

~~~text
POST /api/v1/predict
GET  /api/v1/health
POST /api/v1/explain
POST /api/v1/disposition
~~~

Additional governed endpoints support disposition evidence, adjudication, manifests and Reliability Twin access.

---

# 19. Production vs benchmark

| Component | Status | Meaning |
|---|---|---|
| XGBoost binary classifier | **PRODUCTION AUTHORIZED** | Primary failure-risk model |
| Multiclass defect model | **PRODUCTION ARTIFACT** | Known defect mechanism classification |
| Anomaly stack | **GOVERNED SCREENING EVIDENCE** | Abnormality evidence |
| GPR | **BENCHMARK / PROGNOSTIC** | Degradation evidence |
| Conformal calibration | **BENCHMARK ONLY** | Not promoted to production |
| External datasets | **TRANSFER EVALUATION** | Robustness/generalization studies |
| Historical reports | **HISTORICAL** | Development and audit record |

### Conformal governance

~~~text
NOT_CALIBRATED
BENCHMARK_ONLY
REVIEW_REQUIRED
promotion_locked = true
production_promotion_permitted = false
~~~

### Synthetic-data boundary

The current governed production dataset is synthetic.

Therefore its metrics must not be described as:

- commercial-fab validation;
- physical silicon qualification;
- field failure rates;
- production-line performance.

Physical validation remains a separate engineering step.

---

# 20. Data and provenance

### Current governed dataset

<code>ml/data/synthetic/predicta_dataset_v4_production.csv</code>

- 50,000 records
- SHA-256 certified
- feature schema version: <code>4.0.0_authoritative</code>
- random seed: 42

### External evaluation families

The repository contains evaluation work involving:

- ST-AWFD;
- UCI SECOM;
- UCI AI4I 2020;
- NASA IGBT;
- NASA MOSFET;
- NASA capacitor;
- UPC Si IGBT 2026.

External datasets are not assumed to be physical equivalents of the PREDICTA ATE schema. Compatibility and target limitations are recorded in the evaluation work.

---

# 21. Protected production artifact register

| Artifact | SHA-256 |
|---|---|
| XGBoost model | <code>91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98</code> |
| Multiclass model | <code>3b1cfd6ea2659a112bcbcc70cbf90d247628f52eb4fcbb64658a787cd0d62c33</code> |
| Anomaly artifacts | <code>045705e92377b3cbe31883ec2cfd88b700c7f4d1aa6876b2b6d11245edebd447</code> |
| GPR artifact | <code>1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf</code> |
| Production dataset | <code>9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24</code> |

Current production manifest:

[ml/models/production/predicta_production_manifest.json](ml/models/production/predicta_production_manifest.json)

---

# 22. Node.js and Python parity

The repository intentionally maintains Node.js runtime implementations and Python validation/offline implementations.

Parity exists for important decision-path components including:

- inference;
- prognostics;
- risk/disposition logic;
- anomaly calculations;
- governance/security paths.

The objective is independent verification and reproducibility, not uncontrolled duplication.

---

# 23. Verification

### Standard repository verification

~~~bash
npm install
npm test
~~~

### Production certification

~~~bash
npm run certify:production
~~~

### Cross-runtime parity

~~~bash
npm run test:parity
~~~

### Documentation threshold consistency

~~~bash
node tests/test_docs_threshold_consistency.js
~~~

### GPR provenance

~~~bash
node tests/test_gpr_provenance.js
~~~

### PS-170 traceability demonstration

~~~bash
node src/demo_ps170_traceability.js
~~~

The release suite covers model integrity, threshold contracts, inference, parity, security, precedence, ML contracts, native model execution, frontend contracts, latent trajectory targets, data foundations, prognostics, release certification, risk fusion, counterfactual/disposition, reproducibility and documentation consistency.

---

# 24. Reproducibility controls

The training and evaluation chain records:

- dataset path and SHA-256;
- feature schema and exact feature order;
- random seed;
- group-aware split rules;
- calibration method;
- threshold-selection method;
- model metadata;
- artifact hashes;
- production manifest;
- verification results.

The production model is therefore identified by **content + metadata + manifest + tests**, not only by a filename.

---

# 25. Judge path

If you have only a few minutes, inspect in this order:

### 1 — Understand the requirement
[PS-170 Traceability Matrix](docs/PS170_TRACEABILITY_MATRIX.md)

### 2 — Understand authority
[Repository Authority](docs/REPOSITORY_AUTHORITY.md)

### 3 — Inspect the ML contract
[ML Authority & Certification](docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md)

### 4 — Inspect the current system
[Current System Authority](docs/CURRENT_SYSTEM_AUTHORITY.md)

### 5 — Run the traceability demo

~~~bash
node src/demo_ps170_traceability.js
~~~

### 6 — Inspect the production path

~~~text
src/api/
src/anomaly_detection/
src/prognostics/
src/physics/
src/risk_fusion/
src/governance/
src/reliability_twin/
src/explainability/
ml/training/
ml/models/production/
tests/
~~~

---

# 26. What PREDICTA does not claim

PREDICTA does not claim that:

- synthetic benchmark accuracy equals commercial-fab performance;
- the GPR benchmark component is the production failure classifier;
- conformal intervals are already calibrated on physical fab data;
- an external dataset proves semiconductor qualification;
- a counterfactual explanation is a causal explanation;
- a dashboard label replaces engineering validation;
- historical reports override current production contracts;
- a high model score alone identifies physical root cause.

These limitations are part of the system boundary.

---

# 27. Current engineering limitations

1. **Synthetic production benchmark:** the governed 50,000-record production dataset is synthetic.
2. **Physical validation:** physical silicon and commercial-fab validation remain separate engineering activities.
3. **GPR:** retained as prognostic/benchmark evidence, not the production failure classifier.
4. **Conformal:** benchmark-only and promotion-locked.
5. **External transfer:** only interpretable where dataset targets and physical semantics are compatible.
6. **Human validation:** operator and adjudication paths preserve engineering oversight.

---

# 28. Design rules

~~~text
No leakage
No fabricated data
No invented physics
No metric gaming
No silent promotion of benchmark models
No hidden threshold changes
No undocumented production artifacts
No unsupported commercial-fab claims
No rewriting of historical evidence into current configuration
~~~

---

# 29. Judge-facing system card

<table>
<tr>
<td width="33%">

### 🇮🇳 SIH 2026
**PS-170**

Semiconductor Burn-In Telemetry & Latent Defect Screening

</td>
<td width="33%">

### ◈ PREDICTA
Telemetry → ML → anomaly → prognostics → physics → risk → disposition → evidence

</td>
<td width="33%">

### 🔬 Evidence
Model hashes · dataset hash · threshold contract · tests · traceability

</td>
</tr>
</table>

> The README uses GitHub-native diagrams and text rather than embedding third-party logos. The SIH/PS-170 identity above describes the competition/problem statement scope; it is not an endorsement claim.

---

# 30. Final system view

~~~mermaid
flowchart LR
    T["🧪 Burn-in / ATE"] --> V["Validation"]
    V --> X["28 Features"]

    X --> M["🌳 XGBoost P(FAIL)"]
    X --> A["📈 MAD + COPOD + IF"]
    X --> P["⏱ 168 h Prognostics"]

    A --> R["Evidence"]
    P --> R
    M --> R

    X --> PH["⚙ Physics<br/>BTI · Timing · Leakage · Thermal"]
    PH --> R

    R --> F["Risk Fusion"]
    F --> D["PASS / MONITOR / REJECT"]
    D --> H["👤 Operator / Secondary Test"]
    H --> Q["Adjudication"]
    Q --> TW["Reliability Twin"]
    TW --> E["📋 Traceable Evidence"]
~~~

## In one sentence

**PREDICTA turns early semiconductor burn-in telemetry into a structured reliability decision path: validate the observation, score failure risk, detect abnormal behavior, examine degradation toward 168 hours, check physical consistency, fuse the evidence, preserve engineering disposition, and retain the provenance needed to reconstruct the decision.**

---

## Primary references

- [PS-170 Traceability Matrix](docs/PS170_TRACEABILITY_MATRIX.md)
- [Repository Authority](docs/REPOSITORY_AUTHORITY.md)
- [ML Authority & Certification](docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md)
- [GPR Lineage & Provenance](docs/GPR_LINEAGE_AND_PROVENANCE.md)
- [Current System Authority](docs/CURRENT_SYSTEM_AUTHORITY.md)
- [Product Demo Script](docs/PRODUCT_DEMO_SCRIPT.md)
- [System Demo Guide](docs/SYSTEM_DEMO_GUIDE.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Repository

[umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)
