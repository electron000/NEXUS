# NEXUS ML Model Testing & Training Guide 🧪

This document outlines the testing methodology and training workflows for the NEXUS Intelligence Core's **Dual-Model Ensemble** (XGBoost + Random Forest).

---

## 📐 Testing Methodology

We use a multi-tiered approach to ensure the model remains accurate and generalizes well to unseen domains.

### 1. Basic Evaluation (`evaluate_model.py`)
- **Purpose**: A quick "sanity check" to see how the current live model performs against the reference dataset.
*   **Logic**: Runs the existing `.pkl` model against all domains in `data/nexus_domain_india_4000.csv` and reports the error.

### 2. Train-Test Split (`train_test_eval.py`)
- **Purpose**: The "Production Gold Standard" test.
*   **Logic**:
    1.  Shuffles the dataset.
    2.  Splits it into **80% Training** and **20% Testing**.
    3.  Trains a *temporary* model on the 80%.
    4.  Tests that model on the 20% it has **never seen**.
*   **Result**: This provides the most realistic "Closeness Accuracy" score (currently **~91%**).

### 3. Model Comparison (`evaluate_models_comparison.py`)
- **Purpose**: Directly compares the performance of XGBoost vs. Random Forest on the same dataset.
- **Logic**: Loads both persisted models and reports side-by-side metrics.

### 4. Ensemble Performance (`test_ensemble.py`)
- **Purpose**: Proves the mathematical benefit of combining models.
- **Result**: Confirms a ~1% R² improvement when using the average of both models.

### 5. Production Deployment
- **Scripts**: 
    - `train_production_model.py` (XGBoost)
    - `train_production_model_rf.py` (Random Forest)
- **Logic**: Trains on **100%** of data and overwrites the production `.pkl` files in `models/`.

---

## 📊 Understanding the Metrics

| Metric | What it tells you | Goal |
| :--- | :--- | :--- |
| **Closeness Accuracy** | How close the score (0-100) is to the target value. | **> 85%** |
| **Correlation (R)** | Does the score go up when the price goes up? | **> 0.60** |
| **MAE** | Mean Absolute Error. The average "points" we are off by. | **< 15.0** |
| **R-squared** | How much of the price variance is explained by the model. | **> 0.40** |

---

## 🧪 How to Run Tests

Ensure you are in the `intelligence-core` directory:

### To run a realistic accuracy test:
```powershell
python scripts/train_test_eval.py        # XGBoost only
python scripts/train_test_comparison.py  # Side-by-side split test
python scripts/test_ensemble.py           # Combined accuracy test
```

### To update the live models with new data:
```powershell
python scripts/train_production_model.py
python scripts/train_production_model_rf.py
```

---

## 🧠 Technical Details

### Target Normalization
Since domains are priced exponentially (e.g., $500 vs $50,000), we don't predict raw prices. Instead, we use a **Logarithmic Scale** to normalize prices into a **0–100 Score**.
- This ensures the model treats the difference between $100 and $200 with the same significance as $10,000 and $20,000.

### Feature Set
The model makes decisions based on:
1.  **Length**: Short domains (4-8 chars) get premiums.
2.  **Linguistic Balance**: Vowel-to-consonant ratios and alternating patterns (pronounceability).
3.  **TLD Authority**: Extensions like `.com`, `.io`, and `.ai` have higher weight.
4.  **Keyword Signals**: Presence of high-value industry roots (e.g., `pay`, `cloud`, `lab`).
