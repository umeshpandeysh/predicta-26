"""
PREDICTA-26 — AETHER-Parity ML Challenger Experiment
READ-ONLY benchmark experiment: does not modify production artifacts.

Protocol:
- Reconstructs the current authoritative v4 lot-held-out split (seed=42).
- Uses train only for fitting.
- Uses validation only for model/threshold selection.
- Uses locked test exactly once for the selected challenger.
- Objective: minimize validation FPR subject to recall >= 97%.
- Reports the selected model's frozen-threshold test metrics and a Pareto table.
"""

from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from src.features.feature_contract import (
    ALL_28_FEATURE_NAMES,
    compute_engineered_features_df,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v4_production.csv"
OUT = ROOT / "ml" / "experiments" / "AETHER_PARITY"


def split(df: pd.DataFrame):
    gss = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=42)
    trv_i, te_i = next(gss.split(df, groups=df["lot_id"]))
    trv, test = df.iloc[trv_i].copy(), df.iloc[te_i].copy()
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.1765, random_state=42)
    tr_i, va_i = next(gss2.split(trv, groups=trv["lot_id"]))
    train, val = trv.iloc[tr_i].copy(), trv.iloc[va_i].copy()
    assert set(train.lot_id).isdisjoint(val.lot_id)
    assert set(train.lot_id).isdisjoint(test.lot_id)
    assert set(val.lot_id).isdisjoint(test.lot_id)
    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)


def make_features(df: pd.DataFrame, expanded: bool) -> pd.DataFrame:
    x = compute_engineered_features_df(df.copy())
    if expanded:
        # Deterministic physics-derived features available at the same screening point.
        x["effective_drive_current"] = x["current"] - (x["leakage_current"] * 1e-3)
        x["rc_delay"] = x["resistance"] * x["capacitance"] * 1e-3
        x["timing_slack"] = x["timing_margin"] - x["setup_time"] - x["hold_time"]
        x["dynamic_power_per_freq"] = x["dynamic_power"] / np.maximum(x["frequency"], 1e-6)
        x["leakage_temperature_interaction"] = (x["leakage_current"] * 1e-3) * x["temperature"]
        cols = list(ALL_28_FEATURE_NAMES) + [
            "effective_drive_current", "rc_delay", "timing_slack",
            "dynamic_power_per_freq", "leakage_temperature_interaction",
        ]
    else:
        cols = list(ALL_28_FEATURE_NAMES)
    return x[cols].astype(float)


