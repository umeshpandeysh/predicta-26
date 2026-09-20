"""
Predicta Semiconductor Reliability — Pydantic v2 API Schemas
File: src/api/schemas.py

Strict Pydantic v2 schemas validating:
  - Input telemetry records (16 physical channels + equipment ID + identifiers)
  - Single and batch prediction responses
  - Real-time dashboard summary, recent, equipment, and risk distribution payloads
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict, model_validator
import math


class TelemetryRecordInput(BaseModel):
    equipment_id: str = Field(..., description="Automated Test Equipment identifier (e.g. EQP-101)")
    supply_voltage: float = Field(..., description="ATE supply voltage V_dd in Volts")
    output_voltage: float = Field(..., description="Measured output voltage V_out in Volts")
    current: float = Field(..., description="Total operating current I_dd in mA")
    leakage_current: float = Field(..., description="Subthreshold/gate oxide leakage current in µA")
    resistance: float = Field(..., description="Effective interconnect/channel resistance in Ohms")
    capacitance: float = Field(..., description="Effective load capacitance in pF")
    threshold_voltage: float = Field(..., description="Transistor threshold voltage V_th in Volts")
    frequency: float = Field(..., description="Operating clock frequency in MHz")
    propagation_delay: float = Field(..., description="Signal propagation delay t_pd in ns")
    setup_time: float = Field(..., description="Flip-flop setup time requirement in ns")
    hold_time: float = Field(..., description="Flip-flop hold time requirement in ns")
    timing_margin: float = Field(..., description="Timing slack margin in ns")
    temperature: float = Field(..., description="Junction/chuck temperature in °C")
    dynamic_power: float = Field(..., description="Dynamic switching power dissipation in mW")
    total_power: float = Field(..., description="Total static + dynamic power dissipation in mW")
    test_duration: float = Field(..., description="ATE test execution duration in ms")

    # Optional metadata identifiers
    test_id: Optional[str] = Field(None, description="Unique test run identifier")
    wafer_id: Optional[str] = Field(None, description="Silicon wafer identifier")
    die_id: Optional[str] = Field(None, description="Die identifier on wafer")
    lot_id: Optional[str] = Field(None, description="Manufacturing lot identifier")
    burn_in_hour: Optional[float] = Field(None, description="Cumulative burn-in stress hours")
    iddq_standby: Optional[float] = Field(None, description="Quiescent standby IDDQ current in µA")

    @field_validator("equipment_id")
    @classmethod
    def validate_equipment_id(cls, v: str) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("equipment_id cannot be empty")
        return s.upper()

    @field_validator(
        "supply_voltage", "propagation_delay", "resistance",
        "capacitance", "test_duration", mode="after"
    )
    @classmethod
    def validate_strictly_positive(cls, v: float, info) -> float:
        if math.isnan(v) or math.isinf(v):
            raise ValueError(f"Field '{info.field_name}' must be a finite number")
        if v <= 0:
            raise ValueError(f"Field '{info.field_name}' must be strictly positive > 0. Got: {v}")
        return v

    @field_validator(
        "leakage_current", "current", "dynamic_power", "total_power", mode="after"
    )
    @classmethod
    def validate_non_negative(cls, v: float, info) -> float:
        if math.isnan(v) or math.isinf(v):
            raise ValueError(f"Field '{info.field_name}' must be a finite number")
        if v < 0:
            raise ValueError(f"Field '{info.field_name}' cannot be negative. Got: {v}")
        return v


class DefectClassificationResponse(BaseModel):
    predicted_defect: str = Field(..., description="Authoritative defect classification name")
    confidence: float = Field(..., description="Classification probability confidence [0, 1]")
    is_unknown_anomaly: bool = Field(..., description="Flag indicating open-set statistical anomaly outside known defect taxonomy")


class PredictionResponse(BaseModel):
    ml_prediction: str = Field(..., description="Binary PASS or FAIL classification")
    prediction: str = Field(..., description="Binary PASS or FAIL classification")
    probability: float = Field(..., description="Calibrated failure risk probability [0, 1]")
    raw_probability: Optional[float] = Field(None, description="Pre-calibration raw XGBoost model probability")
    threshold: float = Field(..., description="Operational decision threshold (0.20)")
    risk_level: str = Field(..., description="Authoritative 4-tier risk level: LOW, MEDIUM, HIGH, CRITICAL")
    defect_classification: Optional[DefectClassificationResponse] = None
    anomaly_status: str = Field(..., description="Statistical anomaly status: PASS, NORMAL, MONITOR, REJECT, INSUFFICIENT_EVIDENCE")
    overall_status: Optional[str] = Field(None, description="Overall anomaly status")
    anomaly_score: Optional[float] = Field(None, description="Normalized multi-criteria anomaly score [0, 1]")
    weighted_fusion_score: Optional[float] = Field(None, description="Weighted anomaly score")
    fusion_method: Optional[str] = Field(None, description="Active anomaly fusion method")
    contributing_detectors: Optional[List[str]] = Field(None, description="List of active anomaly detector names")
    detector_evidence: Optional[Dict[str, Any]] = Field(None, description="Sub-detector evidence map")
    reference_status: Optional[str] = Field(None, description="Lot reference governance status")
    reference_source: Optional[str] = Field(None, description="Lot reference source (LOT_SPECIFIC, GLOBAL_FALLBACK, NONE)")
    reference_sample_count: Optional[int] = Field(None, description="Lot reference sample count")
    reference_context: Optional[Dict[str, Any]] = Field(None, description="Structured lot reference metadata")
    calibration_status: Optional[str] = Field(None, description="Anomaly calibration status (strictly NOT_CALIBRATED)")
    anomaly_calibration_status: Optional[str] = Field(None, description="Anomaly calibration status (strictly NOT_CALIBRATED)")
    validation_status: Optional[str] = Field(None, description="Validation governance status")
    promotion_status: Optional[str] = Field(None, description="Promotion status (BENCHMARK_ONLY)")
    is_unseen_equipment: bool = Field(..., description="True if equipment ID was not present during training")
    disposition: str = Field(..., description="Operational disposition: PASS, MONITOR, REJECT")
    operational_decision: str = Field(..., description="Operational decision action")
    recommended_action: str = Field(..., description="Recommended engineering action")
    decision_reason: str = Field(..., description="Detailed engineering rationale for the disposition")
    model_version: str = Field(..., description="Production model release version")
    explanation: Dict[str, Any] = Field(..., description="SHAP feature attributions and diagnostic indicators")
    ml_details: Optional[Dict[str, Any]] = None
    evaluation_target: Optional[Dict[str, Any]] = None
    test_id: Optional[str] = None
    wafer_id: Optional[str] = None
    die_id: Optional[str] = None
    equipment_id: Optional[str] = None
    lot_id: Optional[str] = None


class BatchPredictionRequest(BaseModel):
    records: List[TelemetryRecordInput] = Field(..., min_length=1, max_length=1000)


class BatchPredictionResponse(BaseModel):
    total: int = Field(..., description="Total records evaluated in batch")
    pass_count: int = Field(..., description="Number of passing components")
    fail_count: int = Field(..., description="Number of failing components")
    results: List[Dict[str, Any]] = Field(..., description="Detailed prediction response list")


class DashboardSummaryResponse(BaseModel):
    total_runs: int
    pass_count: int
    fail_count: int
    fail_rate: float
    yield_rate: float
    average_probability: float
    operating_threshold: float
    model_version: str


class EquipmentMetric(BaseModel):
    total: int
    pass_count: int = Field(..., alias="pass")
    fail_count: int = Field(..., alias="fail")
    fail_rate: float
    avg_probability: float
    is_unseen: Optional[bool] = False

    class Config:
        populate_by_name = True


class RiskDistributionResponse(BaseModel):
    LOW: int
    MEDIUM: int
    HIGH: int
    CRITICAL: int


class CounterfactualRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record: Dict[str, Any] = Field(..., description="Telemetry input record with 16 raw features and equipment_id")
    target_condition: Optional[str] = Field("TARGET_PASS", description="Target condition: TARGET_PASS, TARGET_REJECT, or TARGET_MONITOR")
    trace_id: Optional[str] = Field(None, description="Optional trace ID for correlation")

    @model_validator(mode="before")
    @classmethod
    def validate_canonical_record(cls, values: Any) -> Any:
        if isinstance(values, dict) and "record" in values:
            rec = values["record"]
            if isinstance(rec, dict):
                allowed = {
                    "supply_voltage", "output_voltage", "current", "leakage_current",
                    "resistance", "capacitance", "threshold_voltage", "frequency",
                    "propagation_delay", "setup_time", "hold_time", "timing_margin",
                    "temperature", "dynamic_power", "total_power", "test_duration",
                    "equipment_id", "component_id", "die_id", "test_id", "wafer_id",
                    "lot_id", "trace_id", "timestamp", "operator", "socket", "chamber",
                    "date_code", "supplier", "package"
                }
                for k in rec.keys():
                    if k not in allowed:
                        raise ValueError(f"UNKNOWN_FEATURE: Unknown feature or field '{k}' is not permitted in canonical counterfactual schema.")
        return values


class CounterfactualResponse(BaseModel):
    explanation_id: str
    trace_id: str
    model_id: str
    model_hash: str
    model_status: str
    explanation_status: str
    original_input: Dict[str, float]
    original_prediction: Dict[str, Any]
    target_condition: str
    counterfactual_input: Dict[str, float]
    counterfactual_prediction: Dict[str, Any]
    changed_features: Dict[str, Any]
    distance: float
    total_cost: float
    target_reached: bool
    target_margin: float
    immutable_features_verified: bool
    physical_constraints_verified: bool
    schema_verified: bool
    algorithm: str
    algorithm_version: str
    provenance: Dict[str, str]
    generated_at: str


class DispositionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trace_id: str = Field(..., description="Trace identifier matching ^[A-Za-z0-9._:-]{1,128}$")
    disposition: str = Field(..., description="Operator disposition: ACCEPT, REJECT, HOLD, RETEST, ESCALATE")
    reason_code: str = Field(..., description="Controlled reason code")
    comment: Optional[str] = Field("", max_length=1000, description="Operator notes up to 1000 characters")
    operator_id: Optional[str] = Field(None, description="Operator username or badge reference")
    component_id: Optional[str] = Field(None, description="Component identifier")
    lot_id: Optional[str] = Field(None, description="Lot identifier")

    @model_validator(mode="before")
    @classmethod
    def reject_client_ml_snapshots(cls, values: Any) -> Any:
        if isinstance(values, dict):
            prohibited = {
                "ml_decision_snapshot", "ml_decision", "original_ml_decision", "decision",
                "probability", "calibrated_probability", "raw_probability",
                "model_hash", "model_id", "anomaly_score", "prognostic_output",
                "ground_truth", "ground_truth_label", "is_ground_truth"
            }
            for k in prohibited:
                if k in values and values[k] is not None:
                    raise ValueError(
                        f"CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '{k}' cannot be provided by client. "
                        "Original ML decision is backend-authoritative."
                    )
        return values


class DispositionResponse(BaseModel):
    disposition_id: str
    trace_id: str
    component_id: str
    lot_id: str
    operator_id: str
    operator_role: str
    disposition: str
    reason_code: str
    comment: str
    created_at: str
    model_id_at_decision: str
    model_hash_at_decision: str
    original_ml_decision: str
    original_ml_probability: float
    source: str
    feedback_status: str
    governance_guarantees: Dict[str, bool]

