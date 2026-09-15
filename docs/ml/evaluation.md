# Model Evaluation Strategy & Authoritative Latent-168h Target

Semiconductor qualification for aerospace programs requires a strict, risk-averse metric prioritization.
This document specifies PREDICTA's authoritative evaluation architecture, separating instantaneous single-station qualification from true longitudinal burn-in latent defect screening.

---

## 1. Problem Formulation: Generic 168h Failure vs. True SIH Latent Failure

Standard machine learning pipelines often conflate two very different evaluation objectives:

1. **Generic 168h Failure Prediction:**
   $$\text{failure}_{168\text{h}} = \mathbb{I}(\text{telemetry at } 168\text{h} \text{ violates limits})$$
   *Problem:* This trivializes the task by including components that had already failed catastrophically at $0\text{h}$ or $24\text{h}$ and would have been quarantined at initial screening without requiring burn-in stress.

2. **Authoritative SIH Latent Failure Screening:**
   $$\text{latent\_168h\_failure} = (\text{PASS at } 24\text{h}) \land (\text{FAIL by } 168\text{h})$$
   *Semantic Objective:* Specifically isolate components that **pass all initial 24h screening criteria** (normal operating envelope, within nominal limits), yet harbor sub-surface damage (gate-oxide micro-pinholes, interface trap buildup, NBTI wear-out) that accelerates failure by $168\text{h}$.

---

## 2. Authoritative Semantic Trajectory States

Every component evaluated longitudinally is classified into exactly one of five mutually exclusive states:

| Trajectory State | Semantic Meaning | `latent_168h_failure` | Screening Disposition |
| :--- | :--- | :---: | :--- |
| `PASS_24H_PASS_168H` | Healthy throughout 168h stress | **False** | Pass to Flight Assembly |
| `PASS_24H_FAIL_168H` | **True Latent Defect** (silent at 24h, failed by 168h) | **True** | **Primary Screening Target** |
| `FAIL_24H_FAIL_168H` | Early Failure (already rejected at 24h) | **False** | Pre-burn-in Quarantine |
| `FAIL_24H_PASS_168H` | Transient anomaly / measurement anomaly | **False** | Secondary QA Review |
| `INSUFFICIENT_HISTORY` | Missing 24h or 168h burn-in telemetry | **null** | Telemetry Incomplete |

> [!IMPORTANT]
> Components failing at 24h (`FAIL_24H_FAIL_168H`) are **explicitly excluded** from the `latent_168h_failure` target. Counting pre-existing 24h rejects as latent failures inflates recall and misrepresents early warning capability.

---

## 3. Strict Temporal Leakage Prevention Protocol

To ensure valid scientific evaluation:
1. **Zero Future Features:** Predictor inputs at the 24h decision point contain strictly $0\text{h}$ telemetry, $24\text{h}$ telemetry, and $24\text{h} - 0\text{h}$ delta drift.
2. **Post-Screening Quarantine:** Telemetry measured at $96\text{h}$ or $168\text{h}$ is strictly quarantined for retrospective ground-truth evaluation and is programmatically asserted never to enter feature vectors.
3. **Disjoint Lot Cohorts:** Evaluation uses strict lot-held-out partitioning (e.g. Training: Lots 1–35, Validation: Lots 36–42, Test: Lots 43–50). No component ID or lot cohort crosses split boundaries.

---

## 4. Prioritized Screening Metrics

Because semiconductor escapees (false negatives) cause satellite and mission failures, metrics prioritize recall and FNR:

1. **Latent Recall ($TP / (TP + FN)$) - CRITICAL:**
   Percentage of true latent 168h failures successfully flagged at the 24h window.
2. **Latent False Negative Rate ($\text{FNR} = FN / (TP + FN)$) - CRITICAL:**
   The escapee rate. Must approach zero for aerospace mission acceptance.
3. **F2 Score ($5 \cdot P \cdot R / (4P + R)$) - HIGH:**
   Weights recall 4x higher than precision, penalizing false negatives heavily.
4. **Precision ($TP / (TP + FP)$) - MEDIUM:**
   Quantifies yield impact (unnecessary secondary testing).
5. **PR-AUC & ROC-AUC - HIGH:**
   Evaluates discrimination capability under extreme class imbalance ($\sim 2\%$ latent defects).

---

## 5. Current Production Model Assessment & Lineage

* **Production Model:** `predicta_xgboost_model.json` (SHA-256: `9c671a615cf253746181f2391a095d496344b45a936ebebe8a5971508521fbba`)
* **Training Dataset:** `predicta_dataset_v3_50000.csv` (SHA-256: `637cebbcb0e0717466cfdbb660232491a0293d052be1451f28b24a9a0ea6bfd1`)
* **Target:** Instantaneous wafer qualification (`result`) across 28 single-station ATE features.
* **Compatibility Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
* **Direct Latent-168h Evaluation:** False (Requires retraining on longitudinal burn-in trajectory data)

### Operational Rationale
The current production XGBoost classifier was specifically trained for instantaneous wafer-level screening on 28 ATE features. It does not accept 3-parameter longitudinal time-series records ($I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}}$ across $0\text{h} \to 24\text{h} \to 168\text{h}$).

To prevent fabricated results:
* The production XGBoost classifier is preserved operational for single-station ATE screening.
* Longitudinal 168h degradation forecasting is handled by the Gaussian Process Regression (GPR) drift engine (`src/drift_prediction/gpr.py`).
* Retrospective trajectory evaluation is governed by `src/evaluation/latent_trajectory.py`.
