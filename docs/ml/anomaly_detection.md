# PREDICTA-26 — Dynamic Anomaly Detection Architecture & Benchmark

## 1. Overview & Anomaly Objectives
In the PREDICTA semiconductor test analytics framework, **Dynamic Anomaly Detection** screens semiconductor dies at early manufacturing checkpoints (specifically at the 24h burn-in decision cutoff) to identify statistical outliers, unexpected process deviations, and open-set fabrication defects before components proceed to long-term qualification or customer deployment.

---

## 2. Distinction Between Anomaly, Drift, and Latent Failure
PREDICTA strictly decouples three distinct failure modes to prevent target collapse:

1. **Instantaneous Anomaly Detection (Stage 4 / This Engine):**
   - *Time Horizon:* $t = 24\text{h}$ screening decision cutoff.
   - *Inputs:* 24h parametric readings (`iddq`, `ileak`, `tpd`).
   - *Objective:* Detect whether the die is an extreme multivariate or distribution outlier relative to its lot or global baseline population.

2. **Longitudinal Parametric Drift Forecasting (GPR Engine):**
   - *Time Horizon:* $t \in [0\text{h}, 168\text{h}]$ continuous wear-out trajectory.
   - *Inputs:* $\Delta_{24\text{h}} = x_{24\text{h}} - x_{0\text{h}}$ parametric shifts.
   - *Objective:* Forecast 168h end-of-life parametric drift using Gaussian Process Regression with $95\%$ confidence bounds.

3. **Latent 168h Failure Classification (XGBoost Trajectory Engine):**
   - *Target:* $\text{latent\_168h\_failure} = (\text{PASS at } 24\text{h}) \land (\text{FAIL by } 168\text{h})$.
   - *Objective:* Predict early latent wear-out failures that pass early static specification limits but fail after extended stress testing.

---

## 3. Mathematical Detector Formulations

### A. Robust MAD (Part Average Testing - PAT)
Part Average Testing utilizes Median Absolute Deviation (MAD) for robust outlier detection that is immune to outlier masking:
$$\text{MAD} = \text{median}(|x_i - \text{median}(X)|)$$
$$\sigma_{\text{robust}} = 1.4826 \times \text{MAD}$$
$$Z_j = \frac{|x_j - \text{median}_j|}{\sigma_{\text{robust}, j}}$$
$$S_{\text{MAD}} = \max_{j} Z_j$$

### B. COPOD (Empirical Copula-Based Outlier Detection)
COPOD is a parameter-free outlier detector that estimates empirical tail probabilities:
$$F_n(x) = \frac{1}{n} \sum_{i=1}^n \mathbb{I}(X_i \le x)$$
$$S_{\text{left}} = -\sum_{j=1}^d \ln(F_n(x_j)), \quad S_{\text{right}} = -\sum_{j=1}^d \ln(1 - F_n(x_j))$$
$$S_{\text{COPOD}} = \max(S_{\text{left}}, S_{\text{right}})$$

### C. Isolation Forest
Isolation Forest isolates anomalies by randomly partitioning feature dimensions:
$$s(x, n) = 2^{-\frac{\mathbb{E}(h(x))}{c(n)}}$$
where $c(n) = 2(\ln(n - 1) + 0.5772156649) - \frac{2(n - 1)}{n}$ is the average path length of an unsuccessful search in a Binary Search Tree (BST).

---

## 4. Lot Reference Governance & Population Provenance
To ensure that lot-relative anomaly screening is scientifically and operationally governed rather than producing false confidence, PREDICTA enforces authoritative reference-population rules defined in `ml/anomaly/lot_reference_contract.json`:

1. **Why Lot-Relative Normalization Exists:**
   Semiconductor fabrication experiences lot-to-lot wafer processing variations (e.g., subtle gate oxide thickness drifts or dopant concentration shifts). Lot-relative Part Average Testing evaluates each component against its own lot distribution, preventing healthy dies from tight lots being falsely quarantined and catching subtle defect outliers within loose lots.

