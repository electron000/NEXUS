"""
Nexus Digital Asset Terminal – FastAPI Intelligence Core
Entrypoint: uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import ml
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Intelligence Core starting up…")
    # Warm up the ML models so first request isn't slow
    from app.services.scorer import warm_up
    await warm_up()
    logger.info("ML models warm – Intelligence Core ready.")
    yield
    logger.info("Intelligence Core shutting down.")


app = FastAPI(
    title="Nexus Intelligence Core",
    version="1.0.0",
    description="ML-powered domain valuation engine for the Nexus Digital Asset Terminal.",
    lifespan=lifespan,
    docs_url="/docs" if not settings.production else None,
    redoc_url=None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.nerve_center_origin],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ─── Internal API key guard ───────────────────────────────────────────────────
@app.middleware("http")
async def verify_internal_key(request: Request, call_next):
    # Skip check on health and docs endpoints
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)

    key = request.headers.get("X-Internal-Key", "")
    if settings.internal_api_key and key != settings.internal_api_key:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    return await call_next(request)


# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(ml.router, prefix="/api/ml", tags=["ML Scoring"])


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "intelligence-core"}
