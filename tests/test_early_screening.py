import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml.training.latent_trajectory_model import ARTIFACT, early_features, predict
from src.api.inference_service import PredictaInferenceService
from src.api.schemas import TelemetryRecordInput
from src.features.feature_contract import ALL_28_FEATURE_NAMES, extract_feature_vector

ROOT = Path(__file__).resolve().parents[1]


def test_serving_vector_matches_training_units_in_both_runtimes():
    row = pd.read_csv(ROOT / "ml/data/processed/train.csv", nrows=1).iloc[0].to_dict()
    # Published feature columns in the training CSV were calculated before raw sensor rounding.
    expected = [row[name] for name in ALL_28_FEATURE_NAMES]
    vector, _ = extract_feature_vector(row)
    np.testing.assert_allclose(vector, expected, atol=0.0002)
    script = """
      const service = require('./src/api/inference');
      const row = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      const features = service.engineerFeatures(row, row.equipment_id);
      const result = service.predictSingle(row);
      process.stdout.write(JSON.stringify({
        vector: service.metadata.feature_names.map(name => features[name]),
        probability: result.probability, disposition: result.disposition
      }));
    """
    node = subprocess.run(["node", "-e", script], cwd=ROOT, input=json.dumps(row),
                          text=True, check=True, capture_output=True)
    parsed = json.loads(node.stdout)
    py = PredictaInferenceService().predict_single(row)
    np.testing.assert_allclose(parsed["vector"], vector, atol=1e-6)
    assert parsed["probability"] == pytest.approx(py["probability"], abs=1e-5)
    assert parsed["disposition"] == py["disposition"]


def test_public_screening_window_and_history():
    record = pd.read_csv(ROOT / "ml/data/processed/train.csv", nrows=1).iloc[0].to_dict()
    service = PredictaInferenceService()
    record.update(iddq_standby=10.7, iddq_0h=10.5, ileak_0h=111.0, tpd_0h=11.0)
    for hour, expected in [(0, False), (24, True)]:
        record["burn_in_hour"] = hour
        parsed = TelemetryRecordInput(**record).model_dump(exclude_none=True)
        fields = service.validate_input_record(parsed)
        fields["burn_in_hour"] = parsed["burn_in_hour"]
        assert service.evaluate_gpr_drift(fields)["iddq"]["has_history"] is expected
    for hour in [-1, 48, 168, float("nan")]:
        record["burn_in_hour"] = hour
        with pytest.raises(ValueError):
            TelemetryRecordInput(**record)
        with pytest.raises(ValueError, match="burn_in_hour"):
            service.predict_single(record)


def test_ate_reference_lineage_and_checkpoint_selection():
    import hashlib
    reference = json.loads((ROOT / "ml/anomaly/ate_reference.json").read_text())
    path = ROOT / "ml/data/processed/train.csv"
    assert reference["training_sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    nominal = pd.read_csv(path).query("0 <= burn_in_hour <= 24 and result == 'PASS' and defect_type == 'NORMAL' and is_latent == 0")
    assert reference["training_rows"] == len(nominal)
    assert reference["robust_mad"]["global_stats"]["current"]["median"] == nominal.current.median()
    test = pd.read_csv(ROOT / "ml/data/processed/test.csv", usecols=["lot_id"])
    assert set(reference["training_lots"]).isdisjoint(test.lot_id)


def test_future_measurements_cannot_change_latent_score():
    artifact = json.loads(ARTIFACT.read_text())
    data = pd.read_csv(ROOT / "data/synthetic/semiconductor_synthetic_test.csv", nrows=12)
    early = data[data.burn_in_hour <= 24]
    original = predict(early, artifact)
    data.loc[data.burn_in_hour > 24, ["iddq", "ileak", "tpd"]] = 1e9
    pd.testing.assert_frame_equal(original, predict(data, artifact))
    missing = predict(early[early.burn_in_hour == 0], artifact)
    assert missing["status"].eq("INSUFFICIENT_HISTORY").all() and missing["score"].isna().all()
    with pytest.raises(ValueError, match="Duplicate"):
        early_features(pd.concat([early, early], ignore_index=True))
