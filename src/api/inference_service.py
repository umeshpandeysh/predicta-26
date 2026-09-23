"""
Predicta Semiconductor Test Analytics — Certified Model Inference Service
File: src/api/inference_service.py

Production-safe multi-task model inference service responsible for:
  - Loading authoritative XGBoost binary, multiclass defect, and anomaly artifacts at startup
  - Verifying SHA-256 artifact checksums
  - Extracting 28-feature continuous production vector (16 raw + 7 engineered + 5 equipment)
  - Applying calibrated operating threshold (0.20)
  - True XGBoost tree feature attributions (pred_contribs SHAP attributions)
  - Multi-task predictions: Failure probability, Defect classification, Unknown anomaly detection
  - Authoritative 4-tier risk taxonomy: LOW, MEDIUM, HIGH, CRITICAL
  - Robust handling of unseen equipment IDs without crashing
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import hashlib
import json
import math
import os
import numpy as np
import xgboost as xgb

from src.features.feature_contract import (
    ALL_28_FEATURE_NAMES,
    DEFECT_INDEX_MAP,
    KNOWN_EQUIPMENT_IDS,
    RAW_NUMERICAL_FEATURES,
    compute_engineered_features_dict,
    encode_equipment_status,
    extract_feature_vector,
)
from src.evaluation.phase12_evaluation_integrity import EvaluationIntegrityGatePy

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PROD_MODELS_DIR = os.path.join(BASE_DIR, "ml", "models", "production")

MODEL_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_xgboost_model.json")
MULTICLASS_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_defect_multiclass.json")
METADATA_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_xgboost_metadata.json")
MANIFEST_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_production_manifest.json")
ANOMALY_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_anomaly_artifacts.json")
DRIFT_JSON_PATH = os.path.join(PROD_MODELS_DIR, "predicta_gpr_kernel_artifacts.json")

VALID_EQUIPMENT_IDS = set(KNOWN_EQUIPMENT_IDS)


class PredictaInferenceService:
    def __init__(self):
        self.manifest_data: Dict[str, Any] = {}
        self.model_data: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.anomaly_artifacts: Dict[str, Any] = {}
        self.drift_artifacts: Dict[str, Any] = {}
        self.operating_threshold: float = 0.20
        self.is_loaded: bool = False
        self.native_model: Optional[xgb.XGBClassifier] = None
        self.multiclass_model: Optional[xgb.XGBClassifier] = None
        self.calib_a: float = -1.0
        self.calib_b: float = 0.0
        self.load_model()

    def load_model(self) -> None:
        """Loads the manifest-defined production bundle and fails closed on missing required artifacts."""
        if not os.path.exists(MANIFEST_JSON_PATH):
            raise FileNotFoundError(f"Production manifest not found at {MANIFEST_JSON_PATH}")

        with open(MANIFEST_JSON_PATH, "r", encoding="utf-8") as f:
            self.manifest_data = json.load(f)

        def resolve_manifest_path(relative_path: str, label: str) -> str:
            if not isinstance(relative_path, str) or not relative_path:
                raise ValueError(f"CONFIGURATION_ERROR: manifest missing {label} path")
            resolved = os.path.abspath(os.path.join(BASE_DIR, relative_path))
            if os.path.commonpath([BASE_DIR, resolved]) != BASE_DIR:
                raise ValueError(f"CONFIGURATION_ERROR: manifest {label} path escapes repository")
            if not os.path.exists(resolved):
                raise FileNotFoundError(f"Required {label} artifact not found at {resolved}")
            return resolved

        model_path = resolve_manifest_path(self.manifest_data.get("xgboost_model"), "xgboost_model")
        metadata_path = resolve_manifest_path(self.manifest_data.get("xgboost_metadata"), "xgboost_metadata")
        anomaly_path = resolve_manifest_path(self.manifest_data.get("anomaly_artifacts"), "anomaly_artifacts")
        drift_path = resolve_manifest_path(self.manifest_data.get("gpr_artifacts"), "gpr_artifacts")

        gate = EvaluationIntegrityGatePy(custom_prod_manifest_path=MANIFEST_JSON_PATH)
        model_check = gate.verify_production_model_protection(model_path)
        if not model_check["valid"]:
            raise ValueError(f"CONFIGURATION_ERROR: {model_check['message']}")

        manifest_check = gate.verify_production_manifest_protection(MANIFEST_JSON_PATH)
        if not manifest_check["valid"]:
            raise ValueError(f"CONFIGURATION_ERROR: {manifest_check['message']}")

        cal_check = gate.verify_calibration_artifact_immutability()
        if not cal_check["valid"]:
            raise ValueError(f"CONFIGURATION_ERROR: {cal_check['message']}")

        models = self.manifest_data.get("models", {})
        multiclass_spec = models.get("defect_classification", {})
        multiclass_path = resolve_manifest_path(multiclass_spec.get("file"), "defect_classification")

        with open(metadata_path, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        def verify_sha(path: str, expected: Optional[str], label: str) -> None:
            if not expected:
                raise ValueError(f"CONFIGURATION_ERROR: missing SHA-256 for required {label}")
            with open(path, "rb") as artifact_file:
                raw_bytes = artifact_file.read()
                actual = hashlib.sha256(raw_bytes).hexdigest()
                actual_lf = hashlib.sha256(raw_bytes.replace(b"\r\n", b"\n")).hexdigest()
            if actual != expected and actual_lf != expected:
                raise ValueError(f"CONFIGURATION_ERROR: {label} SHA-256 mismatch! Computed: {actual}, Expected: {expected}")

        verify_sha(
            model_path,
            self.manifest_data.get("model_sha256") or self.metadata.get("model_sha256"),
            "xgboost_model",
        )
        verify_sha(multiclass_path, multiclass_spec.get("sha256"), "defect_classification")

        anomaly_spec = models.get("anomaly_detection", {})
        verify_sha(anomaly_path, anomaly_spec.get("sha256"), "anomaly_artifacts")

        drift_spec = models.get("drift_forecasting", {})
        verify_sha(drift_path, drift_spec.get("sha256"), "drift_forecasting")

        self.native_model = xgb.XGBClassifier()
        self.native_model.load_model(model_path)

        with open(model_path, "r", encoding="utf-8") as f:
            self.model_data = json.load(f)

        self.multiclass_model = xgb.XGBClassifier()
        self.multiclass_model.load_model(multiclass_path)

        with open(anomaly_path, "r", encoding="utf-8") as f:
            self.anomaly_artifacts = json.load(f)
        with open(drift_path, "r", encoding="utf-8") as f:
            self.drift_artifacts = json.load(f)

        # Set Operating Threshold and Calibration Coefficients
        self.operating_threshold = float(self.metadata.get("operating_threshold", 0.20))
        if not math.isfinite(self.operating_threshold) or not 0.0 < self.operating_threshold < 1.0:
            raise ValueError("CONFIGURATION_ERROR: operating_threshold must be a finite probability strictly between 0 and 1.")
        calib_cfg = self.metadata.get("calibration", {}).get("coefficients", {})
        self.calib_a = float(calib_cfg.get("a", -1.0))
        self.calib_b = float(calib_cfg.get("b", 0.0))
        if not math.isfinite(self.calib_a) or not math.isfinite(self.calib_b):
            raise ValueError("CONFIGURATION_ERROR: calibration coefficients must be finite numbers.")

        self.is_loaded = True

    def validate_input_record(self, raw_record: Dict[str, Any], strict_equipment: bool = False) -> Dict[str, float]:
        """Validates input fields, numerical types, finite bounds, and equipment_id."""
        if not isinstance(raw_record, dict):
            raise ValueError("Input record must be a JSON object.")

        eq_id = raw_record.get("equipment_id")
        if not eq_id:
            raise ValueError("Missing required field: equipment_id")

        eq_clean = str(eq_id).strip()
        if strict_equipment and eq_clean not in VALID_EQUIPMENT_IDS:
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
            if feature_name == "current" and num_val > 500.0:
                raise ValueError(f"Field '{feature_name}' value {num_val} exceeds physical upper bound of 500mA")

            validated_numerical[feature_name] = num_val

        # Support optional auxiliary canonical reliability fields
        for k in ["iddq", "ileak", "tpd", "iddq_standby", "iddq_0h", "ileak_0h", "tpd_0h"]:
            if k in raw_record and raw_record[k] is not None:
                try:
                    num_v = float(raw_record[k])
                    if not math.isnan(num_v) and not math.isinf(num_v):
                        validated_numerical[k] = num_v
                except (ValueError, TypeError):
                    pass

        return validated_numerical

    def get_normalized_params(self, feat: Dict[str, float]) -> Dict[str, float]:
        """Calculates canonical IDDQ, Ileak, and Tpd parameters for PAT and COPOD screening."""
        raw_iddq = feat.get("iddq_standby") if feat.get("iddq_standby") is not None else (
            feat.get("iddq") if feat.get("iddq") is not None else feat.get("current", 10.703885)
        )
        raw_ileak = feat.get("ileak") if feat.get("ileak") is not None else (
            feat.get("leakage_current") if feat.get("leakage_current") is not None else 111.7316
        )
        raw_tpd = feat.get("tpd") if feat.get("tpd") is not None else (
            feat.get("propagation_delay") if feat.get("propagation_delay") is not None else 10.9834
        )

        eff_iddq = float(raw_iddq if raw_iddq is not None else 10.703885)
        eff_ileak = float(raw_ileak if raw_ileak is not None else 111.7316)
        eff_tpd = float(raw_tpd if raw_tpd is not None else 10.9834)

        # Standard physical scaling bridge: IDDQ (µA) x 200, Leakage (µA) x 2.7, Tpd (ns) x 17.5
        iddq_val = eff_iddq * 200.0
        ileak_val = eff_ileak * 2.7
        tpd_val = eff_tpd * 17.5

        return {"iddq": iddq_val, "ileak": ileak_val, "tpd": tpd_val}

    def engineer_features(self, validated: Dict[str, float], equipment_id: str = "") -> Dict[str, float]:
        """Computes all 7 domain engineered physical features and equipment one-hot encodings."""
        feat = dict(validated)
        eng = compute_engineered_features_dict(feat)
        feat.update(eng)
        eq_clean = str(equipment_id or feat.get("equipment_id", "")).strip().upper()
        for eq in KNOWN_EQUIPMENT_IDS:
            feat[f"eq_{eq}"] = 1.0 if eq_clean == eq else 0.0
        return feat

    def calculate_both_probabilities(self, feat_vector: List[float]) -> Tuple[float, float]:
        """
        Computes raw and Platt-calibrated model probability using native XGBoost inference.
        Uses clean continuous features without artificial pre-split standardization.
        """
        if self.native_model is None:
            raise ValueError("CONFIGURATION_ERROR: Executable XGBoost model artifact missing or corrupted.")

        X = np.array([feat_vector], dtype=np.float32)
        raw_proba = float(self.native_model.predict_proba(X)[0][1])

        # Apply Platt Sigmoid Calibration
        p_clip = np.clip(raw_proba, 1e-7, 1.0 - 1e-7)
        logit = math.log(p_clip / (1.0 - p_clip))
        calib_proba = 1.0 / (1.0 + math.exp(np.clip(self.calib_a * logit + self.calib_b, -50.0, 50.0)))

        return round(raw_proba, 6), round(calib_proba, 6)

    def calculate_probability(self, feat: Union[Dict[str, Any], List[float]], equipment_id: str = "") -> float:
        """
        Computes calibrated failure probability using genuine native XGBoost inference.
        Accepts either a feature dictionary or a 28-length numerical feature vector.
        """
        if self.native_model is None:
            raise ValueError("CONFIGURATION_ERROR: Executable XGBoost model artifact missing or corrupted.")

        if isinstance(feat, dict):
            eq = equipment_id or str(feat.get("equipment_id", ""))
            feat_vector, _ = extract_feature_vector(feat, eq)
        else:
            feat_vector = list(feat)

        _, calib_proba = self.calculate_both_probabilities(feat_vector)
        return calib_proba

    def determine_risk_level(self, probability: float, anomaly_status: str = "NORMAL") -> str:
        """
        Authoritative 4-tier risk taxonomy:
          LOW:      P < operating_threshold (nominal)
          MEDIUM:   operating_threshold <= P < 0.50 (review/monitor)
          HIGH:     0.50 <= P < 0.75 (high failure probability)
          CRITICAL: P >= 0.75 or severe anomaly REJECT (immediate quarantine)
        """
        if not isinstance(self.operating_threshold, (int, float)) or not math.isfinite(self.operating_threshold):
            raise ValueError("CONFIGURATION_ERROR: operating threshold is unavailable.")
        thresh = self.operating_threshold
        if anomaly_status == "REJECT" or probability >= 0.75:
            return "CRITICAL"
        if probability >= 0.50:
            return "HIGH"
        if probability >= thresh or anomaly_status == "MONITOR":
            return "MEDIUM"
        return "LOW"

    def generate_explanation(
        self,
        feat: Dict[str, float],
        feat_vector: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Generates genuine model explanations using XGBoost tree SHAP feature contributions (pred_contribs),
        clearly distinguished from secondary domain diagnostic rules.
        """
        top_contributions = []

        # 1. Genuine XGBoost Tree Feature Contributions
        if self.native_model is not None and feat_vector is not None:
            try:
                booster = self.native_model.get_booster()
                dmat = xgb.DMatrix([feat_vector], feature_names=ALL_28_FEATURE_NAMES)
                contribs = booster.predict(dmat, pred_contribs=True)[0]
                feat_contribs = contribs[:-1]  # 28 feature contributions

                ranked_indices = np.argsort(np.abs(feat_contribs))[::-1][:5]
                for idx in ranked_indices:
                    fname = ALL_28_FEATURE_NAMES[idx]
                    cval = float(feat_contribs[idx])
                    top_contributions.append({
                        "feature": fname,
                        "value": round(float(feat.get(fname, 0.0)), 4),
                        "contribution": round(cval, 4),
                        "direction": "INCREASES_RISK" if cval > 0.0 else "REDUCES_RISK",
                    })
            except Exception:
                pass

        # 2. Secondary Domain Diagnostic Indicators
        indicators = []
        if feat.get("leakage_current", 0.0) > 185.0:
            indicators.append({
                "feature": "leakage_current",
                "value": round(feat["leakage_current"], 2),
                "unit": "µA",
                "status": "ELEVATED",
                "description": "High leakage current indicates potential transistor gate oxide breakdown.",
            })
        if feat.get("temperature", 0.0) > 31.0:
            indicators.append({
                "feature": "temperature",
                "value": round(feat["temperature"], 2),
                "unit": "°C",
                "status": "ELEVATED",
                "description": "Operating temperature above nominal thermal envelope.",
            })
        if feat.get("propagation_delay", 0.0) > 13.8:
            indicators.append({
                "feature": "propagation_delay",
                "value": round(feat["propagation_delay"], 2),
                "unit": "ns",
                "status": "ELEVATED",
                "description": "Excessive path delay risking timing failure.",
            })
        if not indicators:
            indicators.append({
                "feature": "nominal_parameters",
                "value": 0,
                "unit": "N/A",
                "status": "NORMAL",
                "description": "All physical parameters within normal operational bounds.",
            })

        return {
            "ml_feature_attributions": top_contributions,
            "top_contributions": top_contributions,
            "key_indicators": indicators,
        }

    def evaluate_pat_mad(self, feat: Dict[str, float], lot_id: Optional[str] = None) -> Dict[str, Any]:
        """Evaluates Part Average Testing (PAT) using Median Absolute Deviation with lot-reference governance."""
        if not self.anomaly_artifacts or "robust_mad" not in self.anomaly_artifacts:
            raise ValueError("CONFIGURATION_ERROR: robust MAD artifact is unavailable.")

        from src.anomaly_detection.robust_mad import RobustMADDetector
        if not hasattr(self, "_mad_detector_instance") or self._mad_detector_instance is None:
            self._mad_detector_instance = RobustMADDetector(stats=self.anomaly_artifacts["robust_mad"])
        mapping = self.get_normalized_params(feat) if not (set(feat.keys()) == {"iddq", "ileak", "tpd"} and len(feat) == 3) else feat
        canonical = {"iddq": float(mapping["iddq"]), "ileak": float(mapping["ileak"]), "tpd": float(mapping["tpd"])}
        return self._mad_detector_instance.score_single(canonical, lot_id)

    def evaluate_copod(self, feat: Dict[str, float]) -> Dict[str, Any]:
        """Evaluates COPOD empirical copula tail-probability score."""
        if not self.anomaly_artifacts or "copod" not in self.anomaly_artifacts or not isinstance(self.anomaly_artifacts.get("copod"), dict) or "global_ecdfs" not in self.anomaly_artifacts.get("copod", {}):
            return {"score": None, "status": "INSUFFICIENT_EVIDENCE", "detector": "copod"}

        try:
            from src.anomaly_detection.copod import COPODDetector
            if not hasattr(self, "_copod_detector_instance") or self._copod_detector_instance is None:
                self._copod_detector_instance = COPODDetector(model_data=self.anomaly_artifacts["copod"])
            mapping = self.get_normalized_params(feat) if not (set(feat.keys()) == {"iddq", "ileak", "tpd"} and len(feat) == 3) else feat
            canonical = {"iddq": float(mapping["iddq"]), "ileak": float(mapping["ileak"]), "tpd": float(mapping["tpd"])}
            return self._copod_detector_instance.score_single(canonical)
        except Exception as e:
            return {"score": None, "status": "INSUFFICIENT_EVIDENCE", "detector": "copod", "error": str(e)}

    def evaluate_isolation_forest(self, feat: Dict[str, float]) -> Dict[str, Any]:
        """Evaluates Isolation Forest multi-dimensional partition score."""
        if not self.anomaly_artifacts or "isolation_forest" not in self.anomaly_artifacts or not isinstance(self.anomaly_artifacts.get("isolation_forest"), dict) or not isinstance(self.anomaly_artifacts.get("isolation_forest", {}).get("trees"), list) or len(self.anomaly_artifacts.get("isolation_forest", {}).get("trees", [])) == 0:
            return {"score": None, "status": "INSUFFICIENT_EVIDENCE", "detector": "isolation_forest", "mean_path_length": 0.0, "anomaly_evidence": {}}

        try:
            from src.anomaly_detection.isolation_forest import IsolationForestDetector
            if not hasattr(self, "_iso_detector_instance") or self._iso_detector_instance is None:
                self._iso_detector_instance = IsolationForestDetector(forest_data=self.anomaly_artifacts["isolation_forest"])
            mapping = self.get_normalized_params(feat) if not (set(feat.keys()) == {"iddq", "ileak", "tpd"} and len(feat) == 3) else feat
            canonical = {"iddq": float(mapping["iddq"]), "ileak": float(mapping["ileak"]), "tpd": float(mapping["tpd"])}
            return self._iso_detector_instance.score_single(canonical)
        except Exception as e:
            return {"score": None, "status": "INSUFFICIENT_EVIDENCE", "detector": "isolation_forest", "mean_path_length": 0.0, "anomaly_evidence": {}, "error": str(e)}

    def evaluate_anomaly_fusion(self, feat: Dict[str, float], lot_id: Optional[str] = None) -> Dict[str, Any]:
        """Evaluates authoritative multi-criteria anomaly fusion engine."""
        if not hasattr(self, "_fusion_detector_instance") or self._fusion_detector_instance is None:
            from src.anomaly_detection.fusion import AnomalyFusionEngine
            self._fusion_detector_instance = AnomalyFusionEngine.from_artifacts(self.anomaly_artifacts)

        mapping = self.get_normalized_params(feat) if not (set(feat.keys()) == {"iddq", "ileak", "tpd"} and len(feat) == 3) else feat
        canonical_features = {"iddq": float(mapping["iddq"]), "ileak": float(mapping["ileak"]), "tpd": float(mapping["tpd"])}
        return self._fusion_detector_instance.evaluate_component(canonical_features, lot_id=lot_id)

    def evaluate_gpr_drift(self, feat: Dict[str, float]) -> Dict[str, Any]:
        """Evaluates genuine GPR 168h forecast using RBF Kernel Matrix math."""
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
                        "value_24h": round(val24, 4),
                    }
                    continue

                scale_factors = {"iddq": 200.0, "ileak": 2.7, "tpd": 17.5}
                p0_raw = float(feat.get(f"{param}_0h", 0.0))
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

                drift_predictions[param] = {
                    "has_history": True,
                    "status": "CALCULATED",
                    "value_24h": round(val24, 4),
                    "predicted_168h": round(pred_168, 4),
                    "uncertainty_std": round(total_std, 4),
                    "lower_95": round(pred_168 - 1.96 * total_std, 4),
                    "upper_95": round(pred_168 + 1.96 * total_std, 4),
                }

        return drift_predictions

    def synthesize_operational_disposition(
        self,
        probability: float,
        anomaly_evidence: Dict[str, Any],
        drift_predictions: Dict[str, Any],
        safety_slope: Dict[str, Any],
        risk_engine: Dict[str, Any],
        is_unseen: bool = False,
    ) -> Dict[str, Any]:
        """Synthesizes operational disposition matching authoritative Node.js decision semantics."""
        pat = anomaly_evidence.get("pat") or {}
        copod = anomaly_evidence.get("copod") or {}

        exceeded_params = [p for p, s in (safety_slope or {}).items() if s and s.get("boundary_status") == "EXCEEDED"]
        warning_params = [p for p, s in (safety_slope or {}).items() if s and s.get("boundary_status") == "WARNING"]

        any_exceeded = len(exceeded_params) > 0
        any_warning = len(warning_params) > 0

        pat_status = pat.get("status")
        copod_status = copod.get("status")
        overall_status = anomaly_evidence.get("overall_status") or anomaly_evidence.get("anomaly_status")

        is_pat_reject = pat_status == "REJECT"
        is_copod_reject = copod_status == "REJECT"
        is_anomaly_reject = is_pat_reject or is_copod_reject or overall_status in ["ANOMALOUS", "REJECT"]
        is_anomaly_monitor = pat_status == "MONITOR" or copod_status == "MONITOR" or overall_status == "MONITOR"

        # PRIORITY 1: REJECT
        # Triggered if critical model defect probability (>= 0.65), PAT reject, COPOD reject, or safety slope exceeded.
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

            primary_signal = signals[0] if signals else "Critical Reliability Evidence Exceeded"
            secondary_signals = signals[1:]

            decision_reason = f"Critical risk detected ({primary_signal}). Component quarantined."
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
                "decision_reason": decision_reason,
            }

        # PRIORITY 2: MONITOR
        # Triggered if model probability >= operating threshold (0.20), PAT/COPOD monitor, safety slope warning, or unseen equipment.
        if probability >= self.operating_threshold or is_anomaly_monitor or any_warning or is_unseen:
            signals = []
            if probability >= self.operating_threshold:
                signals.append(f"XGBoost Failure Risk Elevated (P={(probability * 100):.1f}%)")
            if is_anomaly_monitor:
                signals.append("PAT/COPOD Anomaly Monitor Warning")
            for p in warning_params:
                signals.append(f"GPR {p.upper()} 168h Forecast Approaching Limit")
            if is_unseen:
                signals.append("Unseen Equipment Identity Warning")

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
                "decision_reason": f"Elevated risk signal detected ({primary_signal}). Secondary ATE re-test or operator inspection recommended.",
            }

        # PRIORITY 3: PASS
        # Triggered ONLY when all risk signals and evidence are within nominal limits.
        return {
            "disposition": "PASS",
            "operational_decision": "PASS",
            "decision_class": "LOW_RISK",
            "requires_secondary_test": False,
            "recommended_action": "PROCEED_STANDARD_SCREENING",
            "decision_override_reason": "NONE",
            "primary_rejection_signal": "NONE",
            "secondary_rejection_signals": [],
            "decision_reason": f"All physical telemetry parameters, XGBoost probability (P={(probability * 100):.1f}% < {self.operating_threshold:.2f}), and multi-criteria risk evidence fall safely within nominal bounds.",
        }

    def predict_single(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Performs end-to-end multi-task inference on a single semiconductor test record."""
        # 1. Validation
        validated_num = self.validate_input_record(record)
        eq_id = str(record.get("equipment_id", "")).strip().upper()
        is_unseen, _ = encode_equipment_status(eq_id)
        lot_id = str(record.get("lot_id")) if record.get("lot_id") else None

        # 2. Extract 28-feature production vector
        feat_vector, _ = extract_feature_vector(record, eq_id)
        raw_prob, calib_prob = self.calculate_both_probabilities(feat_vector)

        # 3. Defect Classification (Model 2)
        defect_class = "NORMAL"
        defect_confidence = 1.0
        if self.multiclass_model is not None:
            try:
                m_probs = self.multiclass_model.predict_proba([feat_vector])[0]
                pred_idx = int(np.argmax(m_probs))
                defect_class = DEFECT_INDEX_MAP.get(pred_idx, "UNKNOWN")
                defect_confidence = float(m_probs[pred_idx])
            except Exception:
                defect_class = "NORMAL"

        # 4. Anomaly Detection (Model 3 — Authoritative Anomaly Fusion Engine)
        fusion_res = self.evaluate_anomaly_fusion(validated_num, lot_id=lot_id)
        anomaly_status = fusion_res.get("anomaly_status", "NORMAL")
        anomaly_score = fusion_res.get("anomaly_score")
        drift_preds = self.evaluate_gpr_drift(validated_num)

        # Open-set unknown anomaly check
        is_unknown_anomaly = False
        if anomaly_status in ["REJECT", "MONITOR"] and (defect_confidence < 0.50 or defect_class == "NORMAL"):
            is_unknown_anomaly = True
            defect_class = "UNKNOWN_ANOMALY"

        # 5. Risk Level & Explanations
        prediction = "FAIL" if calib_prob >= self.operating_threshold else "PASS"
        risk_level = self.determine_risk_level(calib_prob, anomaly_status)
        explanation = self.generate_explanation(validated_num, feat_vector)

        # 6. Safety Slope & Multi-Criteria Decision
        from src.decision_engine.safety_slope import SafetySlopeCalculator
        safety_calculator = SafetySlopeCalculator(max_limit=250.0, max_slope_per_hour=1.0)
        safety_slope = safety_calculator.evaluate_all_trajectories(drift_preds)

        from src.decision_engine.decision import MultiCriteriaDecisionEngine
        risk_engine_calc = MultiCriteriaDecisionEngine()
        anomaly_evidence = dict(fusion_res.get("evidence", {}))
        anomaly_evidence["pat"] = fusion_res.get("detector_evidence", {}).get("robust_mad", {})
        anomaly_evidence["copod"] = fusion_res.get("detector_evidence", {}).get("copod", {})
        anomaly_evidence["isolation_forest"] = fusion_res.get("detector_evidence", {}).get("isolation_forest", {})
        anomaly_evidence["mad"] = anomaly_evidence["pat"]
        anomaly_evidence["overall_status"] = "ANOMALOUS" if anomaly_status == "REJECT" else anomaly_status
        anomaly_evidence["fusion"] = fusion_res

        risk_engine_res = risk_engine_calc.evaluate_multi_criteria_risk(anomaly_evidence, drift_preds, safety_slope)

        from src.risk_fusion.risk_fusion import GovernedRiskFusionEngine
        governed_fusion_engine = GovernedRiskFusionEngine()
        governed_res = governed_fusion_engine.evaluate(calib_prob, anomaly_evidence, drift_preds, safety_slope)
        risk_engine_res["governed_risk_fusion"] = governed_res

        from src.decision_engine.explanation import ExplainabilityGenerator
        explainability_gen = ExplainabilityGenerator()
        explainability_res = explainability_gen.generate_explanation(anomaly_evidence, drift_preds, safety_slope, risk_engine_res)

        # 7. Operational Disposition Synthesis
        synth_disp = self.synthesize_operational_disposition(
            calib_prob, anomaly_evidence, drift_preds, safety_slope, risk_engine_res, is_unseen=is_unseen
        )
        disposition = synth_disp["disposition"]
        op_decision = synth_disp["operational_decision"]
        rec_action = synth_disp["recommended_action"]
        reason = synth_disp["decision_reason"]

        pat_result = fusion_res.get("detector_evidence", {}).get("robust_mad", {})
        copod_result = fusion_res.get("detector_evidence", {}).get("copod", {})
        iso_result = fusion_res.get("detector_evidence", {}).get("isolation_forest", {})

        pat_res = fusion_res.get("detector_evidence", {}).get("robust_mad") or pat_result
        copod_res = fusion_res.get("detector_evidence", {}).get("copod") or copod_result
        iso_res = fusion_res.get("detector_evidence", {}).get("isolation_forest") or iso_result

        anomaly_ml_details = dict(fusion_res)
        anomaly_ml_details["score"] = anomaly_score
        anomaly_ml_details["status"] = anomaly_status
        anomaly_ml_details["pat"] = pat_res
        anomaly_ml_details["copod"] = copod_res
        anomaly_ml_details["isolation_forest"] = iso_res
        anomaly_ml_details["detectors"] = {
            "pat_mad": pat_res,
            "copod": copod_res,
            "isolation_forest": iso_res,
        }

        response = {
            "ml_prediction": prediction,
            "prediction": prediction,
            "probability": calib_prob,
            "raw_probability": raw_prob,
            "calibrated": True,
            "operating_threshold": self.operating_threshold,
            "threshold": self.operating_threshold,
            "risk_level": risk_level,
            "defect_classification": {
                "predicted_defect": defect_class,
                "confidence": round(defect_confidence, 4),
                "is_unknown_anomaly": is_unknown_anomaly,
            },
            "anomaly_score": anomaly_score,
            "anomaly_status": anomaly_status,
            "overall_status": fusion_res.get("overall_status", anomaly_status),
            "weighted_fusion_score": fusion_res.get("weighted_fusion_score"),
            "fusion_method": fusion_res.get("fusion_method"),
            "contributing_detectors": fusion_res.get("contributing_detectors", []),
            "detector_evidence": fusion_res.get("detector_evidence", {}),
            "reference_status": fusion_res.get("reference_status"),
            "reference_source": fusion_res.get("reference_source"),
            "reference_sample_count": fusion_res.get("reference_sample_count", 0),
            "lot_id": fusion_res.get("lot_id", lot_id),
            "reference_context": fusion_res.get("reference_context", {}),
            "calibration_status": fusion_res.get("calibration_status", "NOT_CALIBRATED"),
            "anomaly_calibration_status": "NOT_CALIBRATED",
            "validation_status": fusion_res.get("validation_status", "PROJECT_DEFINED_SCREENING_CRITERION"),
            "promotion_status": fusion_res.get("promotion_status", "BENCHMARK_ONLY"),
            "is_unseen_equipment": is_unseen,
            "disposition": disposition,
            "operational_decision": op_decision,
            "recommended_action": rec_action,
            "decision_reason": reason,
            "model_version": "4.0.0_authoritative",
            "explanation": explanation,
            "ml_details": {
                "anomaly_detection": anomaly_ml_details,
                "drift_prediction": drift_preds,
                "safety_slope": safety_slope,
                "risk_engine": risk_engine_res,
                "explainability": explainability_res,
            },
        }

        # Include request identifiers if present (identity passthrough at authoritative boundary)
        for key in ["trace_id", "component_id", "test_id", "wafer_id", "die_id", "equipment_id", "lot_id"]:
            if key in record and record[key] is not None:
                response[key] = record[key]

        # Retrospective Trajectory Evaluation Target (Phase 7 API Contract)
        from src.evaluation.latent_trajectory import AuthoritativeTarget, TrajectoryState, evaluate_component_state
        evaluation_target = {
            "name": AuthoritativeTarget.NAME,
            "definition": AuthoritativeTarget.DEFINITION,
            "criteria_source": AuthoritativeTarget.CRITERIA_SOURCE,
            "status": "INSUFFICIENT_DATA",
            "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
            "ground_truth_available": False,
            "latent_168h_failure": None
        }

        if record.get("has_168h_ground_truth") or record.get("telemetry_168h") or record.get("tpd_168h") is not None:
            tel168 = record.get("telemetry_168h") or {
                "tpd": record.get("tpd_168h"),
                "iddq": record.get("iddq_168h"),
                "ileak": record.get("ileak_168h"),
                "health_state": record.get("health_state_168h", record.get("health_state"))
            }
            tel24 = {
                "tpd": record.get("propagation_delay", record.get("tpd")),
                "iddq": record.get("iddq_standby", record.get("iddq")),
                "ileak": record.get("leakage_current", record.get("ileak")),
                "health_state": record.get("health_state")
            }
            traj_res = evaluate_component_state(tel24, tel168)
            evaluation_target = {
                "name": AuthoritativeTarget.NAME,
                "definition": AuthoritativeTarget.DEFINITION,
                "criteria_source": AuthoritativeTarget.CRITERIA_SOURCE,
                "status": "INSUFFICIENT_DATA" if traj_res["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value else "EVALUATED",
                "trajectory_state": traj_res["trajectory_state"],
                "ground_truth_available": True,
                "latent_168h_failure": traj_res["latent_168h_failure"],
                "evaluation_reason": traj_res["reason"]
            }

        response["evaluation_target"] = evaluation_target

        return response

    def predict_batch(self, batch: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Performs batch inference on an array of test records."""
        if not isinstance(batch, list) or len(batch) == 0:
            raise ValueError("Batch request must be a non-empty array of records.")
        if len(batch) > 1000:
            raise ValueError("Batch request exceeds maximum allowed size limit of 1000 records.")

        results = []
        pass_count = 0
        fail_count = 0

        for index, item in enumerate(batch):
            if not isinstance(item, dict):
                raise ValueError(f"Batch record at index {index} must be a JSON object.")
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
            "results": results,
        }


# Global singleton instance
inference_service = PredictaInferenceService()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "--single" and len(sys.argv) > 2:
            input_record = json.loads(sys.argv[2])
            res = inference_service.predict_single(input_record)
            print(json.dumps(res, indent=2))
        elif sys.argv[1] == "--batch" and len(sys.argv) > 2:
            batch_record = json.loads(sys.argv[2])
            res = inference_service.predict_batch(batch_record)
            print(json.dumps(res, indent=2))
    else:
        print("[INFO] PredictaInferenceService loaded successfully with certified multi-task ensemble.")
