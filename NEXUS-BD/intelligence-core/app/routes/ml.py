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
        "Runs the quantitative baseline (XGBoost), semantic quality (LLM), "
        "and trend momentum (Google Trends) pipelines concurrently and returns "
        "the three component scores."
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
        quantitative_baseline=scores["quantitativeBaseline"],
        semantic_score=scores["semanticScore"],
        trend_momentum=scores["trendMomentum"],
        model_used="xgboost",
    )
