# NEXUS System Documentation 🌐

Master guide for the **NEXUS Digital Asset Terminal**.

---

## 🏗 High-Level System Architecture

NEXUS uses a specialized triple-layer architecture to decouple user experience, business logic, and machine learning intelligence.

```mermaid
graph TD
    subgraph "Frontend Layer (NEXUS-FD)"
        UI["Next.js 14 Dashboard"]
        State["Zustand State Store"]
        SSE_Listener["SSE Client (Valuation Stream)"]
        WS_Client["Socket.IO Client (Live Chat)"]
    end

    subgraph "Orchestration Layer (NEXUS-BD: Nerve Center)"
        API_GW["Express API Gateway (Port 4000)"]
        Auth["Session Auth Service"]
        Registrar_Proxy["Registrar Orchestrator"]
        WS_Server["Socket.IO Server (Inquiry Rooms)"]
        DB[(PostgreSQL)]
    end

    subgraph "Intelligence Layer (NEXUS-BD: Intelligence Core)"
        FastAPI["FastAPI Scorer (Port 8000)"]
        XGBoost["XGBoost ML Model"]
        LLM["Semantic Brandability Analysis"]
        Trend_Logic["Trend Momentum Engine"]
    end

    subgraph "External Integrations"
        Registrars["Registrar APIs (GoDaddy, Porkbun, Name.com)"]
        RDAP["RDAP/WHOIS Network"]
    end

    UI <--> State
    UI -- "REST / Cookie Auth" --> API_GW
    SSE_Listener -- "EventSource (SSE)" --> API_GW
    WS_Client <--> WS_Server

    API_GW -- "Data Persistence" --> DB
    API_GW -- "Fetch Pricing" --> Registrar_Proxy
    Registrar_Proxy <--> Registrars

    API_GW -- "Request Scoring" --> FastAPI
    FastAPI -- "Valuation Logic" --> XGBoost
    FastAPI --> LLM
    FastAPI --> Trend_Logic
```

> **Note on real-time transports**: SSE is used exclusively for the domain valuation pipeline (one-directional server push). Socket.IO provides the bidirectional channel for live messaging within inquiry threads.

---

## 🔑 1. Authentication & Security Flow

NEXUS implements session-based security using **HttpOnly Cookies**.

### Flowchart: Secure Session Lifecycle
```mermaid
sequenceDiagram
    participant User
    participant FD as NEXUS-FD
    participant NC as Nerve Center (BD)
    participant DB as PostgreSQL

    User->>FD: Enter Credentials
    FD->>NC: POST /api/auth/login
    NC->>DB: Verify Identity
    DB-->>NC: User Profile (id, email, name, role, is_admin, kyc_status)
    NC->>NC: Create Signed Session
    NC-->>FD: Set-Cookie (connect.sid, httpOnly)
    FD->>FD: Initialize Zustand Store
    Note over FD: Protected Routes Activated
    Note over FD: Admin routes additionally check is_admin flag
```

---

## 📈 2. Domain Valuation Pipeline

The Domain Terminal uses a multi-stage pipeline streamed via **Server-Sent Events (SSE)**.

```mermaid
flowchart TD
    Start([User Search]) --> Intent{User Mode?}
    Intent -- Acquisition --> Stage1[Registrar Discovery]
    Intent -- Appraisal --> StageApp[ML Appraisal]
    Intent -- Exchange --> StageOwn[Ownership Discovery]

    Stage1 --> P1[GoDaddy] & P2[Porkbun] & P3[Name.com]
    StageOwn --> DB_Lookup[(NEXUS Portfolio)] & RDAP[RDAP/WHOIS]
    StageApp --> ML[XGBoost Pipeline]

    ML --> Synthesis[Nexus Score Synthesis]
    Synthesis --> Output[Stream to UI via SSE]
    Output --> Results["Domain Header (name, grade, trust %, summary, tags)"]
```

### SSE Progress Phases
Phases are emitted in sequence with a `pct` progress value:

