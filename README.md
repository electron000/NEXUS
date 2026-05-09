# NEXUS Digital Asset Terminal 🌐

NEXUS is an institutional-grade digital asset terminal designed for domain investors, brand managers, and financial analysts. It synthesizes real-time registrar data, machine learning valuations, and peer-to-peer exchange logic into a unified, high-fidelity interface.

---

## 🏗 System Architecture

The NEXUS ecosystem is built on a specialized triple-layer stack designed for absolute data integrity and security.

### 1. **NEXUS-FD (Frontend)**
- **Framework**: Next.js 14 (App Router)
- **State Management**: Zustand (Persisted to localStorage)
- **Security**: Cookie-based session management (HttpOnly)
- **User Roles**: `investor`, `brand_manager`, `analyst`
- **Core Views**:
  - **Nerve Center** (`/overview`): Real-time portfolio metrics and verified intelligence feed.
  - **Domain Terminal** (`/terminal`): Triple-mode engine (Acquisition, Appraisal, Exchange).
  - **My Portfolio** (`/portfolio`): Technical asset verification (DNS/HTML) and KYC management.
  - **Watchlist** (`/watchlist`): Monitor tracked domains for availability or listing changes.
  - **Messages** (`/messages`): Secure inquiry inbox and real-time P2P negotiation chat.
- **Public Surface**:
  - **Marketing/Landing Page** (`/`): Feature overview and onboarding entry point.
  - **Auth Pages**: `/login`, `/register`
  - **Unauthorized** (`/unauthorized`): Access-denied redirect target.

### 2. **NEXUS-BD: Nerve Center (API Gateway)**
- **Runtime**: Node.js / Express
- **Port**: `4000`
- **Responsibilities**:
  - **Orchestration**: Real-time integration with GoDaddy, Porkbun, and Name.com.
  - **Verification Engine**: Automated ownership validation via DNS TXT record and HTML meta tag crawling.
  - **Nexus Connect**: Secure inquiry creation and P2P messaging hub.
  - **Data Streaming**: Server-Sent Events (SSE) for domain valuation transparency.
  - **Real-Time Messaging**: Socket.IO for live bidirectional chat within active inquiries.

### 3. **NEXUS-BD: Intelligence Core (ML Service)**
- **Runtime**: Python / FastAPI
- **Port**: `8000`
- **Intelligence**:
  - **XGBoost Pipeline**: Predictive valuation baseline trained on 4,000+ domain sales.
  - **Semantic Scoring**: Brandability and linguistic sentiment analysis.
  - **Trend Analysis**: Market velocity tracking and search momentum synthesis.

### 4. **Admin Dashboard**
- **Route**: `/admin/dashboard` (protected by `is_admin` flag)
- **Capabilities**: Platform-wide stats (users, sellers, inquiries, active portfolio domains), pending KYC queue review (approve/reject with reason), Aadhaar document inspection.

---

## 📡 Production Connectivity

NEXUS utilizes direct, authentic API integrations for 100% data fidelity.

| Provider | Status | Role |
| :--- | :--- | :--- |
| **GoDaddy** | ✅ Active | Live Pricing & Availability |
| **Porkbun** | ✅ Active | Renewal TCO & Arbitrage Signals |
| **Name.com** | ✅ Active | Bulk Discovery & Registry Access |
| **RDAP/WHOIS** | ✅ Active | Real-time Ownership Intelligence |

---

## 🚀 Core Features

### 1. The Triple Terminal
A dynamic valuation engine that adapts to user intent:
- **Acquisition**: Registrar arbitrage table (registration, renewal, transfer, privacy costs), Scarcity Index gauge, and primary acquisition recommendation.
- **Appraisal**: Fair Market Value (FMV) projection, ML-predicted sale price, Semantic Score gauge, and Velocity (Trend) gauge.
- **Exchange**: RDAP/WHOIS ownership snapshot, P2P negotiation panel (Nexus members) or watchlist fallback (external assets), and Nexus Trust Index gauge.

All results include a domain summary, tag set, grade badge (S → F), and a Trust confidence percentage.

### 2. Ownership & Trust (KYC)
- **Technical Validation**: Prove asset ownership via automated DNS TXT (`nexus-site-verification=[TOKEN]`) or HTML meta tag crawling.
- **Identity Verification (KYC)**: Submit full name, address, and Aadhaar (front + back) for manual admin review. Approval grants the global "Verified Seller" badge.
- **Admin Review**: Human-in-the-loop KYC approval via the Admin Dashboard.

### 3. Nexus Connect (Messages)
- **Inquiry Creation**: Initiate a purchase offer (with optional price) directly from the Exchange terminal view.
- **Communications Hub**: Inbox listing all active inquiries with counterparty, domain, and offer price.
- **Real-Time Chat**: Socket.IO–powered bidirectional messaging within each inquiry thread.

### 4. Watchlist
- Bookmark any domain from the Terminal with one click.
- View all tracked assets with add date and notes.
- One-click re-analysis from the watchlist back into the Terminal.

---

## 🛠 Setup & Development

Detailed instructions are available in [SETUP.md](./SETUP.md).

1. **Install Dependencies**: `npm install` in FD/BD and `pip install` in ML Core.
2. **Configure Secrets**: Populate `.env` files with database and registrar API keys.
3. **Launch Stack**:
   - **Frontend**: `npm run dev` (Port 3000)
   - **Nerve Center**: `npm run dev` (Port 4000)
   - **Intelligence Core**: `uvicorn app.main:app` (Port 8000)

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
