# Validation Strategy & Metric Framework
## Ensuring Rigorous Evaluation of Anomaly and Drift Models

---

## 1. Automated Validation Pipeline

During active screening on the test bench, all inputs undergo automated checks before model ingestion to prevent data corruption and ensure high reliability:

```text
  [ Raw Data Ingest ] ──► Unit & Range Check ──► Time-Series Ordering Check
                                                          │
                                                          ▼
  [ Data Quality Report ] ◄── Train/Test Leakage Check ◄── Missing Value Flagging
```

---

## 2. Evaluation Metrics

### Module A (Outlier Detection)
When labeled anomaly data is available (e.g., in synthetic test sets), we calculate standard classification metrics, but with a strong emphasis on Recall:
*   **Precision:** $\frac{TP}{TP + FP}$
*   **Recall (Sensitivity):** $\frac{TP}{TP + FN}$
*   **Cost-Weighted $F_3$ Score:**
    $$F_3 = 10 \cdot \frac{\text{Precision} \cdot \text{Recall}}{9 \cdot \text{Precision} + \text{Recall}}$$
    *Rationale:* A False Negative (letting a defective part fly) is $100\times$ more expensive than a False Positive (discarding a good part). The $F_3$ score weights Recall $9\times$ higher than Precision.
*   **Area Under Precision-Recall Curve (PR-AUC):** Preferred over ROC-AUC due to extreme class imbalance (anomalies represent $< 2\%$ of the lot).

### Module B (Drift Prediction)
We evaluate the regression model's ability to forecast the 168h value:
*   **Mean Absolute Error (MAE):**
    $$\text{MAE} = \frac{1}{N} \sum_{i=1}^{N} |y_{i, 168} - \hat{y}_{i, 168}|$$
*   **Prediction Interval Coverage Probability (PICP):**
    Measures the percentage of actual 168h values that fall within the GPR's predicted 95% confidence interval:
    $$\text{PICP} = \frac{1}{N} \sum_{i=1}^{N} \mathbb{I}\left( y_{i, 168} \in [\hat{y}_{i, 168}^{\text{lower}}, \hat{y}_{i, 168}^{\text{upper}}] \right)$$
    A calibrated model should exhibit a PICP of $\ge 95\%$.

---

## 3. Data Integrity & Train/Test Leakage Checks

To prevent overfitting and maintain scientific rigor:
1.  **Lot Separation:** In Dynamic PAT, the standardization parameters (Median, MAD) must be computed strictly using the *current* lot. Historical lot distributions must not bleed into the active test lot's calculations.
2.  **Temporal Separation:** The drift prediction model (Module B) must only use $0\text{h}$ and $24\text{h}$ data during inference. No $96\text{h}$ or $168\text{h}$ measurements can bleed into the input feature vector.
3.  **Cross-Validation:** When training on proxy datasets, we use group K-fold cross-validation based on `lot_id` to ensure models generalize to unseen manufacturing lots.
