# Human Disposition Feedback & Governance Protocol

**Status**: `RECORDED_ONLY`  
**Contract Version**: `1.0.0`  
**Authority**: `AUTHORITATIVE_GOVERNANCE_CONTRACT`  
**Schema**: `ml/governance/disposition_contract.json`

---

## 1. Scope & Objective

In semiconductor manufacturing quality assurance, Automated Test Equipment (ATE) screening is overseen by qualified test floor operators and quality engineers. The Human Disposition Feedback protocol establishes a governed, traceable mechanism for capturing human-in-the-loop decisions (`ACCEPT`, `REJECT`, `HOLD`, `RETEST`, `ESCALATE`) while enforcing strict isolation from production model weights, decision thresholds, and datasets.

---

## 2. Immutability & Separation of Concerns

A fundamental failure mode in automated ML governance is "decision clobbering," where a human disposition overwrites the machine learning record. Predicta strictly prevents this:

```
[Inference Phase]
ATE Telemetry ───> Multi-Task Model ───> ML Decision: REJECT (P = 0.84)
                                                │
                                                ▼ (Permanently Immutable)
                                          [Audit Log]
                                                │
[Human Review Phase]                            │
Operator Input ──> Operator Disposition: ACCEPT ─┘
                   Reason: MANUAL_ENGINEERING_REVIEW
                   Status: RECORDED_ONLY
```

1. **The original ML decision is NEVER overwritten**.
2. If the model predicted `REJECT` and an operator chooses `ACCEPT`, the recorded state stores:
   - `original_ml_decision = "REJECT"`
   - `human_disposition = "ACCEPT"`
3. Both records are cryptographically tagged with trace IDs and model hashes to facilitate retrospective disagreement analysis without corrupting historical inference logs.

---

## 3. Zero-Retraining & Data Leakage Protection

Under no circumstances does human disposition feedback automatically:
- Trigger online learning or gradient updates.
- Modify production weights or model files.
- Adapt operating decision thresholds (such as $\theta^* = 0.20$).
- Modify anomaly fusion weights or baseline statistics.
- Trigger conformal recalibration.
- Enter training, validation, calibration, or held-out test splits.

All feedback records are tagged with:
```json
"feedback_status": "RECORDED_ONLY"
```

Any future model updates using operator feedback must proceed through an independent, offline, human-reviewed retraining pipeline.

---

## 4. Controlled Taxonomy & Reason Codes

### Dispositions
- `ACCEPT`: Component accepted for downstream assembly under engineering waiver.
- `REJECT`: Component confirmed defective; consigned to physical quarantine.
- `HOLD`: Component held pending lot-level statistical review.
- `RETEST`: Component flagged for secondary diagnostic retest on pristine test head.
- `ESCALATE`: Flagged for principal reliability engineering disposition.

### Reason Codes
- `FALSE_POSITIVE_SUSPECTED`
- `FALSE_NEGATIVE_SUSPECTED`
- `INSUFFICIENT_DATA`
- `RETEST_REQUIRED`
- `EQUIPMENT_ISSUE`
- `PROCESS_EXCEPTION`
- `MANUAL_ENGINEERING_REVIEW`
- `OTHER`

---

## 5. Security & RBAC Enforcement

All disposition endpoints enforce role-based access control:
- Unauthenticated requests are rejected with `401 UNAUTHORIZED`.
- Unauthorized roles (such as anonymous or read-only users) are rejected with `403 FORBIDDEN`.
- Allowed roles: `OPERATOR`, `ADMIN`.
- Input validation rejects malformed trace IDs, unrecognized reason codes, and comments exceeding 1,000 characters.
- Structured audit events (`DISPOSITION_RECORDED`, `DISPOSITION_REJECTED`) are emitted for every transaction.
