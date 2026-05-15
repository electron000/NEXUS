# NEXUS System Workflow — Complete Integration Documentation

> **Scope**: End-to-end workflow documentation for the entire NEXUS platform across all three services operating on three separate terminals.

---

## System Architecture

```
Terminal 1 (Port 3000)        Terminal 2 (Port 4000)           Terminal 3 (Port 8000)
┌──────────────────┐    HTTP   ┌──────────────────────┐   HTTP   ┌─────────────────────┐
│   NEXUS-FD       │◀────────▶│   Nerve Center       │◀────────▶│  Intelligence Core  │
│   Next.js 16     │    WS    │   Express.js 4       │          │  FastAPI + ML       │
│   React 19       │          │   PostgreSQL         │          │  RandomForest       │
│   Zustand        │          │   Redis              │          │  Gemini LLM         │
│   Socket.IO      │          │   Socket.IO          │          │  Feature Eng.       │
└──────────────────┘          └──────────────────────┘          └─────────────────────┘
```

**Start commands**:
- Terminal 1: `npm run dev` (in `NEXUS-FD/`)
- Terminal 2: `$env:PORT=4000; npm run dev` (in `NEXUS-BD/nerve-center/`)
- Terminal 3: `python -m uvicorn app.main:app --reload --port 8000` (in `NEXUS-BD/intelligence-core/`)

---

## 1. Signup & Email OTP Verification

### Flow

```
Frontend (3000)                    Nerve Center (4000)                Redis
     │                                    │                            │
     │ 1. POST /api/auth/send_otp        │                            │
     │    { email }                       │                            │
     │───────────────────────────────────▶│                            │
     │                                    │ 2. Generate 6-digit OTP    │
     │                                    │ 3. Store in Redis          │
     │                                    │    key: otp:{email}        │
     │                                    │    TTL: 300s               │
     │                                    │───────────────────────────▶│
     │                                    │ 4. Send OTP via            │
     │                                    │    EMAIL_SERVICE_API       │
     │◀───────────────────────────────────│                            │
     │    { message: "OTP sent" }         │                            │
     │                                    │                            │
     │ 5. User enters OTP                 │                            │
     │ 6. POST /api/auth/verify_otp      │                            │
     │    { email, otp }                  │                            │
     │───────────────────────────────────▶│                            │
     │                                    │ 7. Compare OTP from Redis  │
     │                                    │◀───────────────────────────│
     │                                    │ 8. Set verified=true       │
     │                                    │───────────────────────────▶│
     │◀───────────────────────────────────│                            │
     │    { message: "Email verified" }   │                            │
     │                                    │                            │
     │ 9. POST /api/auth/signup           │                            │
     │    { email, password, name }       │                            │
     │───────────────────────────────────▶│                            │
     │                                    │ 10. Check isEmailVerified()│
     │                                    │◀───────────────────────────│
     │                                    │ 11. Check duplicate email  │
     │                                    │ 12. bcrypt hash (12 rounds)│
     │                                    │ 13. INSERT INTO users      │
     │                                    │ 14. Sign JWT {id, email}   │
     │                                    │ 15. Set HttpOnly cookie    │
     │◀───────────────────────────────────│                            │
     │    Set-Cookie: token=JWT           │                            │
     │    { success, user }               │                            │
     │                                    │                            │
     │ 16. Zustand: login(user)           │                            │
     │ 17. localStorage: save user        │                            │
     │ 18. Router: push /overview         │                            │
```

### Validation Rules
- **Email**: Must be valid format, normalized
- **Password**: Min 8 chars, 1 uppercase, 1 number
- **Name**: Required, non-empty
- **OTP**: 6-digit numeric, expires in 5 minutes

---

## 2. Signin (Login)

### Flow

```
Frontend                          Nerve Center                    PostgreSQL
     │ POST /api/auth/login            │                              │
     │ { email, password }             │                              │
     │────────────────────────────────▶│                              │
     │                                 │ SELECT user WHERE email=$1   │
     │                                 │─────────────────────────────▶│
     │                                 │◀─────────────────────────────│
     │                                 │ bcrypt.compare(password,hash)│
     │                                 │ Sign JWT, Set cookie         │
     │◀────────────────────────────────│                              │
     │ Set-Cookie: token=JWT           │                              │
     │ { success, user }               │                              │
     │                                 │                              │
     │ Zustand: login(user)            │                              │
     │ connectSocket(token)            │                              │
     │ Router: push /overview          │                              │
```

