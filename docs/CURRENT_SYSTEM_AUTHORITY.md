# PREDICTA — Current System Authority

> **AUTHORITATIVE STATUS DOCUMENT**
>
> For the current executable system, this document and the production manifest below take precedence over historical audits, experiments, milestone reports, and legacy model cards.

## Canonical Production Authority

- **Production manifest:** `ml/models/production/predicta_production_manifest.json`
- **Production model directory:** `ml/models/production/`
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
- Historical thresholds such as **0.45** are not current operating settings.

## SIH demonstration rule

During demonstrations, use the current production manifest and executable runtime as the source of truth. Historical documents are retained for engineering traceability only.
