# Synthetic Data Guide

This document defines the organization, metadata, and classes represented in our `v0.1` synthetic dataset.

## Health Classes

1.  **HEALTHY (95% of lot):** Normal process variance. Standard sub-linear BTI drift over 168 hours. No parameter violations.
2.  **BORDERLINE (2% of lot):** Starts near the outer edge of process distributions (e.g. $+3\sigma_{\text{robust}}$). Serves to challenge False Positive bounds.
3.  **LATENT_DEFECT (2% of lot):** Initially normal/borderline at 0h. Exhibits accelerated aging curves ($4\times$ BTI factor), crossing safety boundaries under stress (detectable at 24h/96h).
4.  **FAILED (1% of lot):** Highly aggressive degradation. Undergoes dielectric step breakdown or thermal runaway, quickly exceeding absolute maximum specifications.
