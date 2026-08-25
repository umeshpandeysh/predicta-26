"""
Predicta Semiconductor Test Analytics Prototype — Day 10 ML Inference API Test Suite
File: tests/test_inference.py

Tests:
  1. Model loads successfully
  2. Health endpoint status & threshold
  3. Valid single prediction
  4. Valid batch prediction
  5. Missing feature rejection (HTTP 400)
  6. Invalid equipment rejection (HTTP 400)
  7. Malformed numeric input rejection (HTTP 400)
  8. Operating threshold remains exactly 0.45
  9. Output schema compliance
  10. Deterministic repeated inference

STRICT REQUIREMENT: Absolutely zero access to ml/data/processed/test.csv. Uses synthetic dev records.
"""

import json
import unittest
from src.api.inference_service import inference_service, PredictaInferenceService

SAMPLE_DEV_RECORD = {
    "test_id": "DEV-TEST-001",
    "wafer_id": "W-DEV-01",
    "die_id": "D-DEV-05",
    "equipment_id": "EQP-103",
    "supply_voltage": 1.20,
    "output_voltage": 1.18,
    "current": 45.2,
    "leakage_current": 195.4,
    "resistance": 12.5,
    "capacitance": 4.2,
    "threshold_voltage": 0.42,
    "frequency": 2400.0,
    "propagation_delay": 14.5,
    "setup_time": 1.2,
    "hold_time": 0.8,
    "timing_margin": 2.1,
    "temperature": 35.0,
    "dynamic_power": 65.0,
    "total_power": 72.0,
    "test_duration": 12.0
}

SAMPLE_CLEAN_RECORD = {
    "test_id": "DEV-TEST-002",
    "wafer_id": "W-DEV-01",
    "die_id": "D-DEV-06",
    "equipment_id": "EQP-101",
    "supply_voltage": 1.20,
    "output_voltage": 1.19,
    "current": 40.0,
    "leakage_current": 110.0,
    "resistance": 12.0,
    "capacitance": 4.0,
    "threshold_voltage": 0.45,
    "frequency": 2500.0,
    "propagation_delay": 12.0,
    "setup_time": 1.5,
    "hold_time": 1.0,
    "timing_margin": 3.0,
    "temperature": 27.0,
    "dynamic_power": 45.0,
    "total_power": 52.0,
    "test_duration": 10.0
}

class TestPredictaInference(unittest.TestCase):

    def test_01_model_loads_successfully(self):
        """1. Verify model and metadata artifacts load at startup."""
        service = PredictaInferenceService()
        self.assertTrue(service.is_loaded)
        self.assertIsNotNone(service.model_data)
        self.assertIsNotNone(service.metadata)

    def test_02_health_endpoint_schema(self):
        """2. Verify health endpoint response properties."""
        self.assertEqual(inference_service.operating_threshold, 0.45)
        self.assertEqual(inference_service.metadata["model_name"], "predicta_final_xgboost")

    def test_03_valid_single_prediction(self):
        """3. Verify valid single prediction execution."""
        res = inference_service.predict_single(SAMPLE_DEV_RECORD)
        self.assertEqual(res["prediction"], "FAIL")
        self.assertGreaterEqual(res["probability"], 0.45)
        self.assertEqual(res["threshold"], 0.45)
        self.assertIn(res["risk_level"], ["HIGH", "CRITICAL"])
        self.assertEqual(res["test_id"], "DEV-TEST-001")

    def test_04_valid_batch_prediction(self):
        """4. Verify valid batch prediction execution."""
        batch_input = [SAMPLE_DEV_RECORD, SAMPLE_CLEAN_RECORD]
        res = inference_service.predict_batch(batch_input)
        self.assertEqual(res["total"], 2)
        self.assertEqual(res["pass_count"], 1)
        self.assertEqual(res["fail_count"], 1)
        self.assertEqual(len(res["results"]), 2)

    def test_05_missing_feature_rejection(self):
        """5. Verify HTTP 400 rejection for missing required feature."""
        incomplete = dict(SAMPLE_DEV_RECORD)
        del incomplete["leakage_current"]
        with self.assertRaises(ValueError) as ctx:
            inference_service.predict_single(incomplete)
        self.assertIn("Missing required numerical feature", str(ctx.exception))

    def test_06_invalid_equipment_rejection(self):
        """6. Verify HTTP 400 rejection for unknown equipment_id."""
        invalid_eq = dict(SAMPLE_DEV_RECORD)
        invalid_eq["equipment_id"] = "EQP-999"
        with self.assertRaises(ValueError) as ctx:
            inference_service.predict_single(invalid_eq)
        self.assertIn("Invalid equipment_id 'EQP-999'", str(ctx.exception))

    def test_07_malformed_numeric_input_rejection(self):
        """7. Verify HTTP 400 rejection for malformed numeric input."""
        malformed = dict(SAMPLE_DEV_RECORD)
        malformed["temperature"] = "INVALID_STRING"
        with self.assertRaises(ValueError) as ctx:
            inference_service.predict_single(malformed)
        self.assertIn("Field 'temperature' must be a valid finite number", str(ctx.exception))

    def test_08_threshold_remains_exactly_0_45(self):
        """8. Verify operating threshold remains fixed at 0.45."""
        self.assertEqual(inference_service.operating_threshold, 0.45)

    def test_09_output_schema_compliance(self):
        """9. Verify response dictionary schema."""
        res = inference_service.predict_single(SAMPLE_DEV_RECORD)
        required_keys = {"prediction", "probability", "threshold", "risk_level", "model_version", "explanation"}
        self.assertTrue(required_keys.issubset(res.keys()))
        self.assertIn("key_indicators", res["explanation"])

    def test_10_repeated_inference_deterministic(self):
        """10. Verify repeated inference outputs identical probability."""
        res1 = inference_service.predict_single(SAMPLE_DEV_RECORD)
        res2 = inference_service.predict_single(SAMPLE_DEV_RECORD)
        self.assertEqual(res1["probability"], res2["probability"])
        self.assertEqual(res1["prediction"], res2["prediction"])

if __name__ == "__main__":
    unittest.main()
