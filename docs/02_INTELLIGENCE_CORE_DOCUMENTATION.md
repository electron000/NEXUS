# NEXUS Intelligence Core — Technical Documentation

> **Module**: `NEXUS-BD/intelligence-core`
> **Runtime**: Python 3.11+ · FastAPI · Uvicorn
> **Port**: 8000 (configurable via `PORT`)
> **Role**: ML-powered domain valuation engine, semantic analysis service, and predictive intelligence hub for the NEXUS ecosystem.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration & Environment](#4-configuration--environment)
5. [Application Lifecycle](#5-application-lifecycle)
6. [API Reference](#6-api-reference)
7. [ML Pipeline — Detailed Breakdown](#7-ml-pipeline--detailed-breakdown)
8. [Feature Engineering](#8-feature-engineering)
9. [Prediction Service](#9-prediction-service)
10. [Semantic Scoring (LLM)](#10-semantic-scoring-llm)
11. [Scoring Orchestrator](#11-scoring-orchestrator)
12. [Data Models & Schemas](#12-data-models--schemas)
13. [Security Architecture](#13-security-architecture)
14. [Deployment](#14-deployment)

---

## 1. Architecture Overview

The Intelligence Core is a **dedicated ML microservice** that operates as an internal service behind the Nerve Center. It is not directly accessible to end users — all requests are proxied through the Nerve Center with internal API key authentication.

```
                    ┌─────────────────────┐
                    │   Nerve Center       │
                    │  (Port 4000)         │
                    └──────────┬──────────┘
                               │ POST /api/ml/nexus-score
                               │ Header: X-Internal-Key
                               ▼
                    ┌─────────────────────┐
                    │  Intelligence Core   │
                    │  (Port 8000)         │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │ Tier Model     │  │ ← RandomForest (.pkl, ~2.8MB)
                    │  │ (Classification)│  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ Price Model    │  │ ← RandomForest (.pkl, ~16MB)
                    │  │ (Regression)   │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ Semantic Engine│  │ ← Gemini LLM API
                    │  │ (LLM Scoring)  │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ Feature Eng.   │  │ ← Algorithmic extraction
                    │  │ (Heuristics)   │  │
                    │  └────────────────┘  │
                    └─────────────────────┘
```

### Core Responsibilities

| Responsibility | Description |
|---|---|
| **Feature Engineering** | Extract 12+ numerical features from raw domain strings |
| **Tier Prediction** | Classify domains as `low`, `medium`, or `high` investment tiers |
| **Price Prediction** | Estimate aftermarket price using trained RandomForest regression model |
| **Semantic Scoring** | LLM-powered analysis of brandability, memorability, and semantic clarity |
| **Score Composition** | Combine model + semantic scores into a unified Nexus Score |

---

## 2. Technology Stack

### Core Dependencies

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.111.0 | Async web framework |
| `uvicorn[standard]` | 0.30.1 | ASGI server with hot reload |
| `pydantic` | 2.7.3 | Data validation and serialization |
| `pydantic-settings` | 2.3.1 | Environment-based configuration |

### ML Stack

| Package | Version | Purpose |
|---|---|---|
| `scikit-learn` | ≥1.5.0 | RandomForest models (primary prediction engine) |
| `xgboost` | 2.0.3 | XGBoost (available for future use; legacy) |
| `numpy` | 1.26.4 | Numerical computation |
| `pandas` | 2.2.2 | DataFrame-based feature vector construction |

### LLM & External Intelligence

| Package | Version | Purpose |
|---|---|---|
| `google-generativeai` | 0.7.1 | Gemini API client for semantic scoring |
| `openai` | 1.35.3 | OpenAI API client (available, not actively used) |
| `pytrends` | 4.9.2 | Google Trends data (feature flag controlled) |

### Async & Utilities

| Package | Version | Purpose |
|---|---|---|
| `httpx` | 0.27.0 | Async HTTP client |
| `anyio` | 4.4.0 | Async concurrency primitives |
| `tenacity` | 8.3.0 | Retry logic for API calls |
| `cachetools` | 5.3.3 | TTL-based in-memory caching |
| `python-dotenv` | 1.0.1 | Environment variable loading |

### Trained Model Files

| File | Size | Type | Purpose |
|---|---|---|---|
| `models/price_model.pkl` | ~16 MB | Serialized RandomForest | Predicts aftermarket domain price |
| `models/tier_model.pkl` | ~2.8 MB | Serialized RandomForest | Classifies domain investment tier (0–1 continuous output) |

---

## 3. Project Structure

```
intelligence-core/
├── .env                          # Environment variables (not committed)
├── .env.example                  # Template for configuration
├── Dockerfile                    # Container build instructions
├── requirements.txt              # Python dependencies
├── ML_MODEL_TESTING.md           # Model testing documentation
├── models/
│   ├── price_model.pkl           # ★ Trained price prediction model
│   └── tier_model.pkl            # ★ Trained tier classification model
└── app/
    ├── __init__.py
    ├── main.py                   # ★ FastAPI application entry point
    ├── config.py                 # Pydantic Settings configuration
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py            # Pydantic request/response models
    ├── routes/
    │   ├── __init__.py
    │   └── ml.py                 # ML scoring API endpoint
    ├── services/
    │   ├── __init__.py
    │   ├── features.py           # ★ Feature engineering pipeline
    │   ├── predictor.py          # ★ ML model loading and inference
    │   ├── scorer.py             # ★ Score orchestration engine
    │   └── semantic.py           # ★ LLM-based semantic analysis
    └── utils/
        ├── __init__.py
        └── logger.py             # Structured logging
```

---

## 4. Configuration & Environment

### Settings (via `pydantic-settings`)

Configuration is centralized in `app/config.py` using Pydantic's `BaseSettings` class, which automatically loads from `.env` files and environment variables.

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | int | `8000` | Server listen port |
| `PRODUCTION` | bool | `false` | Production mode (disables /docs) |
| `INTERNAL_API_KEY` | str | `""` | Shared secret for Nerve Center authentication |
| `NERVE_CENTER_ORIGIN` | str | `http://localhost:3001` | Allowed CORS origin |
| `OPENAI_API_KEY` | str | `""` | OpenAI API key (optional) |
| `GEMINI_API_KEY` | str | `""` | Google Gemini API key (recommended) |
| `GEMINI_MODEL_NAME` | str | `gemini-2.5-flash` | Target Gemini model for semantic scoring |
| `USE_PYTRENDS` | bool | `true` | Enable/disable Google Trends integration |
| `MODEL_PATH` | str | `models/` | Directory containing .pkl model files |

### Protected Namespace Handling

Both the Settings class and Pydantic models use `protected_namespaces = ()` to avoid conflicts with Pydantic v2's reserved `model_` prefix validation.

---

## 5. Application Lifecycle

### Startup Sequence

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Log startup
    # 2. Warm up ML models (load .pkl files into memory)
    # 3. Prime semantic cache with dummy call
    # 4. Ready to serve
    yield
    # 5. Log shutdown
```

The `warm_up()` function:
1. Loads `tier_model.pkl` and `price_model.pkl` from disk into global variables
2. Performs a dummy semantic score call (`example.com`) to initialize LLM client
3. Ensures first real request is fast (no cold-start latency)

### CORS Configuration

```python
CORSMiddleware(
    allow_origins=[settings.nerve_center_origin],  # Only Nerve Center
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)
```

---

## 6. API Reference

### Health Endpoint

```
GET /health → { "status": "ok", "service": "intelligence-core" }
```

No authentication required. Used for Docker health checks and monitoring.

### ML Scoring Endpoint

```
POST /api/ml/nexus-score
```

**Headers**: `X-Internal-Key: {shared_secret}` (required)

**Request Body**:
```json
{
  "domain": "example.com"
}
```

**Validation**:
- `domain`: 3–253 characters
- Must match RFC-compliant domain regex: `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`
- Automatically lowercased and trimmed

**Response** (200):
```json
{
  "domain": "example.com",
  "model_score": 67.5,
  "semantic_score": 78.2,
  "predicted_price": 42500.0,
  "predicted_tier": "medium",
  "model_used": "random_forest"
}
```

**Response Fields**:

| Field | Type | Range | Description |
|---|---|---|---|
| `model_score` | float | 0–100 | Tier model output × 100 (structural/quantitative quality) |
| `semantic_score` | float | 0–100 | LLM-derived brand/memory/clarity composite |
| `predicted_price` | float | ≥ 0 | Estimated aftermarket value in INR |
| `predicted_tier` | string | `low`/`medium`/`high` | Investment tier classification |
| `model_used` | string | — | Always `"random_forest"` |

### API Documentation

- **Swagger UI**: `GET /docs` (disabled in production)
- **ReDoc**: Disabled

---

## 7. ML Pipeline — Detailed Breakdown

The complete scoring pipeline for a single domain:

```
Domain String: "nexushub.io"
        │
        ▼
┌─────────────────────┐
│  Feature Engineering │  ← features.py
│  (12 features)       │
└──────────┬──────────┘
           │
     ┌─────┼─────────────────────────┐
     ▼                               ▼
┌──────────────┐            ┌──────────────────┐
│  Tier Model   │            │  Semantic Engine   │
│  (Random      │            │  (Gemini LLM or   │
│   Forest)     │            │   Local Heuristic) │
└──────┬───────┘            └────────┬───────────┘
       │                             │
       ▼                             ▼
  tier_value (0–1)            semantic_score (0–100)
  model_score (0–100)
       │
       ▼
┌──────────────┐
│  Price Model  │  ← Uses tier_value as additional feature
│  (Random      │
│   Forest)     │
└──────┬───────┘
       │
       ▼
  predicted_price (INR)
       │
       ▼
┌──────────────────┐
│  Score Assembly   │  ← scorer.py
│  modelScore       │
│  semanticScore    │
│  predictedPrice   │
│  predictedTier    │
└──────────────────┘
```

### Concurrency Model

The scorer runs the **semantic scoring** (async I/O-bound LLM call) and **ML prediction** (CPU-bound, offloaded to thread pool via `asyncio.run_in_executor`) concurrently for optimal latency.

---

## 8. Feature Engineering

**File**: `app/services/features.py`

### Extracted Features (12 total)

| # | Feature | Type | Range | Algorithm |
|---|---|---|---|---|
| 1 | `tld` | string | — | Raw TLD string (preserved for reference) |
| 2 | `length` | float | 1–253 | Character count of SLD |
| 3 | `vowel_ratio` | float | 0–1 | `vowels / length` |
| 4 | `digit_ratio` | float | 0–1 | `digits / length` |
| 5 | `hyphen_count` | float | 0–∞ | Count of hyphens in SLD |
| 6 | `uniqueness` | float | 0–1 | `unique_chars / length` |
| 7 | `alt_score` | float | 0–1 | Vowel-consonant alternation ratio |
| 8 | `tld_score` | float | 0–1 | TLD premium score from lookup table |
| 9 | `keyword_score` | float | 0–1 | Heuristic keyword value estimation |
| 10 | `max_repeat` | float | 1–∞ | Maximum consecutive repeated character count |
| 11 | `length_score` | float | 0.30–1.0 | Length-based quality curve |
| 12 | `consonant_ratio` | float | 0–1 | `consonants / length` |

### TLD Premium Table

| TLD | Score | TLD | Score |
|---|---|---|---|
| `.com` | 1.00 | `.net` | 0.60 |
| `.ai` | 0.90 | `.org` | 0.55 |
| `.io` | 0.85 | `.xyz` | 0.30 |
| `.app` | 0.70 | `.info` | 0.25 |
| `.dev` | 0.68 | `.biz` | 0.20 |
| `.co` | 0.65 | *other* | 0.15 |

### Keyword Score Algorithm

The `_calculate_keyword_score(sld)` function implements a multi-tier penalty system:

```
1. Gibberish detection: length > 7 AND zero vowels → 0.10
2. Hyphen/digit penalty: has hyphen OR digit → 0.20
3. Excessive length: length > 15 → 0.30
4. Standard default: 0.50 + (length × 0.01, capped at 0.10)
5. Special case: "invest" → 0.8783 (calibrated from training data)
```

### Alternating Score Algorithm

Measures phonetic quality by counting vowel-consonant transitions:
```
"google" → g(C)o(V)o(V)g(C)l(C)e(V) → alternations: 3/5 = 0.60
```

### Length Score Curve

| Length | Score | Interpretation |
|---|---|---|
| < 3 | 0.40 | Too short, limited meaning |
| 3 | 0.70 | Premium short domain |
| 4–5 | 1.00 | **Optimal** — brandable and memorable |
| 6–8 | 0.90 | Good — common brand range |
| 9–12 | 0.70 | Acceptable — longer brand names |
| 13–16 | 0.50 | Suboptimal — hard to remember |
| > 16 | 0.30 | Poor — excessive length |

---

## 9. Prediction Service

**File**: `app/services/predictor.py`

### Model Loading

Models are loaded from `.pkl` files at startup into global variables:

```python
_price_model = None  # RandomForest Regressor
_tier_model = None   # RandomForest Classifier (outputs continuous 0–1)
```

**Loading Mechanism**: Standard `pickle.load()` from the `models/` directory.

### Model Input Vector

The feature vector fed into both models is constructed as a Pandas DataFrame with **exact column ordering** matching the training schema:

| Column Index | Feature Name | Source |
|---|---|---|
| 0 | `length` | `features["length"]` |
| 1 | `vowel_ratio` | `features["vowel_ratio"]` |
| 2 | `has_number` | `float(features["digit_ratio"] > 0)` — binary flag |
| 3 | `tld_score` | `features["tld_score"]` |
| 4 | `keyword_score` | `features["keyword_score"]` |
| 5 | `brand_score` | `features["alt_score"]` — vowel-consonant alternation |

> **Critical Note**: Models were trained on raw numpy arrays (`.values`), so DataFrame column names are not used for indexing — **column order is paramount**.

### Tier Model Prediction

```
input → tier_model.predict(input_df.values) → raw_prediction
```

| Raw Output | Interpretation |
|---|---|
| String `"low"/"medium"/"high"` | Mapped to 0.0 / 0.5 / 1.0 |
| Float (0–1 continuous) | Used directly |

**Tier Classification Thresholds**:
| Tier Value | Tier Label |
|---|---|
| ≥ 0.68 | `high` |
| ≥ 0.42 | `medium` |
| < 0.42 | `low` |

**Model Score**: `tier_value × 100`, clamped to [0, 100].

### Price Model Prediction

The price model receives the **same 6 features plus the tier value** as a 7th feature:

```python
price_input_df = input_df.copy()
price_input_df["tier"] = tier_val    # 7th column
price = price_model.predict(price_input_df.values)[0]
```

**Post-processing**: `max(0.0, predicted_price)` — clamps negative predictions to zero.

---

## 10. Semantic Scoring (LLM)

**File**: `app/services/semantic.py`

### Architecture

```
Domain → Cache Check → Gemini LLM API → JSON Parse → Weighted Average → Score
                    ↓ (on cache miss)                        ↓ (on LLM failure)
                                                    Heuristic Fallback
```

### Caching

- **Type**: TTL-based in-memory cache (`cachetools.TTLCache`)
- **Capacity**: 1024 entries
- **TTL**: 24 hours
- **Key**: Domain string

### LLM Prompt Engineering

```
System Prompt:
You are an expert domain name appraiser. Given a domain name, evaluate it on:
1. Brandability (0-100): Is it catchy, unique, and suitable as a brand?
2. Memorability (0-100): Is it easy to remember and spell?
3. Semantic clarity (0-100): Does it convey a clear purpose or concept?

Respond ONLY with valid JSON in this exact format, no other text:
{"brandability": <number>, "memorability": <number>, "semantic_clarity": <number>}
```

### Gemini Model Fallback Chain

The system implements a **resilient model cascade**:

```
1. Primary: settings.gemini_model_name (default: "gemini-2.5-flash")
2. Fallback 1: "gemini-2.5-flash"
3. Fallback 2: "gemini-2.5-pro"
4. Fallback 3: "gemini-3-flash-preview"
```

**Error Handling**:
- 404 (Model Not Found) → Try next model in chain
- Auth/Quota/Network errors → Fail immediately, use heuristic fallback

### Score Composition

The three LLM sub-scores are combined with domain-specific weighting:

```
composite = brandability × 0.45 + memorability × 0.35 + semantic_clarity × 0.20
```

**Rationale**: Brandability is the strongest predictor of domain aftermarket value.

### JSON Parsing

Handles markdown-fenced JSON (`\`\`\`json ... \`\`\``) and raw JSON responses. Strips fence markers before parsing.

### Heuristic Fallback

When no LLM API is available, a pure algorithmic fallback computes:

```python
score = (
    length_score   × 40 +
    alt_score      × 30 +
    uniqueness     × 20 +
    tld_score      × 10
)
```

This provides a rough brandability proxy without any external API dependency.

---

## 11. Scoring Orchestrator

**File**: `app/services/scorer.py`

### `warm_up()` — Startup Initialization

1. Loads ML models from disk (in thread pool executor)
2. Primes semantic cache with `"example.com"` dummy call
3. Called during FastAPI `lifespan` event

### `score_domain(domain)` — Main Public Interface

**Concurrency Strategy**:
```
                    ┌── async ── get_semantic_score(domain) ──────┐
score_domain(domain)│                                              │→ merge
                    └── thread ── predict_valuation(domain) ──────┘
```

1. **Semantic scoring** runs as an async task (I/O-bound LLM API call)
2. **ML prediction** offloaded to thread pool executor (CPU-bound pickle model inference)
3. Results merged after both complete
4. Semantic failure fallback: defaults to 50.0

**Return Schema**:
```python
{
    "modelScore":     float,   # 0–100 (from tier model)
    "semanticScore":  float,   # 0–100 (from LLM or heuristic)
    "predictedPrice": float,   # INR aftermarket estimate
    "predictedTier":  str,     # "low" | "medium" | "high"
}
```

---

## 12. Data Models & Schemas

**File**: `app/models/schemas.py`

### `NexusScoreRequest`

```python
class NexusScoreRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=253)
    
    @field_validator("domain")
    def validate_domain(cls, v):
        # RFC-compliant domain regex validation
        # Auto-lowercase and trim
```

### `NexusScoreResponse`

```python
class NexusScoreResponse(BaseModel):
    domain: str
    model_score: float         # 0–100, tier model output
    semantic_score: float      # 0–100, LLM semantic quality
    predicted_price: float     # ≥ 0, aftermarket price estimate
    predicted_tier: str        # "low" | "medium" | "high"
    model_used: str            # "random_forest" | "heuristic" | "llm-only"
```

---

## 13. Security Architecture

### Internal API Key Guard

Every HTTP request (except `/health` and `/docs`) is checked for the `X-Internal-Key` header:

```python
@app.middleware("http")
async def verify_internal_key(request, call_next):
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)
    
    key = request.headers.get("X-Internal-Key", "")
    if settings.internal_api_key and key != settings.internal_api_key:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    
    return await call_next(request)
```

This ensures only the Nerve Center (which knows the shared secret) can invoke ML endpoints.

### CORS Policy

Only the Nerve Center origin is allowed:
```python
allow_origins=[settings.nerve_center_origin]
```

### API Key Security

- Gemini API key stored in environment variable only
- Internal API key shared between Nerve Center and Intelligence Core
- No user credentials are ever sent to or stored by the Intelligence Core

---

## 14. Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# System deps for XGBoost / numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/models

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
EXPOSE 8000
```

**Key Notes**:
- Multi-worker Uvicorn (2 workers) for concurrency
- System C/C++ compilers installed for native extension compilation
- Model files (`models/*.pkl`) must be volume-mounted or baked into the image

### Local Development

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Health Check

```
GET /health → { "status": "ok", "service": "intelligence-core" }
```

### Performance Characteristics

| Metric | Typical Value |
|---|---|
| Cold start (model loading) | 2–5 seconds |
| Warm prediction (cached semantic) | 50–200ms |
| Full scoring (uncached, with LLM) | 1–3 seconds |
| Memory footprint | ~200–400 MB (with models loaded) |
| Model file total size | ~19 MB |
