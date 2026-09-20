# Governed Counterfactual Explanations

**Status**: `BENCHMARK_ONLY`  
**Contract Version**: `1.0.0`  
**Authority**: `AUTHORITATIVE_EXPLANATION_CONTRACT`  
**Model Grounding**: Authoritative Native XGBoost (`ml/models/production/predicta_xgboost_model.json`, SHA-256: `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`)

---

## 1. Scope & Objective

Counterfactual explanations provide mathematically valid, constraint-aware perturbations showing what measurable feature adjustments would move a benchmark failure prediction across a decision boundary.

For an input vector $\mathbf{x}$ producing calibrated failure probability $P(\text{FAIL} \mid \mathbf{x})$, the counterfactual engine searches for a perturbed vector $\mathbf{x}'$ satisfying a target condition (such as $P(\text{FAIL} \mid \mathbf{x}') < \theta^* = 0.20$) while minimizing standardized distance:

$$\min_{\mathbf{x}'} \sum_{j \in \text{mutable}} \frac{|x'_j - x_j|}{\sigma_j} + \lambda \cdot \text{penalty}(\mathbf{x}')$$

subject to:
- Physical validity bounds ($x'_j \in [\min_j, \max_j]$)
- Strict positivity for physical quantities ($V_{\text{sup}}, t_{\text{pd}}, R, C, t_{\text{dur}} > 0$)
- Non-negativity for currents and powers ($I_{\text{tot}}, I_{\text{leak}}, P_{\text{dyn}}, P_{\text{tot}} \ge 0$)
- Strict preservation of immutable features (manufacturing identifiers, equipment ID)
- Deterministic re-computation of domain engineered features.

---

## 2. Immutable Features vs Mutable Physical Parameters

To prevent nonsensical or physically impossible recommendations:

| Category | Features | Policy | Rationale |
| :--- | :--- | :--- | :--- |
| **Manufacturing Identifiers** | `component_id`, `lot_id`, `wafer_id`, `die_id`, `test_id` | **IMMUTABLE** | Cannot alter component lineage or lot identity to fabricate a passing result. |
| **Tooling & Environment** | `equipment_id`, `eq_EQP-101`..`eq_EQP-105` | **IMMUTABLE** | An operator cannot re-assign a test run to a different ATE head to bypass quarantine. |
| **Measurable Telemetry** | 16 raw physical channels (`supply_voltage`, `leakage_current`, etc.) | **MUTABLE** | Genuine electrical test parameters that can be probed, tuned, or adjusted. |
| **Engineered Features** | 7 domain physical interactions (`voltage_headroom`, `leakage_fraction`, etc.) | **RE-DERIVED** | Automatically recalculated from perturbed raw features to ensure mathematical consistency. |

---

## 3. Optimization Algorithm & Determinism

The explanation engine uses a deterministic projected search algorithm:
- Initialized from the original input vector $\mathbf{x}$.
- Evaluates candidate coordinate perturbations along key parametric sensitivity directions.
- Clamps values to project-defined feature bounds and per-feature maximum movement limits ($\le 5\sigma$).
- Total distance budget capped at $30\sigma$.
- Model SHA-256 hash is verified immediately before and after counterfactual search, guaranteeing zero in-flight model mutation.
- All operations are 100% deterministic (no stochastic seeds or unseeded random steps).

---

## 4. Target Conditions

The engine supports three explicit target conditions:
1. `TARGET_PASS`: Requires calibrated probability $P < 0.20$ (nominal operating threshold).
2. `TARGET_REJECT`: Requires calibrated probability $P \ge 0.20$ (quarantine threshold).
3. `TARGET_MONITOR`: Requires calibrated probability $0.20 \le P < 0.50$ (secondary review envelope).

If a target condition cannot be satisfied within the configured distance budget and physical constraints, the engine returns `target_reached: false` with the closest candidate found and the remaining target margin.

---

## 5. Canonical Input Schema & Fail-Closed Validation

To prevent prompt injection, malicious perturbation vectors, or feature contamination:
- Requests must strictly adhere to the canonical schema: exactly the 16 raw numerical features, `equipment_id`, and valid metadata identifiers.
- Unknown or extra features are strictly rejected with `UNKNOWN_FEATURE` (silent stripping is prohibited).
- Missing features, non-finite values (NaN, Infinity), and physical-bound violations fail closed.
- Feature vectors of incorrect length or non-canonical ordering fail closed (`INVALID_FEATURE_VECTOR_LENGTH`).

---

## 6. Critical Engineering Disclaimers

> [!CAUTION]
> **NOT A CAUSAL PROOF**: A counterfactual explanation demonstrates model sensitivity under configured mathematical constraints. It is **NOT** a physical causal guarantee that adjusting wafer parameters in the fab will physically prevent degradation without side effects.

> [!IMPORTANT]
> **BENCHMARK ONLY**: Counterfactual explanations are marked `explanation_status = BENCHMARK_ONLY`. They do **NOT** modify production decision rules, thresholds, anomaly weights, or conformal intervals.
