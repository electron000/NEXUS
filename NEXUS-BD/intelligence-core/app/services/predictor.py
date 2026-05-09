"""
app/services/predictor.py

Loads the user-provided price and tier models and provides predictions
based on extracted domain features.
"""

import os
import pickle
from pathlib import Path
import numpy as np
from app.config import settings
from app.services.features import extract
from app.utils.logger import logger

_price_model = None
_tier_model = None

_PRICE_MODEL_FILE = Path(settings.model_path) / "price_model.pkl"
_TIER_MODEL_FILE = Path(settings.model_path) / "tier_model.pkl"

def load_models():
    """Initialise the user's pkl models."""
    global _price_model, _tier_model
    
    try:
        if _PRICE_MODEL_FILE.exists():
            with open(_PRICE_MODEL_FILE, "rb") as f:
                _price_model = pickle.load(f)
            logger.info(f"Price model loaded from {_PRICE_MODEL_FILE}")
        else:
            logger.warning(f"Price model not found at {_PRICE_MODEL_FILE}")

        if _TIER_MODEL_FILE.exists():
            with open(_TIER_MODEL_FILE, "rb") as f:
                _tier_model = pickle.load(f)
            logger.info(f"Tier model loaded from {_TIER_MODEL_FILE}")
        else:
            logger.warning(f"Tier model not found at {_TIER_MODEL_FILE}")
    except Exception as e:
        logger.error(f"Error loading models: {e}")

def predict_valuation(domain: str) -> dict:
    """
    Predict price and tier using the provided models.
    Features: [length, vowel_ratio, has_number, tld_score, keyword_score, brand_score]
    """
    feats = extract(domain)
    
    # Map features to the model's expected input vector
    input_vector = np.array([[
        feats["length"],
        feats["vowel_ratio"],
        1.0 if feats["digit_ratio"] > 0 else 0.0, # has_number
        feats["tld_score"],
        feats["has_power_keyword"], # keyword_score
        feats["alt_score"],         # brand_score
    ]])

    results = {
        "predicted_price": 0.0,
        "predicted_tier": "low",
        "tier_value": 0.0
    }

    if _price_model:
        try:
            price = float(_price_model.predict(input_vector)[0])
            results["predicted_price"] = round(price, 2)
        except Exception as e:
            logger.error(f"Price prediction error: {e}")

    if _tier_model:
        try:
            tier_val = float(_tier_model.predict(input_vector)[0])
            results["tier_value"] = tier_val
            if tier_val >= 0.75:
                results["predicted_tier"] = "high"
            elif tier_val >= 0.35:
                results["predicted_tier"] = "medium"
            else:
                results["predicted_tier"] = "low"
        except Exception as e:
            logger.error(f"Tier prediction error: {e}")

    return results