def metrics(y, p, th):
    pred = (p >= th).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "threshold": float(th),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "fpr": float(fp / max(fp + tn, 1)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def select_threshold(y, p):
    # Frozen validation-only policy: minimum FPR at >=97% recall.
    best = None
    for th in np.linspace(0.01, 0.99, 197):
        m = metrics(y, p, float(th))
        if m["recall"] >= 0.97:
            if best is None or (m["fpr"], -m["precision"], -m["f1"]) < (
                best["fpr"], -best["precision"], -best["f1"]
            ):
                best = m
    if best is None:
        candidates = [metrics(y, p, float(t)) for t in np.linspace(0.01, 0.99, 197)]
        best = max(candidates, key=lambda m: (m["recall"], -m["fpr"]))
    return best


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(DATA)
    train, val, test = split(df)

    ytr = (train["result"] == "FAIL").astype(int).to_numpy()
    yv = (val["result"] == "FAIL").astype(int).to_numpy()
    yt = (test["result"] == "FAIL").astype(int).to_numpy()

    configs = []
    for expanded in (False, True):
        for depth in (3, 4, 5):
            for n_estimators in (300, 500):
                configs.append({
                    "expanded": expanded,
                    "max_depth": depth,
                    "n_estimators": n_estimators,
                    "learning_rate": 0.04,
                    "subsample": 0.90,
                    "colsample_bytree": 0.90,
                    "min_child_weight": 2,
                    "reg_lambda": 2.0,
                })

    rows = []
    trained = []
    Xtr_base = make_features(train, False)
    Xv_base = make_features(val, False)
    Xt_base = make_features(test, False)
    Xtr_exp = make_features(train, True)
    Xv_exp = make_features(val, True)
    Xt_exp = make_features(test, True)

    scale_pos_weight = max(float((ytr == 0).sum() / max((ytr == 1).sum(), 1)), 1.0)

    for i, cfg in enumerate(configs, 1):
        Xtr, Xv = (Xtr_exp, Xv_exp) if cfg["expanded"] else (Xtr_base, Xv_base)
        model = xgb.XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=2,
            tree_method="hist",
            scale_pos_weight=scale_pos_weight,
            **{k: v for k, v in cfg.items() if k != "expanded"},
        )
        model.fit(Xtr, ytr, eval_set=[(Xv, yv)], verbose=False)
        pv = model.predict_proba(Xv)[:, 1]
        sel = select_threshold(yv, pv)
        auc = roc_auc_score(yv, pv)
        ap = average_precision_score(yv, pv)
        row = {**cfg, **{f"val_{k}": v for k, v in sel.items()}, "val_roc_auc": auc, "val_pr_auc": ap}
        rows.append(row)
        trained.append((row, model))
        print(f"[{i:02d}/{len(configs)}] expanded={cfg['expanded']} depth={cfg['max_depth']} trees={cfg['n_estimators']} "
              f"val recall={sel['recall']:.4f} fpr={sel['fpr']:.4f} prec={sel['precision']:.4f}")

    results = pd.DataFrame(rows)
    feasible = results[results["val_recall"] >= 0.97]
    if not feasible.empty:
        chosen_row = feasible.sort_values(
            ["val_fpr", "val_precision", "val_f1", "val_pr_auc"],
            ascending=[True, False, False, False],
        ).iloc[0]
    else:
        chosen_row = results.sort_values(
            ["val_recall", "val_fpr", "val_pr_auc"],
            ascending=[False, True, False],
        ).iloc[0]

    chosen = next(pair for pair in trained if pair[0]["expanded"] == bool(chosen_row["expanded"])
                  and pair[0]["max_depth"] == int(chosen_row["max_depth"])
                  and pair[0]["n_estimators"] == int(chosen_row["n_estimators"]))
    chosen_cfg, model = chosen
    Xtest = Xt_exp if chosen_cfg["expanded"] else Xt_base
    pt = model.predict_proba(Xtest)[:, 1]
    test_m = metrics(yt, pt, float(chosen_cfg["val_threshold"]))
    test_m["roc_auc"] = float(roc_auc_score(yt, pt))
    test_m["pr_auc"] = float(average_precision_score(yt, pt))
    test_m["n"] = int(len(yt))
    test_m["defects"] = int(yt.sum())
    test_m["normal"] = int((yt == 0).sum())

    report = {
        "protocol": {
            "test_tuning": False,
            "selection_rule": "min validation FPR subject to validation recall >= 97%; test evaluated once",
            "group_split": True,
            "seed": 42,
        },
        "split_sizes": {"train": len(train), "validation": len(val), "test": len(test)},
        "split_lots": {
            "train": sorted(train.lot_id.unique().tolist()),
            "validation": sorted(val.lot_id.unique().tolist()),
            "test": sorted(test.lot_id.unique().tolist()),
        },
        "baseline_reference": {
            "current_authoritative_recall": 0.9462,
            "current_authoritative_fpr": 0.6462,
        },
        "selected": chosen_cfg,
        "validation_selected_metrics": {k: chosen_cfg[f"val_{k}"] for k in ("threshold","recall","fpr","precision","f1")},
        "test_metrics": test_m,
        "all_validation_candidates": rows,
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    results.to_csv(OUT / "validation_candidates.csv", index=False)
    print("\n=== SELECTED CHALLENGER ===")
    print(json.dumps({"selected": chosen_cfg, "test_metrics": test_m}, indent=2))
    print(f"Artifacts: {OUT}")


if __name__ == "__main__":
    main()
