# Data Strategy: Proxy & Synthetic Data Calibration
## Addressing Data Scarcity and Preserving Scientific Integrity

---

## 1. Data Classification Framework

Semiconductor manufacturing and reliability data are heavily protected by corporate and government intellectual property regulations. To ensure our development is transparent and legally compliant, we classify all data into three categories:

```text
  ┌────────────────────────────────────────────────────────┐
  │                   Data Classifications                 │
  ├────────────────────────────────────────────────────────┤
  │ 1. Public Proxy Data (e.g., NASA MOSFET, ST-AWFD)      │
  │    - Used for algorithm verification and benchmarking  │
  ├────────────────────────────────────────────────────────┤
  │ 2. Physics-Based Synthetic Data                        │
  │    - Generated to match the exact 168h ISRO intervals  │
  ├────────────────────────────────────────────────────────┤
  │ 3. Proprietary Flight Data (ISRO internal)             │
  │    - Not committed to GitHub; processed locally if provided│
  └────────────────────────────────────────────────────────┘
```

---

## 2. Public Proxy Datasets

We register and utilize the following public proxy datasets to benchmark our models:

### STMicroelectronics Wafer Fault Dataset (ST-AWFD)
*   **Source:** STMicroelectronics GitHub (`STMicroelectronics/ST-AWFD`)
*   **Type:** Multivariate time-series process logs.
*   **Relevance:** Used to test Module A's dynamic outlier detection and batch-level anomaly screening algorithms against real-world manufacturing noise.

### NASA Prognostics Center Power MOSFET Dataset
*   **Source:** NASA Ames Prognostics Center of Excellence (PCoE)
*   **Type:** Accelerated thermal overstress run-to-failure parameters.
*   **Relevance:** Tracks leakage currents ($I_{gate\_leakage}$) and thermal characteristics over time under bias stress. Used to train and calibrate Module B's drift prediction models.

### UCI SECOM
*   **Source:** UCI Machine Learning Repository
*   **Type:** Static snapshot of semiconductor e-test parameters (591 features) with binary quality labels.
*   **Relevance:** Used to validate feature selection and robust lot standardization techniques under highly imbalanced classes.

---

## 3. Physics-Based Synthetic Data Generator

To test the end-to-end pipeline under the exact sampling intervals specified by ISRO (**0h, 24h, 96h, 168h**), we implement a physics-based synthetic data generator (`scripts/generate_synthetic_data.py`).

### Mathematical Simulator Parameters:
1.  **Lot-Level Process Variation:** Initial parameter values $I_{ddq\_0h}$ and $t_{pd\_0h}$ are generated using a **log-normal distribution** to model typical wafer-level process variations:
    $$P_0 \sim \text{LogNormal}(\mu_{\text{lot}}, \sigma^2_{\text{lot}})$$
2.  **Healthy Transistor Degradation (BTI power law):**
    $$\Delta P_{\text{healthy}}(t) = A_0 \cdot \exp\left(-\frac{E_a}{k_B T}\right) \cdot t^n$$
    Where $n = 0.20$ and $E_a = 0.12\text{ eV}$.
3.  **Latent Defect Insertion (Dielectric Breakdown & shorts):**
    We inject latent defect profiles into 2% of the components:
    *   *Type 1 (Accelerated Drift):* Pre-factor $A_0$ is set to $3\times$ nominal, simulating a thin gate dielectric that degrades rapidly.
    *   *Type 2 (Step Breakdown):* A sudden step increase in leakage current is injected at the $96\text{h}$ mark to simulate catastrophic oxide breakdown.
4.  **Measurement Noise:** We add Gaussian white noise representing test equipment measurement error:
    $$\epsilon \sim \mathcal{N}(0, \sigma^2_{\text{noise}})$$
    Where $\sigma_{\text{noise}}$ is calibrated to $1\%$ of the parameter's nominal value.
5.  **Metadata Tagging:** Every synthetic record is tagged with `source_type = 'synthetic'` to distinguish it from real proxy data.
