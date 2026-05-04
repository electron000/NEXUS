import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import pickle
from sklearn.metrics import mean_absolute_error, r2_score
from scipy.stats import pearsonr

# Add parent directory to sys.path to import app
sys.path.append(str(Path(__file__).parent.parent))

from app.services.features import extract

def evaluate():
    # Paths
    base_dir = Path(__file__).parent.parent
    model_path = base_dir / "models" / "quantitative_baseline.pkl"
    data_path = base_dir / "data" / "nexus_domain_india_4000.csv"

    print(f"Loading model from {model_path}...")
    if not model_path.exists():
        print("Model file not found! Please run the app first to generate/load the model.")
        return

    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except Exception as e:
        print(f"Error loading data: {e}")
        return

    print(f"Extracting features for {len(df)} domains...")
    # Map features to the order expected by the model
    feat_order = [
        "length", "vowel_ratio", "digit_ratio", "hyphen_count",
        "uniqueness", "alt_score", "tld_score", "has_power_keyword", "max_repeat",
    ]

    X = []
    y_true_price = []
    
    for _, row in df.iterrows():
        feats = extract(row['domain'])
        X.append([feats[k] for k in feat_order])
        y_true_price.append(row['price'])

    X = np.array(X)
    y_true_price = np.array(y_true_price)

    # Normalize price to a 0-100 score for comparison
    # Domain prices are often power-law distributed, so use log scale
    log_prices = np.log10(y_true_price)
    min_log = np.log10(min(y_true_price))
    max_log = np.log10(max(y_true_price))
    
    # Scale log_price to 10-95 like the model's target range in scorer.py
    y_true_score = 10 + (log_prices - min_log) / (max_log - min_log) * 85

    print("Running predictions...")
    try:
        y_pred = model.predict(X)
        y_pred = np.clip(y_pred, 0, 100)
    except Exception as e:
        print(f"Error during prediction: {e}")
        return

    # Metrics
    mae = mean_absolute_error(y_true_score, y_pred)
    r2 = r2_score(y_true_score, y_pred)
    corr, _ = pearsonr(y_true_score, y_pred)
    
    # Calculate "Closeness Accuracy" as a percentage (100% - normalized error)
    # This represents how close the model's score is to the target on average.
    closeness_accuracy = max(0, 100 - mae)

    print("\n" + "="*30)
    print("MODEL EVALUATION SUMMARY")
    print("="*30)
    print(f"Total Samples:      {len(df)}")
    print(f"Closeness Accuracy: {closeness_accuracy:.2f}%")
    print(f"Correlation:        {corr:.4f}")
    print(f"Mean Absolute Error: {mae:.4f}")
    print("="*30)

    # Breakdown by tier
    df['pred_score'] = y_pred
    df['true_score'] = y_true_score
    
    print("\nPerformance by Tier:")
    tier_summary = df.groupby('tier').agg({
        'true_score': 'mean',
        'pred_score': 'mean',
        'domain': 'count'
    }).rename(columns={'domain': 'count'})
    
    # Reorder tiers for logical display
    tier_order = ['low', 'medium', 'high']
    tier_summary = tier_summary.reindex(tier_order)
    print(tier_summary)

if __name__ == "__main__":
    evaluate()
