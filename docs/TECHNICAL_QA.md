# PREDICTA — Production 2026 Technical Review QuestionS & ANSWERS (Q&A)

### Q1: Why did you choose XGBoost over Deep Neural Networks?
**Answer**: XGBoost provides fast tabular inference (0.03 ms per die), exact decision tree serialization without GPU requirements, and strong performance on structured ATE telemetry datasets.

### Q2: How do you handle environmental shifts like temperature variations in the fab?
**Answer**: We use Lot-Relative Z-Score Normalization ($Z_x = rac{x - mu_{	ext{wafer}}}{sigma_{	ext{wafer}}}$). Subtracting the wafer lot mean cancels out global ambient shifts ($Delta T, Delta V$), providing 100% FPR stability across tested $+2^circ	ext{C}$ to $+10^circ	ext{C}$ shifts.

### Q3: What happens when an unseen defect occurs that was not in your training data?
**Answer**: PREDICTA uses an unsupervised Open-Set Anomaly Detection Layer (Isolation Forest + PAT/MAD + COPOD) trained strictly on normal dies. Unseen defects trigger `UNKNOWN_ANOMALY` and route to `ENGINEER_REVIEW` rather than misclassifying as a known defect.

### Q4: How is data leakage prevented in your temporal forecasts?
**Answer**: All temporal features (rolling mean, slope, Arrhenius prior) for wafer $N$ use strictly historical observations from wafers $1 ldots N$. Wafers $N+1 ldots N+H$ are completely isolated.
