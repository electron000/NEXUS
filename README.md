# NEXUS Digital Asset Terminal 🌐

NEXUS is an institutional-grade digital asset terminal designed for domain investors, brand managers, and financial analysts. It synthesizes real-time registrar data, machine learning valuations, and peer-to-peer exchange logic into a unified, high-fidelity interface.

---

## 🏗 System Architecture

NEXUS uses a specialized triple-layer architecture to decouple user experience, business logic, and machine learning intelligence.

### 1. **NEXUS-FD (Frontend)**
- **Framework**: Next.js 14 (App Router), TypeScript, TailwindCSS, Framer Motion.
- **State Management**: Zustand (Persisted to localStorage).
- **Communication**: SSE (Server-Sent Events) for valuations, Socket.IO for real-time chat.
- **Security**: Cookie-based session management (HttpOnly).

### 2. **NEXUS-BD: Nerve Center (API Gateway)**
- **Runtime**: Node.js / Express, PostgreSQL, Socket.IO.
- **Responsibilities**: Orchestration of registrar APIs, ownership verification, P2P messaging hub, and data streaming.
- **Port**: `4000`

### 3. **NEXUS-BD: Intelligence Core (ML Service)**
- **Runtime**: Python / FastAPI, XGBoost.
- **Intelligence**: Predictive valuation baseline trained on 4,000+ domain sales, semantic scoring, and trend synthesis.
- **Port**: `8000`

---

## 🚀 Core Features

### 1. The Triple Terminal
A dynamic valuation engine that adapts to user intent:
- **Acquisition**: Registrar arbitrage table comparing GoDaddy, Porkbun, and Name.com for the lowest registration and renewal costs.
- **Appraisal**: Fair Market Value (FMV) projection, Nexus Score (0-100), and categorical Tiers (High/Medium/Low).
- **Exchange**: RDAP/WHOIS ownership snapshot and P2P negotiation panel for verified Nexus assets.

### 2. Ownership & Trust (KYC)
- **Technical Validation**: Prove asset ownership via automated DNS TXT or HTML meta tag crawling.
- **Identity Verification (KYC)**: Aadhaar-based institutional verification for sellers, managed via a dedicated Admin Dashboard.

### 3. Nexus Connect (Messages)
- **Real-Time Chat**: Socket.IO–powered bidirectional messaging within inquiry threads for secure domain negotiations.

### 4. Portfolio & Watchlist
- **Portfolio**: Track owned assets with live valuation updates and verification badges.
- **Watchlist**: Monitor external domains for availability and market changes.

---

## 🐳 Setup & Installation

### Option A: Docker Compose (Recommended)
The entire NEXUS stack is containerized for instant deployment.

1. **Build and Run**:
   ```bash
   cd NEXUS-BD
   docker-compose up --build
   ```
2. **Access**:
   - Frontend: `http://localhost:3000`
   - Admin Login: `admin@nexus.io` / `NexusAdmin2026!`

---

### Option B: Manual Installation

#### 1. Backend: Nerve Center (Port 4000)
1. **Install**: `cd NEXUS-BD/nerve-center && npm install`
2. **Configure**: Create `.env` with DB credentials and Registrar keys (`GODADDY_KEY`, `PORKBUN_KEY`, etc.).
3. **Initialize DB**: `node src/db/rebuild.js` (Seeds admin account).
4. **Run**: `npm run dev`

#### 2. Backend: Intelligence Core (Port 8000)
1. **Install**: `cd NEXUS-BD/intelligence-core && pip install -r requirements.txt`
2. **Configure**: Create `.env` with `INTERNAL_API_KEY` matching the Nerve Center.
3. **Run**: `python -m uvicorn app.main:app --port 8000`

#### 3. Frontend: NEXUS Terminal (Port 3000)
1. **Install**: `cd NEXUS-FD && npm install`
2. **Configure**: Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000`.
3. **Run**: `npm run dev`

---

## ⚙️ Technical Workflow

### 1. Domain Intelligence Pipeline
1. **Intake**: User submits domain via the Terminal.
2. **Stream**: Nerve Center initiates SSE; emits progress stages (Scanning Ecosystem, Analyzing Core, etc.).
3. **Intelligence**: Intelligence Core executes XGBoost, semantic, and trend pipelines in parallel.
4. **Synthesis**: Nerve Center calculates the final **Nexus Score** and **FMV**.
   - `Overall = (Quantitative × 0.35) + (Semantic × 0.40) + (Trend × 0.25)`
   - `FMV = BaseValue(TLD) × LengthMultiplier × (Score / 55)^3.0`

### 2. Live Chat (NexusChat)
1. **Join**: User selects an inquiry; client joins a Socket.IO room named after the inquiry ID.
2. **Broadcast**: Messages are emitted to the room and persisted in PostgreSQL.
3. **Sync**: deduplicated message stream with automatic scroll-to-bottom.

---

## 📡 API Reference

### Domain Intelligence
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/domains/valuation-stream/:domain` | SSE stream for real-time appraisals |
| `POST` | `/api/domains/check` | Bulk availability check |

### User Portfolio & Inquiries
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/user/portfolio` | Add domain with `boughtPrice` |
| `POST` | `/api/inquiries` | Initiate P2P negotiation |

### Admin (requires `is_admin: true`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Platform metrics (excludes admins) |
| `POST` | `/api/admin/kyc/review` | Approve/Reject user KYC |

---

## 🗄 Project Structure

```text
NEXUS/
├── NEXUS-FD/                    # Next.js Frontend
│   ├── src/app/
│   │   ├── (dashboard)/         # Overview, Terminal, Portfolio, Messages
│   │   ├── admin/               # Admin Control Center
│   │   └── (marketing)/         # Landing Page
├── NEXUS-BD/
│   ├── nerve-center/            # Node.js API Gateway
│   └── intelligence-core/       # Python ML Service
└── docker-compose.yml           # Complete system orchestration
```

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
