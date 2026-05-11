"""
app/routes/ml.py – ML scoring endpoints.
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import NexusScoreRequest, NexusScoreResponse
from app.services.scorer import score_domain
from app.utils.logger import logger

router = APIRouter()


@router.post(
    "/nexus-score",
    response_model=NexusScoreResponse,
    summary="Calculate the Nexus Value Score for a domain",
    description=(
        "Runs the tier model (model_score) and semantic quality (LLM) "
        "pipelines concurrently and returns the component scores "
        "along with price and tier predictions."
    ),
)
async def nexus_score(req: NexusScoreRequest):
    logger.info(f"Scoring domain: {req.domain}")
    try:
        scores = await score_domain(req.domain)
    except Exception as exc:
        logger.error(f"Scoring failed for '{req.domain}': {exc}")
        raise HTTPException(status_code=500, detail="Scoring pipeline failed.") from exc

    return NexusScoreResponse(
        domain=req.domain,
        model_score=scores["modelScore"],
        semantic_score=scores["semanticScore"],
        predicted_price=scores["predictedPrice"],
        predicted_tier=scores["predictedTier"],
        model_used="random_forest",
    )