### Session Restoration (Page Reload)

```
Dashboard Layout Mount:
  1. GET /api/auth/me (cookie sent automatically)
  2. Nerve Center verifies JWT from cookie
  3. Returns user data (id, email, name, role, is_admin, kyc_status)
  4. Zustand: login(userData)
  5. connectSocket()
  6. setHasHydrated(true) → AuthGuard renders children
```

### Session Expiry
- 401 response → Axios interceptor clears localStorage → Redirect to `/login?expired=true`
- Exception: Login page itself — 401 on login attempt shows error, no redirect

---

## 3. Domain Search & Intelligence Terminal

This is the **core feature** involving all three services.

### Flow

```
Frontend (3000)              Nerve Center (4000)              Intelligence Core (8000)
     │                              │                                │
     │ 1. User types domain         │                                │
     │    in search bar             │                                │
     │                              │                                │
     │ 2. EventSource connect       │                                │
     │    GET /api/domains/         │                                │
     │    valuation-stream/         │                                │
     │    {domain}?token=JWT        │                                │
     │─────────────────────────────▶│                                │
     │                              │ 3. Validate TLD (100+ allowed) │
     │                              │ 4. Setup SSE headers           │
     │                              │                                │
     │ SSE: progress 10%           │                                │
     │ "Scanning Ecosystem"        │                                │
     │◀─────────────────────────────│                                │
     │                              │                                │
     │                              │ 5. POST /api/ml/nexus-score    │
     │                              │    Header: X-Internal-Key      │
     │                              │    { domain }                  │
     │                              │───────────────────────────────▶│
     │                              │                                │
     │ SSE: progress 40%           │    ┌─ Feature Extraction ──┐   │
     │ "Core Processing"           │    │ 12 features from SLD  │   │
     │◀─────────────────────────────│    │ (length, vowels,      │   │
     │                              │    │  TLD score, keywords) │   │
     │                              │    └───────────┬───────────┘   │
     │                              │                │               │
     │                              │    ┌───────────┼───────────┐   │
     │                              │    │Tier Model │Semantic   │   │
     │                              │    │(RF .pkl)  │(Gemini)   │   │
     │                              │    │→tier_val  │→score 0-100   │
     │                              │    │→model_score           │   │
     │                              │    └───────────┬───────────┘   │
     │                              │                │               │
     │                              │    ┌───────────▼───────────┐   │
     │                              │    │ Price Model (RF .pkl) │   │
     │                              │    │ features + tier_val   │   │
     │                              │    │ → predicted_price     │   │
     │                              │    └───────────────────────┘   │
     │                              │                                │
     │                              │◀───────────────────────────────│
     │                              │ { model_score, semantic_score, │
     │                              │   predicted_price,             │
     │                              │   predicted_tier }             │
     │                              │                                │
     │ SSE: progress 65%           │ 6. Check portfolio DB          │
     │ "Ownership Audit"           │    for domain owner            │
     │◀─────────────────────────────│                                │
     │                              │ 7a. IF Nexus member:           │
     │                              │     Return portfolio data      │
     │                              │ 7b. ELSE:                      │
     │                              │     WhoisJSON API → owner data │
     │                              │     DNS MX audit → mail infra  │
     │                              │                                │
     │ SSE: progress 85%           │ 8. Query registrar APIs        │
     │ "Synthesizing Intelligence" │    (GoDaddy + Porkbun +         │
     │◀─────────────────────────────│     Name.com) concurrently     │
     │                              │                                │
     │                              │ 9. calculateRegistrarPricing() │
     │                              │ 10. calculateAftermarketValue()│
     │                              │ 11. generateSummary()          │
     │                              │ 12. generateTags()             │
     │                              │                                │
     │ SSE: progress 100%          │                                │
     │ "Intelligence gathered"     │                                │
     │◀─────────────────────────────│                                │
     │                              │                                │
     │ SSE: complete               │                                │
     │ { domain, score, pricing,   │                                │
     │   ownership, appraisal,     │                                │
     │   summary, tags, timestamp }│                                │
     │◀─────────────────────────────│                                │
     │                              │                                │
     │ 13. Render results:          │                                │
     │     - ScoreGauge (overall)   │                                │
     │     - ArbitrageTable         │                                │
     │     - Ownership panel        │                                │
     │     - Appraisal card         │                                │
     │     - InquiryModal (if       │                                │
     │       owner is Nexus member) │                                │
     │ 14. Zustand: setLastValuation│                                │
```

