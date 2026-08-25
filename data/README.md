# Data Directory Structure

This folder contains the datasets used to train and validate the anomaly detection and drift prediction models.

## Categories

*   aw/: Raw, unaltered source files (e.g., ST-AWFD zip file, NASA dataset downloads). **Do not commit large raw files.**
*   proxy/: Verified public proxy datasets representing semiconductor manufacturing and reliability parameters (e.g., UCI SECOM, NASA MOSFET).
*   synthetic/: Data generated using our physics-of-failure simulator (scripts/generate_synthetic_data.py).
*   processed/: Cleaned, validated, and normalized data output from the preprocessing pipeline.
*   sample/: Very small, anonymized subsets (under 100 rows) committed to the repository for quick local testing and CI pipeline validation.
