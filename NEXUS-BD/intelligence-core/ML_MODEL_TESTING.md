# NEXUS ML Model Testing & Training Guide 🧪

This document outlines the testing methodology and training workflows for the NEXUS Intelligence Core's XGBoost valuation model.

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

### 3. Production Deployment (`train_production_model.py`)
- **Purpose**: Updates the live application.
*   **Logic**: Trains on **100%** of the available data and overwrites `models/quantitative_baseline.pkl`.

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
python scripts/train_test_eval.py
```

### To update the live model with new data:
```powershell
python scripts/train_production_model.py
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
