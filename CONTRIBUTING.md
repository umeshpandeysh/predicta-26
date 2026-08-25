# Contributing to AI-Driven Anomaly Detection in Component Burn-In & Screening

Thank you for contributing to our Smart India Hackathon 2026 project! We welcome contributions that adhere to our engineering principles.

## Guidelines

1. **Keep it Physics-Informed**: All machine learning strategies must be rooted in semiconductor reliability physics (BTI, HCI, electromigration).
2. **Document Assumptions**: Make a clear distinction between:
   * **Verified Facts**: Officially documented by ISRO, JEDEC, or MIL standards.
   * **Engineering Assumptions**: Necessary simplifications to build the prototype.
   * **Proposed Methods**: Our custom algorithms.
   * **Synthetic Data**: Artificially generated test parameters.
3. **Reproducibility**: All experiments must have a random seed and versioned dataset configurations.
4. **Code Quality**:
   * Format Python code using Black/Ruff before committing.
   * Add unit tests in the 	ests/ directory for any new logic.