| Phase Label | What Happens |
| :--- | :--- |
| `Scraping Registrars...` | Live pricing fetched from GoDaddy, Porkbun, Name.com |
| `Analyzing Linguistics...` | LLM semantic and brandability scoring |
| `Ownership Analysis...` | RDAP/WHOIS lookup + NEXUS portfolio cross-check |
| `Synthesizing Intelligence...` | Weighted score composition and FMV appraisal |
| `complete` | Full `DomainValuationResponse` emitted on `complete` event |

---

## 🗄 3. Data Model (Entity Relationship)

```mermaid
erDiagram
    USERS ||--o{ PORTFOLIO : owns
    USERS ||--o{ WATCHLIST : monitors
    USERS ||--o{ INQUIRIES : sends
    PORTFOLIO ||--o{ INQUIRIES : receives

    USERS {
        uuid id PK
        string email
        string password_hash
        string name
        enum role "investor | brand_manager | analyst"
        boolean is_admin
        enum kyc_status "unverified | pending | verified | rejected"
        datetime created_at
    }

    PORTFOLIO {
        uuid id PK
        uuid user_id FK
        string domain
        enum verification_status "pending | verified | failed"
        string verification_token
        boolean is_for_sale
        numeric asking_price
        datetime created_at
    }

    WATCHLIST {
        uuid id PK
        uuid user_id FK
        string domain
        datetime added_at
        numeric alert_price
        text notes
    }

    INQUIRIES {
        uuid id PK
        uuid sender_id FK
        string domain
        numeric offer_price
        text message
        enum status "open | closed"
        datetime created_at
    }
```

---

## 🛠 Feature Deep Dive

### 1. The Triple Terminal
- **Acquisition**: Registrar arbitrage table (registration, renewal, transfer, privacy costs per registrar), Scarcity Index gauge, and a primary recommendation block.
- **Appraisal**: Fair Market Value (FMV) and ML-predicted sale price panels, Semantic Score gauge (brand affinity), Velocity gauge (search trend momentum).
- **Exchange**: RDAP/WHOIS ownership snapshot (owner, country, last updated), P2P offer panel for Nexus-member assets, watchlist fallback for external assets, Nexus Trust Index gauge.

### 2. Nerve Center (Dashboard Overview)
Real-time metrics updated every 30 seconds from the Nerve Center API. Each metric includes a `change` percentage shown as a trend indicator:

- **Portfolio Value**: Sum of verified asset appraisals.
- **Active Domains**: Count of technically verified portfolio holdings.
- **Monthly Revenue**: Projected income from active P2P inquiries.
- **Watchlist Size**: Total domains currently being monitored.

### 3. Messages (Communications Hub)
- **Inbox**: Lists all inquiries for the authenticated user — shows domain, counterparty email, offer price, and status.
- **NexusChat**: Real-time Socket.IO thread per inquiry. Messages are fetched via REST on load, then kept live via `join_inquiry` room events.
- **Inquiry Creation**: Launched from the Exchange terminal view via `InquiryModal` — accepts a free-text message and optional offer price (`POST /api/inquiries`).

### 4. Portfolio & Verification
- **Domain Listing**: Add a domain to your portfolio (`POST /api/user/portfolio`).
- **Ownership Proof**: Choose DNS TXT record or HTML meta tag method. The Nerve Center verifies via `dns.resolveTxt` or HTTP crawl.
- **KYC Submission**: Multi-step form collecting personal details and Aadhaar (front + back). Submitted to admin queue for manual review.

### 5. Watchlist
- Add any domain from the Terminal with one click (persisted in Zustand + localStorage).
- View add date and optional notes per entry.
- Re-run analysis on any watched domain directly from the list.

### 6. Admin Dashboard
- Accessible only to users with `is_admin: true`.
- **Stats Panel**: `totalUsers`, `totalSellers`, `totalInquiries`, `totalPortfolioDomains`, `activeConnections`.
- **KYC Queue**: Table of pending verification requests with Aadhaar document review and approve/reject actions.

### 7. Integrated Verification
- **DNS Method**: TXT record lookup for `nexus-site-verification=[TOKEN]`.
- **HTML Method**: Meta tag crawl for `<meta name="nexus-site-verification" content="[TOKEN]">`.
- **Identity (KYC)**: Aadhaar-based manual administrative review. Approval sets `kyc_status` to `verified` and grants the "Verified Seller" badge platform-wide.

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
