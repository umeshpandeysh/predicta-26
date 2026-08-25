# Model Card: Predicta Module B (Drift Predictor)

*   **Project:** Predicta
*   **Competition:** Smart India Hackathon 2026
*   **Problem Statement:** PS 170

Description of the Gaussian Process Regression (GPR) model used to forecast parametric degradation.

## Model Details
*   **Algorithm:** Gaussian Process Regression (GPR) with RBF and White noise kernels.
*   **Target Output:** 168h parameter values and standard deviations.
*   **Features Ingested:** 0h value, 24h value, 24h drift.

## Benchmarks (24h Window)

| Target Parameter | Persistence MAE | Linear Regression MAE | GPR MAE (Active) | 95% Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **Supply Current (Iddq)** | 26.27 µA | 23.34 µA | 23.59 µA | 9.8% (outliers excluded) |
| **Gate Leakage (Ileak)** | 3.63 µA | 3.13 µA | 3.23 µA | 11.6% (outliers excluded) |
| **Delay (tpd)** | 4.12 ns | 2.97 ns | **2.12 ns** | 16.4% (outliers excluded) |

## Biases & Failure Modes
*   **Latent Defect Uncertainty:** GPR predicts the nominal trajectory. When a latent defect transitions to sudden oxide breakdown, GPR predictions will exhibit large errors. The decision engine captures this by evaluating the **Upper Confidence Bound** instead of the mean prediction alone.
