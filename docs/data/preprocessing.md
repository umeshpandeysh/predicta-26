# Preprocessing Pipeline

This document describes the steps taken to transform raw proxy and synthetic datasets into standard ML-ready structures.

```text
Raw Ingest (CSV/MAT) â”€â”€â–º Validation Check â”€â”€â–º Unit Normalization â”€â”€â–º Robust Z-Score â”€â”€â–º ML Split
```

## 1. Canonical Schema Transformation
*   Raw datasets (ST-AWFD, NASA, UCI) are loaded via customized parsers implementing `BaseParser`.
*   Unused fields are dropped, and missing columns are padded with `None` to align with `canonical-schema.md`.

## 2. Unit Standardization
*   All currents are converted to **Microamperes (ÂµA)**.
*   All delays are standardized to **Nanoseconds (ns)**.
*   All voltages are standardized to **Volts (V)**.
*   Original values and units are archived in metadata configurations.

## 3. Robust Per-Lot Standardization
*   To neutralize wafer-level process shifts and absolute offset variation, we apply Robust Z-score scaling:
    $$Z = \frac{x - \text{Median}_{\text{lot}}}{1.4826 \times \text{MAD}_{\text{lot}}}$$
*   This centers lot parameters around zero, exposing localized component anomalies without bleeding lot-level bias.