### Score Composition Algorithm

```
Overall Score = model_score × 0.45 + semantic_score × 0.55
```

Where:
- `model_score`: RandomForest tier model output (0–1) × 100
- `semantic_score`: Gemini LLM composite (brandability×0.45 + memorability×0.35 + clarity×0.20)

### Aftermarket Value Algorithm

```
base_value = TLD_BASE[tld] × 95.93 (USD→INR)
length_mult = (≤3: 8×) | (≤5: 3×) | (else: 1×)
quality_mult = (overall/55) ^ (overall>80 ? 3 : 2.2)
value = base_value × length_mult × quality_mult × (semantic>80 ? 1.5 : 1)
```

---

## 4. Portfolio Management & DNS Verification

### Adding a Domain

```
Frontend                    Nerve Center                     PostgreSQL
     │ POST /api/user/portfolio    │                              │
     │ { domain, boughtPrice,      │                              │
     │   isForSale, askingPrice }  │                              │
     │────────────────────────────▶│                              │
     │                             │ Generate verification_token  │
     │                             │ (crypto.randomBytes 16 hex)  │
     │                             │ INSERT INTO portfolio        │
     │                             │─────────────────────────────▶│
     │◀────────────────────────────│                              │
     │ { id, domain, token,        │                              │
     │   verification_status:      │                              │
     │   "pending" }               │                              │
```

### DNS Verification

```
Frontend                    Nerve Center              DNS (Google/Cloudflare)
     │                             │                         │
     │ User adds TXT record:       │                         │
     │ nexus-site-verification=    │                         │
     │ {token} to their DNS        │                         │
     │                             │                         │
     │ POST /api/user/portfolio/   │                         │
     │ verify { domain }           │                         │
     │────────────────────────────▶│                         │
     │                             │ dns.resolveTxt(domain)  │
     │                             │ via 8.8.8.8 / 1.1.1.1  │
     │                             │────────────────────────▶│
     │                             │◀────────────────────────│
     │                             │ Check TXT records for   │
     │                             │ "nexus-site-verification│
     │                             │  ={token}"              │
     │                             │                         │
     │                             │ IF found:               │
     │                             │   UPDATE status=verified│
     │◀────────────────────────────│                         │
     │ { success: true }           │                         │
```

### .test Domain Bypass

Domains ending in `.test` are **auto-verified** on creation — no DNS check required (development convenience).

---

## 5. KYC Verification by Admin

### User KYC Submission

```
Frontend                      Nerve Center                   Filesystem
     │ POST /api/user/kyc/submit     │                           │
     │ FormData:                     │                           │
     │   firstName, lastName, etc.   │                           │
     │   aadhaar_front (image)       │                           │
     │   aadhaar_back (image)        │                           │
     │──────────────────────────────▶│                           │
     │                               │ Multer saves to           │
     │                               │ uploads/kyc/{userId}-     │
     │                               │ {field}-{timestamp}.ext   │
     │                               │──────────────────────────▶│
     │                               │ UPDATE users SET          │
     │                               │   kyc_status='pending'    │
     │                               │   first_name, last_name.. │
     │                               │   aadhaar_front_path,     │
     │                               │   aadhaar_back_path       │
     │◀──────────────────────────────│                           │
     │ { success, message }          │                           │
```

### Admin KYC Review

