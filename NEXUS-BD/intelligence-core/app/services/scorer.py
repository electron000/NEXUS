"""
app/services/scorer.py

Orchestrates all scoring components and exposes:
  - warm_up()       called at startup to initialise models
  - score_domain()  main public interface

The quantitative baseline (XGBoost on synthetic physical features) has been
replaced by model_score, which is derived from the user-trained tier model
(RandomForest, 0–1 output scaled to 0–100).
"""

from __future__ import annotations
import asyncio

from app.services.semantic import get_semantic_score
from app.services.predictor import load_models, predict_valuation
from app.utils.logger import logger


# ─── Public API ───────────────────────────────────────────────────────────────

async def warm_up():
    """Called at application startup to avoid cold-start latency."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_models)
    # Prime the semantic cache with a dummy call (no-op if no LLM key)
    await get_semantic_score("example.com")


async def score_domain(domain: str) -> dict:
    """
    Compute all Nexus score components concurrently.

    Returns
    -------
    {
      "modelScore":     float   – tier model output scaled 0–100
      "semanticScore":  float   – LLM semantic quality score 0–100
      "predictedPrice": float   – aftermarket price estimate
      "predictedTier":  str     – "low" | "medium" | "high"
    }
    """
    loop = asyncio.get_event_loop()

    semantic_task = get_semantic_score(domain)

    try:
        semantic = await semantic_task
    except Exception as exc:
        logger.warning(f"Semantic scoring failed: {exc}")
        semantic = 50.0

    # Offload CPU-bound ML prediction to a thread pool
    predictions = await loop.run_in_executor(None, predict_valuation, domain)

    return {
        "modelScore":     predictions["model_score"],       
        "semanticScore":  float(semantic),
        "predictedPrice": predictions["predicted_price"],
        "predictedTier":  predictions["predicted_tier"],
    }