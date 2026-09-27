# PREDICTA-26: Scientific Claim & Evidence Provenance Matrix

**Document Version:** `2.0.0-PROVENANCE`  
**Classification Standard:** SIH 2026 Scientific Rigor & Evidence Integrity Protocol  

---

## 1. Provenance Classification Taxonomy

Every technical, physical, economic, and machine-learning claim in PREDICTA-26 is classified into one of six evidence tiers:
1. **MEASURED**: Empirically measured in continuous software benchmark runs on frozen test splits.
2. **SYNTHETIC BENCHMARK**: Derived from physics-guided synthetic wafer/lot degradation simulations.
3. **LITERATURE-BACKED**: Established in peer-reviewed semiconductor reliability and physics literature.
4. **PROJECT ASSUMPTION**: Defined as an explicit boundary condition or operational constraint of the project.
5. **DESIGN TARGET**: Engineering architecture specification or software design objective.
6. **FUTURE VALIDATION**: Requires physical fab silicon, flight qualification, or foundry ATE integration.

---

## 2. Master Claim & Evidence Matrix

| Claim | Type | Evidence | Dataset | Limitation | Safe Wording |
|---|---|---|---|---|---|
| **Latent Defect Detection Recall ($\ge 90\%$)** | **SYNTHETIC BENCHMARK** | Benchmark evaluation on frozen test partition (`test.csv`, N=40,000 samples) at $\theta^* = 0.20$ achieves $91.8\%$ recall. | `predicta_dataset_v4_production.csv` (Synthetic CMOS 28nm benchmark) | Evaluated on physics-guided synthetic degradation data; not silicon fab tested. | "Achieves 91.8% recall on synthetic 28nm benchmark dataset under cost-optimal threshold $\theta^*=0.20$." |
| **ROC-AUC Performance ($\ge 0.95$)** | **SYNTHETIC BENCHMARK** | Native XGBoost model achieves $\text{ROC-AUC} = 0.963$ on held-out test lots (`LOT-043` through `LOT-050`). | `test.csv` (Held-out synthetic test lots) | Synthetic distribution with physics-informed process variation. | "Exhibits 0.963 ROC-AUC on held-out synthetic test lots." |
| **144-Hour Early Detection Window** | **PROJECT ASSUMPTION** | 24-hour gate qualification screens latent defects before the standard 168-hour burn-in completion ($168 - 24 = 144\text{ hours}$). | Burn-in protocol timeline definition | 144 hours represents the potential test termination window, not guaranteed time-to-failure. | "Provides a 144-hour early intervention window by screening latent defects at the 24h burn-in checkpoint." |
| **Physical Degradation Kinetics (Arrhenius / Eyring / Black's EM)** | **LITERATURE-BACKED** | Implementation of standard electro-thermal acceleration equations in `src/physics/` ($E_a = 0.7\text{ eV}$, $n = 2.0$, thermal delta). | IEEE / JEDEC Standard JESD22-A108 and semiconductor physics literature | Models standard activation energy curves; device-specific calibration required for specific foundry nodes. | "Incorporates literature-standard Arrhenius, Eyring, and Black's electromigration physical models." |
| **Multi-Criteria Anomaly Fusion (PAT-MAD + COPOD + IF)** | **DESIGN TARGET** | Non-parametric anomaly detection and tail probability modeling implemented in `src/anomaly/`. | `ml/models/production/predicta_anomaly_artifacts.json` | Anomaly detectors operate as non-parametric screening filters; not calibrated to specific physical defects. | "Implements multi-criteria risk fusion combining robust MAD, COPOD tail estimation, and isolation forests." |
| **Continuous Degradation GPR Forecasting** | **SYNTHETIC BENCHMARK** | Matérn 5/2 Gaussian Process Regression forecasts 168h trajectory ($t_{\text{pd}}, I_{\text{DDQ}}, I_{\text{leak}}$) with 95% confidence intervals. | Multi-point telemetry observations ($t=0\text{h}$ and $t=24\text{h}$) | Single-point telemetry truthfully yields `INSUFFICIENT_HISTORY`; forecasting requires baseline history. | "Forecasts 168h degradation trajectories with 95% confidence bounds when 0h and 24h telemetry are present." |
| **Cost-Sensitive Threshold ($\theta^* = 0.20$)** | **MEASURED** | Minimum expected cost optimization under asymmetric error cost matrix ($C_{\text{FN}} / C_{\text{FP}} = 10$). | Cost curve sweep across validation split | Optimal operating point depends on specific manufacturer defect cost ratios. | "Operating threshold $\theta^* = 0.20$ minimizes expected screening cost under a 10:1 false negative cost penalty." |
| **Economic ROI & Burn-In Savings** | **PROJECT ASSUMPTION** | Economic impact model (`src/evaluation/economic_impact_model.py`) evaluates Conservative, Base, and Optimistic scenarios. | Model scenario parameters ($C_{\text{esc}} = \$500$, $C_{\text{burnin}} = \$0.50/\text{hr}$) | Scenario simulation results; not an audited foundry financial audit. | "Economic model projects positive ROI across conservative, base, and optimistic burn-in reduction scenarios." |
| **Cross-Runtime Parity (Node ↔ Python)** | **MEASURED** | 12/12 canonical test vectors produce identical raw probability with $0.000000$ numerical delta. | `tests/test_js_python_parity.js` | Enforces exact IEEE 754 float parity for native tree traversal. | "Verified 0.000000 delta numerical parity between Node.js and Python inference engines." |
| **Fail-Closed OOD Governance** | **DESIGN TARGET** | Unseen equipment identifiers (`EQP-UNSEEN-999`) trigger `is_unseen_equipment: true` and enforce `MONITOR`/`REJECT`. | Out-of-distribution evaluation suite | Requires operator or quality lead adjudication for unseen equipment lots. | "Enforces fail-closed governance that prevents automated PASS on unseen equipment or invalid telemetry." |
| **Silicon Fab / Flight Qualification** | **FUTURE VALIDATION** | Prototype architecture designed for ATE and foundry deployment. | N/A (Future milestone) | Not certified for flight hardware or commercial foundry production lines without silicon tape-out validation. | "Demonstrated in high-fidelity prototype simulation; physical silicon tape-out validation is a planned future phase." |

---

## 3. Economic Model Scenario Classification

The economic model is classified as a parameterized decision support simulation:
- **Source-Backed Constants**: Chamber operating cost per hour ($\approx \$0.50/\text{hr}$), standard qualification duration ($168\text{ hours}$), test gate ($24\text{ hours}$).
- **Project Assumptions**: Escape cost penalty ($C_{\text{esc}} \in [\$250, \$1000]$), baseline lot defect rate ($p \approx 2.5\%$).
- **Scenario Outputs**: Potential chamber hour reductions are clearly marked as *scenario projections* rather than realized balance sheet savings.
