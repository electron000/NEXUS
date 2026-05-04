# NEXUS Digital Asset Terminal 🌐

NEXUS is a high-fidelity, professional-grade digital asset terminal designed for domain investors, brand managers, and financial analysts. It synthesizes real-time market data, machine learning valuations, and multi-registrar arbitrage signals into a unified institutional interface.

---

## 🏗 System Architecture

The NEXUS ecosystem is composed of three primary layers, ensuring high performance, scalability, and intelligence.

### 1. **NEXUS-FD (Frontend)**
- **Framework**: Next.js 14 (App Router)
- **State Management**: Zustand (with session & persistence layers)
- **Styling**: Premium "Terminal" aesthetic using Glassmorphism and specialized CSS animations.
- **Code Quality**: 100% ESLint compliant (0 errors, 0 warnings).
- **Core Views**:
  - **Nerve Center**: Real-time portfolio metrics and market sentiment.
  - **Domain Terminal**: Real-time valuation engine with SSE streaming.
  - **Portfolio Auditor**: Bulk CSV analysis with async job polling.

### 2. **NEXUS-BD: Nerve Center (Backend)**
- **Runtime**: Node.js / Express
- **Responsibilities**:
  - **Registrar Orchestration**: Dynamic live pricing from multiple registrars.
  - **Job System**: Asynchronous batch processing for portfolio audits.
  - **Security**: JWT-based institutional authentication and per-user encrypted settings.
  - **Streaming**: Server-Sent Events (SSE) for real-time valuation transparency.

### 3. **NEXUS-BD: Intelligence Core (ML Service)**
- **Runtime**: Python / FastAPI
- **Intelligence**:
  - **Nexus Ensemble Model**: A high-accuracy dual-model system combining **XGBoost** and **Random Forest** regressors. Tested at **91.18% closeness accuracy** on unseen data.
  - **LLM Semantic Score**: Linguistic analysis via OpenAI/Gemini.
  - **Momentum Tracking**: Real-time Google Trends integration for "Trend Score" synthesis.

### **Service Mapping**

| Service | Stack | Port | Description |
|---|---|---|---|
| **Terminal (FD)** | Next.js 14 | `3000` | Institutional UI & Dashboard |
| **Nerve Center (BD)** | Node.js | `3001` | API Gateway & Orchestration |
| **Intelligence Core (BD)** | Python | `8000` | ML Scoring & LLM Logic |
| **Database** | PostgreSQL | `5432` | User Profiles & Job State |

---

## 📡 Multi-Registrar Integration Status


NEXUS leverages direct API integrations to provide real-time arbitrage signals. 

| Registrar | Status | Mode | Features |
|---|---|---|---|
| **Porkbun** | ✅ Active | Production | Live Pricing, Availability, TCO Analysis |
| **Cloudflare** | ✅ Active | Global API | Management, Discovery, Integrated Pricing |
| **GoDaddy** | 🧪 OTE | Test | Pricing (Switching to Prod @ 50 domains) |
| **Namecheap** | ⏳ Pending | $50 Balance | API access requires minimum account funding |
| **Dynadot** | ⏳ Pending | Spend Req. | Requires $50+ annual spend or 10 domains |

### **Integrated Utility Logic**
- **Cloudflare Discovery**: Automatically fetches Account IDs and management metadata across the terminal and auditor.
- **Porkbun Live Check**: Used as the primary fallback for high-fidelity pricing when other registrars are rate-limited.
- **Global Settings**: Credentials (API Keys, Secrets, Emails) are stored securely in the database per-user, enabling personal institutional access.

---

## 🚀 Core Features & Functionality

### 1. **The Domain Terminal (Valuation Engine)**
Search any domain to trigger a multi-stage valuation pipeline:
1. **Scraping**: Fetches live registrar pricing and availability.
2. **ML Scoring**: Calculates the "Nexus Ensemble Score" (0–100) using a dual-algorithm approach and assigns an investment grade (S–F).
3. **TCO Modeling**: Generates a 5-year Total Cost of Ownership projection (Best/Expected/Worst case).
4. **Arbitrage Signals**: Identifies price discrepancies between registrars for immediate ROI.

### 2. **The Portfolio Auditor (Bulk Analysis)**
Upload `.csv` files (up to 10,000 rows) for background analysis:
- **Async Processing**: Jobs run in the background; UI polls for completion.
- **Data Enrichment**: Attaches ML scores and live market valuations to every row.
- **Manual Mode**: Excel-style manual entry for quick "what-if" modeling.

### 3. **The Nerve Center (Dashboard)**
Institutional overview of your digital assets:
- **Aggregated Metrics**: Total Portfolio Value, Monthly Run Rate, and CAGR.
- **Market Pulse**: Dynamic sentiment indicators derived from current TLD velocity.
- **Live Watchlist**: Real-time tracking of mission-critical assets.

---

## 🛡 Security & Best Practices

- **Zero-Credential Policy**: No API keys are hardcoded. All integrations use environment variables or database-encrypted settings.
- **Robust .gitignore**: Protecting environment secrets and build artifacts across all repositories.
- **Strict Typing**: TypeScript interfaces unify the FD and BD data contracts, preventing runtime failures.
- **Clean Code**: Verified via `npm run lint` with 100% compliance.

---

## 🛠 Setup & Development

### **Root Configuration**
1. Clone the repository and submodules.
2. Configure `.env` in `NEXUS-BD/nerve-center` and `NEXUS-BD/intelligence-core`.
3. Run `docker-compose up --build` for the full stack.

### **Registrar Credentials**
To activate live pricing, navigate to **Settings** in the dashboard and input your API keys for:
- **GoDaddy**: Key & Secret
- **Porkbun**: Key & Secret
- **Cloudflare**: Email & Global Key

---

## 📝 Roadmap & Pending Requirements

- **Namecheap/Dynadot Production**: Will be activated once the project account meets the minimum registrar-specific funding thresholds.
- **GoDaddy Production Migration**: Planned for the next development phase once the portfolio reach exceeds 50 domains.
- **Enhanced ML Training**: Incorporating real-time sale data from Afternic/Sedo APIs.

---

## 📖 API Reference (Key Endpoints)

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/api/auth/signup` | Register new institutional account |
| **POST** | `/api/auth/login` | Authenticate & retrieve JWT |
| **POST** | `/api/domains/check` | Batch availability check (up to 50 domains) |
| **GET** | `/api/domains/valuation-stream/:domain` | SSE stream for real-time ML valuation |
| **POST** | `/api/portfolio/upload` | Async CSV audit upload |
| **GET** | `/api/portfolio/status/:jobId` | Poll audit job status & results |

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*

