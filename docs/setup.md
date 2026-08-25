# Setup and Execution Guide

This document describes the environment preparation, package installation, and execution steps to run Predicta.

---

## 1. Prerequisites

Verify your local system has the following runtimes configured:
*   **Node.js (v18.0.0+):** Required to run automated validation test suites and load the local static browser dashboard.
*   **Python (v3.10.0+):** Required to run the machine learning training and GPR inference scripts.

---

## 2. Quick Start (Automated Verification)

To clone the repository and run all 5 automated schema, frontend, registry, and mathematical tests:

```bash
# 1. Clone the repository
git clone https://github.com/umeshpandeysh/HBD-main-ak.git
cd ceenew

# 2. Run all project tests
node tests/test_frontend.js
node tests/test_registries.js
node tests/test_phase4.js
node tests/test_anomaly.js
node tests/test_drift.js
```

---

## 3. Python ML Environment Setup

To prepare the Python environment and install required machine learning libraries (such as `numpy`, `pandas`, `pyyaml`, and `scikit-learn`):

```bash
# Create a virtual environment
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

---

## 4. Model Training & Evaluation

To execute the python-based training pipelines for Module A and Module B and write metrics:

```bash
# Run Module A (Anomaly Detection) training and evaluation
python scripts/train_anomaly_models.py

# Run Module B (Parametric Drift Forecasting) training and evaluation
python scripts/train_drift_models.py
```

All metrics and SVG plots will be outputted under `experiments/anomaly_detection/` and `experiments/drift_prediction/`.
