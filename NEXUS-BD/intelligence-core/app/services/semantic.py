"""
app/services/semantic.py

Uses an LLM to score the semantic quality, brandability, and memorability
of a domain name. Returns a normalised score 0–100.

Priority: OpenAI GPT-4o → Google Gemini → heuristic fallback
"""

from __future__ import annotations
import json
import re
from cachetools import TTLCache

from app.config import settings
from app.utils.logger import logger

# Cache semantic scores for 24 h (they don't change)
_cache: TTLCache = TTLCache(maxsize=1024, ttl=24 * 3600)

_SYSTEM_PROMPT = """\
You are an expert domain name appraiser. Given a domain name, evaluate it on:
1. Brandability (0-100): Is it catchy, unique, and suitable as a brand?
2. Memorability (0-100): Is it easy to remember and spell?
3. Semantic clarity (0-100): Does it convey a clear purpose or concept?

Respond ONLY with valid JSON in this exact format, no other text:
{"brandability": <number>, "memorability": <number>, "semantic_clarity": <number>}
"""


async def get_semantic_score(domain: str) -> float:
    """
    Return a composite semantic score 0–100 for the given domain.
    """
    if domain in _cache:
        return _cache[domain]

    score = await _score_with_openai(domain)
    if score is None:
        score = await _score_with_gemini(domain)
    if score is None:
        score = _heuristic_fallback(domain)

    _cache[domain] = score
    return score


async def _score_with_openai(domain: str) -> float | None:
    if not settings.openai_api_key:
        return None
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": f"Domain: {domain}"},
            ],
            temperature=0.2,
            max_tokens=80,
        )
        raw = response.choices[0].message.content or ""
        return _parse_llm_json(raw)
    except Exception as exc:
        logger.warning(f"OpenAI semantic score failed for '{domain}': {exc}")
        return None


async def _score_with_gemini(domain: str) -> float | None:
    if not settings.gemini_api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"{_SYSTEM_PROMPT}\n\nDomain: {domain}"
        response = await model.generate_content_async(prompt)
        raw = response.text or ""
        return _parse_llm_json(raw)
    except Exception as exc:
        logger.warning(f"Gemini semantic score failed for '{domain}': {exc}")
        return None


def _parse_llm_json(text: str) -> float | None:
    """Extract the three sub-scores and return their weighted average."""
    try:
        # Strip markdown fences if present
        cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
        data = json.loads(cleaned)
        b = float(data.get("brandability", 50))
        m = float(data.get("memorability", 50))
        s = float(data.get("semantic_clarity", 50))
        # Weighted: brandability most important for domain value
        composite = b * 0.45 + m * 0.35 + s * 0.20
        return round(max(0.0, min(100.0, composite)), 2)
    except Exception:
        return None


def _heuristic_fallback(domain: str) -> float:
    """
    Pure heuristic when no LLM is available.
    Uses length + vowel ratio as a rough brandability proxy.
    """
    from app.services.features import extract
    feats = extract(domain)
    score = (
        feats["length_score"]   * 40
        + feats["alt_score"]    * 30
        + feats["uniqueness"]   * 20
        + feats["tld_score"]    * 10
    )
    return round(min(100.0, score), 2)
