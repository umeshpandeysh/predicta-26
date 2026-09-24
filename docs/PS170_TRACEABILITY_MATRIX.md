# PREDICTA-26 — PS-170 traceability matrix

Problem Statement: SIH 2026 PS-170 — Semiconductor Burn-In Telemetry & Latent Defect Screening

This matrix connects the problem statement requirements used by the project to implementation, tests, evaluation scripts, and stored evidence.

## 1. Traceability flow

~~~text
Burn-in telemetry
      |
      v
Input validation
      |
      v
Feature construction
      |
      +----------------------+----------------------+
      |                      |                      |
      v                      v                      v
Production model       Anomaly / drift       Prognostic analysis
      |                      |                      |
      +----------------------+----------------------+
                             |
                             v
                    Physics / consistency
                             |
                             v
                         Risk fusion
                             |
                             v
                    Engineering disposition
                             |
                             v
                 Evidence and reliability record
~~~

The traceability demo follows the same evidence path and records the inputs and outputs used at each stage.

## 2. Requirement-to-code mapping

| Req ID | PS-170 requirement | Implementation | Tests | Evaluation / verification | Evidence |
|---|---|---|---|---|---|
| PS170-01 | Early screening and temporal leakage control | src/api/inference.js, src/api/inference_service.py | tests/test_ps170_intelligence.js, tests/test_ps170_intelligence.py | ml/analysis/ps170_temporal_leakage_proof.py | ml/reports/ps170_temporal_leakage_audit.json |
| PS170-02 | Dynamic outlier screening | src/api/inference.js, src/api/inference_service.py | parity and inference tests | anomaly benchmark scripts | anomaly benchmark report |
| PS170-03 | Failure-risk scoring | production inference modules | release certification tests | PS-170 benchmark | latent-escape benchmark report |
| PS170-04 | 168-hour prognostics and uncertainty | src/prognostics/ | prognostic and stability tests | lot stability evaluation | prognostic stability report |
| PS170-05 | Physics consistency checks | src/physics/ | physics and parity tests | physics evaluation scripts | layer-ablation report |
| PS170-06 | Sensor / equipment / silicon discrimination | src/governance/discrimination_engine.* | PS-170 intelligence tests | PS-170 benchmark | latent-escape report |
| PS170-07 | Distribution shift and OOD screening | src/governance/ood_classifier.* | PS-170 intelligence tests | robustness suite | benchmark evidence |
| PS170-08 | Governed uncertainty decision path | src/decision_engine/ | PS-170 intelligence tests | stack analysis | layer-ablation report |
| PS170-09 | Engineering evidence card | src/governance/evidence_card.* | PS-170 intelligence tests | traceability demo | docs/demo_evidence_packet.html |
| PS170-10 | Reliability evidence history | src/reliability_twin/ | reliability-twin tests | release certification | reliability-twin contract |
| PS170-11 | Multi-layer evaluation | ml/analysis/ps170_stack_ablation.py | PS-170 intelligence tests | stack analysis | layer-ablation report |
| PS170-12 | External transfer evaluation | ml/analysis/ps170_external_transfer_experiment.py | PS-170 intelligence tests | external transfer experiment | transfer report |
| PS170-13 | Adversarial reliability evaluation | ml/benchmarks/ps170_adversarial_reliability_benchmark.py | adversarial reliability tests | benchmark runner | adversarial report |
| PS170-14 | Temporal replay | src/governance/temporal_replay.* | PS-170 intelligence tests | temporal replay analysis | replay report |
| PS170-15 | Champion / challenger governance | ml/analysis/ps170_champion_challenger_harness.py | release governance tests | champion/challenger harness | comparison report |

This is a traceability index. A benchmark listed here is not automatically a production acceptance test.

## 3. Verification

~~~bash
node src/demo_ps170_traceability.js
python src/demo_ps170_traceability.py
~~~

For release verification, use the commands in the root README and the current release-certification documentation.
