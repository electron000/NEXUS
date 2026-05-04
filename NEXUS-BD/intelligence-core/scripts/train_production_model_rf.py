import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import pickle

# Add parent directory to sys.path to import app
sys.path.append(str(Path(__file__).parent.parent))

from app.services.features import extract

def train_production_model_rf():
    base_dir = Path(__file__).parent.parent
    data_path = base_dir / "data" / "nexus_domain_india_4000.csv"
    model_path = base_dir / "models" / "rf_quantitative_baseline.pkl"

    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except Exception as e:
        print(f"Error loading data: {e}")
        return

    print(f"Extracting features for all {len(df)} domains...")
    feat_order = [
        "length", "vowel_ratio", "digit_ratio", "hyphen_count",
        "uniqueness", "alt_score", "tld_score", "has_power_keyword", "max_repeat",
    ]

    X = []
    y_price = []
    for _, row in df.iterrows():
        feats = extract(row['domain'])
        X.append([feats[k] for k in feat_order])
        y_price.append(row['price'])

    X = np.array(X)
    y_price = np.array(y_price)

    # Log-scale target normalization
    log_prices = np.log10(y_price)
    min_log, max_log = np.log10(y_price.min()), np.log10(y_price.max())
    y_score = 10 + (log_prices - min_log) / (max_log - min_log) * 85

    print(f"Training PRODUCTION Random Forest model on full dataset...")
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X, y_score)

    print(f"Saving Random Forest model to {model_path}...")
    model_path.parent.mkdir(parents=True, exist_ok=True)
    with open(model_path, "wb") as f:
        pickle.dump(model, f)

    print("\n" + "="*45)
    print("SUCCESS: RANDOM FOREST PRODUCTION MODEL UPDATED")
    print("="*45)

if __name__ == "__main__":
    train_production_model_rf()