2. **Minimum Reference Population Size:**
   - **Minimum Size:** $N = 10$ components (classified under `PROJECT_DEFINED_SCREENING_CRITERION`).
   - **Preferred Size:** $N \ge 30$ components.
   - If a lot contains fewer than 10 reference observations, establishing a lot-specific distribution is statistically unstable. The system forbids constructing a lot baseline and triggers `INSUFFICIENT_REFERENCE`.

3. **Status & Reference Source Semantics:**
   - **`LOT_RELATIVE` (`reference_source = "LOT_RELATIVE"`):** Known lot with $N \ge 10$ valid samples. Die is evaluated against lot-specific robust median and MAD.
   - **`INSUFFICIENT_REFERENCE` (`reference_source = "GLOBAL_FALLBACK"`):** Known lot with $N < 10$ samples, or lot with degenerate dispersion ($\sigma_{\text{robust}} \le 10^{-9}$). Safely evaluated against the global reference baseline.
   - **`UNKNOWN_LOT` (`reference_source = "GLOBAL_FALLBACK"`):** Unseen lot identifier, or missing/null/empty lot identifier. Safely evaluated against the global reference baseline without inventing a lot model.
   - **`INVALID_INPUT`:** Missing, extra, or reordered canonical features, or non-numeric/non-finite values. Throws an immediate fail-fast exception.

4. **Reference Population Quality Checks:**
   - **Sample Count:** Validated against minimum reference threshold.
   - **Non-Finite Detection:** Any NaN or $\pm\infty$ in training samples causes immediate rejection during model fitting.
   - **Near-Zero Dispersion / Constant Feature:** If $\sigma_{\text{robust}} \le 10^{-9}$ (indicating zero parameter dispersion or a stuck constant parameter), the lot is flagged as `DEGENERATE_SCALE` and falls back to global reference rather than dividing by zero.

5. **Test-Lot Leakage Protection & Immutability:**
   - Held-out evaluation lots (Lots 43–50) are strictly unseen during model fitting. The benchmark explicitly routes test lots through the `UNKNOWN_LOT` / `GLOBAL_FALLBACK` execution path, guaranteeing zero test distribution leakage into the reference store.
   - Scoring is strictly read-only: scoring new, undersized, or unseen lots never mutates, appends to, or caches data within the trained reference store.

6. **Zero Fabricated Confidence:**
   - The platform never fabricates a numerical "confidence score" for undersized or missing lots. Provenance is transparently exposed in the response schema (`reference_status`, `reference_source`, `reference_sample_count`, `lot_id`, and `reference_context`).

---

## 5. Canonical Feature Schema & Threshold Governance
- **Canonical Feature Order:** Strict feature order `["iddq", "ileak", "tpd"]` is enforced across all runtimes. Any reordered, missing, extra, or non-numeric features are rejected with explicit validation errors.
- **Train Partition (Lots 1–35):** Reference statistics (medians, MADs, ECDFs) and Isolation Forest trees are fitted strictly on training data.
- **Validation_Tune Partition (Lots 36–38):** Operating thresholds are selected strictly on the validation_tune partition by maximizing the $F_2$-score ($\beta=2.0$, prioritizing defect recall and zero customer escapes). Calibration lots (Lots 39–42) are reserved separately and excluded from threshold tuning.
- **Held-Out Test Partition (Lots 43–50):** Frozen thresholds are applied exactly once. Test set data is never used to optimize hyperparameters or operating cutoffs.

---

## 6. Multi-Criteria Fusion Candidates & Runtime Parity
1. **Conservative Fusion (Boolean ANY):** An alarm is triggered if any individual detector (MAD, COPOD, or Isolation Forest) exceeds its operating reject threshold:
   $$\text{Reject} = (S_{\text{MAD}} \ge \theta_{\text{MAD}}) \lor (S_{\text{COPOD}} \ge \theta_{\text{COPOD}}) \lor (S_{\text{IF}} \ge \theta_{\text{IF}})$$
