"""
app/services/trends.py

Fetches Google Trends interest data for a domain's SLD keyword
and converts it into a normalised momentum score (-100 → +100).
"""

from __future__ import annotations
import asyncio
from functools import lru_cache
from typing import Optional

from cachetools import TTLCache
from app.config import settings
from app.utils.logger import logger

# In-memory cache: keyword → score, TTL = 6 hours
_cache: TTLCache = TTLCache(maxsize=512, ttl=6 * 3600)


async def get_trend_momentum(domain: str) -> float:
    """
    Return a trend momentum score for the domain's SLD keyword.
    Score range: -100 (sharply declining) → +100 (sharply surging).
    Returns 0.0 on any error.
    """
    keyword = _extract_keyword(domain)

    if keyword in _cache:
        return _cache[keyword]

    score = await asyncio.get_event_loop().run_in_executor(
        None, _fetch_sync, keyword
    )

    _cache[keyword] = score
    return score


def _extract_keyword(domain: str) -> str:
    """Return the SLD of the domain as the trend keyword."""
    return domain.rsplit(".", 1)[0].replace("-", " ")


def _fetch_sync(keyword: str) -> float:
    """Blocking PyTrends call – run in executor thread."""
    if not settings.use_pytrends:
        logger.debug("PyTrends disabled – returning 0.0")
        return 0.0

    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="en-US", tz=360, timeout=(5, 15), retries=1)
        pt.build_payload([keyword], timeframe="today 3-m")
        df = pt.interest_over_time()

        if df.empty or keyword not in df.columns:
            return 0.0

        series = df[keyword].dropna()
        if len(series) < 4:
            return 0.0

        # Momentum = slope of linear trend, normalised to [-100, 100]
        import numpy as np
        x = np.arange(len(series))
        slope, _ = np.polyfit(x, series.values, 1)

        # Typical weekly slope rarely exceeds ±5 points; clamp and scale
        momentum = float(np.clip(slope * 20, -100, 100))
        logger.debug(f"Trend momentum for '{keyword}': {momentum:.1f}")
        return round(momentum, 2)

    except Exception as exc:
        logger.warning(f"PyTrends fetch failed for '{keyword}': {exc}")
        return 0.0
