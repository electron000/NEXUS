import os
import pickle
from pathlib import Path
import numpy as np
import pandas as pd
from app.config import settings
from app.services.features import extract
from app.utils.logger import logger

_price_model = None
_tier_model = None

_PRICE_MODEL_FILE = Path(settings.model_path) / "price_model.pkl"
_TIER_MODEL_FILE  = Path(settings.model_path) / "tier_model.pkl"

def load_models():
    """Initialise the user's pkl models."""
    global _price_model, _tier_model
    try:
        if _TIER_MODEL_FILE.exists():
            with open(_TIER_MODEL_FILE, "rb") as f:
                _tier_model = pickle.load(f)
            logger.info("Tier model loaded successfully.")
        else:
            logger.warning(f"Tier model not found at {_TIER_MODEL_FILE}")

        if _PRICE_MODEL_FILE.exists():
            with open(_PRICE_MODEL_FILE, "rb") as f:
                _price_model = pickle.load(f)
            logger.info("Price model loaded successfully.")
        else:
            logger.warning(f"Price model not found at {_PRICE_MODEL_FILE}")
    except Exception as e:
        logger.error(f"Failed to load models: {e}", exc_info=True)


def predict_valuation(domain: str) -> dict:
    """
    Predict price, tier, and model_score using the provided models.
    """
    feats = extract(domain)

    # CRITICAL: This exact order must match the array columns used during model.fit()
    input_df = pd.DataFrame([{
        "length": feats["length"],
        "vowel_ratio": feats["vowel_ratio"],
        "has_number": feats["has_number"],
        "tld_score": feats["tld_score"],
        "keyword_score": feats["keyword_score"], 
        "brand_score": feats["brand_score"], 
    }])

    results = {
        "predicted_price": 0.0,
        "predicted_tier":  "low",
        "tier_value":      0.0,
        "model_score":     0.0, 
    }

    # ── Step 1: tier model ───────────────────────────────────────────────────
    tier_val = 0.0
    if _tier_model:
        try:
            # Reinstated .values to pass a raw numpy array, matching the fitted model state
            raw_prediction = _tier_model.predict(input_df.values)[0]

            if isinstance(raw_prediction, str):
                tier_mapping = {"low": 0.0, "medium": 0.5, "high": 1.0}
                tier_val = tier_mapping.get(raw_prediction.lower(), 0.0)
            else:
                tier_val = float(raw_prediction)

            results["tier_value"] = tier_val

            # Adjusted tertile thresholds 
            if tier_val >= 0.68:
                results["predicted_tier"] = "high"
            elif tier_val >= 0.42:
                results["predicted_tier"] = "medium"
            else:
                results["predicted_tier"] = "low"

            results["model_score"] = round(float(np.clip(tier_val * 100, 0.0, 100.0)), 2)
        except Exception as e:
            logger.error(f"Tier prediction error for {domain}: {e}", exc_info=True)

    # ── Step 2: price model ──────────────────────────────────────────────────
    if _price_model:
        try:
            price_input_df = input_df.copy()
            price_input_df["tier"] = tier_val 
            
            # Reinstated .values here as well
            price = float(_price_model.predict(price_input_df.values)[0])
            results["predicted_price"] = round(max(0.0, price), 2)
        except Exception as e:
            logger.error(f"Price prediction error for {domain}: {e}", exc_info=True)

    return results