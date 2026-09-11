"""
Predicta Semiconductor Test Analytics Prototype — Model Inference Service
File: src/api/inference_service.py

Production-safe model inference service responsible for:
  - Loading predicta_final_xgboost.json and predicta_final_metadata.json once at application startup
  - Validating feature schemas and input types
  - Reproducing 23 physical/engineered + 5 equipment one-hot features (28 features total)
  - Applying threshold 0.20
  - Outputting PASS/FAIL predictions, probabilities, risk levels, and explanations
"""

import hashlib
import json
import math
import os
from typing import Any, Dict, List
import numpy as np
import xgboost as xgb

PROD_MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/production/predicta_production_manifest.json")
PROD_MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/production/predicta_xgboost_model.json")
PROD_METADATA_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/production/predicta_xgboost_metadata.json")

MANIFEST_JSON_PATH = PROD_MANIFEST_PATH
MODEL_JSON_PATH = PROD_MODEL_PATH
METADATA_JSON_PATH = PROD_METADATA_PATH
ANOMALY_ARTIFACT_JSON_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/predicta_anomaly_artifacts.json")
DRIFT_ARTIFACT_JSON_PATH = os.path.join(os.path.dirname(__file__), "../../ml/models/predicta_gpr_kernel_artifacts.json")

VALID_EQUIPMENT_IDS = {"EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"}

RAW_NUMERICAL_FEATURES = [
    "supply_voltage", "output_voltage", "current", "leakage_current",
    "resistance", "capacitance", "threshold_voltage", "frequency",
    "propagation_delay", "setup_time", "hold_time", "timing_margin",
    "temperature", "dynamic_power", "total_power", "test_duration"
]

ENGINEERED_FEATURES = [
    "voltage_headroom", "voltage_utilization", "leakage_fraction",
    "power_per_current", "normalized_timing_margin", "frequency_delay_product",
    "thermal_delta"
]

EQUIPMENT_ONE_HOT_COLS = ["eq_EQP-101", "eq_EQP-102", "eq_EQP-103", "eq_EQP-104", "eq_EQP-105"]

ALL_28_FEATURE_NAMES = RAW_NUMERICAL_FEATURES + ENGINEERED_FEATURES + EQUIPMENT_ONE_HOT_COLS


