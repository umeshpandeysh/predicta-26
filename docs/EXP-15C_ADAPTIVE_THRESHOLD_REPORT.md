# PREDICTA EXP-15C ADAPTIVE THRESHOLDING REPORT

## Executive Summary
EXP-15C evaluated **Soft Defect-Signature Adaptive Thresholding** (routing die telemetry at inference time to physical defect signatures based on non-leaking physical Z-scores) to test whether False Positive Rate could be reduced below $7.70%$ while maintaining overall Fail Recall $ge 97.0%$.

## 1. Locked Test Set Adaptive Routing Benchmark (`test.csv`, 10,000 Records)

| Model Variant | Strategy | Fail Recall | Nominal FPR | ROC-AUC | F1 Score | Meets Target Constraints? (Recall $ge 97.0%$, FPR $< 7.70%$) |
|---|---|---|---|---|---|---|
| **Current Champion** | Global $	heta^* = 0.20$ | **97.31%** | **7.70%** | **0.9901** | **0.7822** | **CHAMPION BASELINE ✅** |
| **Pure Adaptive Router** | Category $	heta_{	ext{sig}}$ | 97.23% | 7.82% | 0.9901 | 0.7794 | NO (FPR > 7.70%) ❌ |
| **Conservative Hybrid Router** | Conf-Weighted $	heta_{	ext{sig}}$ | 97.31% | 7.76% | 0.9901 | 0.7810 | NO (FPR > 7.70%) ❌ |

## 2. Key Findings & Scientific Conclusion
1. **Inference-Time Routing Reliability**: Soft signature evidence formulas correctly routed $98.4%$ of dies to their physical mechanism using non-leaking Z-scores.
2. **Operational FPR Bound**: Raising thresholds for power anomalies ($	heta_{	ext{power}} = 0.25$) reduced power false alarms, but lowering thresholds for process variation ($	heta_{	ext{process}} = 0.18$) increased process false alarms by an equal proportion, resulting in net FPR stabilization at $7.76% - 7.82%$.
3. **Defect Preservation**: All 7 defect categories preserved $ge 95.11%$ recall.

$$\mathbf{CHALLENGER\ DECISION:}\ \mathbf{CURRENT\ CHAMPION\ REMAINS\ BEST}$$
Production remains strictly `v2.0.0`.
