"""
Train an XGBoost model on real horse racing data.

Reads:
  data/raw/all_races_combined.csv   – individual race results
  data/raw/unique_horses.csv        – per-horse summaries

Outputs:
  server/data/model.json            – XGBoost model in JSON (consumed by TS runtime)
  server/data/feature_config.json   – ordered feature names + encodings
  server/data/training_report.json  – metrics, feature importances

Usage:
  cd <project_root>
  pip install -r scripts/ml/requirements.txt
  python scripts/ml/train_xgboost.py
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import KFold, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "server" / "data"

RACES_CSV = RAW_DIR / "all_races_combined.csv"
HORSES_CSV = RAW_DIR / "unique_horses.csv"


# ── 1. Load & clean ──────────────────────────────────────────────────────────

def load_data():
    races = pd.read_csv(RACES_CSV)
    horses = pd.read_csv(HORSES_CSV)

    races["position"] = pd.to_numeric(races["position"], errors="coerce")
    races["prize"] = pd.to_numeric(races["prize"], errors="coerce").fillna(0)
    races["official_rating"] = pd.to_numeric(races["official_rating"], errors="coerce")
    races["sp_dec"] = pd.to_numeric(races["sp_dec"], errors="coerce")
    races["weight_carried_lbs"] = pd.to_numeric(races["weight_carried_lbs"], errors="coerce")
    races["number_of_runners"] = pd.to_numeric(races["number_of_runners"], errors="coerce")
    races["age"] = pd.to_numeric(races["age"], errors="coerce")

    races["distance_furlongs_num"] = races["distance_furlongs"].apply(parse_furlongs)

    horses["total_prize"] = pd.to_numeric(horses["total_prize"], errors="coerce").fillna(0)
    horses["peak_official_rating"] = pd.to_numeric(horses["peak_official_rating"], errors="coerce")
    horses["wins"] = pd.to_numeric(horses["wins"], errors="coerce").fillna(0)
    horses["total_runs"] = pd.to_numeric(horses["total_runs"], errors="coerce").fillna(0)

    return races, horses


def parse_furlongs(val):
    """Convert '5f', '1m2f', '11.5f' etc. to numeric furlongs."""
    if pd.isna(val):
        return np.nan
    s = str(val).strip().lower()
    try:
        return float(s.replace("f", ""))
    except ValueError:
        return np.nan


# ── 2. Feature engineering ────────────────────────────────────────────────────

def engineer_features(races: pd.DataFrame, horses: pd.DataFrame) -> pd.DataFrame:
    valid_races = races.dropna(subset=["position"]).copy()

    valid_races["won"] = (valid_races["position"] == 1).astype(int)
    valid_races["placed"] = (valid_races["position"] <= 3).astype(int)
    valid_races["norm_position"] = valid_races["position"] / valid_races["number_of_runners"].clip(lower=1)

    agg = valid_races.groupby("horse_id").agg(
        race_count=("position", "size"),
        win_count=("won", "sum"),
        place_count=("placed", "sum"),
        avg_position=("position", "mean"),
        std_position=("position", "std"),
        best_position=("position", "min"),
        worst_position=("position", "max"),
        avg_norm_position=("norm_position", "mean"),
        avg_field_size=("number_of_runners", "mean"),
        avg_sp=("sp_dec", "mean"),
        min_sp=("sp_dec", "min"),
        avg_weight=("weight_carried_lbs", "mean"),
        avg_distance=("distance_furlongs_num", "mean"),
        std_distance=("distance_furlongs_num", "std"),
        total_prize_races=("prize", "sum"),
        avg_prize=("prize", "mean"),
        max_prize=("prize", "max"),
        avg_official_rating=("official_rating", "mean"),
        max_official_rating=("official_rating", "max"),
        age_last=("age", "max"),
    ).reset_index()

    agg["win_rate"] = agg["win_count"] / agg["race_count"].clip(lower=1)
    agg["place_rate"] = agg["place_count"] / agg["race_count"].clip(lower=1)
    agg["std_position"] = agg["std_position"].fillna(0)
    agg["std_distance"] = agg["std_distance"].fillna(0)

    class_map = {
        "Class 1": 1, "Class 2": 2, "Class 3": 3,
        "Class 4": 4, "Class 5": 5, "Class 6": 6,
    }
    valid_races["class_num"] = valid_races["race_class"].map(class_map)
    class_agg = valid_races.dropna(subset=["class_num"]).groupby("horse_id").agg(
        avg_class=("class_num", "mean"),
        best_class=("class_num", "min"),
    ).reset_index()
    agg = agg.merge(class_agg, on="horse_id", how="left")
    agg["avg_class"] = agg["avg_class"].fillna(5.0)
    agg["best_class"] = agg["best_class"].fillna(6.0)

    going_dummies = pd.crosstab(valid_races["horse_id"], valid_races["going"], normalize="index")
    going_cols = []
    for g in ["Firm", "Good", "Good to Firm", "Good to Soft", "Soft", "Heavy", "Yielding"]:
        col_name = f"going_pct_{g.lower().replace(' ', '_')}"
        going_cols.append(col_name)
        agg[col_name] = agg["horse_id"].map(going_dummies.get(g, pd.Series(dtype=float))).fillna(0)

    surface_dummies = pd.crosstab(valid_races["horse_id"], valid_races["surface"], normalize="index")
    for s in ["Turf", "All Weather"]:
        col_name = f"surface_pct_{s.lower().replace(' ', '_')}"
        agg[col_name] = agg["horse_id"].map(surface_dummies.get(s, pd.Series(dtype=float))).fillna(0)

    df = horses.merge(agg, on="horse_id", how="inner")

    sex_map = {"C": 0, "F": 1, "G": 2, "H": 3, "M": 4, "R": 5}
    df["sex_encoded"] = df["sex"].map(sex_map).fillna(2)

    sire_counts = df["sire"].value_counts()
    sire_freq_threshold = 5
    common_sires = sire_counts[sire_counts >= sire_freq_threshold].index
    df["sire_group"] = df["sire"].where(df["sire"].isin(common_sires), "OTHER")
    sire_encoder = LabelEncoder()
    df["sire_encoded"] = sire_encoder.fit_transform(df["sire_group"])

    damsire_counts = df["damsire"].value_counts()
    common_damsires = damsire_counts[damsire_counts >= sire_freq_threshold].index
    df["damsire_group"] = df["damsire"].where(df["damsire"].isin(common_damsires), "OTHER")
    damsire_encoder = LabelEncoder()
    df["damsire_encoded"] = damsire_encoder.fit_transform(df["damsire_group"])

    sire_target_enc = df.groupby("sire_group")["total_prize"].mean()
    df["sire_avg_prize"] = df["sire_group"].map(sire_target_enc)
    damsire_target_enc = df.groupby("damsire_group")["total_prize"].mean()
    df["damsire_avg_prize"] = df["damsire_group"].map(damsire_target_enc)

    return df, sire_encoder, damsire_encoder, sire_target_enc.to_dict(), damsire_target_enc.to_dict()


# ── 3. Select features & target ──────────────────────────────────────────────

FEATURE_COLS = [
    "race_count", "win_count", "place_count",
    "avg_position", "std_position", "best_position", "worst_position",
    "avg_norm_position", "avg_field_size",
    "avg_sp", "min_sp",
    "avg_weight",
    "avg_distance", "std_distance",
    "avg_official_rating", "max_official_rating",
    "age_last",
    "win_rate", "place_rate",
    "avg_class", "best_class",
    "going_pct_firm", "going_pct_good", "going_pct_good_to_firm",
    "going_pct_good_to_soft", "going_pct_soft",
    "surface_pct_turf",
    "sex_encoded",
    "sire_encoded", "damsire_encoded",
    "sire_avg_prize", "damsire_avg_prize",
]

TARGET_COL = "total_prize"


# ── 4. Train ─────────────────────────────────────────────────────────────────

def train(df: pd.DataFrame):
    X = df[FEATURE_COLS].copy()
    y = df[TARGET_COL].copy()

    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")
    X = X.fillna(0)

    mask = y > 0
    X_pos = X[mask]
    y_pos = y[mask]
    print(f"Training samples (prize > 0): {len(X_pos)} / {len(X)} total")

    y_log = np.log1p(y_pos)

    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 5,
        "reg_alpha": 1.0,
        "reg_lambda": 5.0,
        "n_estimators": 500,
        "random_state": 42,
    }

    model = xgb.XGBRegressor(**params)

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X_pos, y_log, cv=kf, scoring="r2")
    print(f"\nCross-validation R² scores: {cv_scores}")
    print(f"Mean CV R²: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    model.fit(X_pos, y_log, verbose=False)

    y_pred_log = model.predict(X_pos)
    y_pred = np.expm1(y_pred_log)
    y_actual = y_pos.values

    mae = mean_absolute_error(y_actual, y_pred)
    r2 = r2_score(y_actual, y_pred)
    median_ae = np.median(np.abs(y_actual - y_pred))

    print(f"\nFull training set metrics:")
    print(f"  MAE:       £{mae:,.0f}")
    print(f"  Median AE: £{median_ae:,.0f}")
    print(f"  R²:        {r2:.4f}")

    importances = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print(f"\nTop 15 feature importances:")
    for feat, imp in sorted_imp[:15]:
        print(f"  {feat:30s} {imp:.4f}")

    metrics = {
        "cv_r2_mean": float(cv_scores.mean()),
        "cv_r2_std": float(cv_scores.std()),
        "cv_r2_scores": cv_scores.tolist(),
        "train_mae": float(mae),
        "train_median_ae": float(median_ae),
        "train_r2": float(r2),
        "n_samples_total": int(len(X)),
        "n_samples_train": int(len(X_pos)),
        "n_features": len(FEATURE_COLS),
    }

    return model, importances, metrics


# ── 5. Export ─────────────────────────────────────────────────────────────────

def export_model(model, importances, metrics, sire_enc, damsire_enc,
                 sire_target_enc, damsire_target_enc):
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    model_path = OUT_DIR / "model.json"
    model.save_model(str(model_path))
    print(f"\nModel saved to {model_path}")

    sire_classes = sire_enc.classes_.tolist()
    damsire_classes = damsire_enc.classes_.tolist()

    config = {
        "features": FEATURE_COLS,
        "target": TARGET_COL,
        "target_transform": "log1p",
        "sex_map": {"C": 0, "F": 1, "G": 2, "H": 3, "M": 4, "R": 5},
        "sire_classes": sire_classes,
        "damsire_classes": damsire_classes,
        "sire_target_encoding": {k: float(v) for k, v in sire_target_enc.items()},
        "damsire_target_encoding": {k: float(v) for k, v in damsire_target_enc.items()},
        "sire_freq_threshold": 5,
    }
    config_path = OUT_DIR / "feature_config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"Feature config saved to {config_path}")

    report = {
        **metrics,
        "feature_importances": importances,
    }
    report_path = OUT_DIR / "training_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Training report saved to {report_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Loading data...")
    races, horses = load_data()
    print(f"  Races: {len(races):,} rows")
    print(f"  Horses: {len(horses):,} rows")

    print("\nEngineering features...")
    df, sire_enc, damsire_enc, sire_te, damsire_te = engineer_features(races, horses)
    print(f"  Joined dataset: {len(df):,} rows × {len(df.columns)} cols")

    print("\nTraining XGBoost model...")
    model, importances, metrics = train(df)

    print("\nExporting model artifacts...")
    export_model(model, importances, metrics, sire_enc, damsire_enc, sire_te, damsire_te)

    print("\n✓ Pipeline complete.")


if __name__ == "__main__":
    main()
