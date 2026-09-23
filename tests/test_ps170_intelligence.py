"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
Comprehensive PS-170 Reliability Intelligence & Anti-Fabrication Test Suite (Python)
File: tests/test_ps170_intelligence.py
"""

from __future__ import annotations

import hashlib
import json
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

    def test_evidence_card_model_provenance_strictness(self, generator: EvidenceCardGenerator) -> None:
        """Targeted Anti-Fabrication Test 1: Caller with only calibrated prob gets NOT_ESTABLISHED model provenance."""
        sample = {
            "component_id": "DIE_TEST_001",
            "calibrated_probability": 0.25,
            # model_provenance omitted
        }
        res = generator.generate_card(sample)
        assert res["json"]["counterfactual_explanation"]["disclaimer"] == COUNTERFACTUAL_DISCLAIMER
        prov = res["json"]["provenance_and_twin"]["model_provenance"]
        assert prov["status"] == "NOT_ESTABLISHED"
        assert prov["model_version"] is None
        assert prov["model_sha256"] is None
        assert prov["provenance_source"] is None

        # Verify explicit verified provenance is preserved
        sample_verified = {
            "component_id": "DIE_TEST_001",
            "calibrated_probability": 0.25,
            "model_provenance": {
                "status": "VERIFIED",
                "model_version": "4.0.0_authoritative",
                "model_sha256": "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98",
                "provenance_source": "AUTHORITATIVE_PRODUCTION_MANIFEST",
            },
        }
        res_verified = generator.generate_card(sample_verified)
        prov_ver = res_verified["json"]["provenance_and_twin"]["model_provenance"]
        assert prov_ver["status"] == "VERIFIED"
        assert prov_ver["model_version"] == "4.0.0_authoritative"
        assert prov_ver["model_sha256"] == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


class TestTargetedGovernanceAntiFabrication:
    def test_heuristic_ood_governance_metadata(self) -> None:
        """Targeted Anti-Fabrication Test 2: Heuristic OOD Classifier governance metadata declaration."""
        classifier = OODClassifier()
        meta = classifier.governance_metadata
        assert meta["baseline_type"] == "GOVERNED_HEURISTIC_SPECIFICATION"
        assert meta["calibration_status"] == "NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE"
        assert meta["usage_scope"] == "BENCHMARK_SCREENING_ONLY"
        assert meta["is_production_calibrated"] is False
        assert meta["is_authoritative_decision_input"] is False

    def test_uncalibrated_ood_not_authoritative(self) -> None:
        """Targeted Anti-Fabrication Test 3: Uncalibrated heuristic OOD does not become authoritative production evidence."""
        classifier = OODClassifier()
        res = classifier.classify({"current": 55.0, "temperature": 140.0})
        assert res["classification"] == "OOD"
        assert res["governance_metadata"]["is_production_calibrated"] is False
        assert res["governance_metadata"]["usage_scope"] == "BENCHMARK_SCREENING_ONLY"
        assert res["governance_metadata"]["baseline_type"] == "GOVERNED_HEURISTIC_SPECIFICATION"

    def test_champion_challenger_ledger_provenance(self) -> None:
        """Targeted Anti-Fabrication Test 4: Champion and Challenger Ledger Provenance Verification."""
        ledger_path = os.path.join(project_root, "ml", "governance", "champion_challenger_ledger.json")
        with open(ledger_path, "r", encoding="utf-8") as f:
            ledger = json.load(f)

        assert ledger["champion"]["status"] == "CHAMPION_ACTIVE"
        assert ledger["champion"]["sha256_hash"] == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
        assert ledger["champion"]["operating_threshold"] == 0.20
        assert ledger["champion"]["conformal_calibration_status"] == "BENCHMARK_EVALUATION_ONLY"
        assert "conformal_coverage" not in ledger["champion"]

        challenger = ledger["challengers"][0]
        assert challenger["artifact_status"] == "HISTORICAL_REFERENCE_ONLY"
        assert challenger["verification_status"] == "HISTORICAL_UNVERIFIED"
        assert challenger["rejection_performance_evidence"] == "NOT_ESTABLISHED"
        assert challenger["status"] != "REJECTED_UNACCEPTABLE_LATENT_ESCAPES"


class TestProtectedArtifactIntegrity:
    def test_production_model_sha256(self) -> None:
        model_path = os.path.join(project_root, "ml", "models", "production", "predicta_xgboost_model.json")
        with open(model_path, "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()
        assert h == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

    def test_production_dataset_sha256(self) -> None:
        dataset_path = os.path.join(project_root, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv")
        with open(dataset_path, "rb") as f:
            h = hashlib.sha256(f.read()).hexdigest()
        assert h == "9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24"

    def test_operating_threshold_locked(self) -> None:
        assert PROD_OPERATING_THRESHOLD == 0.20
