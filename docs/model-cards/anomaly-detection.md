# Model Card: PREDICTA Production Anomaly Detection

**Project:** PREDICTA-26  
**Status:** Authoritative production model card  
**Production artifact:** `ml/models/production/predicta_anomaly_artifacts.json`

## Model Details

PREDICTA uses a two-layer unsupervised anomaly intelligence contract:

1. **Robust PAT / MAD** — interpretable lot-relative parametric outlier screening.
2. **COPOD** — multivariate empirical-copula tail anomaly scoring.

Isolation Forest implementations and benchmarks elsewhere in the repository are historical or experimental references and are **not part of the authoritative production runtime decision contract**.

**Active production runtime:** `src/api/inference.js`  
**Parity runtime:** `src/api/inference_service.py`

## Intended Use

The anomaly layer provides complementary evidence to the supervised XGBoost failure-risk model. It is designed to flag unusual telemetry patterns, including potentially unseen distributions, but it does not independently replace deterministic safety limits or the final operational decision engine.

## Production Artifact Contract

The production artifact must contain:

- `robust_mad.global_stats` for PAT/MAD reference statistics
- `copod.global_ecdfs` for empirical copula reference distributions

Release certification validates this schema before production release.

## Limitations

- Robust PAT/MAD is population-relative and depends on sufficient reference data.
- COPOD is an unsupervised tail-distribution signal and should not be presented as a standalone defect classifier.
- Historical Isolation Forest experiments must not be cited as active production behavior.
- Results obtained on synthetic evaluation data must be described as synthetic-environment performance, not real-fab production performance.
