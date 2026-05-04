# NEXUS System Documentation 🌐

Welcome to the comprehensive documentation for the **NEXUS Digital Asset Terminal**. This document explains the high-level architecture, core features, and technical workflows that power the platform.

---

## 🏗 High-Level System Architecture

NEXUS is built using a microservices-inspired architecture, separating the user interface, orchestration logic, and machine learning intelligence into three distinct layers.

```mermaid
graph TD
    subgraph "Frontend Layer (NEXUS-FD)"
        UI["Next.js 14 Dashboard"]
        State["Zustand State Store"]
        SSE_Listener["SSE Client"]
    end

    subgraph "Orchestration Layer (NEXUS-BD: Nerve Center)"
        API_GW["Express API Gateway"]
        Auth["JWT Auth Service"]
        Job_Manager["Async Job Manager"]
        Registrar_Proxy["Registrar Orchestrator"]
        DB[(PostgreSQL)]
    end

    subgraph "Intelligence Layer (NEXUS-BD: Intelligence Core)"
        FastAPI["FastAPI Scorer"]
        Ensemble["Ensemble Controller"]
        XGBoost["XGBoost Model"]
        RF["Random Forest Model"]
        LLM["Semantic LLM Analysis"]
        Trend_Scraper["Google Trends Scraper"]
    end

    subgraph "External Integrations"
        Registrars["Registrar APIs (Porkbun, CF, GD)"]
        OpenAI["OpenAI / Gemini"]
    end

    %% Connections
    UI <--> State
    UI -- "REST / JWT" --> API_GW
    SSE_Listener -- "EventSource (SSE)" --> API_GW
    
    API_GW -- "Auth Validation" --> Auth
    API_GW -- "Data Persistence" --> DB
    API_GW -- "Fetch Pricing" --> Registrar_Proxy
    Registrar_Proxy <--> Registrars
    
    API_GW -- "Request Scoring" --> FastAPI
    FastAPI -- "Coordinate" --> Ensemble
    Ensemble -- "Synthesize" --> XGBoost & RF
    FastAPI -- "Semantic Analysis" --> LLM
    LLM <--> OpenAI
    FastAPI -- "Popularity Check" --> Trend_Scraper
```

---

## 🔑 1. Authentication & Security Flow

NEXUS uses a strict institutional-grade authentication flow based on **JSON Web Tokens (JWT)**.

### Flowchart: User Authentication
```mermaid
sequenceDiagram
    participant User
    participant FD as NEXUS-FD
    participant NC as Nerve Center (BD)
    participant DB as PostgreSQL

    User->>FD: Enter Credentials
    FD->>NC: POST /api/auth/login
    NC->>DB: Verify Email & Hash
    DB-->>NC: User Data
    NC->>NC: Generate JWT (Short-lived)
    NC-->>FD: Set-Cookie (httpOnly) + User Info
    FD->>FD: Initialize Zustand Auth Store
    Note over FD: User Redirected to Dashboard
```

---

## 📈 2. Domain Valuation Pipeline (Feature: Domain Terminal)

The Domain Terminal utilizes a multi-stage pipeline to synthesize a real-time valuation. This process is streamed to the frontend via **Server-Sent Events (SSE)** to provide instant feedback.

### Flowchart: Valuation Logic
```mermaid
flowchart TD
    Start([User Search]) --> Request[Nerve Center: Open SSE Stream]
    Request --> Stage1[Stage 1: Registrar Discovery]
    Stage1 --> P1[Fetch Porkbun Pricing]
    Stage1 --> P2[Fetch Cloudflare Data]
    Stage1 --> P3[Check GoDaddy OTE]
    
    P1 & P2 & P3 --> Aggregator[Aggregate TCO Model]
    Aggregator --> Stage2[Stage 2: Intelligence Scoring]
    
    Stage2 --> ML[Nexus Ensemble Model]
    ML --> XGB[XGBoost Component]
    ML --> RF_M[Random Forest Component]
    Stage2 --> SEM[LLM Semantic Grade]
    Stage2 --> TRD[Google Trends Velocity]
    
    XGB & RF_M & SEM & TRD --> Synthesis[Final Nexus Score Synthesis]
    Synthesis --> Output[Stream Result to UI]
    Output --> End([Valuation Complete])
```

---

## 📂 3. Portfolio Auditor Flow (Feature: Bulk Analysis)

The Auditor allows users to process thousands of domains asynchronously. It uses a background job system to prevent UI blocking.

