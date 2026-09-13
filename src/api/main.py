"""
Predicta Semiconductor Test Analytics Prototype — FastAPI Application
File: src/api/main.py

Production-grade FastAPI REST API server exposing:
  - GET /api/health
  - POST /api/predict (with live telemetry persistence)
  - POST /api/predict/batch (with live telemetry persistence)
  - GET /api/dashboard/summary (dynamic real-time aggregation)
  - GET /api/dashboard/recent (live prediction event stream)
  - GET /api/dashboard/equipment (per-equipment failure rates)
  - GET /api/dashboard/risk (authoritative 4-tier risk distribution)
"""

from typing import Any, Dict, List, Union
import os
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.inference_service import inference_service
from src.api.telemetry_store import telemetry_store

app = FastAPI(
    title="Predicta Semiconductor Test Analytics ML API",
    description="Production-safe REST API for semiconductor PASS/FAIL defect screening, anomaly detection, and yield optimization.",
    version="4.0.0_authoritative"
)

# CORS configuration
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://ceenew.vercel.app,http://localhost:3000,http://localhost:8000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Trace-ID"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint exposing authoritative model status and operating threshold."""
    return {
        "status": "ok",
        "model": "predicta_xgboost_model",
        "version": "4.0.0_authoritative",
        "threshold": inference_service.operating_threshold,
        "telemetry_events_recorded": len(telemetry_store.events),
    }


@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    """Returns dynamic aggregate dashboard summary metrics from live telemetry store."""
    return telemetry_store.get_summary(operating_threshold=inference_service.operating_threshold)


@app.get("/api/dashboard/recent")
async def get_dashboard_recent(limit: int = 50):
    """Returns live recent prediction runs in reverse chronological order."""
    return telemetry_store.get_recent(limit=min(limit, 200))


@app.get("/api/dashboard/equipment")
async def get_dashboard_equipment():
    """Returns dynamic per-equipment distribution and failure rate metrics."""
    return telemetry_store.get_equipment_metrics()


@app.get("/api/dashboard/risk")
async def get_dashboard_risk():
    """Returns dynamic count of prediction runs across the 4-tier risk taxonomy."""
    return telemetry_store.get_risk_distribution()


@app.post("/api/predict")
async def predict_single(record: Dict[str, Any]):
    """Single semiconductor measurement prediction endpoint with automatic telemetry persistence."""
    try:
        result = inference_service.predict_single(record)
        telemetry_store.record_event(record, result)
        return result
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal prediction error: {str(err)}"
        )


@app.post("/api/predict/batch")
async def predict_batch(payload: Union[List[Dict[str, Any]], Dict[str, Any]]):
    """Batch semiconductor measurements prediction endpoint with automatic telemetry persistence."""
    try:
        if isinstance(payload, dict) and "records" in payload:
            batch_list = payload["records"]
        elif isinstance(payload, list):
            batch_list = payload
        else:
            raise ValueError("Batch request payload must be an array of records or contain a 'records' key.")

        result = inference_service.predict_batch(batch_list)
        telemetry_store.record_batch(batch_list, result["results"])
        return result
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal batch prediction error: {str(err)}"
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Custom HTTP 400 error handler for malformed requests."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": f"Invalid request body format: {str(exc)}"}
    )