```
Admin Frontend                Nerve Center                   PostgreSQL
     │ GET /api/admin/kyc/pending    │                           │
     │──────────────────────────────▶│                           │
     │                               │ requireAdmin middleware:  │
     │                               │ Check is_admin=TRUE       │
     │                               │ SELECT users WHERE        │
     │                               │   kyc_status='pending'    │
     │◀──────────────────────────────│                           │
     │ [ { id, email, name,          │                           │
     │     first_name, last_name,    │                           │
     │     aadhaar_front_path,       │                           │
     │     aadhaar_back_path, ... }] │                           │
     │                               │                           │
     │ Admin views documents         │                           │
     │ (images served from           │                           │
     │  /uploads/kyc/ static route)  │                           │
     │                               │                           │
     │ POST /api/admin/kyc/review    │                           │
     │ { userId, status: "verified"  │                           │
     │   OR "rejected",              │                           │
     │   reason: "..." }             │                           │
     │──────────────────────────────▶│                           │
     │                               │ UPDATE users SET          │
     │                               │   kyc_status=$1,          │
     │                               │   kyc_rejection_reason=$2,│
     │                               │   kyc_verified_at=NOW()   │
     │◀──────────────────────────────│                           │
     │ { success, message }          │                           │
```

### KYC Status Sync on Frontend

The dashboard layout runs `GET /api/auth/me` on **every navigation** (pathname change), updating the Zustand store with the latest `kyc_status`. This ensures the UI immediately reflects admin actions.

---

## 6. Sale Portfolio & Marketplace Listing

### Listing a Domain for Sale

**Prerequisites**: User must have `kyc_status = 'verified'` AND domain must have `verification_status = 'verified'`.

```
1. User adds domain to portfolio (POST /api/user/portfolio)
2. User performs DNS verification (POST /api/user/portfolio/verify)
3. User completes KYC (POST /api/user/kyc/submit → Admin approves)
4. User toggles "For Sale" with asking price
5. Domain appears in search results as Nexus-Member-Owned with asking price
```

### How Buyers Discover Listed Domains

When any user searches a domain via the terminal:
1. Nerve Center checks `portfolio` table for the domain
2. If found with `is_for_sale = true`, ownership data includes:
   - `isNexusMember: true`
   - `isVerified: true/false`
   - `ownerEmail`, `ownerName`
   - `askingPrice`
3. Frontend shows **InquiryModal** button for the buyer

---

## 7. Inquiry & Real-Time Negotiation Chat

### Creating an Inquiry

```
Buyer Frontend              Nerve Center              Seller Frontend
     │ POST /api/inquiries        │                        │
     │ { domain, message,         │                        │
     │   offer_price }            │                        │
     │───────────────────────────▶│                        │
     │                            │ Find domain owner      │
     │                            │ Validate not self      │
     │                            │ INSERT inquiry         │
     │                            │ INSERT first message   │
     │                            │                        │
     │                            │ Socket.IO emit:        │
     │                            │ emitToUser(seller,     │
     │                            │   'new_inquiry', data) │
     │                            │───────────────────────▶│
     │◀───────────────────────────│                        │ Real-time
     │ { inquiry object }         │                        │ notification
```

### Chat Message Flow

```
Sender                      Nerve Center              Receiver
     │ POST /api/inquiries/       │                        │
     │ {id}/messages              │                        │
     │ { content }                │                        │
     │───────────────────────────▶│                        │
     │                            │ Verify membership      │
     │                            │ INSERT message         │
     │                            │                        │
     │                            │ io.to(inquiry:{id})    │
     │                            │   .emit('new_message') │
     │                            │ emitToUser(receiver,   │
     │                            │   'new_message')       │
     │                            │───────────────────────▶│
     │◀───────────────────────────│                        │
     │ { message object }         │                        │ UI auto-updates
```

### Socket.IO Room Architecture

```
On Login:
  socket.join('user:{userId}')         ← Private room for notifications

On Opening Chat:
  socket.emit('join_inquiry', id)       ← Client requests to join
  Server: verify membership in DB
  socket.join('inquiry:{inquiryId}')    ← Chat room for real-time sync
```

### Dual Delivery Strategy

