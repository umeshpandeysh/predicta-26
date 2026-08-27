# PREDICTA — SIH 2026 Final Technical Judge Defense Guide (Phase 10)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Target**: Technical Defense against 20 Skeptical Judge Questions  

---

1. **Why better than static thresholding?** ➔ Detects early multi-variate non-linear anomalies (COPOD) and predicts 168h degradation from 24h data before catastrophic failure.
2. **Why GPR?** ➔ Burn-in data has only 2 points ($0\text{h}$, $24\text{h}$). Deep learning overfits; GPR provides exact Bayesian analytical posteriors and variance ($\sigma_{total}$).
3. **Why not Neural Networks?** ➔ Neural networks require massive time-series sequences and act as black boxes lacking physical confidence intervals.
4. **Where is future leakage prevented?** ➔ Inference inputs strictly limited to 0h/24h telemetry ($P_{0h}, P_{24h}, \Delta P_{24h}$). Ground truth 96h/168h values are absent from production code.
5. **How was uncertainty validated?** ➔ Latent variance plus observation noise ($\sigma_{total} = \sqrt{\sigma_{latent}^2 + \sigma_{obs}^2}$) calibrated on validation lot residuals.
6. **Why trust 95% intervals?** ➔ Defines the Bayesian 95% credible interval ($\hat{y} \pm 1.96\sigma_{total}$) for degradation at 168h.
7. **What happens with outliers?** ➔ PAT Robust MAD standardization scales parameters insensitively using lot median and MAD.
8. **What if one parameter fails?** ➔ Precedence override rules in Multi-Criteria Risk Engine trigger `CRITICAL` risk if any upper bound exceeds spec limit.
9. **What happens during DB failure?** ➔ System degrades gracefully to `HYBRID_MEMORY_FALLBACK (LOCAL DEMO)`.
10. **Can an operator alter a decision?** ➔ No, only record QA dispositions (`CONFIRMED_PASS` / `QUARANTINED`) via authenticated RBAC routes.
11. **How is every decision traced?** ➔ Tagged with a unique `trace_id` (e.g. `PRED-2026-X8F9A2`) and logged in `public.prediction_events`.
12. **Is explainability real?** ➔ Yes, **Deterministic Engineering Feature Attribution** maps exact Z-scores and predicted slopes.
13. **Is SHAP used?** ➔ No, we use **Deterministic Engineering Feature Attribution** tailored to electrical physics.
14. **What happens to latent defects?** ➔ High predicted drift slopes trigger Safety Slope warnings (`EXCEEDED`), flagging chips for re-testing.
15. **What makes this scalable?** ➔ Sub-millisecond single request latency ($0.36\text{ ms}$) and serverless-native Node.js design.
16. **What is deployed?** ➔ API Gateway (`src/api/server.js` / `api/index.js`), 5-Phase ML Engine, PostgreSQL Schema (`supabase/schema.sql`).
17. **What is simulated?** ➔ Simulated ATE telemetry generator (`/api/ate/simulate`) for demo testing.
18. **What is project-defined vs datasheet?** ➔ Screening criteria ($I_{ddq} \le 5000\text{ nA}$, $I_{leak} \le 500\text{ nA}$, $t_{pd} \le 250\text{ ps}$) are explicitly labeled as project-defined screening criteria.
19. **What are the limitations?** ➔ Cloud persistence requires supplying `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel settings.
20. **What would you improve after SIH?** ➔ Expand multi-site ATE streaming ingestion and deploy multi-region distributed rate limiters.
