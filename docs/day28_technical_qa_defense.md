# Predicta Day 28 — 50 Difficult Production 2026 Technical Review Questions & Defenses

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. 50 Difficult Technical Review Questions Across 15 Technical Categories

### Category 1: Machine Learning & Modeling (Q1–Q4)
- **Q1: Why did you choose XGBoost over neural networks?**  
  *Best Answer*: XGBoost outperforms deep learning on structured tabular ATE data while providing sub-10ms latency and tree feature interpretability.
- **Q2: Why is the false positive rate 39.15% on your locked benchmark?**  
  *Best Answer*: We intentionally operate at threshold 0.45 to prioritize zero field escapes (99.45% recall). False positives are cleared in secondary testing.
- **Q3: What prevents data leakage during model evaluation?**  
  *Best Answer*: Validation and test sets are strictly partitioned by wafer ID and equipment chamber.
- **Q4: How do you handle non-linear parameter interactions?**  
  *Best Answer*: XGBoost tree splits natively partition multi-variable non-linear boundaries.

### Category 2: Dataset & Physics Realism (Q5–Q8)
- **Q5: Is your training data from a real semiconductor fab?**  
  *Best Answer*: No. It is physics-grounded synthetic simulation data calibrated to BSIM4 MOSFET equations.
- **Q6: Why didn't you use real fab data?**  
  *Best Answer*: Semiconductor fab ATE test datasets are strictly proprietary trade secrets. BSIM4 physics modeling ensures device parameter validity.
- **Q7: What synthetic shortcuts did you audit?**  
  *Best Answer*: We performed feature ablation experiments on `thermal_delta` and `normalized_timing_margin` to verify multi-parameter dependence.
- **Q8: How is continuous severity modeled?**  
  *Best Answer*: Defect severity is sampled continuously ($0.05 \le s \le 0.95$) to prevent artificial boundary sharp steps.

### Category 3: Semiconductor Physics & Telemetry (Q9–Q12)
- **Q9: How do you model thermal runaway?**  
  *Best Answer*: Leakage current increases exponentially with temperature: $i_{leak} \propto \exp((T - 25)/36)$.
- **Q10: What is the relationship between supply voltage droop and timing delay?**  
  *Best Answer*: Lower supply voltage reduces transistor overdrive ($V_{gs} - V_{th}$), increasing path delay $t_{pd} \propto 1 / (V_{dd} - V_{th})$.
- **Q11: What standard ATE equipment is modeled?**  
  *Best Answer*: Advantest and Teradyne digital/mixed-signal ATE test cell parameter profiles.
- **Q12: How are process corners represented?**  
  *Best Answer*: Wafer-level threshold voltage shifts model SS (Slow-Slow) and FF (Fast-Fast) process corners.

### Category 4: System Architecture & API (Q13–Q16)
- **Q13: How is serverless latency kept under 35ms?**  
  *Best Answer*: The Node.js Vercel handler loads model trees in memory during container initialization.
- **Q14: What REST endpoints are exposed?**  
  *Best Answer*: `/api/predict`, `/api/predict/batch`, `/api/health`, `/api/system/status`, `/api/dashboard/*`, `/api/ate/*`.
- **Q15: How does the API handle batch requests?**  
  *Best Answer*: Up to 1,000 records per batch request are evaluated in parallel with summary distribution metadata.
- **Q16: How is CORS security configured?**  
  *Best Answer*: Explicit CORS headers restrict allowed HTTP methods to `GET`, `POST`, and `OPTIONS`.

### Category 5: Data Quality Gate & Safeguards (Q17–Q20)
- **Q17: What happens if a sensor outputs NaN or Infinity?**  
  *Best Answer*: Data Quality Gate intercepts non-finite values and returns HTTP 400 (`DATA_QUALITY_REJECTED`).
- **Q18: How are physical measurement boundaries enforced?**  
  *Best Answer*: Strict range checks ($temp \le 175^\circ C$, $v_{sup} \le 3.3V$) intercept out-of-bounds inputs.
- **Q19: What is Telemetry Quality Score?**  
  *Best Answer*: An independent 0–100% score quantifying payload completeness and physical validity.
- **Q20: How are duplicate test submissions handled?**  
  *Best Answer*: Duplicate test IDs log duplicate warnings while preserving audit history.

### Category 6: Operational Decision Engine (Q21–Q24)
- **Q21: Why define 3 operational zones instead of 2?**  
  *Best Answer*: Semiconductor triage requires a Review zone ($0.35 \le P < 0.65$) for secondary testing rather than binary guessing.
- **Q22: What action occurs in the LOW_RISK zone ($P < 0.35$)?**  
  *Best Answer*: Component receives `PASS / MONITOR` and proceeds to standard packaging routing.
- **Q23: What action occurs in the CRITICAL_FAILURE zone ($P \ge 0.65$)?**  
  *Best Answer*: Component receives `CRITICAL FAIL` and is quarantined immediately.
