"""
app/services/scorer.py

Orchestrates all three scoring components and exposes:
  - warm_up()          called at startup to initialise models
  - score_domain()     main public interface
"""

from __future__ import annotations
import asyncio
import os
import pickle
from pathlib import Path

import numpy as np

from app.config import settings
from app.services.features import extract
from app.services.trends import get_trend_momentum
from app.services.semantic import get_semantic_score
from app.utils.logger import logger

# ─── XGBoost model management ────────────────────────────────────────────────

_model = None          # XGBRegressor or None
_rf_model = None       # RandomForestRegressor or None
_MODEL_FILE = Path(settings.model_path) / "quantitative_baseline.pkl"
_RF_MODEL_FILE = Path(settings.model_path) / settings.rf_model_filename


def _load_or_train_models():
    """
    Load persisted XGBoost and Random Forest models from disk, or train
    bootstrap models on synthetic data if none exists yet.
    """
    global _model, _rf_model

    # --- XGBoost ---
    if _MODEL_FILE.exists():
        logger.info(f"Loading persisted XGBoost model from {_MODEL_FILE}")
        with open(_MODEL_FILE, "rb") as f:
            _model = pickle.load(f)
    else:
        logger.warning("No persisted XGBoost model found – training bootstrap model.")
        _model = _train_bootstrap_model(model_type="xgboost")
        _MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_MODEL_FILE, "wb") as f:
            pickle.dump(_model, f)

    # --- Random Forest ---
    if _RF_MODEL_FILE.exists():
        logger.info(f"Loading persisted Random Forest model from {_RF_MODEL_FILE}")
        with open(_RF_MODEL_FILE, "rb") as f:
            _rf_model = pickle.load(f)
    else:
        logger.warning("No persisted Random Forest model found – training bootstrap model.")
        _rf_model = _train_bootstrap_model(model_type="rf")
        _RF_MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_RF_MODEL_FILE, "wb") as f:
            pickle.dump(_rf_model, f)


def _train_bootstrap_model(model_type: str = "xgboost"):
    """
    Train a simple model (XGBoost or Random Forest) on synthetically generated domain data.
    """
    if model_type == "xgboost":
        try:
            import xgboost as xgb
        except ImportError:
            logger.warning("XGBoost not installed – falling back to linear heuristic")
            return None
    else:
        try:
            from sklearn.ensemble import RandomForestRegressor
        except ImportError:
            logger.warning("scikit-learn not installed – falling back to linear heuristic")
            return None

    rng = np.random.default_rng(42)
    N = 5_000

    # Synthetic feature matrix
    lengths          = rng.integers(3, 25, N).astype(float)
    vowel_ratios     = rng.uniform(0.2, 0.6, N)
    digit_ratios     = rng.uniform(0.0, 0.3, N)
    hyphen_counts    = rng.choice([0, 1, 2], N, p=[0.80, 0.17, 0.03]).astype(float)
    uniqueness       = rng.uniform(0.3, 1.0, N)
    alt_scores       = rng.uniform(0.2, 0.9, N)
    tld_scores       = rng.choice([1.0, 0.9, 0.85, 0.65, 0.55, 0.30], N)
    power_keywords   = rng.choice([0.0, 1.0], N, p=[0.75, 0.25])
    max_repeats      = rng.choice([1, 2, 3], N, p=[0.85, 0.12, 0.03]).astype(float)

    X = np.column_stack([
        lengths, vowel_ratios, digit_ratios, hyphen_counts,
        uniqueness, alt_scores, tld_scores, power_keywords, max_repeats,
    ])

    # Synthetic "ground truth" scores
    y = (
        (1 / np.clip(lengths, 3, 25)) * 25
        + vowel_ratios * 15
        + alt_scores * 15
        + tld_scores * 20
        + power_keywords * 10
        - digit_ratios * 10
        - hyphen_counts * 5
        - (max_repeats - 1) * 3
        + rng.normal(0, 3, N)
    )
    y = np.clip(y * 2.5, 10, 95)

    if model_type == "xgboost":
        model = xgb.XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            tree_method="hist",
        )
        logger.info("Bootstrap XGBoost model trained.")
    else:
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=7,
            random_state=42,
            n_jobs=-1
        )
        logger.info("Bootstrap Random Forest model trained.")

    model.fit(X, y)
    return model


def _predict_quantitative(domain: str, model_type: str = "xgboost") -> float:
    """Run feature extraction + specified model (or fallback heuristic) for a domain."""
    feats = extract(domain)
    feat_order = [
        "length", "vowel_ratio", "digit_ratio", "hyphen_count",
        "uniqueness", "alt_score", "tld_score", "has_power_keyword", "max_repeat",
    ]
    X = np.array([[feats[k] for k in feat_order]])

    target_model = _model if model_type == "xgboost" else _rf_model

    if target_model is not None:
        try:
            score = float(target_model.predict(X)[0])
            return round(max(0.0, min(100.0, score)), 2)
        except Exception as exc:
            logger.warning(f"{model_type.upper()} predict failed: {exc}")

    # Linear heuristic fallback
    score = (
        feats["length_score"] * 30
        + feats["alt_score"]  * 20
        + feats["tld_score"]  * 25
        + feats["uniqueness"] * 15
        + feats["has_power_keyword"] * 10
    )
    return round(min(100.0, score), 2)


# ─── Public API ───────────────────────────────────────────────────────────────

async def warm_up():
    """Called at application startup to avoid cold-start latency."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_or_train_models)
    # Prime the semantic cache with a dummy call (no-op if no LLM key)
    await get_semantic_score("example.com")


async def score_domain(domain: str) -> dict:
    """
    Compute all Nexus score components concurrently, including both XGBoost and RF baselines.
    """
    loop = asyncio.get_event_loop()

    xgb_task = loop.run_in_executor(None, _predict_quantitative, domain, "xgboost")
    rf_task  = loop.run_in_executor(None, _predict_quantitative, domain, "rf")
    semantic_task = get_semantic_score(domain)
    trend_task    = get_trend_momentum(domain)

    xgb_score, rf_score, semantic, trend = await asyncio.gather(
        xgb_task,
        rf_task,
        semantic_task,
        trend_task,
        return_exceptions=True,
    )

    def safe(val, default: float) -> float:
        if isinstance(val, Exception):
            logger.warning(f"Scoring component failed: {val}")
            return default
        return float(val)

    return {
        "quantitativeBaseline":   safe(xgb_score, 50.0),
        "rfQuantitativeBaseline": safe(rf_score, 50.0),
        "ensembleScore":          round((safe(xgb_score, 50.0) + safe(rf_score, 50.0)) / 2, 2),
        "semanticScore":          safe(semantic, 50.0),
        "trendMomentum":          safe(trend, 0.0),
    }
