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
from app.services.predictor import load_models, predict_valuation
from app.utils.logger import logger

# ─── XGBoost model management ────────────────────────────────────────────────

_model = None          # XGBRegressor or None
_MODEL_FILE = Path(settings.model_path) / "quantitative_baseline.pkl"


def _load_or_train_model():
    """
    Load a persisted XGBoost model from disk, or train a bootstrap model
    on synthetic data if none exists yet.
    """
    global _model

    if _MODEL_FILE.exists():
        logger.info(f"Loading persisted model from {_MODEL_FILE}")
        with open(_MODEL_FILE, "rb") as f:
            _model = pickle.load(f)
        return

    logger.warning("No persisted model found – training bootstrap model on synthetic data.")
    _model = _train_bootstrap_model()

    # Persist for next startup
    _MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_MODEL_FILE, "wb") as f:
        pickle.dump(_model, f)
    logger.info(f"Bootstrap model saved to {_MODEL_FILE}")


def _train_bootstrap_model():
    """
    Train a simple XGBoost regressor on synthetically generated domain data.
    Focus is strictly on PHYSICAL and STRUCTURAL features to avoid redundancy 
    with the Semantic/Trend models.
    """
    try:
        import xgboost as xgb
    except ImportError:
        logger.warning("XGBoost not installed – falling back to linear heuristic")
        return None

    rng = np.random.default_rng(42)
    N = 5_000

    # Synthetic feature matrix (Physical markers only)
    lengths          = rng.integers(3, 25, N).astype(float)
    vowel_ratios     = rng.uniform(0.2, 0.6, N)
    digit_ratios     = rng.uniform(0.0, 0.3, N)
    hyphen_counts    = rng.choice([0, 1, 2], N, p=[0.80, 0.17, 0.03]).astype(float)
    uniquenesses     = rng.uniform(0.3, 0.9, N)
    alt_scores       = rng.uniform(0.2, 0.8, N)
    tld_scores       = rng.choice([1.0, 0.9, 0.85, 0.65, 0.55, 0.30], N)
    has_power_kws    = rng.choice([0.0, 1.0], N, p=[0.8, 0.2])
    max_repeats      = rng.choice([1, 2, 3], N, p=[0.85, 0.12, 0.03]).astype(float)

    X = np.column_stack([
        lengths, vowel_ratios, digit_ratios, hyphen_counts,
        uniquenesses, alt_scores, tld_scores, has_power_kws,
        max_repeats,
    ])

    # Synthetic "ground truth" scores with sensible physical priors
    y = (
        (1 / np.clip(lengths, 3, 25)) * 40          # Physical length is primary
        + tld_scores * 30                           # Extension scarcity
        - digit_ratios * 15                         # Numbers usually hurt physical grade
        - hyphen_counts * 10                        # Hyphens are a negative physical trait
        - (max_repeats - 1) * 5                     # Character clusters are hard to read
        + rng.normal(0, 3, N)                       # minor noise
    )
    y = np.clip(y * 2.5, 10, 95)                    # scale to ~10–95

    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        tree_method="hist",
    )
    model.fit(X, y)
    logger.info("Bootstrap XGBoost model trained.")
    return model


def _predict_quantitative(domain: str) -> float:
    """Run feature extraction + XGBoost (or fallback heuristic) for a domain."""
    feats = extract(domain)
    # Physical-only feature set
    feat_order = [
        "length", "vowel_ratio", "digit_ratio", "hyphen_count",
        "uniqueness", "alt_score", "tld_score", "has_power_keyword",
        "max_repeat",
    ]
    X = np.array([[feats[k] for k in feat_order]])

    if _model is not None:
        try:
            score = float(_model.predict(X)[0])
            return round(max(0.0, min(100.0, score)), 2)
        except Exception as exc:
            logger.warning(f"XGBoost predict failed: {exc}")

    # Physical-only heuristic fallback
    score = (
        feats["length_score"] * 45
        + feats["tld_score"]  * 35
        + (1.0 - feats["digit_ratio"]) * 10
        + (1.0 / max(1, feats["max_repeat"])) * 10
    )
    return round(min(100.0, score), 2)


# ─── Public API ───────────────────────────────────────────────────────────────

async def warm_up():
    """Called at application startup to avoid cold-start latency."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_or_train_model)
    await loop.run_in_executor(None, load_models)
    # Prime the semantic cache with a dummy call (no-op if no LLM key)
    await get_semantic_score("example.com")


async def score_domain(domain: str) -> dict:
    """
    Compute all three Nexus score components concurrently.

    Returns:
        {
          "quantitativeBaseline": float,
          "semanticScore":        float,
          "trendMomentum":        float,
        }
    """
    loop = asyncio.get_event_loop()

    quantitative_task = loop.run_in_executor(None, _predict_quantitative, domain)
    semantic_task     = get_semantic_score(domain)
    trend_task        = get_trend_momentum(domain)

    quantitative, semantic, trend = await asyncio.gather(
        quantitative_task,
        semantic_task,
        trend_task,
        return_exceptions=True,
    )

    def safe(val, default: float) -> float:
        if isinstance(val, Exception):
            logger.warning(f"Scoring component failed: {val}")
            return default
        return float(val)

    # ML Predictor (User models)
    predictions = predict_valuation(domain)

    return {
        "quantitativeBaseline": safe(quantitative, 50.0),
        "semanticScore":        safe(semantic, 50.0),
        "trendMomentum":        safe(trend, 0.0),
        "predictedPrice":       predictions["predicted_price"],
        "predictedTier":        predictions["predicted_tier"],
    }