2. **Weighted Score Fusion:**
   $$S_{\text{fusion}} = 0.35 \times \text{norm}(S_{\text{MAD}}) + 0.35 \times \text{norm}(S_{\text{COPOD}}) + 0.30 \times \text{norm}(S_{\text{IF}})$$
   where normalization scales ($\text{scale}_{\text{MAD}} = 6.0$, $\text{scale}_{\text{COPOD}} = 9.5$, $\text{min}_{\text{IF}} = 0.40, \text{scale}_{\text{IF}} = 0.30$) are explicitly locked in the artifact to ensure 100% numerical parity between Python and Node.js runtimes.

---

## 7. Synthetic Data Disclosure & Operational Status
All quantitative metrics reported in the benchmark are derived from physics-informed synthetic semiconductor simulations (`data/synthetic/semiconductor_synthetic_full.csv`). Results demonstrate relative statistical sensitivity and do not represent external silicon fab qualification until independently calibrated against physical wafer lot data.

---

## 8. Authoritative Anomaly Fusion & Calibration Governance (Stage 4.3)
To ensure complete internal consistency across Python and Node.js runtimes, PREDICTA enforces `ml/anomaly/fusion_contract.json`:

1. **Standardized Detector Evidence Structure:**
   Every detector (`robust_mad`, `copod`, `isolation_forest`) emits a consistent evidence payload containing:
   `detector`, `score`, `normalized_score` $\in [0, 1]$, `threshold`, `status` (`PASS`, `MONITOR`, `REJECT`), `feature_scores`, `reference_status`, `reference_source`, `reference_sample_count`, `lot_id`, `calibration_status` (`NOT_CALIBRATED`), and `validation_status` (`PROJECT_DEFINED_SCREENING_CRITERION`).

2. **Deterministic Normalization Layer:**
   Heterogeneous detector scores are deterministically scaled into $[0, 1]$ where higher values strictly indicate greater anomaly evidence:
   - **Robust MAD:** $\text{norm}(s) = \min(1.0, \max(0.0, s / 6.0))$
   - **COPOD:** $\text{norm}(s) = \min(1.0, \max(0.0, s / 9.5))$
   - **Isolation Forest:** $\text{norm}(s) = \min(1.0, \max(0.0, (s - 0.40) / 0.30))$ for $s \ge 0.40$, else $0.0$.
   Normalization is derived solely from training/validation optimization boundaries and never fitted against the held-out test partition.

3. **Dynamic Weight Re-Normalization:**
   When a subset of detectors is active, weights are re-normalized across active detectors only:
   $$w'_i = \frac{w_i}{\sum_{j \in \text{active}} w_j}$$
   Default baseline weights: `{"robust_mad": 0.35, "copod": 0.35, "isolation_forest": 0.30}`.

4. **Fail-Closed Zero-Detector Policy:**
   If zero detectors are configured or active, the engine NEVER returns `PASS`. It emits an explicit `INSUFFICIENT_EVIDENCE` status with `anomaly_score: null`.

5. **Two-Threshold Decision Policy:**
   - **`MONITOR_THRESHOLD` (0.35):** Component exhibits elevated anomaly evidence; flagged for observation.
   - **`REJECT_THRESHOLD` (0.50):** Component crosses screening quarantine criterion.
   - Any individual detector alarm triggers `MONITOR` or `REJECT` under conservative fusion.

6. **Calibration Honesty:**
   - Normalization is explicitly distinct from probability calibration.
   - `calibration_status` is locked to `NOT_CALIBRATED`.
   - The platform strictly prohibits describing anomaly scores as "probabilities", "confidence percentages", or "failure chances".

7. **V1 / V2 Governance:**
   - V1 remains the default production anomaly screening path.
   - V2 remains labeled as `BENCHMARK_ONLY` pending physical fab telemetry qualification.
