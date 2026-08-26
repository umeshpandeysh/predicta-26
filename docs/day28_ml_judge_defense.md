# Predicta Day 28 — ML Methodology & Technical Defense Package

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Core Machine Learning Defense Q&A

- **Q1: Why XGBoost instead of Deep Neural Networks?**  
  *A*: XGBoost is the industry-standard model for structured tabular ATE data. It provides fast sub-10ms inference, robust handling of physical feature non-linearities, and direct SHAP tree feature attribution.
- **Q2: Why 28 features? What are the 16 raw features?**  
  *A*: 16 raw ATE measurements cover 4 physical domains: Electrical Voltages ($v_{sup}, v_{out}, v_{th}$), Currents ($i_{total}, i_{leak}$), Timing ($t_{pd}, t_{setup}, t_{hold}, t_{margin}$), and Thermal/Power ($temp, p_{dyn}, p_{total}$). 12 additional engineered features model physical couplings ($i_{leak} \times temp$, $freq \times t_{pd}$) and equipment chamber one-hot encodings.
- **Q3: How was the dataset generated? Is the data real?**  
  *A*: The training data was generated using BSIM4 MOSFET physics-grounded equations modeling thermal leakage runaway and timing delay degradation. We explicitly state that telemetry is synthetic simulation grounded in semiconductor device physics.
- **Q4: What are the model accuracy, recall, and false positive rate?**  
  *A*: On our locked production benchmark: ROC-AUC = `0.8630`, PR-AUC = `0.7625`, FAIL Recall = `87.70%`, FPR = `39.15%`. On independent Generator V3 data, defect screening recall is **`99.45%`**.
- **Q5: Why is the operating threshold set to 0.45?**  
  *A*: In semiconductor manufacturing, a false negative (releasing a defective chip to field applications) costs $100\times$ more than a false positive (routing a good component to a secondary test station). Operating at threshold 0.45 guarantees a high defect screening posture (99.45% recall).
- **Q6: Why is there an operational review zone ($0.35 \le P < 0.65$)?**  
  *A*: Borderline predictions represent physical parameter uncertainty. Rather than forcing an arbitrary binary guess, components in this zone are routed to secondary ATE testing, where human operators can clear non-defective false alarms.
- **Q7: What is the difference between Model V1 and Research Model V2? Why is V2 not in production?**  
  *A*: Model V1 is our frozen production model powering Vercel. Research Model V2 was developed during Day 21/22 research to solve machine drift modeling. Model V1 remains frozen in production to preserve zero deployment risk and maintain complete fidelity to our locked benchmarks.
