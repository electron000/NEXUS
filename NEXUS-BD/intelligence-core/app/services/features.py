"""
app/services/features.py

Extracts a numeric feature vector from a domain name string.
These features feed the XGBoost quantitative baseline model.
"""

from __future__ import annotations
import re
from typing import Dict

# TLD tier premiums (higher = more desirable)
TLD_PREMIUM: Dict[str, float] = {
    ".com": 1.0, ".io": 0.85, ".ai": 0.90, ".app": 0.70,
    ".dev": 0.68, ".co": 0.65, ".net": 0.60, ".org": 0.55,
    ".xyz": 0.30, ".info": 0.25, ".biz": 0.20,
}

VOWELS = set("aeiou")
CONSONANTS = set("bcdfghjklmnpqrstvwxyz")

# Common high-value keyword roots
POWER_KEYWORDS = {
    "ai", "cloud", "pay", "go", "get", "my", "pro", "app", "hub",
    "lab", "box", "base", "io", "do", "now", "best", "top", "fast",
    "smart", "easy", "open", "safe", "data", "code", "tech",
}


def extract(domain: str) -> dict:
    """
    Return a flat feature dict for a single domain string.

    Args:
        domain: Fully-qualified domain (e.g. "example.com")

    Returns:
        dict mapping feature name → float
    """
    domain = domain.strip().lower()

    # Split SLD from TLD
    parts = domain.rsplit(".", 1)
    if len(parts) == 2:
        sld, tld = parts
        tld = "." + tld
    else:
        sld, tld = domain, ".com"

    length = len(sld)
    char_set = set(sld)

    # Character composition
    vowel_count     = sum(1 for c in sld if c in VOWELS)
    consonant_count = sum(1 for c in sld if c in CONSONANTS)
    digit_count     = sum(1 for c in sld if c.isdigit())
    hyphen_count    = sld.count("-")

    vowel_ratio     = vowel_count / max(length, 1)
    digit_ratio     = digit_count / max(length, 1)

    # Pronounceability proxy: alternating vowel/consonant patterns
    alt_score = _alternating_score(sld)

    # Uniqueness: ratio of unique chars to length (higher = more diverse)
    uniqueness = len(char_set) / max(length, 1)

    # TLD premium
    tld_score = TLD_PREMIUM.get(tld, 0.15)

    # Keyword presence
    has_power_keyword = int(any(kw in sld for kw in POWER_KEYWORDS))

    # Repetition penalty (e.g. "aaabc")
    max_repeat = _max_consecutive_repeat(sld)

    # Length score: sweet spot 4–8 chars
    length_score = _length_score(length)

    return {
        "length":            float(length),
        "vowel_ratio":       vowel_ratio,
        "digit_ratio":       digit_ratio,
        "hyphen_count":      float(hyphen_count),
        "uniqueness":        uniqueness,
        "alt_score":         alt_score,
        "tld_score":         tld_score,
        "has_power_keyword": float(has_power_keyword),
        "max_repeat":        float(max_repeat),
        "length_score":      length_score,
        "consonant_ratio":   consonant_count / max(length, 1),
    }


# ─── Private helpers ──────────────────────────────────────────────────────────

def _alternating_score(s: str) -> float:
    """
    Score 0–1 measuring how well the string alternates vowels and consonants.
    Perfect alternation → 1.0.
    """
    if len(s) < 2:
        return 0.5
    alternations = 0
    for i in range(len(s) - 1):
        a, b = s[i], s[i + 1]
        a_vowel = a in VOWELS
        b_vowel = b in VOWELS
        if a_vowel != b_vowel:
            alternations += 1
    return alternations / (len(s) - 1)


def _max_consecutive_repeat(s: str) -> int:
    """Return the maximum run of any single character."""
    if not s:
        return 0
    max_run = current_run = 1
    for i in range(1, len(s)):
        if s[i] == s[i - 1]:
            current_run += 1
            max_run = max(max_run, current_run)
        else:
            current_run = 1
    return max_run


def _length_score(n: int) -> float:
    """
    Piecewise score based on domain name length.
    < 3:   penalty (too short / not meaningful)
    3:     0.70
    4–5:   1.00 (premium short domains)
    6–8:   0.90 (still very good)
    9–12:  0.70
    13–16: 0.50
    > 16:  0.30
    """
    if n < 3:
        return 0.40
    if n == 3:
        return 0.70
    if n <= 5:
        return 1.00
    if n <= 8:
        return 0.90
    if n <= 12:
        return 0.70
    if n <= 16:
        return 0.50
    return 0.30
