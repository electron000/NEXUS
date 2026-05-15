# NEXUS ML Model Testing & Training Guide 🧪

This document outlines the testing methodology and training workflows for the NEXUS Intelligence Core's RandomForest valuation models.

---

## 📐 Testing Methodology

We use a multi-tiered approach to ensure the model remains accurate and generalizes well to unseen domains.

### 1. Basic Evaluation
- **Purpose**: A quick "sanity check" to see how the current live model performs against the reference dataset.
- **Logic**: Runs the existing `.pkl` models (`tier_model.pkl`, `price_model.pkl`) against domains in the training CSV and reports metrics.

### 2. Train-Test Split
- **Purpose**: The "Production Gold Standard" test.
- **Logic**:
    1.  Shuffles the dataset.
    2.  Splits it into **80% Training** and **20% Testing**.
    3.  Trains a *temporary* model on the 80%.
    4.  Tests that model on the 20% it has **never seen**.
- **Result**: This provides the most realistic "Closeness Accuracy" score.

### 3. Production Deployment
- **Purpose**: Updates the live application.
- **Logic**: Trains on **100%** of the available data and overwrites `models/price_model.pkl` and `models/tier_model.pkl`.

---

## 📊 Understanding the Metrics

| Metric | What it tells you | Goal |
| :--- | :--- | :--- |
| **Tier Accuracy** | How often the model correctly predicts low/medium/high. | **> 85%** |
| **Price MAE** | Mean Absolute Error for price prediction (in INR). | **< 5000** |
| **R-squared** | How much of the price variance is explained by the model. | **> 0.60** |

---

## 🧠 Technical Details

### Model Architecture
- **Tier Model**: RandomForest Regressor predicting a 0–1 continuous "quality score".
- **Price Model**: RandomForest Regressor predicting raw price, using the tier score as an additional input feature.

### Feature Set
1.  **Length**: Character count of the SLD.
2.  **Vowel Ratio**: Pronounceability indicator.
3.  **Has Number**: Binary flag for digits in the domain.
4.  **TLD Score**: Desirability weight of the extension.
5.  **Keyword Score**: Heuristic based on industry keywords.
6.  **Brand Score**: Phonetic quality (vowel-consonant alternation).
7.  **Age (Price Model Only)**: Domain age in years (fetched via WHOIS).
