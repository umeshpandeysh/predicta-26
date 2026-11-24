"""Fit the raw ATE anomaly reference using only nominal 0–24h training measurements."""
import hashlib
import json
from pathlib import Path

import pandas as pd

from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.robust_mad import RobustMADDetector

ROOT = Path(__file__).resolve().parents[2]
CHANNELS = {"current": "current", "leakage_current": "ileak", "propagation_delay": "tpd"}


def fit_reference(frame):
    nominal = frame.loc[
        frame.burn_in_hour.between(0, 24) & frame.result.eq("PASS") &
        frame.defect_type.eq("NORMAL") & frame.is_latent.eq(0)
    ]
    channels = nominal[list(CHANNELS)].rename(columns=CHANNELS)
    if channels.empty or channels.isna().any().any():
        raise ValueError("Missing nominal ATE training measurements")
    config = {"features": list(channels)}
    mad = RobustMADDetector(stats=config)
    copod = COPODDetector(model_data=config)
    mad.fit(channels, nominal.lot_id)
    copod.fit(channels)
    return {
        "features": list(channels), "units": ["mA", "µA", "ns"],
        "training_rows": len(nominal), "training_lots": sorted(nominal.lot_id.unique()),
        "robust_mad": mad.export_parameters(), "copod": copod.export_parameters(),
    }


if __name__ == "__main__":
    source = ROOT / "ml/data/processed/train.csv"
    artifact = fit_reference(pd.read_csv(source))
    artifact["training_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    (ROOT / "ml/anomaly/ate_reference.json").write_text(
        json.dumps(artifact, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8"
    )
