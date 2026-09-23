# PREDICTA — Current System Authority

> **AUTHORITATIVE STATUS DOCUMENT**
>
> For the current executable system, this document and the production manifest below take precedence over historical audits, experiments, milestone reports, and legacy model cards.

## Canonical Production Authority

- **Master ML Authority:** [`docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md`](docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md)
- **Production manifest:** `ml/models/production/predicta_production_manifest.json`
- **Production model directory:** `ml/models/production/`
- **System Release Version:** `2.0_production` (`v2.0.0` platform release)
- **Model Lineage Version:** `4.0.0_authoritative`
- **Operating threshold:** **0.20**
- **Public system overview:** `README.md`

## Evidence hierarchy

1. Executable runtime behavior and automated tests
2. `ml/models/production/predicta_production_manifest.json`
3. Production model metadata and artifacts
4. `README.md`
5. Reproducible evaluation artifacts
6. Research and historical documentation

## Scientific presentation rules

- The benchmark dataset contains **50,000 physics-informed synthetic records**.
- Production metadata metrics must be presented as synthetic-benchmark results unless independently validated on real fab data.
- Historical operating thresholds used during early research phases are not current production settings. The current authoritative operating threshold is 0.20.

## SIH demonstration rule

During demonstrations, use the current production manifest and executable runtime as the source of truth. Historical documents are retained for engineering traceability only.
