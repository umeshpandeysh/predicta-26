# Contributing to PREDICTA Platform

Thank you for contributing to PREDICTA — Industrial Semiconductor Manufacturing Intelligence Platform. We welcome contributions that adhere to high-reliability ML and physical device engineering principles.

## Engineering Guidelines

1. **Physics-Informed Architecture**: All machine learning strategies, feature engineering formulas, and anomaly scoring algorithms must be grounded in semiconductor device physics (BTI, HCI, electromigration, Arrhenius kinetics, and Elmore delay models).
2. **Document Assumptions & Limitations**:
   * **Verified Device Physics**: Equations grounded in established semiconductor physics literature.
   * **Synthetic Data Baselines**: Parameters derived from synthetic ATE telemetry generation.
   * **Real-Fab Silicon Pilot**: Commercial semiconductor fab validation planned for future releases.
3. **Reproducibility & Determinism**: All ML training, validation, and inference routines must specify explicit random seeds and maintain strict single-source-of-truth threshold metadata.
4. **Code Quality & Testing**:
   * Format Python code using Black/Ruff and Node.js using ESLint/Prettier before submitting pull requests.
   * Add automated unit and contract tests in the `tests/` directory for any proposed changes.
   * Run the master regression suite (`npm test`) prior to opening a pull request.
