# PREDICTA-26 repository guide

This file is an index for the repository. It is not a second source of truth for model parameters or release status.

## Current system

PREDICTA-26 addresses SIH 2026 Problem Statement 170: Semiconductor Burn-In Telemetry & Latent Defect Screening.

The current runtime combines telemetry validation, production XGBoost inference, anomaly and drift evidence, 168-hour prognostic analysis, physics consistency checks, risk fusion, disposition, and evidence records.

The executable behavior and tests are authoritative for implementation details. The production manifest is authoritative for the production model, dataset, and threshold.

## Authority order

When documents disagree, use this order:

1. executable runtime behavior and passing tests;
2. ml/models/production/predicta_production_manifest.json;
3. production model metadata and artifacts;
4. docs/REPOSITORY_AUTHORITY.md;
5. docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md;
6. current system documentation;
7. benchmark, experiment, and historical reports.

A historical report records what was evaluated at that point in development. It is not a current configuration unless a current authority document says so.

## Production artifacts

| Artifact | Role |
|---|---|
| ml/models/production/predicta_xgboost_model.json | Production failure-risk model |
| ml/models/production/predicta_xgboost_metadata.json | Model metadata and evaluation values |
| ml/models/production/predicta_production_manifest.json | Production artifact and threshold authority |
| ml/data/synthetic/predicta_dataset_v4_production.csv | Governed synthetic production benchmark dataset |
| ml/models/production/predicta_gpr_kernel_artifacts.json | Prognostic benchmark artifact |
| ml/models/production/conformal_calibration_artifacts.json | Benchmark calibration artifact |

The protected hashes are recorded in the manifest and checked by the verification suites.

## Source tree

### Runtime

- api/ — deployment entry point.
- src/api/ — API and inference service.
- src/physics/ — physics calculations.
- src/prognostics/ — 168-hour trajectory logic.
- src/risk_fusion/ — evidence combination and risk scoring.
- src/governance/ — disposition and evidence controls.
- src/reliability_twin/ — evidence-only reliability history.
- src/explainability/ — counterfactual explanations.

### Machine learning

- ml/models/production/ — protected production artifacts.
- ml/training/ — training and model-building code.
- ml/analysis/ — offline analysis and audits.
- ml/benchmarks/ — reproducible benchmark scripts.
- ml/experiments/ — historical experiment outputs.
- ml/data/ — synthetic, processed, and external datasets.

### Verification

- tests/ — regression, parity, security, provenance, and release tests.
- .github/workflows/ — CI definitions.
- docs/audit/ — audit evidence and review records.

### Documentation

Current specifications and release documents are kept near the top of docs/. Dated reports and phase reports are historical records.

## PS-170 evidence

Start with:

- docs/PS170_TRACEABILITY_MATRIX.md
- docs/CURRENT_SYSTEM_AUTHORITY.md
- docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md
- docs/REPOSITORY_AUTHORITY.md
- docs/PRODUCT_DEMO_SCRIPT.md
- docs/SYSTEM_DEMO_GUIDE.md

## Verification commands

~~~bash
npm test
npm run test:parity
npm run certify:production
node tests/test_docs_threshold_consistency.js
node tests/test_gpr_provenance.js
node src/demo_ps170_traceability.js
~~~

Run Python tests and analysis from the specific module documentation rather than copying commands from older reports.

## Documentation rules

Current documentation should:

- state what the code actually does;
- identify whether evidence is production, benchmark, or historical;
- give the source artifact for model values and hashes;
- avoid claims that cannot be reproduced from repository evidence;
- avoid repeating the same architecture description in multiple files.

Historical reports are not rewritten merely to make them look current. If an old report contains an outdated value, its historical status should be clear and the current authority should point to the newer source.

## Development workflow

Use a branch for changes, run the relevant tests, review the diff, and merge only validated work into main.

Experimental branches are not production releases simply because they exist. A branch is considered for merge when its changes are represented in the validated release line and the resulting repository passes the applicable release checks.

## License

Apache License 2.0.
