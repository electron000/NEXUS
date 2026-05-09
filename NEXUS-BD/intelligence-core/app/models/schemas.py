"""app/models/schemas.py – Pydantic request & response models."""

from pydantic import BaseModel, Field, field_validator
import re

DOMAIN_RE = re.compile(
    r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
)


class NexusScoreRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=253, examples=["example.com"])

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        v = v.strip().lower()
        if not DOMAIN_RE.match(v):
            raise ValueError(f"'{v}' is not a valid domain name")
        return v


class NexusScoreResponse(BaseModel):
    domain: str
    quantitative_baseline: float = Field(
        ..., ge=0, le=100,
        description="Score based on length, TLD premium, character composition."
    )
    semantic_score: float = Field(
        ..., ge=0, le=100,
        description="LLM-derived semantic quality, memorability, and brandability."
    )
    trend_momentum: float = Field(
        ..., ge=-100, le=100,
        description="Google Trends momentum (-100 declining → +100 surging)."
    )
    predicted_price: float = Field(default=0.0, description="Predicted aftermarket price from user model.")
    predicted_tier: str = Field(default="low", description="Predicted investment tier (low | medium | high).")
    model_used: str = Field(default="xgboost", description="xgboost | heuristic | llm-only")

    model_config = {
        "protected_namespaces": ()
    }
