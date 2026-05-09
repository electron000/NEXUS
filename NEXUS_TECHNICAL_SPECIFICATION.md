# NEXUS: Technical Specification & Data Flow

High-fidelity technical documentation for the NEXUS terminal.

---

## 🏛 1. System Architecture

1. **Nerve Center (Node.js)**: Port `4000`. API Gateway, registrar aggregator, KYC authority, and Socket.IO messaging hub.
2. **Intelligence Core (FastAPI)**: Port `8000`. High-performance ML inference and brandability analysis.
3. **Terminal (Next.js)**: Port `3000`. Institutional-grade interface and dashboard.

---

## 🧠 2. Intelligence Core Logic

### **Scoring Components**
1. **Quantitative Baseline**: XGBoost Regressor trained on 4,000+ domain sales. Features: character length, vowel-consonant alternation, TLD authority weight, keyword scarcity index.
2. **Semantic Score**: Brandability proxy derived from linguistic analysis (memorability, sentiment, brand affinity). Output: 0–100.
3. **Trend Momentum**: Dynamic velocity calculation based on search trend data over a 90-day window. Output: normalized 0–100 signal.
4. **Confidence**: A composite trust factor (0.0–1.0) reflecting data completeness and model certainty. Displayed in the UI as "Trust: X%".

### **API Interface: `POST /api/ml/nexus-score`**
**Response Structure:**
```json
{
  "domain": "string",
  "quantitative_baseline": 82.5,
  "semantic_score": 91.0,
  "trend_momentum": 12.0,
  "predicted_price": 15400,
  "predicted_tier": "high",
  "model_used": "xgboost"
}
```

---

## ⚙️ 3. Nerve Center Orchestration

### **I. Weighted Score Formula**
> **`Overall = (Quantitative × 0.35) + (Semantic × 0.40) + (Trend × 0.25)`**

### **II. Institutional Grading**
| Grade | Score Range | Meaning |
| :--- | :--- | :--- |
| **S** | 90+ | Elite |
| **A** | 80–89 | Premium |
| **B** | 70–79 | Investment |
| **C** | 60–69 | Standard |
| **D** | 50–59 | Speculative |
| **F** | < 50 | Junk |

### **III. Fair Market Value (FMV) Formula**
> **`FMV = BaseValue(TLD) × LengthMultiplier × (OverallScore / 55)^3.0`**

Reference values:
- **Base TLD Value**: `.com` → $800, `.ai` → $1,200, `.io` → $1,000
- **Length Multiplier**: 3-char → 8×, 5-char → 3×, 8-char → 1×

### **IV. Registrar Integration**
Direct REST/JSON integration with:
- **GoDaddy**: Production API for live pricing and availability.
- **Porkbun**: V3 API for renewal cost modeling and registrar arbitrage.
- **Name.com**: V4 API for bulk discovery signals.

---

## 📡 4. API Reference

### Authentication
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Session login (sets HttpOnly cookie) |
| `POST` | `/api/auth/logout` | Session termination |
| `GET` | `/api/auth/me` | Returns authenticated user profile |

### Domain Intelligence
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/domains/valuation-stream/:domain` | SSE stream — emits `progress` and `complete` events |
| `POST` | `/api/domains/check` | Bulk availability check across registrars |
| `GET` | `/api/domains/:domain` | Cached domain details |

### User Portfolio
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/portfolio` | List authenticated user's domains |
| `POST` | `/api/user/portfolio` | Add a domain to portfolio |
| `POST` | `/api/user/portfolio/verify` | Trigger DNS or HTML ownership verification |

### Inquiries & Messaging
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/inquiries` | List all inquiries for the authenticated user |
| `POST` | `/api/inquiries` | Create a new inquiry (domain, message, optional offer_price) |
| `GET` | `/api/inquiries/:id/messages` | Fetch message history for an inquiry thread |

### Admin (requires `is_admin: true`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Platform-wide statistics |
| `GET` | `/api/admin/kyc/pending` | Queue of pending KYC submissions |
| `POST` | `/api/admin/kyc/review` | Approve or reject a KYC submission (with optional reason) |

---

## 🔌 5. Real-Time Transports

### SSE — Domain Valuation Stream
Used for the Terminal's domain analysis pipeline. One-directional (server → client).

```
GET /api/domains/valuation-stream/:domain
Event: progress  → { stage: LoadingPhase, pct: number }
Event: complete  → DomainValuationResponse (full payload)
Event: error     → connection closed, error surfaced in UI
```

### Socket.IO — Live Messaging
Used for real-time chat within inquiry threads. Bidirectional.

```
Connection: io(API_BASE_URL, { withCredentials: true })
Client emits:  join_inquiry  (inquiryId)
Server emits:  new_message   (Message object)
```

---

## 🛡️ 6. Identity & Trust (KYC)

### KYC Submission Fields
| Field | Type | Description |
| :--- | :--- | :--- |
| `firstName` | string | Legal first name |
| `middleName` | string | Legal middle name (optional) |
| `lastName` | string | Legal last name |
| `fatherName` | string | Father's full name |
| `motherName` | string | Mother's full name |
| `address` | string | Residential address |
| `aadhaar_front` | File (image) | Front of Aadhaar card |
| `aadhaar_back` | File (image) | Back of Aadhaar card |

### KYC Status Lifecycle
`unverified` → `pending` (on submission) → `verified` or `rejected` (after admin review)

### Technical Asset Verification Methods
- **DNS**: `dns.resolveTxt` lookup for `nexus-site-verification=[TOKEN]`
- **HTML**: Crawler-based search for `<meta name="nexus-site-verification" content="[TOKEN]">`

---

## 📋 7. Data Provenance
- **Registrar APIs**: Live institutional-grade pricing (no mock signals).
- **RDAP/WHOIS**: Real-time ownership and expiry data from global registry databases.
- **PostgreSQL**: Master storage for user profiles, portfolio assets, watchlist entries, and P2P inquiries.
- **Intelligence Core**: All scores derived from real-time ML inference. No simulated indices.

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
