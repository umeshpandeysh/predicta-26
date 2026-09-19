"""
Predicta Semiconductor Reliability — Persistent Real-Time Telemetry Store
File: src/api/telemetry_store.py

Thread-safe in-memory and persistent JSON telemetry event store powering:
  - GET /api/dashboard/summary
  - GET /api/dashboard/recent
  - GET /api/dashboard/equipment
  - GET /api/dashboard/risk

Persists all single and batch prediction events with rolling window eviction and historical seeding.
"""

import os
import json
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List
import numpy as np
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
STORE_PATH = os.path.join(BASE_DIR, "ml", "data", "telemetry_store.json")
VAL_DATA_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "validation.csv")
MAX_EVENTS = 5000


class TelemetryStore:
    def __init__(self, store_path: str = STORE_PATH, auto_seed: bool = True):
        self.store_path = store_path
        self.lock = threading.Lock()
        self.events: List[Dict[str, Any]] = []
        self._load_or_seed(auto_seed)

    def _load_or_seed(self, auto_seed: bool) -> None:
        """Loads existing store from JSON file, or seeds initial historical telemetry if empty."""
        with self.lock:
            if os.path.exists(self.store_path):
                try:
                    with open(self.store_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.events = data.get("events", [])
                        return
                except Exception:
                    self.events = []

            if auto_seed and os.path.exists(VAL_DATA_PATH):
                self._seed_from_validation()

    def _seed_from_validation(self, sample_count: int = 150) -> None:
        """Seeds initial realistic historical telemetry from validation_tune partition."""
        try:
            val_df = pd.read_csv(VAL_DATA_PATH)
            sample_df = val_df.sample(min(sample_count, len(val_df)), random_state=42)

            from src.api.inference_service import inference_service

            seeded = []
            for _, row in sample_df.iterrows():
                record = row.to_dict()
                try:
                    res = inference_service.predict_single(record)
                    event = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "test_id": record.get("test_id", f"SEED-{len(seeded):04d}"),
                        "wafer_id": record.get("wafer_id", "W-SEED"),
                        "die_id": record.get("die_id", f"D-{len(seeded):04d}"),
                        "equipment_id": str(record.get("equipment_id", "EQP-101")).strip().upper(),
                        "lot_id": record.get("lot_id", "LOT-VAL"),
                        "probability": float(res.get("probability", 0.0)),
                        "prediction": str(res.get("prediction", "PASS")),
                        "risk_level": str(res.get("risk_level", "LOW")),
                        "disposition": str(res.get("disposition", "PASS")),
                        "defect_type": str(res.get("defect_classification", {}).get("predicted_defect", "NORMAL")),
                        "anomaly_status": str(res.get("anomaly_status", "NORMAL")),
                        "is_unseen_equipment": bool(res.get("is_unseen_equipment", False)),
                    }
                    seeded.append(event)
                except Exception:
                    continue

            self.events = seeded
            self._save_to_disk()
        except Exception:
            self.events = []

    def _save_to_disk(self) -> None:
        """Persists in-memory events to JSON file."""
        os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
        payload = {
            "version": "4.0.0_authoritative",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_count": len(self.events),
            "events": self.events,
        }
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def record_event(self, record: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Records a single prediction inference event into the store."""
        with self.lock:
            event = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "test_id": result.get("test_id") or record.get("test_id", f"RUN-{len(self.events) + 1:06d}"),
                "wafer_id": result.get("wafer_id") or record.get("wafer_id", "W-UNKNOWN"),
                "die_id": result.get("die_id") or record.get("die_id", "D-UNKNOWN"),
                "equipment_id": str(result.get("equipment_id") or record.get("equipment_id", "EQP-101")).strip().upper(),
                "lot_id": record.get("lot_id", "UNKNOWN"),
                "probability": float(result.get("probability", 0.0)),
                "prediction": str(result.get("prediction", "PASS")),
                "risk_level": str(result.get("risk_level", "LOW")),
                "disposition": str(result.get("disposition", "PASS")),
                "defect_type": str(result.get("defect_classification", {}).get("predicted_defect", "NORMAL")),
                "anomaly_status": str(result.get("anomaly_status", "NORMAL")),
                "is_unseen_equipment": bool(result.get("is_unseen_equipment", False)),
            }
            self.events.append(event)
            if len(self.events) > MAX_EVENTS:
                self.events = self.events[-MAX_EVENTS:]
            self._save_to_disk()

    def record_batch(self, batch_records: List[Dict[str, Any]], batch_results: List[Dict[str, Any]]) -> None:
        """Records a batch of prediction inference events into the store."""
        with self.lock:
            for rec, res in zip(batch_records, batch_results):
                event = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "test_id": res.get("test_id") or rec.get("test_id", f"RUN-{len(self.events) + 1:06d}"),
                    "wafer_id": res.get("wafer_id") or rec.get("wafer_id", "W-UNKNOWN"),
                    "die_id": res.get("die_id") or rec.get("die_id", "D-UNKNOWN"),
                    "equipment_id": str(res.get("equipment_id") or rec.get("equipment_id", "EQP-101")).strip().upper(),
                    "lot_id": rec.get("lot_id", "UNKNOWN"),
                    "probability": float(res.get("probability", 0.0)),
                    "prediction": str(res.get("prediction", "PASS")),
                    "risk_level": str(res.get("risk_level", "LOW")),
                    "disposition": str(res.get("disposition", "PASS")),
                    "defect_type": str(res.get("defect_classification", {}).get("predicted_defect", "NORMAL")),
                    "anomaly_status": str(res.get("anomaly_status", "NORMAL")),
                    "is_unseen_equipment": bool(res.get("is_unseen_equipment", False)),
                }
                self.events.append(event)

            if len(self.events) > MAX_EVENTS:
                self.events = self.events[-MAX_EVENTS:]
            self._save_to_disk()

    def get_summary(self, operating_threshold: float = 0.20) -> Dict[str, Any]:
        """Dynamically computes aggregate operational dashboard metrics."""
        with self.lock:
            total = len(self.events)
            if total == 0:
                return {
                    "total_runs": 0,
                    "pass_count": 0,
                    "fail_count": 0,
                    "fail_rate": 0.0,
                    "yield_rate": 1.0,
                    "average_probability": 0.0,
                    "operating_threshold": operating_threshold,
                    "model_version": "4.0.0_authoritative",
                }

            pass_count = sum(1 for e in self.events if e.get("prediction") == "PASS")
            fail_count = total - pass_count
            avg_p = float(np.mean([e.get("probability", 0.0) for e in self.events]))

            return {
                "total_runs": total,
                "pass_count": pass_count,
                "fail_count": fail_count,
                "fail_rate": round(fail_count / total, 4),
                "yield_rate": round(pass_count / total, 4),
                "average_probability": round(avg_p, 4),
                "operating_threshold": operating_threshold,
                "model_version": "4.0.0_authoritative",
            }

    def get_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns the most recent N prediction events in reverse chronological order."""
        with self.lock:
            return list(reversed(self.events[-limit:]))

    def get_equipment_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Calculates per-equipment breakdown including total runs, fail count, and failure rate."""
        known_equipments = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]
        metrics: Dict[str, Dict[str, Any]] = {
            eq: {"total": 0, "pass": 0, "fail": 0, "fail_rate": 0.0, "avg_probability": 0.0}
            for eq in known_equipments
        }

        with self.lock:
            for e in self.events:
                eq = str(e.get("equipment_id", "EQP-101")).strip().upper()
                if eq not in metrics:
                    metrics[eq] = {"total": 0, "pass": 0, "fail": 0, "fail_rate": 0.0, "avg_probability": 0.0, "is_unseen": True}

                metrics[eq]["total"] += 1
                if e.get("prediction") == "PASS":
                    metrics[eq]["pass"] += 1
                else:
                    metrics[eq]["fail"] += 1

            for eq, data in metrics.items():
                tot = data["total"]
                if tot > 0:
                    data["fail_rate"] = round(data["fail"] / tot, 4)
                    probs = [e.get("probability", 0.0) for e in self.events if str(e.get("equipment_id", "")).strip().upper() == eq]
                    data["avg_probability"] = round(float(np.mean(probs)), 4) if probs else 0.0

        return metrics

    def get_risk_distribution(self) -> Dict[str, int]:
        """Calculates exact count of events across the 4-tier risk taxonomy."""
        dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        with self.lock:
            for e in self.events:
                risk = e.get("risk_level", "LOW")
                if risk in dist:
                    dist[risk] += 1
                else:
                    dist["LOW"] += 1
        return dist

    def clear(self) -> None:
        """Clears all stored events (for testing)."""
        with self.lock:
            self.events = []
            if os.path.exists(self.store_path):
                try:
                    os.remove(self.store_path)
                except Exception:
                    pass


# Global singleton instance
telemetry_store = TelemetryStore()
