import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from scipy.stats import pearsonr

# Add parent directory to sys.path to import app
sys.path.append(str(Path(__file__).parent.parent))

from app.services.features import extract

def run_train_test_split():
    base_dir = Path(__file__).parent.parent
    data_path = base_dir / "data" / "nexus_domain_india_4000.csv"

    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except Exception as e:
        print(f"Error loading data: {e}")
        return

    print(f"Extracting features for {len(df)} domains...")
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

    # Log-scale target normalization (Standardizing Price -> 10-95 Score)
    log_prices = np.log10(y_price)
    min_log, max_log = np.log10(y_price.min()), np.log10(y_price.max())
    y_score = 10 + (log_prices - min_log) / (max_log - min_log) * 85

    # Split: 80% Train (to learn), 20% Test (to prove it learned)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_score, test_size=0.2, random_state=42
    )

    print(f"Step 1: Training model on {len(X_train)} domains...")
    # Using production hyperparams from app/services/scorer.py
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        tree_method="hist",
    )
    model.fit(X_train, y_train)

    print(f"Step 2: Evaluating on {len(X_test)} HIDDEN domains...")
    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 0, 100)

    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    corr, _ = pearsonr(y_test, y_pred)
    closeness = max(0, 100 - mae)

    print("\n" + "="*45)
    print("TRAIN-TEST SPLIT EVALUATION RESULTS")
    print("="*45)
    print(f"Dataset Split:      80% Train / 20% Test")
    print(f"Training Size:      {len(X_train)} domains")
    print(f"Hidden Test Size:   {len(X_test)} domains")
    print("-" * 45)
    print(f"Closeness Accuracy: {closeness:.2f}%")
    print(f"Correlation (R):     {corr:.4f}")
    print(f"Mean Absolute Error: {mae:.4f}")
    print(f"R-squared Score:     {r2:.4f}")
    print("="*45)
    
    print("\n[REALITY CHECK]")
    print(f"This model has never seen the {len(X_test)} domains in the test set.")
    print(f"The {closeness:.2f}% accuracy is a realistic prediction of how")
    print("well the model will perform on new domains in the wild.")

if __name__ == "__main__":
    run_train_test_split()
