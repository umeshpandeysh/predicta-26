# PREDICTA Platform Release Changelog

All notable changes to the PREDICTA Semiconductor Manufacturing Intelligence Platform are documented in this file.

## [2.0.0] - 2026-08-28
### Added
- Certified production baseline `predicta_xgboost_v2.json` with SHA-256 integrity lock (`2e7df9f1e2ad3cad...`).
- Single-source-of-truth threshold metadata governance (`operating_threshold = 0.20`).
- Dual-layer unsupervised open-set anomaly router (Lot MAD Z-Score + COPOD empirical copula).
- Gaussian Process Regression (GPR) degradation forecasting with 6.23 wafer early-warning lead time.
- Automated cross-runtime Node.js ↔ Python parity suite (`tests/test_js_python_parity.js`).
- Adversarial security hardening & 1 MB payload size cap enforcement (`tests/test_adversarial_security.js`).
- Interactive Workstation Dashboard with live REST API integration and Supabase offline hybrid fallback.

## [1.0.0] - 2026-08-25
### Added
- Initial baseline 150-tree XGBoost classifier for ATE burn-in telemetry.
- REST API gateway server and authentication middleware.
- Comprehensive technical documentation and system architecture specifications.
