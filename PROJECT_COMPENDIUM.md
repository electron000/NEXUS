# NEXUS Project Compendium 🌐

The master guide for the **NEXUS Digital Asset Terminal**.

---

## 🏛 1. The Triple-Layer Architecture

### **Frontend (NEXUS-FD)**
- **Stack**: Next.js 14, TypeScript, TailwindCSS, Framer Motion, Zustand, Socket.IO Client.
- **Role**: Institutional-grade UI for asset management, valuation, and P2P negotiation.
- **Security**: Stateless frontend with session-based HttpOnly cookie authentication.
- **User Roles**: `investor`, `brand_manager`, `analyst`

### **Backend: Nerve Center (NEXUS-BD/nerve-center)**
- **Stack**: Node.js, Express, PostgreSQL, Socket.IO.
- **Role**: API Gateway, registrar orchestration, ownership verification, and real-time messaging hub.
- **Port**: `4000`

### **Backend: Intelligence Core (NEXUS-BD/intelligence-core)**
- **Stack**: Python, FastAPI, XGBoost.
- **Role**: High-performance ML inference and brandability analysis.
- **Port**: `8000`

---

## 📁 2. Folder Structure

```text
NEXUS/
├── NEXUS-FD/                    # Frontend (Port 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # /login, /register
│   │   │   ├── (dashboard)/     # Protected dashboard routes
│   │   │   │   ├── layout.tsx   # Sidebar, mobile nav, AuthGuard
│   │   │   │   ├── overview/    # Nerve Center — portfolio metrics
│   │   │   │   ├── terminal/    # Domain Terminal (Triple-Mode Engine)
│   │   │   │   ├── portfolio/   # Asset listing, verification, KYC
│   │   │   │   ├── watchlist/   # Tracked domain assets
│   │   │   │   └── messages/    # Communications Hub + NexusChat
│   │   │   ├── (marketing)/     # Public landing page
│   │   │   ├── admin/           # Admin Dashboard (KYC review, stats)
│   │   │   │   ├── login/
│   │   │   │   └── dashboard/
│   │   │   └── unauthorized/    # Access-denied page
│   │   ├── components/
│   │   │   ├── terminal/        # ArbitrageTable, ScoreGauge, SSEProgressBar, InquiryModal
│   │   │   └── ui/              # badge, button, card, input, progress, skeleton, table, tooltip
│   │   ├── services/            # API Bridge: auth, user, domains, admin
│   │   ├── lib/                 # utils, socket (Socket.IO), valuation (SSE helper)
│   │   ├── store/               # Zustand: session, watchlist, terminal history, UI prefs
│   │   └── types/               # Central Type Manifest (index.ts)
├── NEXUS-BD/
│   ├── nerve-center/            # Node.js API Gateway (Port 4000)
│   │   ├── src/
│   │   │   ├── routes/          # Domains, Inquiries, User, Auth, Admin
│   │   │   ├── services/        # Verification, Registrar, ML-Bridge, Socket
│   │   │   └── config/          # Database (PG) & Logger
│   └── intelligence-core/       # Python ML Service (Port 8000)
│       ├── app/                 # FastAPI Scorer & Routes
│       ├── models/              # XGBoost & Scikit-Learn Artifacts
│       └── scripts/             # Training & Evaluation Suites
```

---

## 🚀 3. Functional Capabilities

### **1. Real-Time Domain Intelligence**
- **Nexus Score**: Weighted synthesis of Quantitative (35%), Semantic (40%), and Trend (25%) signals, plus a Confidence percentage.
- **Registrar Arbitrage**: Live comparison table across GoDaddy, Porkbun, and Name.com — showing registration, renewal, transfer, and privacy costs with best-price highlighting.
- **Domain Summary & Tags**: AI-generated natural-language summary and keyword tags included in every valuation response.

### **2. Technical Verification**
- **Ownership Validation**: Real-time DNS TXT and HTML Meta crawling.
- **Identity (KYC)**: Aadhaar-based institutional verification for sellers. Collects personal details plus document images.
- **Admin Review**: Human-in-the-loop oversight for platform trust via the Admin Dashboard.

### **3. P2P Connectivity (Nexus Connect)**
- **Inquiry Creation**: Send a purchase proposal with an optional offer price from the Exchange terminal view.
- **Communications Hub**: Inbox listing all active inquiries with counterparty, domain, offer, and status.
- **Live Chat**: Socket.IO–powered bidirectional messaging per inquiry thread.

### **4. Watchlist**
- Bookmark any domain from the Terminal with a single click.
- Persisted locally (Zustand + localStorage). Supports notes per entry.
- One-click re-analysis shortcut back into the Terminal.

### **5. Portfolio Management**
- Register owned domains in the NEXUS portfolio.
- Technical proof-of-ownership via DNS or HTML verification.
- Set listing status and asking price for P2P discovery.

---

## 🔍 4. Data Integrity Standards

NEXUS enforces a **Zero-Simulation Policy**:
1. **No Dummy Indices**: All scores are derived from real-time ML inference or historical sales data fallbacks.
2. **Authentic Valuations**: FMV and predicted prices are produced by the Intelligence Core — no placeholder values.
3. **Live Registrar Sync**: Pricing and availability are fetched directly from provider APIs.
4. **Verified Metrics**: The Nerve Center dashboard only displays valuations for assets with confirmed ownership.
5. **Real Change Indicators**: Portfolio metric trend percentages reflect actual API data, not estimated values.

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
