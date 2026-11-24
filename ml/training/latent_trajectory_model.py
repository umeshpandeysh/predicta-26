"""Train and score a synthetic 168h latent-failure challenger with measured 0h/24h trajectories."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, roc_auc_score

from src.evaluation.latent_trajectory import AuthoritativeTarget, build_trajectory_dataset

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = ROOT / "ml/models/challengers/latent_168h.json"
CHANNELS = ["iddq", "ileak", "tpd"]
FEATURES = [f"{channel}_{checkpoint}" for checkpoint in ("0h", "24h", "drift_24h") for channel in CHANNELS]


def early_features(records):
    """Return one row per component. Missing or nonfinite paired measurements remain unscored."""
    hours = pd.to_numeric(records["burn_in_hour"], errors="raise")
    if not np.isfinite(hours).all() or (hours < 0).any() or records.component_id.isna().any():
        raise ValueError("Every row needs a component ID and a finite, nonnegative checkpoint")
    early = records.loc[hours.isin([0, 24]), ["component_id", *CHANNELS]].copy()
    early["burn_in_hour"] = hours.loc[early.index]
    if early.duplicated(["component_id", "burn_in_hour"]).any():
        raise ValueError("Duplicate 0h or 24h checkpoint for one component")
    early[CHANNELS] = early[CHANNELS].apply(pd.to_numeric, errors="raise")
    wide = early.pivot(index="component_id", columns="burn_in_hour", values=CHANNELS)
    result = pd.DataFrame(index=pd.Index(records.component_id.unique(), name="component_id"))
    for channel in CHANNELS:
        for hour in [0, 24]:
            result[f"{channel}_{hour}h"] = wide.get((channel, hour), np.nan)
        result[f"{channel}_drift_24h"] = result[f"{channel}_24h"] - result[f"{channel}_0h"]
    return result[FEATURES].replace([np.inf, -np.inf], np.nan)


def metrics(labels, scores, threshold):
    tn, fp, fn, tp = confusion_matrix(labels, scores >= threshold, labels=[0, 1]).ravel().tolist()
    return {
        "n": len(labels), "positives": tp + fn, "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "recall": tp / (tp + fn), "false_positive_rate": fp / (fp + tn),
        "precision": tp / (tp + fp) if tp + fp else 0,
        "average_precision": float(average_precision_score(labels, scores)),
        "roc_auc": float(roc_auc_score(labels, scores)), "brier": float(brier_score_loss(labels, scores)),
    }


def train():
    manifest = json.loads((ROOT / "ml/data/split_manifest.json").read_text())
    source = ROOT / "data/synthetic/semiconductor_synthetic_full.csv"
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != manifest["dataset_sha256"]:
        raise ValueError("Trajectory dataset checksum mismatch")
    data = pd.read_csv(source)
    lots = manifest["lots"]
    assigned = [lot for cohort in lots.values() for lot in cohort]
    if len(set(assigned)) != len(assigned) or set(assigned) != set(data.lot_id):
        raise ValueError("Trajectory lots must belong to exactly one manifest partition")
    if data.groupby("component_id").lot_id.nunique().ne(1).any() or data.duplicated(["component_id", "burn_in_hour"]).any():
        raise ValueError("Ambiguous component identity or duplicate checkpoint")

    def partition(name):
        records = data[data.lot_id.isin(lots[name])]
        matrix = early_features(records)
        targets = build_trajectory_dataset(records).set_index("component_id")[AuthoritativeTarget.NAME].reindex(matrix.index)
        if matrix.isna().any().any() or targets.isna().any() or targets.nunique() != 2:
            raise ValueError(f"Incomplete measurements or single-class target in {name}")
        return matrix, targets.astype(int)

    x_train, y_train = partition("train")
    x_val, y_val = partition("validation_tune")
    candidates = []
    for depth in (2, 4):
        model = xgb.XGBClassifier(max_depth=depth, n_estimators=100, learning_rate=0.05, tree_method="hist",
                                  objective="binary:logistic", n_jobs=1, random_state=42)
        model.fit(x_train, y_train)
        scores = model.predict_proba(x_val)[:, 1]
        candidates.append((float(average_precision_score(y_val, scores)), depth, model, scores))
    _, depth, model, scores = max(candidates, key=lambda item: item[0])

    # Use the project's 10:1 missed-defect/false-alarm cost prior on tuning lots only.
    thresholds = np.append(np.unique(scores.astype(float)), 1.0)
    def validation_cost(threshold):
        predicted = scores.astype(float) >= threshold
        return 10 * int((~predicted & y_val.eq(1)).sum()) + int((predicted & y_val.eq(0)).sum())

    threshold = float(min(thresholds, key=validation_cost))
    x_test, y_test = partition("test")
    report = {
        "scope": "Synthetic longitudinal challenger", "target": AuthoritativeTarget.DEFINITION,
        "dataset_sha256": digest, "xgboost_version": xgb.__version__, "features": FEATURES, "threshold": threshold,
        "selected_depth": depth, "validation_average_precision_by_depth": {d: ap for ap, d, _, _ in candidates},
        "training_components": len(x_train), "training_positives": int(y_train.sum()),
        "validation": metrics(y_val, scores, threshold),
        "test": metrics(y_test, model.predict_proba(x_test)[:, 1], threshold),
        "train_lots": lots["train"], "tuning_lots": lots["validation_tune"], "test_lots": lots["test"],
    }
    artifact = {**report, "model": json.loads(model.get_booster().save_raw(raw_format="json"))}
    return artifact


def predict(records, artifact):
    matrix = early_features(records)
    eligible = matrix.notna().all(axis=1)
    result = pd.DataFrame({"status": "INSUFFICIENT_HISTORY", "score": np.nan}, index=matrix.index)
    if eligible.any():
        booster = xgb.Booster()
        booster.load_model(bytearray(json.dumps(artifact["model"]), "utf-8"))
        scores = booster.predict(xgb.DMatrix(matrix.loc[eligible]))
        result.loc[eligible, "score"] = scores
        result.loc[eligible, "status"] = np.where(scores >= artifact["threshold"], "FLAG", "BELOW_THRESHOLD")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    train_cmd = commands.add_parser("train")
    train_cmd.add_argument("--output", type=Path, required=True)
    score_cmd = commands.add_parser("score")
    score_cmd.add_argument("csv", type=Path)
    score_cmd.add_argument("--model", type=Path, default=ARTIFACT)
    args = parser.parse_args()
    if args.command == "train":
        artifact = train()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(artifact, allow_nan=False, separators=(",", ":")) + "\n")
        print(json.dumps({k: v for k, v in artifact.items() if k != "model"}, indent=2))
    else:
        result = predict(pd.read_csv(args.csv), json.loads(args.model.read_text()))
        print(result.to_csv(), end="")


if __name__ == "__main__":
    main()
