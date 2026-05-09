# NEXUS Workflow & Technical Deep-Dive ⚡

Technical breakdown of the domain intelligence and P2P messaging pipelines.

---

## 🏗️ End-to-End Workflow

| Phase | Component | Action |
| :--- | :--- | :--- |
| **1. Intake** | `NEXUS-FD` | User submits domain via Terminal (3-Mode Engine). |
| **2. Stream** | `Nerve Center` | Initiates SSE connection; emits `progress` events with stage labels and percentage. |
| **3. Intelligence** | `Intelligence Core` | Parallel execution of XGBoost, semantic analysis, and trend pipelines. |
| **4. Enrichment** | `Nerve Center` | Live registrar pricing (GoDaddy / Porkbun / Name.com) and RDAP/WHOIS lookup. |
| **5. Synthesis** | `Nerve Center` | Weighted score composition, FMV appraisal, and `complete` event emission. |
| **6. Delivery** | `NEXUS-FD` | Dynamic rendering of scores, arbitrage table, ownership panel, and gauges. |

---

## 🤖 1. The Intelligence Core (Python)

The ML service calculates three distinct numeric signals:

### A. Quantitative Baseline (XGBoost)
- **Model**: Gradient Boosted Trees trained on 4,000+ institutional domain sales.
- **Features**: Character length, vowel-consonant alternation, TLD authority weight, keyword scarcity index.
- **Output**: 0–100 baseline score.

### B. Semantic Quality (Linguistic Analysis)
- **Analysis**: Brand memorability and linguistic sentiment.
- **Output**: 0–100 "Brand Affinity" score.

### C. Market Velocity (Trend Momentum)
- **Calculation**: Linear regression on search trend data over a 90-day window.
- **Output**: Normalized 0–100 momentum signal.

---

## ⚙️ 2. Nerve Center Synthesis (Node.js)

### I. Overall Nexus Score
The final score is a weighted synthesis:
> **`Overall = (Quantitative × 0.35) + (Semantic × 0.40) + (Trend × 0.25)`**

### II. Institutional Grading
| Grade | Range | Classification |
| :--- | :--- | :--- |
| **S** | 90+ | Elite |
| **A** | 80–89 | Premium |
| **B** | 70–79 | Investment |
| **C** | 60–69 | Standard |
| **D** | 50–59 | Speculative |
| **F** | < 50 | Junk |

### III. Fair Market Value (FMV) Appraisal
> **`FMV = Base_TLD_Value × Length_Multiplier × (Nexus_Score / 55)^3.0`**
- **Base_TLD_Value**: `.com` → $800, `.ai` → $1,200, `.io` → $1,000
- **Length_Multiplier**: 3-char → 8×, 5-char → 3×, 8-char → 1×

---

## 📡 3. Registrar Arbitrage Logic

The Acquisition view renders a sortable table comparing all three registrars across:

| Column | Description |
| :--- | :--- |
| **Registration** | Year-1 cost. Cheapest option highlighted with a "▼ BEST" label. |
| **Renewal** | Annual renewal cost. Cheapest highlighted. |
| **Transfer** | Incoming transfer fee (shown as `—` if not applicable). |
| **Privacy** | WHOIS privacy cost. Shows "Included" badge if free. |
| **Available** | Live availability from registrar API. |
| **Action** | External link to the registrar's registration page. |

The **Primary Recommendation** block below the table auto-selects the lowest-registration-cost registrar and surfaces it as the suggested acquisition path.

---

## 💬 4. P2P Inquiry & Messaging Flow

### Inquiry Creation (Terminal → Exchange View)
```
User clicks "Initiate P2P Offer" or "Send Buyout Proposal"
  → InquiryModal opens (domain pre-filled)
  → User writes message + optional offer_price
  → POST /api/inquiries { domain, message, offer_price }
  → Owner notified via their Nexus Messages inbox
```

### Live Chat (NexusChat)
```
User opens Messages → selects an inquiry
  → GET /api/inquiries/:id/messages  (fetch history)
  → socket.emit("join_inquiry", inquiryId)  (join Socket.IO room)
  → server.emit("new_message", msg)  (real-time delivery)
  → Messages deduplicated by ID; scroll-to-bottom on new arrival
```

---

## 🔌 5. Real-Time Transport Summary

| Transport | Used For | Direction |
| :--- | :--- | :--- |
| **SSE** (`EventSource`) | Domain valuation pipeline progress + result delivery | Server → Client |
| **Socket.IO** | Live messaging within inquiry threads | Bidirectional |

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
