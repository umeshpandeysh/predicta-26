#!/usr/bin/env python3
"""One-shot native XGBoost inference bridge used for cross-runtime verification."""
from pathlib import Path
import json
import sys

# Make the repository root importable regardless of how this script is launched.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.api.inference_service import PredictaInferenceService


def main():
    payload = json.load(sys.stdin)
    service = PredictaInferenceService()
    record = payload["record"] if isinstance(payload, dict) and "record" in payload else payload
    validated = service.validate_input_record(record)
    engineered = service.engineer_features(validated, str(record["equipment_id"]))
    probability = service.calculate_probability(engineered, str(record["equipment_id"]))
    print(json.dumps({"probability": probability, "threshold": service.operating_threshold}))


if __name__ == "__main__":
    main()
