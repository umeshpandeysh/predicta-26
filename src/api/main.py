"""
Predicta Semiconductor Test Analytics Prototype — FastAPI Application
File: src/api/main.py

FastAPI REST API server exposing:
  - GET /api/health
  - POST /api/predict
  - POST /api/predict/batch
"""

from typing import Any, Dict, List, Union
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.inference_service import inference_service

app = FastAPI(
    title="Predicta Semiconductor Test Analytics ML API",
    description="Production-safe REST API for semiconductor PASS/FAIL defect screening and yield optimization.",
    version="2.0_production"
)

# Enable CORS for frontend dashboard connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    """Health check endpoint exposing model status and operating threshold."""
    return {
        "status": "ok",
        "model": "predicta_final_xgboost",
        "version": "2.0_production",
        "threshold": inference_service.operating_threshold
    }

@app.post("/api/predict")
async def predict_single(record: Dict[str, Any]):
    """Single semiconductor measurement prediction endpoint."""
    try:
        result = inference_service.predict_single(record)
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
    """Batch semiconductor measurements prediction endpoint."""
    try:
        if isinstance(payload, dict) and "records" in payload:
            batch_list = payload["records"]
        elif isinstance(payload, list):
            batch_list = payload
        else:
            raise ValueError("Batch request payload must be an array of records or contain a 'records' key.")

        result = inference_service.predict_batch(batch_list)
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
