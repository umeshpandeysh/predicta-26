# PREDICTA-26 — Phase 2 Mahalanobis Challenger Scientific Proof

> **SCIENTIFIC AUDIT & BENCHMARK PROOF — PS-26170**  
> **Generated:** `2026-09-27T11:01:43Z`  
> **Governance Status:** `OFFLINE_CHALLENGER_BENCHMARK_ONLY`  
> **Promotion Decision:** `PROHIBITED (Zero justification for production promotion)`  

---

## 1. Executive Scientific Verdict

- **Scientific Classification:** `CHALLENGER_RETAINED_BENCHMARK_ONLY`
- **Incremental Information:** `LIMITED_TO_MARGINAL (11 unique dies / 0.33% at chi2_0.99, while missing 2,484 production defects)`
- **Production Full Pipeline Recall:** **`94.62%`** (`3133` / `3311` defects)
- **Mahalanobis Recall (Default $\chi^2_{0.99}$):** **`19.93%`** (`660` / `3311` defects)
- **Recall Deficit:** Mahalanobis misses **`2484` defects** captured by PREDICTA's production pipeline.
- **Unique Detections:** Mahalanobis flags only **`11` unique defects** not flagged by the production ensemble.

> **Core Conclusion:** While Multivariate Mahalanobis Distance offers a clean, closed-form linear covariance baseline (ROC-AUC=0.7894, Precision=0.8333 at chi2_0.99), its strict elliptical symmetry cannot capture complex, non-linear multi-physics degradation. PREDICTA's production ensemble (XGBoost + PAT-MAD + COPOD + Isolation Forest) achieves 94.62% Recall (3,133 TPs), whereas Mahalanobis captures only 19.93% Recall (660 TPs), missing 2,484 actual failures. Integrating Mahalanobis into the live inference loop would add redundant matrix computations without meaningful yield or reliability improvement.

---

## 2. Reference Population & Mathematical Formulation

### Mathematical Formulation
The continuous Mahalanobis Distance $D_M(x)$ is computed in $D=3$ canonical feature space $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$:
$$D_M(x) = \sqrt{(x - \mu)^T \Sigma_{\text{reg}}^{-1} (x - \mu)}$$
where $\Sigma_{\text{reg}} = \Sigma + 10^{-6} I$ is the regularized sample covariance matrix inverted via Moore-Penrose pseudoinverse.

### Reference Population Parameters
- **Source Dataset:** `ml/data/processed/train.csv` (SHA-256: `ce75defb813d80c608ed4c3cf1627f1c6473bb56b9b8b2756048d34b0feb0204`)
- **Sample Size ($N$):** `29,754` nominal training records (`result == 'PASS'`)
- **Feature Dimension ($D$):** `3` features (`['iddq', 'ileak', 'tpd']`)
- **Mean Vector ($\mu$):** `[44.1470, 146.4666, 13.8891]`
- **Regularization ($\epsilon$):** `1e-06`
- **Inversion Method:** `Moore-Penrose Pseudoinverse (np.linalg.pinv)`

---

## 3. Performance Across Legitimate $\chi^2$ Statistical Thresholds

Evaluated on locked held-out test partition (`7,500` samples, `3,311` ground-truth defect dies):

| Threshold ID | $\chi^2$ Bound | Distance Threshold ($D_M$) | Recall | FNR | FPR | Precision | F1-Score | ROC-AUC | PR-AUC |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`chi2_0.95`** | `95% Chi-squared confidence bound (D=3)` | **`2.795`** | **`0.4298`** | `0.5702` | `0.0945` | `0.7823` | `0.5548` | `0.7894` | `0.7476` |
| **`chi2_0.99`** | `99% Chi-squared confidence bound (D=3, Default Reject Threshold)` | **`3.368`** | **`0.1993`** | `0.8007` | `0.0315` | `0.8333` | `0.3217` | `0.7894` | `0.7476` |
| **`chi2_0.999`** | `99.9% Chi-squared confidence bound (D=3, Strict Outlier Threshold)` | **`4.033`** | **`0.1009`** | `0.8991` | `0.0043` | `0.9489` | `0.1824` | `0.7894` | `0.7476` |

---

## 4. Incremental True-Positive Set Decomposition

Mathematical decomposition of defect detections against PREDICTA's production ensemble (3,133 TPs):

| Threshold ID | Mahalanobis TPs | Shared TPs (M $\cap$ Prod) | Unique Mahalanobis TPs (M $\setminus$ Prod) | Production TPs Missed by M | Both Missed | Reconciliation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`chi2_0.95`** | `1423` | `1394` | **`29`** | `1739` | `149` | **VERIFIED** ($TP = Shared + Unique$) |
| **`chi2_0.99`** | `660` | `649` | **`11`** | `2484` | `167` | **VERIFIED** ($TP = Shared + Unique$) |
| **`chi2_0.999`** | `334` | `329` | **`5`** | `2804` | `173` | **VERIFIED** ($TP = Shared + Unique$) |

---

## 5. Latency & Computational Profile

- **Evaluated Samples:** `500` warm inference requests
- **Average Latency:** `0.0411 ms`
- **P50 Latency:** `0.0397 ms`
- **P95 Latency:** `0.0515 ms`
- **P99 Latency:** `0.0764 ms`
- **Max Latency:** `0.1135 ms`

---

## 6. Scientific Limitations & Governance Boundaries

1. **Linearity Assumption:** Mahalanobis distance assumes an elliptical, unimodal Gaussian distribution; it fails on multi-modal process distributions.
2. **Feature Coverage:** Operates on 3 parametric features; does not incorporate the 28 engineered features and spatial wafer signatures used by PREDICTA.
3. **Synthetic Data Context:** All evaluation is on synthetic aerospace burn-in distributions; no physical flight qualification is claimed.
4. **Governance Lock:** Mahalanobis distance is strictly governed as `CHALLENGER / BENCHMARK` and is prohibited from entering the live production decision loop.

- **Reproducibility Command:** `npm run evaluate:mahalanobis` or `python src/evaluation/evaluate_mahalanobis_scientific_proof.py`
