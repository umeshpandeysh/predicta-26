# PREDICTA-26 repository authority

Problem statement: SIH 2026 PS-170 — Semiconductor Burn-In Telemetry & Latent Defect Screening

This document defines which repository artifacts control the current system. Implementation details belong in the code and the relevant technical documents.

## 1. Authority order

When repository documents disagree, resolve them in this order:

1. executable runtime behavior and passing tests;
2. ml/models/production/predicta_production_manifest.json;
3. production model metadata and artifacts;
4. this document and docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md;
5. current system documentation;
6. benchmark and research records;
7. historical reports.

Lower levels may document earlier states of the system, but they do not change the current production configuration.

## 2. Production identifiers

| Item | Current value | Source |
|---|---|---|
| System release | 2.0_production | production manifest |
| Model lineage | 4.0.0_authoritative | production manifest / metadata |
| Production model | ml/models/production/predicta_xgboost_model.json | production manifest |
| Model SHA-256 | 91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98 | production manifest |
| Dataset | ml/data/synthetic/predicta_dataset_v4_production.csv | production manifest |
| Dataset SHA-256 | 9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24 | production manifest |
| Dataset size | 50,000 records | production manifest |
| Operating threshold | 0.20 | production manifest |
| Feature schema | 28 features | production metadata |

The manifest and its integrity checks are the source of truth.

## 3. Model and benchmark status

### Production

The native XGBoost classifier is the production decision model. Its executable artifact, metadata, manifest entry, and threshold are protected by release checks.

### Benchmark / prognostic

The GPR artifact is retained for degradation and prognostic evaluation. It is not the production failure classifier.

### Benchmark / uncertainty

The conformal calibration artifact is retained for benchmark evaluation. Its current governance state is NOT_CALIBRATED / BENCHMARK_ONLY; production promotion remains locked.

### External datasets

External datasets are used for transfer and robustness studies where compatible targets exist. A result from an external dataset does not establish production qualification.

## 4. Synthetic-data boundary

The current production dataset is synthetic. Reported model metrics describe that governed dataset and its defined train/test partitions.

Documentation must not describe these metrics as commercial-fab validation, field performance, or silicon qualification.

## 5. Historical records

The repository intentionally retains phase reports, experiment outputs, and earlier audits for development history and reproducibility.

Historical thresholds and metrics may appear in those records. They should be described as historical values rather than silently rewritten to match the current system.

## 6. Change control

A change to a production model, dataset, threshold, manifest, or authority document requires:

1. review of the affected provenance and contracts;
2. the relevant automated tests;
3. diff review;
4. explicit merge into the validated release line.

A branch containing an experiment or an incomplete fix is not a production source merely because it is present on GitHub.
