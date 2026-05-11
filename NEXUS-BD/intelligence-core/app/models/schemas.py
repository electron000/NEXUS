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
    model_score: float = Field(
        ..., ge=0, le=100,
        description=(
            "Tier model output scaled to 0–100. Derived from the user-trained "
            "RandomForest tier model (raw output 0–1 × 100). Replaces the "
            "old XGBoost quantitative baseline as the structural Nexus component."
        )
    )
    semantic_score: float = Field(
        ..., ge=0, le=100,
        description="LLM-derived semantic quality, memorability, and brandability."
    )
    predicted_price: float = Field(
        default=0.0,
        description="Predicted aftermarket price from the price model."
    )
    predicted_tier: str = Field(
        default="low",
        description="Predicted investment tier (low | medium | high)."
    )
    model_used: str = Field(
        default="random_forest",
        description="random_forest | heuristic | llm-only"
    )

    model_config = {
        "protected_namespaces": ()
    }