Messages are delivered through TWO channels simultaneously:
1. **Room broadcast**: `io.to(inquiry:{id}).emit('new_message')` — reaches all participants in the chat view
2. **Direct delivery**: `emitToUser(otherId, 'new_message')` — ensures delivery even if user hasn't joined the room yet

### Unread Message Notification System

NEXUS tracks message read-status across the entire system to ensure users never miss an inquiry.

**1. Status Tracking (Backend)**
- Every message in the `messages` table has an `is_read` boolean (default `FALSE`).
- The `GET /api/inquiries` endpoint returns an `unread_count` for each conversation.
- The `GET /api/inquiries/unread-count` endpoint returns a global total of unread messages.

**2. Real-Time Synchronization**
- When a `new_message` or `new_inquiry` socket event is received, the frontend automatically calls `fetchUnreadMessagesCount()` to refresh global state.
- Red notification badges appear in the **Sidebar**, **Mobile Bottom Nav**, and **Mobile Drawer**.

**3. Automatic Read-Marking**
- Opening a chat thread (`GET /api/inquiries/:id/messages`) automatically marks all received messages as `is_read = TRUE` for that inquiry.
- If a chat is already open, incoming socket messages are marked as read via a `PATCH /api/inquiries/:id/read` call, keeping the global unread count in sync instantly.

---

## 8. Admin Dashboard

### Login Flow

Admin uses the same auth system but accesses `/admin/login`:

```
1. POST /api/auth/login { email, password }
2. Server returns user with is_admin=true
3. Frontend routes to /admin/dashboard
4. All /api/admin/* routes check requireAdmin middleware
```

### Admin Capabilities

| Feature | Endpoint | Description |
|---|---|---|
| Platform Stats | `GET /api/admin/stats` | Total users, sellers, inquiries, domains |
| KYC Queue | `GET /api/admin/kyc/pending` | Pending KYC submissions with documents |
| KYC Review | `POST /api/admin/kyc/review` | Approve or reject with reason |

### Stats Queries

```sql
SELECT COUNT(*) FROM users WHERE is_admin = FALSE           -- totalUsers
SELECT COUNT(*) FROM users WHERE kyc_status = 'verified'    -- totalSellers
  AND is_admin = FALSE
SELECT COUNT(*) FROM inquiries                               -- totalInquiries
SELECT COUNT(*) FROM portfolio                               -- totalPortfolioDomains
```

---

## 9. Dashboard Metrics (Nerve Center Overview)

### Data Assembly

```
Frontend                    Nerve Center                   Intelligence Core
     │ GET /api/user/dashboard    │                              │
     │───────────────────────────▶│                              │
     │                            │ 1. Get user KYC status       │
     │                            │ 2. Get all portfolio rows    │
     │                            │ 3. For each domain:          │
     │                            │    IF valuation_price = 0:   │
     │                            │      Call getNexusScore()    │
     │                            │      ─────────────────────▶  │
     │                            │      ◀─────────────────────  │
     │                            │      Cache in portfolio DB   │
     │                            │    Sum totalValue            │
     │                            │    Sum totalInvested         │
     │                            │ 4. Calculate growth %        │
     │◀───────────────────────────│                              │
     │ { kyc_status,              │                              │
     │   portfolioValue,          │                              │
     │   activeDomains,           │                              │
     │   totalInvested,           │                              │
     │   portfolio: [...] }       │                              │
```

### One-Time ML Valuation

Portfolio valuations are fetched from the Intelligence Core **only once** per domain. The predicted price is cached in the `portfolio.valuation_price` column. Subsequent dashboard loads use the cached value.

---

## 10. Watchlist

### Flow (Client-Heavy)

```
1. User searches domain in terminal
2. Clicks "Add to Watchlist"
3. Zustand: addToWatchlist(domain) → persisted to localStorage
4. POST /api/watchlist { domain, valuation } → stored in PostgreSQL
5. Watchlist page shows all tracked domains
6. DELETE /api/watchlist/{domain} removes from both client and server
```

The watchlist uses an **upsert pattern** (`ON CONFLICT DO UPDATE`) to handle duplicate additions gracefully.

---

## 11. Signout