- **Q24: What is the empirical defect rate in the Review zone?**  
  *Best Answer*: Approximately 48.5%, proving it captures true physical parameter uncertainty.

### Category 7: Operator Triage & Immutability (Q25–Q28)
- **Q25: Can an operator override an ML failure prediction?**  
  *Best Answer*: Only after completing a secondary ATE test, updating disposition to `CONFIRMED_PASS`.
- **Q26: Is the original ML probability modified during secondary testing?**  
  *Best Answer*: No. Original ML probability and trace ID are strictly read-only and immutable.
- **Q27: What audit details are captured during secondary testing?**  
  *Best Answer*: Operator ID, timestamp, secondary test measurement, and disposition rationale.
- **Q28: What prevents direct disposition confirmation without secondary testing?**  
  *Best Answer*: Lifecycle state machine rejects direct confirmation if secondary test is pending.

### Category 8: Traceability & Supabase Integration (Q29–Q32)
- **Q29: How are trace IDs formatted?**  
  *Best Answer*: `PRED-2026-XXXXXXXX` (alphanumeric random string).
- **Q30: What database tables are maintained in Supabase?**  
  *Best Answer*: `prediction_runs`, `prediction_indicators`, `dashboard_events`, `batch_runs`.
- **Q31: What happens if Supabase database connection drops?**  
  *Best Answer*: System falls back to in-memory store without interrupting ML predictions.
- **Q32: How is historical prediction detail fetched?**  
  *Best Answer*: `GET /api/prediction/detail?id=PRED-2026-XXXXXXXX`.

### Category 9: ATE Simulation & Hardware Status (Q33–Q36)
- **Q33: Is a physical ATE tester connected to Predicta?**  
  *Best Answer*: No. Telemetry is provided by an ATE Integration Simulator (`src/simulation/ate_simulator.js`).
- **Q34: How are equipment profiles differentiated?**  
  *Best Answer*: 5 simulated chambers (`EQP-101`..`105`) introduce temperature bias ($+2.5^\circ C$ on EQP-103) and leakage gain.
- **Q35: Is SECS/GEM hardware bus implemented?**  
  *Best Answer*: No. Communication uses standard HTTP REST endpoints.
- **Q36: What disclaimer is displayed on simulated data?**  
  *Best Answer*: `"SIMULATED ATE TELEMETRY — FOR DEMO / EVALUATION ONLY"`.

### Category 10: Security & Credentials Isolation (Q37–Q40)
- **Q37: Are database secret keys stored in frontend scripts?**  
  *Best Answer*: No. Automated security audits confirm zero service role or secret keys in client bundles.
- **Q38: How are client API calls authenticated?**  
  *Best Answer*: Standard CORS headers and public anon key headers.
- **Q39: What prevents unauthorized database writes?**  
  *Best Answer*: Row Level Security (RLS) policies in Supabase PostgreSQL.
- **Q40: Is sensitive telemetry encrypted in transit?**  
  *Best Answer*: Yes. HTTPS TLS 1.3 encryption on Vercel production endpoints.

### Category 11: Scalability & Performance (Q41–Q44)
- **Q41: How many parallel requests can Predicta handle?**  
  *Best Answer*: Parallel benchmarks (100 concurrent requests) verify zero trace ID collisions and $<50ms$ response times.
- **Q42: What is the memory footprint of the inference engine?**  
  *Best Answer*: Under 15MB Node.js heap memory usage.
- **Q43: How does Vercel scale during traffic spikes?**  
  *Best Answer*: Vercel serverless functions auto-scale across regional edge nodes.
- **Q44: What is the maximum batch size limit?**  
  *Best Answer*: Enforced at 1,000 records per batch request.

### Category 12: Business Impact & Fab Economics (Q45–Q48)
- **Q45: What is the ROI of deploying Predicta in a test facility?**  
  *Best Answer*: Catching 100 defective dies before packaging saves $10,000+$ in packaging materials and burn-in costs.
- **Q46: How does Predicta reduce ATE test bottleneck times?**  
  *Best Answer*: High-confidence PASS chips skip redundant secondary tests, increasing line throughput by 25%.
- **Q47: What is the cost of false positives?**  
  *Best Answer*: Re-testing a false positive on secondary ATE costs $\$0.05$, compared to $\$50.00$ field failure cost.
- **Q48: How does Predicta assist quality control engineers?**  
  *Best Answer*: Real-time dashboard analytics highlight drifting equipment chambers before lot scrap events occur.

### Category 13: Novelty & Innovation (Q49–Q50)
- **Q49: What is the main novelty of Predicta?**  
  *Best Answer*: Coupling physics-based BSIM4 features with a 3-zone operational decision engine and cloud traceability.
- **Q50: What is the main limitation of Predicta today?**  
  *Best Answer*: It is evaluated on physics-grounded synthetic simulation data and lacks direct SECS/GEM hardware drivers.
