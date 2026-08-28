# PREDICTA EXP-15D HARD-NEGATIVE MINING REPORT

## Executive Summary
EXP-15D evaluated **Physics-Guided Hard-Negative Mining** ($ ratio \in [5\%, 10\%, 20\%, 30\%, 50\%] $) by synthesizing boundary-crossing normal dies ($ Z \in [1.5, 2.5] $) to test whether False Positive Rate could be reduced below $7.70\%$ (stretch target $<5.0\%$) while maintaining overall Fail Recall $\ge 97.0\%$.

## 1. Locked Test Set Hard-Negative Mining Benchmark (`test.csv`, 10,000 Records)

| Hard-Negative Ratio | Synthetic HNs Added | Fail Recall | Nominal FPR | ROC-AUC | F1 Score | Meets Target Constraints? (Recall $\ge 97.0\%$, FPR $< 7.70\%$) |
|---|---|---|---|---|---|---|
| **0% (Champion Baseline)** | **0** | **97.31%** | **7.70%** | **0.9901** | **0.7822** | **CHAMPION BASELINE ✅** |
| **5% Hard Negatives** | 850 | 95.82% | 6.12% | 0.9895 | 0.7782 | NO (Recall < 97.0%) ❌ |
| **10% Hard Negatives** | 1,700 | 95.14% | 5.34% | 0.9890 | 0.7750 | NO (Recall < 97.0%) ❌ |
| **20% Hard Negatives** | 3,400 | 94.62% | 4.82% | 0.9882 | 0.7710 | NO (Recall < 97.0%) ❌ |
| **30% Hard Negatives** | 5,100 | 94.25% | 4.35% | 0.9875 | 0.7680 | NO (Recall < 97.0%) ❌ |
| **50% Hard Negatives** | 8,500 | 94.15% | 3.98% | 0.9868 | 0.7650 | NO (Recall < 97.0%) ❌ |

## 2. Key Findings & Scientific Conclusion
1. **Boundary Oversampling Effect**: Hard-negative mining successfully reduced FPR from $7.70\%$ down to $3.98\%$ at 50% hard-negative ratio (achieving the stretch FPR target $<5.0\%$).
2. **Recall Degradation**: However, oversampling boundary normal dies shifted tree decision splits away from subtle true failures, reducing overall Fail Recall from $97.31\%$ down to $94.15\% - 95.82\%$ (failing the $\ge 97.0\%$ constraint).
3. **Pareto Tradeoff**: Current Champion (`v2.0.0`) maintains the optimal balance at **97.31% Fail Recall** and **7.70% FPR**.

$$\mathbf{CHALLENGER\ DECISION:}\ \mathbf{CURRENT\ CHAMPION\ REMAINS\ BEST}$$
Production remains strictly `v2.0.0`.
