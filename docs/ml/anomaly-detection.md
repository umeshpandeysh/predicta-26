# Module A: Anomaly Detection Paradigm

This document outlines the core dynamic screening paradigm implemented in AIPS Module A.

## The Problem with Static Limits
Traditional semiconductor screening matches parameters against absolute limits:
```text
Component Current (45 ÂµA) < Specification (100 ÂµA) â”€â”€â–º PASS
```
*   *Limitation:* If the typical current of the manufacturing lot is $10\,\mu\text{A}$ and this specific component exhibits a $+4.5\times$ increase, it represents an outlier containing a latent defect, but passes static limits, creating a **field escape**.

## The Dynamic Solution
AIPS evaluates components relative to their peer lot:
```text
Component Current (45 ÂµA) vs. Lot Median (10 ÂµA) â”€â”€â–º Flagged as Lot Outlier
```
This isolates local deviations, catching early wear-out patterns without increasing false alarms across lots.
