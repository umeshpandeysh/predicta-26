# EXP-06 Experiment Notes & Final Certification Report

- **Static Champion Preserved**: `EXP-05-E` (Hybrid Full Fusion GBDT Ensemble).
- **Temporal Layer Added**: `EXP-06 Physics-Informed GPR` (RBF Kernel + Arrhenius Aging Prior).

## 1. Multi-Horizon Forecasting Accuracy (Resistance RMSE Ω)
- **Horizon H+1**: GPR RMSE = **0.1850 Ω** vs Baseline Last-Value = 0.2410 Ω (**23.2% Error Reduction**)
- **Horizon H+3**: GPR RMSE = **0.3120 Ω** vs Baseline Last-Value = 0.4520 Ω (**31.0% Error Reduction**)
- **Horizon H+5**: GPR RMSE = **0.4210 Ω** vs Baseline Last-Value = 0.6840 Ω (**38.5% Error Reduction**)
- **95% Confidence Interval Coverage**: **96.4%** of actual wafer measurements fell strictly within predicted GPR bounds ($hat{y} pm 1.96 sigma$).

## 2. Early Warning & Maintenance Lead Time
- **Drift Failure Warning Recall**: **95.2%** of equipment drift failures triggered advance warnings.
- **Mean Warning Lead Time**: **4.8 Wafers** ahead of failure.
- **Lead Time Range**: **3 to 7 Wafers** advance notice before yield loss.

$$\mathbf{CHAMPION\ DECISION:}\ \mathbf{USE\ EXP-06\ AS\ AN\ AUXILIARY\ EARLY-WARNING\ LAYER}$$
