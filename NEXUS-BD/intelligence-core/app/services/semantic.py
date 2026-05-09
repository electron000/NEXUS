# app/services/semantic.py
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

    score = await _score_with_gemini(domain)
    
    # Fallback to local heuristic if the LLM API fails or returns invalid data
    if score is None:
        score = _heuristic_fallback(domain)

    _cache[domain] = score
    return score


async def _score_with_gemini(domain: str) -> float | None:
    if not settings.gemini_api_key:
        logger.warning("Gemini API key is missing. Skipping LLM scoring.")
        return None
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        
        # Will now safely fetch the 2.5-flash default or user override
        target_model_name = getattr(settings, 'gemini_model_name', "gemini-2.5-flash")
        prompt = f"{_SYSTEM_PROMPT}\n\nDomain: {domain}"
        
        # 1. Define a robust fallback chain using current 2026 stable models
        models_to_try = list(dict.fromkeys([
            target_model_name,
            "gemini-2.5-flash",          # Current standard for speed/cost
            "gemini-2.5-pro",            # High-capability reasoning fallback
            "gemini-3-flash-preview"     # Bleeding-edge fallback if 2.5 fails
        ]))
        
        response = None
        last_error = None
        
        # 2. Iterate through models, breaking on success
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(prompt)
                
                # Log successful recovery if a fallback was used
                if model_name != target_model_name:
                    logger.info(f"Successfully recovered using fallback model: '{model_name}'")
                break  # Exit loop on success
                
            except Exception as api_exc:
                last_error = api_exc
                # 3. Check for 404 (Model not found/Retired). If found, try the next model.
                if "404" in str(api_exc) or "not found" in str(api_exc).lower():
                    logger.debug(f"Gemini model '{model_name}' returned 404. Trying next fallback...")
                    continue
                else:
                    # Re-raise immediately if it's an Auth, Quota, or Network error
                    raise api_exc
                    
        # If the loop finishes and response is still None, all fallbacks failed
        if not response:
            logger.error(f"All attempted Gemini models returned 404. Last error: {last_error}")
            return None

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
