# Machine Learning Strategy: Benchmark & Algorithm Selection
## Evaluating Candidate Models for Dynamic Screening

---

## 1. Module A: Outlier Screening Benchmarks

Dynamic outlier detection identifies components that behave atypically compared to their lot-mates. We benchmark the following candidate models:

### Dynamic Part Average Testing (DPAT)
*   **Math:** Uses historical static limits or calculates moving limits: $\text{Median} \pm 6\sigma$.
*   **Evaluation:** Simple and highly interpretable, but lacks multi-parameter correlation, leading to escapes when multiple marginal parameters drift in unison.
*   **Role:** Baseline model.

### Isolation Forest (iForest)
*   **Math:** Isolates anomalies by randomly selecting a feature and split value, building isolation trees.
*   **Evaluation:** Excellent for multi-parameter correlation, but requires large lot sizes ($N > 100$) to build stable trees, making it sensitive to noise in standard packaged-part lots ($N \approx 30$).

### COPOD (Copula-Based Outlier Detection) [Winner]
*   **Math:** Uses empirical copulas to calculate tail probabilities of multivariate distributions.
*   **Evaluation:** Highly scalable, fast execution, non-parametric (does not assume Gaussian distributions, which is critical for highly skewed leakage currents), and performs robustly on small lots ($N \ge 30$).

---

## 2. Module B: Drift Prediction Benchmarks

We map early-stage parameters ($0\text{h}$ and $24\text{h}$) to predict final wear-out ($168\text{h}$):

### Linear / Polynomial Regression
*   **Math:** Extrapolates based on linear trend lines.
*   **Evaluation:** Fails to model the non-linear, sub-linear power-law kinetics of Bias Temperature Instability ($t^{0.2}$), leading to high forecasting error.

### XGBoost / Random Forest Regressor
*   **Math:** Decision-tree ensemble regression.
*   **Evaluation:** High accuracy within training boundaries, but completely fails at extrapolation. Decision trees cannot predict values outside the bounds of their training leaf nodes.

### Physics-Informed Gaussian Process Regression (GPR) [Winner]
*   **Math:** Non-parametric Bayesian regression. We define a custom covariance kernel that embeds the NBTI power-law ($t^{0.2}$) trend:
    $$K(t, t') = \sigma_f^2 \exp\left(-\frac{(t - t')^2}{2\ell^2}\right) + \sigma_p^2 (t \cdot t')^{0.2}$$
*   **Evaluation:** Performs exceptionally well on sparse training data (only two input points) and yields both a predicted mean $\mu_{168h}$ and standard deviation $\sigma_{168h}$, enabling risk-averse confidence boundaries.

---

## 3. Custom Evaluation Metric

We implement a cost-weighted **$F_3$ Score** to heavily penalize false negatives (missing a latent defect) over false positives (discarding a good part):
$$F_3 = 10 \cdot \frac{\text{Precision} \cdot \text{Recall}}{9 \cdot \text{Precision} + \text{Recall}}$$
This is coupled with a custom cost function mapping to flight-hardware failure costs:
$$\text{Total Cost} = C_{\text{FN}} \cdot \text{FN} + C_{\text{FP}} \cdot \text{FP}$$
Where $C_{\text{FN}} = \text{₹50,000}$ (cost of spacecraft mission failure/investigation) and $C_{\text{FP}} = \text{₹500}$ (cost of scrapping a single component).
Our final models are tuned to minimize this Total Cost.