class PredictaInferenceService:
    def __init__(self):
        self.manifest_data: Dict[str, Any] = {}
        self.model_data: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.anomaly_artifacts: Dict[str, Any] = {}
        self.drift_artifacts: Dict[str, Any] = {}
        self.operating_threshold: float = None
        self.is_loaded: bool = False
        self.native_model: Any = None
        self.load_model()

    def load_model(self) -> None:
        """Loads native XGBoost model, metadata, anomaly, and drift artifacts once at startup."""
        model_path = MODEL_JSON_PATH
        meta_path = METADATA_JSON_PATH

        if os.path.exists(MANIFEST_JSON_PATH):
            with open(MANIFEST_JSON_PATH, "r", encoding="utf-8") as f:
                self.manifest_data = json.load(f)
                m_model = self.manifest_data.get("xgboost_model")
                m_meta = self.manifest_data.get("xgboost_metadata")
                if m_model and os.path.exists(os.path.join(os.path.dirname(__file__), "../../", m_model)):
                    model_path = os.path.join(os.path.dirname(__file__), "../../", m_model)
                if m_meta and os.path.exists(os.path.join(os.path.dirname(__file__), "../../", m_meta)):
                    meta_path = os.path.join(os.path.dirname(__file__), "../../", m_meta)

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model artifact not found at {model_path}")
        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Metadata artifact not found at {meta_path}")

        with open(model_path, "r", encoding="utf-8") as f:
            raw_model_content = f.read()
            self.model_data = json.loads(raw_model_content)

        with open(meta_path, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        expected_sha = self.manifest_data.get("model_sha256") or self.metadata.get("model_sha256")
        normalized_content = raw_model_content.replace("\r\n", "\n")
        computed_sha = hashlib.sha256(normalized_content.encode("utf-8")).hexdigest()
        if expected_sha and computed_sha != expected_sha:
            raise ValueError(f"CONFIGURATION_ERROR: Model SHA-256 checksum mismatch! Computed: {computed_sha}, Expected: {expected_sha}")

        try:
            self.native_model = xgb.XGBClassifier()
            self.native_model.load_model(model_path)
        except Exception as err:
            raise ValueError(f"CONFIGURATION_ERROR: Failed to load native XGBoost model from {model_path}: {err}")

        if os.path.exists(ANOMALY_ARTIFACT_JSON_PATH):
            with open(ANOMALY_ARTIFACT_JSON_PATH, "r", encoding="utf-8") as f:
                self.anomaly_artifacts = json.load(f)

        if os.path.exists(DRIFT_ARTIFACT_JSON_PATH):
            with open(DRIFT_ARTIFACT_JSON_PATH, "r", encoding="utf-8") as f:
                self.drift_artifacts = json.load(f)

        raw_th = self.metadata.get("operating_threshold") if "operating_threshold" in self.metadata else self.metadata.get("hyperparameters", {}).get("operating_threshold")
        if raw_th is None:
            raise ValueError("CONFIGURATION_ERROR: Authoritative operating_threshold missing or invalid in metadata artifact.")
        self.operating_threshold = float(raw_th)
        self.is_loaded = True

    def validate_input_record(self, raw_record: Dict[str, Any]) -> Dict[str, float]:
        """Validates input fields, numerical types, finite bounds, and equipment_id."""
        if not isinstance(raw_record, dict):
            raise ValueError("Input record must be a JSON object.")

        # Check equipment_id
        eq_id = raw_record.get("equipment_id")
        if not eq_id:
            raise ValueError("Missing required field: equipment_id")
        if str(eq_id) not in VALID_EQUIPMENT_IDS:
            raise ValueError(f"Invalid equipment_id '{eq_id}'. Must be one of: {sorted(list(VALID_EQUIPMENT_IDS))}")

        validated_numerical: Dict[str, float] = {}

        # Validate 16 raw numerical features
        for feature_name in RAW_NUMERICAL_FEATURES:
            if feature_name not in raw_record or raw_record[feature_name] is None:
                raise ValueError(f"Missing required numerical feature: {feature_name}")

            val = raw_record[feature_name]
            try:
                num_val = float(val)
            except (ValueError, TypeError):
                raise ValueError(f"Field '{feature_name}' must be a valid finite number. Got: {val}")

            if math.isnan(num_val) or math.isinf(num_val):
                raise ValueError(f"Field '{feature_name}' must be a valid finite number. Got: {val}")

            if feature_name in ["supply_voltage", "propagation_delay", "resistance", "capacitance", "test_duration"] and num_val <= 0:
                raise ValueError(f"Field '{feature_name}' must be a positive number > 0. Got: {num_val}")
            if feature_name in ["leakage_current", "current", "dynamic_power", "total_power"] and num_val < 0:
                raise ValueError(f"Field '{feature_name}' cannot be negative. Got: {num_val}")

            validated_numerical[feature_name] = num_val

        for k in ["iddq", "ileak", "tpd", "iddq_standby", "leakage_current", "propagation_delay", "iddq_0h", "ileak_0h", "tpd_0h"]:
            if k in raw_record and raw_record[k] is not None:
                try:
                    num_v = float(raw_record[k])
                    if math.isnan(num_v) or math.isinf(num_v):
                        raise ValueError(f"Field '{k}' cannot be NaN or Infinity.")
                    if k in ["iddq", "tpd", "iddq_standby", "propagation_delay", "iddq_0h", "tpd_0h"] and num_v <= 0:
                        raise ValueError(f"Field '{k}' must be a positive number > 0. Got: {num_v}")
                    if k in ["ileak", "leakage_current", "ileak_0h"] and num_v < 0:
                        raise ValueError(f"Field '{k}' cannot be negative. Got: {num_v}")
                    validated_numerical[k] = num_v
                except (ValueError, TypeError) as e:
                    if "must be" in str(e) or "cannot be" in str(e):
                        raise e

        return validated_numerical

    def get_normalized_params(self, feat: Dict[str, float]) -> Dict[str, float]:
        if not feat or not isinstance(feat, dict):
            raise ValueError("VALIDATION_ERROR: Missing required canonical reliability parameters.")

        raw_iddq = feat.get("iddq") if feat.get("iddq") is not None else (feat.get("iddq_standby") if feat.get("iddq_standby") is not None else feat.get("current"))
        raw_ileak = feat.get("ileak") if feat.get("ileak") is not None else feat.get("leakage_current")
        raw_tpd = feat.get("tpd") if feat.get("tpd") is not None else feat.get("propagation_delay")

        if raw_iddq is None or math.isnan(float(raw_iddq)) or math.isinf(float(raw_iddq)) or float(raw_iddq) <= 0:
            raise ValueError("VALIDATION_ERROR: Missing or invalid required parameter 'iddq_standby'. Must be a finite number > 0.")
        if raw_ileak is None or math.isnan(float(raw_ileak)) or math.isinf(float(raw_ileak)) or float(raw_ileak) <= 0:
            raise ValueError("VALIDATION_ERROR: Missing or invalid required parameter 'leakage_current'. Must be a finite number > 0.")
        if raw_tpd is None or math.isnan(float(raw_tpd)) or math.isinf(float(raw_tpd)) or float(raw_tpd) <= 0:
            raise ValueError("VALIDATION_ERROR: Missing or invalid required parameter 'propagation_delay'. Must be a finite number > 0.")

        eff_iddq = float(raw_iddq)
        eff_ileak = float(raw_ileak)
        eff_tpd = float(raw_tpd)

        # Explicit Unit Contract: IDDQ (µA) x 200.0, Leakage (µA) x 2.7, Tpd (ns) x 17.5
        iddq_val = eff_iddq * 200.0
        ileak_val = eff_ileak * 2.7
        tpd_val = eff_tpd * 17.5

        return {"iddq": iddq_val, "ileak": ileak_val, "tpd": tpd_val}

    def engineer_features(self, validated: Dict[str, float], equipment_id: str) -> Dict[str, float]:
        """Reproduces exact 7 engineered physical features + 5 equipment one-hot encodings."""
        feat = dict(validated)

        # 7 Domain Engineered Features
        v_sup = feat["supply_voltage"]
        v_th = feat["threshold_voltage"]
        i_tot = feat["current"]
        i_leak = feat["leakage_current"]
        p_dyn = feat["dynamic_power"]
        t_margin = feat["timing_margin"]
        t_pd = feat["propagation_delay"]
        freq = feat["frequency"]
        temp = feat["temperature"]

        feat["voltage_headroom"] = v_sup - v_th
        feat["voltage_utilization"] = v_th / v_sup if v_sup > 0 else 0.0
        feat["leakage_fraction"] = (i_leak * 1e-3) / i_tot if i_tot > 0 else 0.0
        feat["power_per_current"] = p_dyn / i_tot if i_tot > 0 else 0.0
        feat["normalized_timing_margin"] = t_margin / t_pd if t_pd > 0 else 0.0
        feat["frequency_delay_product"] = freq * t_pd
        feat["thermal_delta"] = temp - 25.0

        # 5 Equipment One-Hot Features
        for eq_key in sorted(list(VALID_EQUIPMENT_IDS)):
            col_name = f"eq_{eq_key}"
            feat[col_name] = 1.0 if equipment_id == eq_key else 0.0

        return feat

    def evaluate_xgboost_trees(self, feat: Dict[str, float], equipment_id: str) -> float:
        """Deprecated guard: production inference must use native_model.predict_proba only."""
        raise RuntimeError(
            "CONFIGURATION_ERROR: Manual XGBoost JSON evaluation is disabled. "
            "Use the authoritative native_model.predict_proba production path."
        )

    def calculate_probability(self, feat: Dict[str, float], equipment_id: str) -> float:
        """Computes model probability using genuine native XGBoost inference."""
        if self.native_model is None:
            raise ValueError("CONFIGURATION_ERROR: Executable XGBoost model artifact missing or corrupted. Silent heuristic fallback disabled.")

        ref_stats = self.metadata.get("reference_stats", {})
        feat_vector = []
        for feature_name in ALL_28_FEATURE_NAMES:
            val = float(feat.get(feature_name, 0.0))
            if feature_name in ref_stats:
                m = float(ref_stats[feature_name].get("mean", 0.0))
                s = float(ref_stats[feature_name].get("std", 1.0)) or 1e-6
                val = (val - m) / s
            feat_vector.append(val)

        X = np.array([feat_vector], dtype=np.float32)
        proba = float(self.native_model.predict_proba(X)[0][1])
        return round(proba, 4)

    def determine_risk_level(self, probability: float) -> str:
        thresh = self.operating_threshold or 0.20
        if probability < thresh:
            return "LOW"
        if probability < 0.65:
            return "MEDIUM"
        return "CRITICAL"

    def generate_explanation(self, feat: Dict[str, float]) -> Dict[str, Any]:
        indicators = []
        if feat.get("leakage_current", 0.0) > 185.0:
            indicators.append({
                "feature": "leakage_current",
                "value": round(feat["leakage_current"], 2),
                "unit": "µA",
                "status": "ELEVATED",
                "description": "High leakage current indicates potential transistor gate oxide defect."
            })
        if feat.get("temperature", 0.0) > 31.0:
            indicators.append({
                "feature": "temperature",
                "value": round(feat["temperature"], 2),
                "unit": "°C",
                "status": "ELEVATED",
                "description": "Operating temperature above nominal thermal envelope."
            })
        if feat.get("propagation_delay", 0.0) > 13.8:
            indicators.append({
                "feature": "propagation_delay",
                "value": round(feat["propagation_delay"], 2),
                "unit": "ns",
                "status": "ELEVATED",
                "description": "Excessive path delay risking timing failure."
            })
        if not indicators:
            indicators.append({
                "feature": "nominal_parameters",
                "value": 0,
                "unit": "N/A",
                "status": "NORMAL",
                "description": "All physical parameters within normal operational bounds."
            })
        return {"key_indicators": indicators}

    def evaluate_pat_mad(self, feat: Dict[str, float], lot_id: str = None) -> Dict[str, Any]:
        if not self.anomaly_artifacts or "robust_mad" not in self.anomaly_artifacts:
            return {"score": 0.0, "status": "PASS", "contributing_features": []}
        pat_config = self.anomaly_artifacts["robust_mad"]
        stats = pat_config.get("global_stats", {})
        if lot_id and pat_config.get("lot_stats") and lot_id in pat_config["lot_stats"]:
            stats = pat_config["lot_stats"][lot_id]
        max_z = 0.0
        contributing = []
        mapping = self.get_normalized_params(feat)
        param_z_scores = {}
        for p, val in mapping.items():
            if p in stats and stats[p].get("sigma", 0) > 0:
                z = abs(val - stats[p]["median"]) / stats[p]["sigma"]
                param_z_scores[p] = round(z, 4)
                if z > max_z:
                    max_z = z
                if z > pat_config.get("thresholds", {}).get("warning_z", 3.0):
                    contributing.append(p)
        thresholds = pat_config.get("thresholds", {})
        status = "REJECT" if max_z > thresholds.get("reject_z", 6.0) else ("MONITOR" if max_z > thresholds.get("warning_z", 3.0) else "PASS")
        return {"score": round(max_z, 4), "status": status, "contributing_features": contributing, "parameter_z_scores": param_z_scores}

    def evaluate_gpr_drift(self, feat: Dict[str, float]) -> Dict[str, Any]:
        """Evaluates Phase 2A Genuine GPR 168h forecast using RBF Kernel Matrix math."""
        if not self.drift_artifacts or "parameters" not in self.drift_artifacts:
            return {}

        params_config = self.drift_artifacts["parameters"]
        mapping = self.get_normalized_params(feat)

        drift_predictions = {}
        for param, val24 in mapping.items():
            if param in params_config:
                p_cfg = params_config[param]
                has_history = feat.get(f"{param}_0h") is not None and not math.isnan(float(feat.get(f"{param}_0h", 0.0)))
                if not has_history:
                    drift_predictions[param] = {
                        "has_history": False,
                        "status": "INSUFFICIENT_HISTORY",
                        "message": "0h baseline missing for degradation forecast",
                        "value_24h": round(val24, 4)
                    }
                    continue

                scale_factors = {"iddq": 200.0, "ileak": 2.7, "tpd": 17.5}
                p0_raw = float(feat.get(f"{param}_0h"))
                p0 = p0_raw * scale_factors.get(param, 1.0)
                delta24 = val24 - p0
                x_raw = [p0, val24, delta24]

                means = p_cfg["feature_means"]
                stds = p_cfg["feature_stds"]
                x_norm = [(x_raw[j] - means[j]) / (stds[j] or 1e-6) for j in range(3)]

                length_scale = p_cfg["length_scale"]
                sigma_f2 = p_cfg["sigma_f2"]
                support_x = p_cfg["support_x"]
                alpha = p_cfg["alpha"]
                K_inv = p_cfg["K_inv"]
                S = len(support_x)

                k_vec = []
                for sup in support_x:
                    sup_norm = [(sup[j] - means[j]) / (stds[j] or 1e-6) for j in range(3)]
                    dist_sq = sum((x_norm[j] - sup_norm[j]) ** 2 for j in range(3))
                    k_val = sigma_f2 * math.exp(-dist_sq / (2.0 * (length_scale ** 2)))
                    k_vec.append(k_val)

                y_std = p_cfg.get("y_std", 1.0)
                pred_delta = p_cfg["y_mean"] + sum(alpha[i] * k_vec[i] for i in range(S)) * y_std
                pred_168 = val24 + pred_delta

                k_xx = sigma_f2 + p_cfg.get("sigma_n2", 0.02)
                var_reduction = 0.0
                for i in range(S):
                    for j in range(S):
                        var_reduction += k_vec[i] * K_inv[i][j] * k_vec[j]

                pred_var_norm = max(1e-6, k_xx - var_reduction)
                latent_std = math.sqrt(pred_var_norm) * y_std
                sigma_obs = p_cfg.get("sigma_obs", 0.0)

                total_std = math.sqrt(latent_std ** 2 + sigma_obs ** 2)

                lower_95 = pred_168 - 1.96 * total_std
                upper_95 = pred_168 + 1.96 * total_std

                drift_predictions[param] = {
                    "has_history": True,
                    "status": "CALCULATED",
                    "value_24h": round(val24, 4),
                    "predicted_168h": round(pred_168, 4),
                    "uncertainty_std": round(total_std, 4),
                    "lower_95": round(lower_95, 4),
                    "upper_95": round(upper_95, 4)
                }

        return drift_predictions

    def evaluate_copod(self, feat: Dict[str, float]) -> Dict[str, Any]:
        """Evaluates COPOD empirical copula tail-probability score against persisted quantiles."""
        if not self.anomaly_artifacts or "copod" not in self.anomaly_artifacts:
            return {"score": 0.0, "status": "PASS"}

        copod_config = self.anomaly_artifacts["copod"]
        ecdfs = copod_config.get("global_ecdfs", {})

        mapping = self.get_normalized_params(feat)

        left_tail_sum = 0.0
        right_tail_sum = 0.0

        for param, val in mapping.items():
            sorted_vals = ecdfs.get(param, [])
            if sorted_vals:
                n = len(sorted_vals)
                import bisect
                pos = bisect.bisect_right(sorted_vals, val)
                pct = max(1e-6, min(1.0 - 1e-6, pos / n))
                left_tail_sum += -math.log(pct)
                right_tail_sum += -math.log(1.0 - pct)

        score = max(left_tail_sum, right_tail_sum)
        thresholds = copod_config.get("thresholds", {})
        status = "REJECT" if score > thresholds.get("reject_score", 9.5) else ("MONITOR" if score > thresholds.get("warning_score", 6.5) else "PASS")

        return {
            "score": round(score, 4),
            "status": status
        }

    def combine_anomaly_evidence(self, pat: Dict[str, Any], copod: Dict[str, Any]) -> Dict[str, Any]:
        """Combines PAT and COPOD anomaly indicators into structured anomaly evidence."""
        if pat["status"] == "REJECT" or copod["status"] == "REJECT":
            overall_status = "ANOMALOUS"
        elif pat["status"] == "MONITOR" or copod["status"] == "MONITOR":
            overall_status = "MONITOR"
        else:
            overall_status = "NORMAL"

        return {
            "pat": pat,
            "copod": copod,
            "overall_status": overall_status
        }

    def synthesize_operational_disposition(self, probability: float, anomaly_evidence: Dict[str, Any], drift_predictions: Dict[str, Any], safety_slope: Dict[str, Any], risk_engine_res: Dict[str, Any]) -> Dict[str, Any]:
        pat = anomaly_evidence.get("pat", {}) if anomaly_evidence else {}
        copod = anomaly_evidence.get("copod", {}) if anomaly_evidence else {}

        exceeded_params = [p for p, s in (safety_slope or {}).items() if s and s.get("boundary_status") == "EXCEEDED"]
        warning_params = [p for p, s in (safety_slope or {}).items() if s and s.get("boundary_status") == "WARNING"]

        any_exceeded = len(exceeded_params) > 0
        any_warning = len(warning_params) > 0

        is_pat_reject = pat.get("status") == "REJECT"
        is_copod_reject = copod.get("status") == "REJECT"
        is_anomaly_reject = is_pat_reject or is_copod_reject or (anomaly_evidence and anomaly_evidence.get("overall_status") == "ANOMALOUS")
        is_anomaly_monitor = pat.get("status") == "MONITOR" or copod.get("status") == "MONITOR" or (anomaly_evidence and anomaly_evidence.get("overall_status") == "MONITOR")

        # PRIORITY 1: REJECT
        if probability >= 0.65 or is_anomaly_reject or any_exceeded:
            signals = []
            if probability >= 0.65:
                signals.append(f"XGBoost ML Failure Risk High (P={(probability * 100):.1f}%)")
            if is_pat_reject:
                signals.append("PAT Multivariate Anomaly Flagged (Z > 6.0)")
            if is_copod_reject:
                signals.append("COPOD Tail Anomaly Score High")
            for p in exceeded_params:
                signals.append(f"GPR {p.upper()} 168h Forecast Exceeds Limits")

            override_reason = "MULTIPLE_CRITICAL_SIGNALS"
            if len(signals) == 1:
                if probability >= 0.65:
                    override_reason = "ML_HIGH_RISK"
                elif is_pat_reject:
                    override_reason = "PAT_CRITICAL_ANOMALY"
                elif is_copod_reject:
                    override_reason = "COPOD_CRITICAL_ANOMALY"
                elif any("iddq" in p for p in exceeded_params):
                    override_reason = "GPR_IDDQ_LIMIT_EXCEEDED"
                elif any("ileak" in p or "leakage" in p for p in exceeded_params):
                    override_reason = "GPR_ILEAK_LIMIT_EXCEEDED"
                elif any("tpd" in p or "delay" in p or "propagation" in p for p in exceeded_params):
                    override_reason = "GPR_TPD_LIMIT_EXCEEDED"

            primary_signal = (
                signals[0]
                if signals
                else "Critical Reliability Evidence Exceeded"
            )
            secondary_signals = signals[1:]

            decision_reason = f"Critical risk detected ({primary_signal}). Component flagged for quarantine."
            if probability < self.operating_threshold:
                decision_reason = f"Under PREDICTA's safety-first multi-model policy, independent reliability evidence ({primary_signal}) overrides the low statistical XGBoost failure probability (P = {(probability * 100):.1f}%)."

            return {
                "disposition": "REJECT",
                "operational_decision": "REJECT",
                "decision_class": "CRITICAL_FAILURE",
                "requires_secondary_test": False,
                "recommended_action": "QUARANTINE_REJECT_RECOMMENDATION",
                "decision_override_reason": override_reason,
                "primary_rejection_signal": primary_signal,
                "secondary_rejection_signals": secondary_signals,
                "decision_reason": decision_reason
            }

        # PRIORITY 2: MONITOR
        if probability >= self.operating_threshold or is_anomaly_monitor or any_warning:
            signals = []
            if probability >= self.operating_threshold:
                signals.append(f"XGBoost Failure Risk Elevated (P={(probability * 100):.1f}%)")
            if is_anomaly_monitor:
                signals.append("PAT/COPOD Anomaly Monitor Warning")
            for p in warning_params:
                signals.append(f"GPR {p.upper()} 168h Forecast Approaching Limit")

            primary_signal = signals[0] if signals else "Elevated Risk Signal Detected"
            secondary_signals = signals[1:]

            return {
                "disposition": "MONITOR",
                "operational_decision": "SECONDARY_TEST",
                "decision_class": "REVIEW",
                "requires_secondary_test": True,
                "recommended_action": "RECOMMEND_SECONDARY_QA_REVIEW",
                "decision_override_reason": "ML_ELEVATED_RISK" if probability >= self.operating_threshold else "ANOMALY_OR_DRIFT_WARNING",
                "primary_rejection_signal": primary_signal,
                "secondary_rejection_signals": secondary_signals,
                "decision_reason": f"Elevated risk signal detected ({primary_signal}). Secondary ATE re-test or operator inspection recommended."
            }

        # PRIORITY 3: PASS
        return {
            "disposition": "PASS",
            "operational_decision": "PASS",
            "decision_class": "LOW_RISK",
            "requires_secondary_test": False,
            "recommended_action": "PROCEED_STANDARD_SCREENING",
            "decision_override_reason": "NONE",
            "primary_rejection_signal": "NONE",
            "secondary_rejection_signals": [],
            "decision_reason": f"All physical telemetry parameters, XGBoost probability (P={(probability * 100):.1f}% < {self.operating_threshold}), and multi-criteria risk evidence fall safely within nominal bounds."
        }

    def predict_single(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Performs end-to-end inference on a single test record."""
        validated_num = self.validate_input_record(record)
        eq_id = str(record["equipment_id"])
        lot_id = str(record.get("lot_id")) if record.get("lot_id") else None

        engineered_feat = self.engineer_features(validated_num, eq_id)
        probability = self.calculate_probability(engineered_feat, eq_id)

        prediction = "FAIL" if probability >= self.operating_threshold else "PASS"
        risk_level = self.determine_risk_level(probability)
        explanation = self.generate_explanation(engineered_feat)

        pat_result = self.evaluate_pat_mad(validated_num, lot_id)
        copod_result = self.evaluate_copod(validated_num)
        anomaly_evidence = self.combine_anomaly_evidence(pat_result, copod_result)
        drift_predictions = self.evaluate_gpr_drift(validated_num)

        from src.decision_engine.safety_slope import SafetySlopeCalculator
        safety_calculator = SafetySlopeCalculator(max_limit=250.0, max_slope_per_hour=1.0)
        safety_slope = safety_calculator.evaluate_all_trajectories(drift_predictions)

        from src.decision_engine.decision import MultiCriteriaDecisionEngine
        risk_engine_calc = MultiCriteriaDecisionEngine()
        risk_engine_res = risk_engine_calc.evaluate_multi_criteria_risk(anomaly_evidence, drift_predictions, safety_slope)

        from src.decision_engine.explanation import ExplainabilityGenerator
        explainability_gen = ExplainabilityGenerator()
        explainability_res = explainability_gen.generate_explanation(anomaly_evidence, drift_predictions, safety_slope, risk_engine_res)

        synth_decision = self.synthesize_operational_disposition(probability, anomaly_evidence, drift_predictions, safety_slope, risk_engine_res)

        ml_risk_status = "HIGH" if probability >= 0.65 else ("ELEVATED" if probability >= self.operating_threshold else "LOW")
        is_anomaly_reject = pat_result.get("status") == "REJECT" or copod_result.get("status") == "REJECT" or anomaly_evidence.get("overall_status") == "ANOMALOUS"
        is_anomaly_monitor = pat_result.get("status") == "MONITOR" or copod_result.get("status") == "MONITOR" or anomaly_evidence.get("overall_status") == "MONITOR"
        anomaly_status = "REJECT" if is_anomaly_reject else ("MONITOR" if is_anomaly_monitor else "NORMAL")

        any_exceeded = any(s and s.get("boundary_status") == "EXCEEDED" for s in safety_slope.values())
        any_warning = any(s and s.get("boundary_status") == "WARNING" for s in safety_slope.values())
        drift_status = "EXCEEDED" if any_exceeded else ("WARNING" if any_warning else "WITHIN")

        response = {
            "ml_prediction": prediction,
            "prediction": prediction,
            "probability": probability,
            "ml_risk_status": ml_risk_status,
            "anomaly_status": anomaly_status,
            "drift_status": drift_status,
            "disposition": synth_decision["disposition"],
            "operational_decision": synth_decision["operational_decision"],
            "recommended_action": synth_decision["recommended_action"],
            "decision_override_reason": synth_decision["decision_override_reason"],
            "primary_rejection_signal": synth_decision["primary_rejection_signal"],
            "secondary_rejection_signals": synth_decision["secondary_rejection_signals"],
            "decision_reason": synth_decision["decision_reason"],
            "threshold": self.operating_threshold,
            "risk_level": risk_level,
            "model_version": "2.0_production",
            "explanation": explanation,
            "ml_details": {
                "anomaly_detection": anomaly_evidence,
                "drift_prediction": drift_predictions,
                "safety_slope": safety_slope,
                "risk_engine": risk_engine_res,
                "explainability": explainability_res
            }
        }

        # Include request identifiers if provided
        for key in ["test_id", "wafer_id", "die_id", "equipment_id"]:
            if key in record and record[key] is not None:
                response[key] = record[key]

        return response

    def predict_batch(self, batch: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Performs batch inference on a list of test records."""
        if not isinstance(batch, list) or len(batch) == 0:
            raise ValueError("Batch request must be a non-empty array of records.")
        if len(batch) > 1000:
            raise ValueError("Batch request exceeds maximum allowed size limit of 1000 records.")

        results = []
        pass_count = 0
        fail_count = 0

        for item in batch:
            res = self.predict_single(item)
            if res["prediction"] == "PASS":
                pass_count += 1
            else:
                fail_count += 1
            results.append(res)

        return {
            "total": len(results),
            "pass_count": pass_count,
            "fail_count": fail_count,
            "results": results
        }


# Global singleton instance
inference_service = PredictaInferenceService()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "--single" and len(sys.argv) > 2:
            input_record = json.loads(sys.argv[2])
            res = inference_service.predict_single(input_record)
            print(json.dumps(res))
        elif sys.argv[1] == "--batch" and len(sys.argv) > 2:
            batch_record = json.loads(sys.argv[2])
            res = inference_service.predict_batch(batch_record)
            print(json.dumps(res))
        else:
            print(json.dumps({"error": "Unknown command line argument"}))
    else:
        print("[INFO] PredictaInferenceService loaded successfully with native XGBoost model.")
