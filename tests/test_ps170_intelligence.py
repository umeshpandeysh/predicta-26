"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
Comprehensive PS-170 Reliability Intelligence & Anti-Fabrication Test Suite (Python)
File: tests/test_ps170_intelligence.py
"""

from __future__ import annotations

import hashlib
import os
import sys
import pytest

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.decision_engine.uncertainty_decision_pathway import (
    GovernedDecision,
    NextAction,
    PROD_OPERATING_THRESHOLD,
    UncertaintyDecisionPathway,
)
from src.governance.discrimination_engine import (
    NON_CAUSAL_DISCLAIMER,
    DiscriminationEngine,
    RootEvidenceType,
)
from src.governance.evidence_card import (
    COUNTERFACTUAL_DISCLAIMER,
    PROD_MODEL_HASH,
    PROD_MODEL_VERSION,
    EvidenceCardGenerator,
)
from src.governance.ood_classifier import OODClassifier, ShiftClassification


class TestDiscriminationEngine:
    @pytest.fixture
    def engine(self) -> DiscriminationEngine:
        return DiscriminationEngine()

    def test_sensor_range_violation(self, engine: DiscriminationEngine) -> None:
        res = engine.evaluate({
            "telemetry_0h": {"supply_voltage": 1.20, "current": 15.0},
            "telemetry_24h": {"supply_voltage": 99.0, "current": 15.0},
        })
        assert res["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
        assert res["disclaimer"] == NON_CAUSAL_DISCLAIMER
        assert len(res["findings"]) > 0

    def test_unphysical_single_channel_step(self, engine: DiscriminationEngine) -> None:
        res = engine.evaluate({
            "telemetry_0h": {"supply_voltage": 1.20, "current": 15.0},
            "telemetry_24h": {"supply_voltage": 1.90, "current": 15.0},
        })
        assert res["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value

    def test_equipment_chamber_shifts(self, engine: DiscriminationEngine) -> None:
        res = engine.evaluate({
            "telemetry_0h": {"supply_voltage": 1.20, "current": 15.0},
            "telemetry_24h": {"supply_voltage": 1.20, "current": 15.0},
            "equipment_context": {
                "equipment_id": "EQP-103",
                "lot_equipment_anomaly_rate": 0.65,
                "chamber_thermal_offset_detected": True,
            },
        })
        assert res["root_evidence_type"] == RootEvidenceType.EQUIPMENT_OR_CHAMBER.value

    def test_explicit_localized_silicon_degradation(self, engine: DiscriminationEngine) -> None:
        res = engine.evaluate({
            "telemetry_0h": {"threshold_voltage": 0.450, "leakage_current": 120.0},
            "telemetry_24h": {"threshold_voltage": 0.490, "leakage_current": 220.0},
            "anomaly_evidence": {"status": "MONITOR", "copod": {"score": 6.5}},
        })
        assert res["root_evidence_type"] == RootEvidenceType.COMPONENT_SILICON.value

    def test_nominal_telemetry_anti_fabrication(self, engine: DiscriminationEngine) -> None:
        """Nominal telemetry without fault indicators must NOT evaluate to COMPONENT_SILICON."""
        res = engine.evaluate({
            "telemetry_0h": {"supply_voltage": 1.20, "current": 15.0, "leakage_current": 120.0, "threshold_voltage": 0.45},
            "telemetry_24h": {"supply_voltage": 1.20, "current": 15.0, "leakage_current": 120.0, "threshold_voltage": 0.45},
        })
        assert res["root_evidence_type"] == RootEvidenceType.INSUFFICIENT_EVIDENCE.value
        assert res["confidence_score"] == 0.0
        assert res["root_evidence_type"] != RootEvidenceType.COMPONENT_SILICON.value

    def test_fail_closed_missing_telemetry(self, engine: DiscriminationEngine) -> None:
        res = engine.evaluate(None)
        assert res["root_evidence_type"] == RootEvidenceType.INSUFFICIENT_EVIDENCE.value
        assert res["confidence_score"] == 0.0


class TestOODClassifier:
    @pytest.fixture
    def classifier(self) -> OODClassifier:
        return OODClassifier()

    def test_nominal_distribution(self, classifier: OODClassifier) -> None:
        res = classifier.classify({
            "supply_voltage": 1.20,
            "current": 15.0,
            "leakage_current": 120.0,
            "threshold_voltage": 0.45,
        })
        assert res["classification"] == ShiftClassification.NORMAL.value
        assert res["requires_hold"] is False
        assert res["governance_metadata"]["baseline_type"] == "GOVERNED_HEURISTIC_SPECIFICATION"

    def test_extreme_ood_values(self, classifier: OODClassifier) -> None:
        res = classifier.classify({
            "supply_voltage": 1.20,
            "current": 45.0,
            "leakage_current": 800.0,
            "threshold_voltage": 0.85,
        })
        assert res["classification"] == ShiftClassification.OOD.value
        assert res["requires_hold"] is True

    def test_fail_closed_empty(self, classifier: OODClassifier) -> None:
        res = classifier.classify({})
        assert res["classification"] == ShiftClassification.OOD.value
        assert res["requires_hold"] is True


class TestUncertaintyDecisionPathway:
    @pytest.fixture
    def pathway(self) -> UncertaintyDecisionPathway:
        return UncertaintyDecisionPathway(PROD_OPERATING_THRESHOLD)

    def test_high_uncertainty_routes_to_hold(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.05,
            "prognostic_evidence": {
                "conformal_interval": {"lower": 0.02, "upper": 0.60},
            },
            "ood_evidence": {"classification": "NORMAL", "requires_hold": False},
        })
        assert res["decision"] == GovernedDecision.HOLD.value
        assert res["next_action"] == NextAction.ROUTE_TO_96H_VERIFICATION.value
        assert res["uncertainty_routed_to_hold"] is True

    def test_ood_routes_to_hold(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.08,
            "ood_evidence": {"classification": "OOD", "requires_hold": True},
        })
        assert res["decision"] == GovernedDecision.HOLD.value
        assert res["next_action"] == NextAction.ROUTE_TO_96H_VERIFICATION.value

    def test_reject_on_probability_breach(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.205,
        })
        assert res["decision"] == GovernedDecision.REJECT.value
        assert res["next_action"] == NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
        assert res["uncertainty_routed_to_hold"] is False

    def test_reject_on_physics_inconsistency(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.05,
            "physics_evidence": {"status": "PHYSICS_INCONSISTENT"},
        })
        assert res["decision"] == GovernedDecision.REJECT.value
        assert res["next_action"] == NextAction.SCRAP_OR_FAILURE_ANALYSIS.value

    def test_sensor_recalibration_routing(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.05,
            "discrimination_evidence": {
                "root_evidence_type": "SENSOR_OR_DATA_QUALITY",
                "findings": ["Range breach"],
            },
        })
        assert res["decision"] == GovernedDecision.HOLD.value
        assert res["next_action"] == NextAction.SENSOR_RECALIBRATION.value

    def test_pass_nominal_die(self, pathway: UncertaintyDecisionPathway) -> None:
        res = pathway.evaluate({
            "calibrated_probability": 0.03,
        })
        assert res["decision"] == GovernedDecision.PASS.value
        assert res["next_action"] == NextAction.RELEASE_TO_PRODUCTION.value


class TestEvidenceCardStrictProvenance:
    @pytest.fixture
    def generator(self) -> EvidenceCardGenerator:
        return EvidenceCardGenerator()

    def test_missing_identity_remains_none(self, generator: EvidenceCardGenerator) -> None:
        """Missing identity must remain None, not fabricated DIE_UNKNOWN."""
        sample = {
            "telemetry_24h": {"supply_voltage": 1.20, "leakage_current": 120.0, "threshold_voltage": 0.45},
            "calibrated_probability": 0.04,
        }
        res = generator.generate_card(sample)
        assert res["json"]["component_identity"]["component_id"] is None
        assert res["json"]["component_identity"]["lot_id"] is None
        assert res["json"]["component_identity"]["wafer_id"] is None
        assert res["json"]["component_identity"]["equipment_id"] is None

    def test_missing_physics_evaluates_insufficient(self, generator: EvidenceCardGenerator) -> None:
        """Missing physics must not default to PHYSICS_CONSISTENT."""
        sample = {
            "component_id": "DIE_REAL_001",
            "telemetry_24h": {"supply_voltage": 1.20, "leakage_current": 120.0},
            "calibrated_probability": 0.04,
        }
        res = generator.generate_card(sample)
        assert res["json"]["physics_consistency"]["status"] == "INSUFFICIENT_PHYSICS_EVIDENCE"
        assert res["json"]["physics_consistency"]["consistency_score"] is None
        assert res["json"]["physics_consistency"]["checks_evaluated"] == []

    def test_missing_conformal_interval_remains_none(self, generator: EvidenceCardGenerator) -> None:
        """Missing conformal uncertainty must remain None without fabricating bounds."""
        sample = {
            "component_id": "DIE_REAL_001",
            "calibrated_probability": 0.04,
        }
        res = generator.generate_card(sample)
        assert res["json"]["early_prognostics"]["conformal_uncertainty"] is None

    def test_missing_telemetry_data_quality(self, generator: EvidenceCardGenerator) -> None:
        sample = {}
        res = generator.generate_card(sample)
        assert res["json"]["data_quality"]["status"] == "INSUFFICIENT_EVIDENCE"
        assert res["json"]["provenance_and_twin"]["twin_trace_id"] is None
        assert res["json"]["provenance_and_twin"]["operator_disposition"] is None

    def test_counterfactual_disclaimer_and_sha(self, generator: EvidenceCardGenerator) -> None:
        sample = {
            "component_id": "DIE_TEST_001",
            "calibrated_probability": 0.25,
        }
        res = generator.generate_card(sample)
        assert res["json"]["counterfactual_explanation"]["disclaimer"] == COUNTERFACTUAL_DISCLAIMER
        assert res["json"]["provenance_and_twin"]["production_model_hash"] == PROD_MODEL_HASH
        assert res["json"]["provenance_and_twin"]["production_model_version"] == PROD_MODEL_VERSION


class TestProtectedArtifactIntegrity:
    def test_production_model_sha256(self) -> None:
        model_path = os.path.join(project_root, "ml", "models", "production", "predicta_xgboost_model.json")
        with open(model_path, "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()
        assert h == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

    def test_operating_threshold_locked(self) -> None:
        assert PROD_OPERATING_THRESHOLD == 0.20
