"""
Predicta Semiconductor Reliability — API Schemas & Telemetry Persistence Test Suite
File: tests/test_api_schemas_and_persistence.py

Rigorous assertions verifying:
1. Pydantic v2 input and output schema validation.
2. HTTP 200 execution of /api/health, /api/predict, /api/predict/batch.
3. Live telemetry persistence: API predictions automatically update the telemetry store.
4. Dynamic dashboard endpoints (/api/dashboard/summary, /recent, /equipment, /risk).
5. Unseen equipment returns HTTP 200 with is_unseen_equipment: true.
6. HTTP 400 rejection for missing or invalid physical parameters.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from src.api.main import app
from src.api.telemetry_store import telemetry_store


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture
def valid_payload():
    return {
        "test_id": "API-TEST-001",
        "wafer_id": "W-TEST-01",
        "die_id": "D-001",
        "equipment_id": "EQP-101",
        "supply_voltage": 1.20,
        "output_voltage": 1.20,
        "current": 45.0,
        "iddq_standby": 10.5,
        "leakage_current": 112.0,
        "resistance": 12.5,
        "capacitance": 4.2,
        "threshold_voltage": 0.45,
        "frequency": 2500.0,
        "propagation_delay": 11.0,
        "setup_time": 0.85,
        "hold_time": 0.42,
        "timing_margin": 2.6,
        "temperature": 28.0,
        "dynamic_power": 54.0,
        "total_power": 54.5,
        "test_duration": 150.0,
    }


def test_01_health_endpoint(client):
    """Verify health endpoint returns status, model, version, and threshold."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["threshold"] == 0.20
    assert "telemetry_events_recorded" in data


def test_02_predict_single_and_persistence(client, valid_payload):
    """Verify single prediction returns valid schema and increments telemetry store."""
    initial_count = len(telemetry_store.events)

    response = client.post("/api/predict", json=valid_payload)
    assert response.status_code == 200
    data = response.json()

    assert data["prediction"] in ["PASS", "FAIL"]
    assert 0.0 <= data["probability"] <= 1.0
    assert data["threshold"] == 0.20
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert "explanation" in data
    assert "defect_classification" in data

    # Verify event was persisted
    assert len(telemetry_store.events) == initial_count + 1


def test_03_predict_batch_and_persistence(client, valid_payload):
    """Verify batch prediction returns counts and persists all items."""
    initial_count = len(telemetry_store.events)
    batch_payload = [valid_payload, dict(valid_payload, test_id="API-TEST-002")]

    response = client.post("/api/predict/batch", json=batch_payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 2
    assert data["pass_count"] + data["fail_count"] == 2
    assert len(data["results"]) == 2

    # Verify 2 events were persisted
    assert len(telemetry_store.events) == initial_count + 2


def test_04_dashboard_summary(client):
    """Verify dashboard summary returns dynamic real metrics."""
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_runs"] > 0
    assert data["pass_count"] + data["fail_count"] == data["total_runs"]
    assert 0.0 <= data["fail_rate"] <= 1.0
    assert 0.0 <= data["yield_rate"] <= 1.0
    assert 0.0 <= data["average_probability"] <= 1.0
    assert data["operating_threshold"] == 0.20


def test_05_dashboard_equipment(client):
    """Verify per-equipment metrics are dynamically computed."""
    response = client.get("/api/dashboard/equipment")
    assert response.status_code == 200
    data = response.json()

    assert "EQP-101" in data
    assert "total" in data["EQP-101"]
    assert "pass" in data["EQP-101"]
    assert "fail" in data["EQP-101"]


def test_06_dashboard_risk(client):
    """Verify risk distribution covers all 4 tiers."""
    response = client.get("/api/dashboard/risk")
    assert response.status_code == 200
    data = response.json()

    assert set(data.keys()) == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert sum(data.values()) > 0


def test_07_dashboard_recent(client):
    """Verify recent predictions stream returns non-empty list of runs."""
    response = client.get("/api/dashboard/recent?limit=10")
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0
    assert "timestamp" in data[0]
    assert "probability" in data[0]


def test_08_unseen_equipment_handling(client, valid_payload):
    """Verify unseen equipment ID returns HTTP 200 with is_unseen_equipment: true."""
    novel_payload = dict(valid_payload, equipment_id="EQP-999")
    response = client.post("/api/predict", json=novel_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["is_unseen_equipment"] is True
    assert data["prediction"] in ["PASS", "FAIL"]


def test_09_invalid_inputs_rejected(client, valid_payload):
    """Verify HTTP 400 rejection for missing or invalid physical fields."""
    # Missing required field
    bad_payload1 = dict(valid_payload)
    del bad_payload1["supply_voltage"]
    resp1 = client.post("/api/predict", json=bad_payload1)
    assert resp1.status_code == 400

    # Negative non-physical resistance
    bad_payload2 = dict(valid_payload, resistance=-5.0)
    resp2 = client.post("/api/predict", json=bad_payload2)
    assert resp2.status_code == 400

    # Non-numeric string
    bad_payload3 = dict(valid_payload, temperature="VERY_HOT")
    resp3 = client.post("/api/predict", json=bad_payload3)
    assert resp3.status_code == 400
