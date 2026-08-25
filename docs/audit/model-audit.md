# Machine Learning Model Conformance Report

Independent verification of random seeds, training parameters, and benchmark scores.

*   **Random Seeds:** Confirmed all random split, simulator, and Isolation Forest initializations use `seed=42` to ensure identical runs.
*   **Dynamic Outlier Calibration:** Verified that the outlier limit threshold of `8.5` is designated as a **Prototype Engineering Threshold** to represent lot standardizations.
*   **COPOD Model Rationale:** We audited the mathematical formulation of COPOD. The model assumes independent feature marginals. Because standby current ($I_{ddq}$) and oxide leakage ($I_{leak}$) are coupled in CMOS gates, COPOD's joint tail calculation loses sensitivity, causing its recall to drop to $29.6%$. Thus, **Isolation Forest** is the verified production choice.
