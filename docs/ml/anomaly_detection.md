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

## 4. Lot-Relative Normalization & Population Governance
- **Known Lot:** If a component belongs to a known training lot with sample count $N \ge 10$, lot-specific medians and MAD values are applied.
- **Unseen / Small Lot:** If a lot was unseen during training, has missing identifiers, or contains fewer than 10 reference samples, the system automatically falls back to global reference distributions and explicitly flags provenance as `GLOBAL_FALLBACK_UNSEEN_OR_SMALL_LOT` or `INSUFFICIENT_REFERENCE`.
- **Zero Fabrication:** The system never fabricates lot-relative confidence for undersized batches.

---

## 5. Threshold Governance & Split Protocols
- **Train Partition (Lots 1–35):** Reference statistics (medians, MADs, ECDFs) and Isolation Forest trees are fitted strictly on training data.
- **Validation Partition (Lots 36–42):** Operating thresholds are selected to optimize validation $F_1$-score.
- **Held-Out Test Partition (Lots 43–50):** Frozen thresholds are applied exactly once. Test set data is never used to optimize hyperparameters or operating cutoffs.

---

## 6. Multi-Criteria Fusion Candidates
1. **Conservative Fusion:** An alarm is triggered if any individual detector triggers warning or reject.
2. **Weighted Score Fusion:**
   $$S_{\text{fusion}} = 0.35 \times \text{norm}(S_{\text{MAD}}) + 0.35 \times \text{norm}(S_{\text{COPOD}}) + 0.30 \times \text{norm}(S_{\text{IF}})$$

---

## 7. Synthetic Data Disclosure & Operational Status
All quantitative metrics reported in the benchmark are derived from physics-informed synthetic semiconductor simulations (`data/synthetic/semiconductor_synthetic_full.csv`). Results demonstrate relative statistical sensitivity and do not represent external silicon fab qualification until independently calibrated against physical wafer lot data.