```
Frontend                    Nerve Center
     │ 1. User clicks Sign Out    │
     │ 2. LogoutConfirmModal      │
     │    appears                  │
     │ 3. User confirms           │
     │                            │
     │ POST /api/auth/logout      │
     │───────────────────────────▶│
     │                            │ Set cookie 'token' = 'none'
     │                            │ expires: 10 seconds
     │◀───────────────────────────│
     │                            │
     │ 4. disconnectSocket()      │
     │ 5. Zustand: logout()       │
     │    - isLoggedIn = false     │
     │    - userProfile = null     │
     │    - Clear watchlist        │
     │    - Clear query history    │
     │ 6. localStorage.clear()    │
     │ 7. Router: push /          │
```

---

## 12. Security Across the System

### Authentication Chain

```
Frontend Cookie → Nerve Center JWT Verify → PostgreSQL User Lookup
                                          → Socket.IO JWT Verify
```

### Inter-Service Security

```
Nerve Center → Intelligence Core: X-Internal-Key header (shared secret)
Intelligence Core: CORS restricted to Nerve Center origin only
```

### Rate Limiting

| Layer | Limit | Scope |
|---|---|---|
| General API | 1000 req / 15 min | Per IP |
| Auth endpoints | 100 req / 15 min | Per IP |
| Domain checks | 500 req / min | Per IP |

### Data Protection

- Passwords: bcrypt (12 rounds), never returned to client
- JWT: HttpOnly cookies (no XSS access)
- KYC docs: Server-side only (uploads/kyc/), multer file filter
- Admin: DB-level `is_admin` check on every request (not JWT-stored)
- Intelligence Core: Not publicly accessible, internal API key required

---

## 13. Error Handling Across Services

| Layer | Strategy |
|---|---|
| **Frontend** | Axios interceptor → `APIError` class → Toast notifications (Sonner) |
| **Nerve Center** | Express error middleware → Winston logging → Sanitized JSON responses |
| **Intelligence Core** | FastAPI exception handler → HTTP 500 with generic message |
| **Socket.IO** | Auth failure → connection rejected with error event |
| **Database** | PostgreSQL error codes (23505 → 409 Conflict) |

---

## 14. Complete Feature Matrix

| Feature | Frontend | Nerve Center | Intelligence Core |
|---|---|---|---|
| Email OTP Verification | Auth pages | OTP module + Redis | — |
| User Registration | Register page | Auth routes + bcrypt | — |
| User Login | Login page | Auth routes + JWT | — |
| Session Management | Zustand + cookies | JWT + HttpOnly cookies | — |
| Domain Search | Terminal page + SSE | Valuation stream + SSE | ML scoring endpoint |
| ML Scoring | ScoreGauge component | mlService bridge | Feature eng. + RF models |
| Semantic Analysis | Score display | Proxied via mlService | Gemini LLM + cache |
| Registrar Pricing | ArbitrageTable | registrarService (3 APIs) | — |
| WHOIS Intelligence | Ownership panel | whoisService (WhoisJSON) | — |
| DNS Intelligence | MX record display | dnsService (Node DNS) | — |
| RDAP Lookup | Ownership panel | rdapService | — |
| Portfolio CRUD | Portfolio page | User routes + PostgreSQL | — |
| DNS Verification | Verify button + token | verificationService | — |
| KYC Submission | KYC modal + file upload | User routes + Multer | — |
| KYC Admin Review | Admin dashboard | Admin routes | — |
| Domain Inquiries | InquiryModal | Inquiry routes | — |
| Real-Time Chat | Messages page | Socket.IO + inquiry routes | — |
| Watchlist | Watchlist page | Watchlist routes | — |
| Admin Stats | Admin dashboard | Admin routes (SQL counts) | — |
| Aftermarket Valuation | Appraisal display | pricingService algorithm | Price model prediction |

---

## 15. Educational References

Here are resources to understand the architectural patterns used in this system workflow:

- **Microservices Architecture**: [Microservices Guide by Martin Fowler](https://martinfowler.com/articles/microservices.html)
- **Server-Sent Events (SSE)**: [Using server-sent events - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- **Cross-Origin Resource Sharing (CORS)**: [CORS documentation on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- **WebSockets**: [The WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
