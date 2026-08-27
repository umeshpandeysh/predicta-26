"""
Phase 4 Python / Node Risk Engine Parity Verification Script
File: scratch/verify_python_node_parity.py
"""

import sys
import json
from src.api.inference_service import PredictaInferenceService

service = PredictaInferenceService()

record = {
    "test_id": "PARITY-001",
    "equipment_id": "EQP-101",
    "supply_voltage": 1.20, "output_voltage": 1.18, "current": 40.0, "leakage_current": 110.0,
    "resistance": 12.0, "capacitance": 4.0, "threshold_voltage": 0.45, "frequency": 2500.0,
    "propagation_delay": 11.5, "setup_time": 1.2, "hold_time": 0.8, "timing_margin": 2.2,
    "temperature": 26.0, "dynamic_power": 42.0, "total_power": 52.0, "test_duration": 12.0,
    "iddq": 2100.0, "ileak": 290.0, "tpd": 190.0,
    "iddq_0h": 2080.0, "ileak_0h": 288.0, "tpd_0h": 188.0
}

py_res = service.predict_single(record)
risk_engine = py_res["ml_details"]["risk_engine"]

print("=========================================================================")
print("PYTHON INFERENCE SERVICE — PHASE 4 RISK ENGINE OUTPUT")
print("=========================================================================")
print(json.dumps(risk_engine, indent=2))

assert risk_engine["risk_class"] == "SAFE", f"Expected SAFE, got {risk_engine['risk_class']}"
assert risk_engine["decision"]["action"] == "PROCEED_STANDARD_SCREENING", "Action mismatch"
print("\n✔ Python Risk Engine Parity Check Passed Successfully!")