### Flowchart: Async Job Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Upload: User Uploads CSV
    Upload --> Pending: Nerve Center Creates Job Record
    Pending --> Processing: Job Worker Picks Up Task
    
    state Processing {
        [*] --> Fetching: Multi-Registrar Price Checks
        Fetching --> Scoring: Intelligence Core Valuations
        Scoring --> Aggregating: Synthesize Final Dataset
    }
    
    Processing --> Complete: Job Result Saved to DB
    Processing --> Failed: Error Logged
    
    Complete --> [*]
    Failed --> [*]
    
    note right of Processing
        Frontend polls /api/portfolio/status/:jobId
        every 3 seconds to update progress bars.
    end
```

---

## 🗄 4. Data Model (Entity Relationship)

The core database structure ensures scalability and user-data isolation.

```mermaid
erDiagram
    USERS ||--o{ PORTFOLIO_JOBS : owns
    USERS ||--|| USER_SETTINGS : configures
    USERS {
        uuid id PK
        string email
        string password_hash
        jsonb preferences
        datetime created_at
    }
    PORTFOLIO_JOBS {
        uuid id PK
        uuid user_id FK
        string status
        jsonb results
        string error
        datetime completed_at
    }
    DOMAIN_CACHE {
        string domain PK
        boolean available
        numeric price
        jsonb nexus_score
        datetime expires_at
    }
```

---

## 🛠 Feature-by-Feature Deep Dive

### 1. The Domain Terminal
- **Purpose**: Real-time evaluation of single domains.
- **Key Logic**:
    - **TCO (Total Cost of Ownership)**: Calculates 1-year, 5-year, and 10-year costs across different registrars.
    - **Arbitrage Detection**: Flags if a domain is significantly cheaper at one registrar versus others.
    - **Investment Grade**: Uses a proprietary algorithm to assign grades from **S (Elite)** to **F (Junk)**.

### 2. Portfolio Auditor
- **Purpose**: Bulk valuation and health checks for large portfolios.
- **Capabilities**:
    - Supports CSV uploads up to 10k rows.
    - **Manual Mode**: A real-time editable spreadsheet interface for "live-modelling" portfolios without file uploads.
    - **Auto-Discovery**: For Cloudflare users, it can automatically pull all domains from their account for auditing.

### 3. Nerve Center (Dashboard)
- **Purpose**: High-level financial overview.
- **Metrics**:
    - **Portfolio Net Worth**: Sum of all estimated asset values.
    - **Monthly Burn**: Total renewal costs normalized per month.
    - **TLD Velocity**: Tracking which extensions are trending in the market.

### 4. Settings & Integrations
- **Purpose**: Secure management of API credentials.
- **Registrar Support**:
    - **Porkbun**: Direct API for production pricing.
    - **Cloudflare**: Global API integration for management.
    - **GoDaddy**: OTE (Test) environment integration.

---

## 🤖 Intelligence Core & Model Accuracy

The **Intelligence Core** is the heart of the NEXUS valuation engine. It uses a **Dual-Model Ensemble (XGBoost + Random Forest)** to provide a highly robust quantitative baseline score for any domain.

### Model Performance (Benchmark: May 2026)

The model is evaluated against a curated benchmark dataset of 4,000 domains using a realistic 80/20 train-test split.

- **Overall Closeness Accuracy**: **91.18%**
- **R-squared (Variance Explained)**: **0.59**
- **Trend Correlation**: **0.77** (Strong directional alignment with market prices)

### Accuracy Breakdown by Tier

| Domain Tier | Accuracy | Description |
| :--- | :--- | :--- |
| **High Tier** | **94.8%** | Exceptional at identifying and valuing premium, liquid assets. |
| **Medium Tier** | **71.1%** | Reliable for standard brandable domains and common extensions. |
| **Low Tier** | **65.9%** | Tends to be "optimistic"; current focus of calibration efforts. |

### Running Self-Evaluations

Developers can run a local accuracy audit at any time using the dedicated evaluation suite:
```powershell
cd NEXUS-BD/intelligence-core
python scripts/evaluate_model.py      # Test-only mode
python scripts/train_test_eval.py    # Proper 80/20 split test
```

### Retraining for Production

To update the live model with new data from `data/nexus_domain_india_4000.csv`:
```powershell
cd NEXUS-BD/intelligence-core
python scripts/train_production_model.py
```

---

## 🚀 Performance Optimizations

1. **Domain Caching**: To minimize registrar API costs and latency, successful searches are cached for 24 hours.
2. **SSE Streaming**: Instead of waiting 10 seconds for a full valuation, users see data as it's discovered (Registrar pricing first, then ML score, then Semantic analysis).
3. **Zustand Persistence**: Auth state and dashboard preferences are persisted in `localStorage` to ensure a seamless experience on reload.

---

**NEXUS** — *The future of digital asset management.*
