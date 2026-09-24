# PREDICTA-26

PREDICTA-26 is a semiconductor burn-in telemetry screening and reliability-analysis project for Smart India Hackathon 2026, Problem Statement 170.

The repository contains the production inference path, offline analysis code, model artifacts, tests, benchmark results, and historical engineering records. Production claims are kept separate from synthetic benchmarks and research experiments.

## PS-170 scope

The system is intended to use early burn-in observations to:

- validate incoming telemetry;
- detect abnormal part or lot behavior;
- estimate failure risk with the production classifier;
- evaluate degradation over the 168-hour burn-in horizon;
- apply physics-based consistency checks;
- combine the available evidence into an engineering disposition;
- retain the evidence used for the decision.

Benchmark and research components are not production decision authorities. Their status is recorded in the repository authority documents.

## Current production path

~~~text
ATE / test telemetry
        |
        v
Input validation
        |
        v
Feature construction
        |
        +-------------------+
        |                   |
        v                   v
Production XGBoost      Anomaly / drift evidence
        |                   |
        +---------+---------+
                  |
                  v
             Risk fusion
                  |
                  v
          Disposition logic
                  |
                  v
      Evidence / audit record
~~~

The main Node.js runtime is under src/. Python implementations are retained for offline analysis, validation, and cross-runtime parity.

## Production authority

The current production decision model is the native XGBoost artifact:

~~~text
ml/models/production/predicta_xgboost_model.json
ml/models/production/predicta_xgboost_metadata.json
ml/models/production/predicta_production_manifest.json
ml/data/synthetic/predicta_dataset_v4_production.csv
~~~

| Item | Value |
|---|---|
| System release | 2.0_production |
| Model lineage | 4.0.0_authoritative |
| Operating threshold | 0.20 |
| Production dataset | 50,000 synthetic records |
| Feature schema | 28 features |
| Production model SHA-256 | 91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98 |
| Dataset SHA-256 | 9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24 |

These values are governed by the production manifest and the associated tests.

### Scope boundaries

- The production dataset is synthetic.
- GPR degradation forecasting is a benchmark/prognostic component; it is not the production failure classifier.
- Conformal calibration is benchmark-only and remains promotion-locked.
- External-dataset experiments measure transfer behavior; they do not establish fab qualification.
- Real commercial-fab validation is future work.

See docs/REPOSITORY_AUTHORITY.md and docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md for the detailed authority rules.

## PS-170 traceability

The repository includes a traceability demonstration and requirement-to-code matrix:

- src/demo_ps170_traceability.js
- src/demo_ps170_traceability.py
- docs/PS170_TRACEABILITY_MATRIX.md
- docs/ps170_traceability_matrix.json

Run:

~~~bash
node src/demo_ps170_traceability.js
~~~

## Verification

~~~bash
npm install
npm test
npm run test:parity
npm run certify:production
node tests/test_docs_threshold_consistency.js
node tests/test_gpr_provenance.js
node src/demo_ps170_traceability.js
~~~

Python validation and research commands are documented with the relevant test or analysis module. Historical reports are not current test instructions unless explicitly marked current.

## Repository layout

~~~text
api/                    Deployment entry point
src/                    Runtime, inference, governance, physics, prognostics
frontend/               Operator-facing web assets
ml/data/                Production, benchmark, and external data
ml/models/production/   Production model artifacts and manifest
ml/benchmarks/          Reproducible benchmark scripts
ml/analysis/            Offline evaluation and audit scripts
ml/training/            Model-building and training code
tests/                  Regression, parity, security, and certification tests
docs/                   Current specifications, reports, and historical records
supabase/               Database schema and migrations
~~~

Dated and phase-specific documentation is retained when it provides reproducibility or audit evidence. It does not override current authority documents.

## Limitations

The primary production dataset is synthetic. Model metrics describe the governed evaluation data and should not be read as commercial-fab performance.

Qualification on physical silicon, production-line transfer, and validation across independent fabrication environments remain separate engineering activities.

## License

Apache License 2.0. See LICENSE for details.
