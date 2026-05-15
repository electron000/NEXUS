# NEXUS Nerve Center — Technical Documentation

> **Module**: `NEXUS-BD/nerve-center`
> **Runtime**: Node.js (v20+) · Express.js v4
> **Port**: 4000 (configurable via `PORT`)
> **Role**: Primary API gateway, authentication authority, business-logic orchestrator, and real-time communication hub for the entire NEXUS ecosystem.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration & Environment](#4-configuration--environment)
5. [Database Layer](#5-database-layer)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference](#7-api-reference)
8. [Service Layer](#8-service-layer)
9. [Real-Time Communication (WebSocket)](#9-real-time-communication-websocket)
10. [OTP Module](#10-otp-module)
11. [Security Architecture](#11-security-architecture)
12. [Deployment](#12-deployment)

---

## 1. Architecture Overview

The Nerve Center is the **central nervous system** of NEXUS. It acts as the single point of contact for the frontend client and coordinates with external services and the Intelligence Core (Python ML backend) internally.

```
┌───────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│   NEXUS-FD    │──HTTP──▶│   Nerve Center   │──HTTP──▶│  Intelligence Core  │
│  (Next.js)    │◀──WS───│   (Express.js)   │        │    (FastAPI/ML)      │
└───────────────┘        └────────┬─────────┘        └─────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
               PostgreSQL      Redis       External APIs
               (Primary DB)   (OTP/Cache)  (GoDaddy, Porkbun,
                                            Name.com, WHOIS,
                                            RDAP, WhoisJSON)
```

### Core Responsibilities

| Responsibility | Description |
|---|---|
| **Authentication** | JWT-based stateless auth with HttpOnly cookies, OTP email verification |
| **Domain Intelligence** | Orchestrates multi-source data aggregation (registrar APIs, WHOIS, ML) |
| **Portfolio Management** | CRUD operations for user domain portfolios with DNS-based ownership verification |
| **KYC Processing** | Document upload, storage, and admin review pipeline |
| **Real-Time Messaging** | Socket.IO-based inquiry/negotiation chat system |
| **Admin Operations** | Platform statistics, KYC review, user management |
| **Pricing Aggregation** | Multi-registrar pricing aggregation |

---

## 2. Technology Stack

### Core Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP server framework |
| `pg` | ^8.12.0 | PostgreSQL client (connection pooling) |
| `jsonwebtoken` | ^9.0.2 | JWT token generation and verification |
| `bcryptjs` | ^2.4.3 | Password hashing (12 salt rounds) |
| `socket.io` | ^4.8.3 | Real-time bidirectional WebSocket communication |
| `ioredis` | ^5.10.1 | Redis client for OTP storage |
| `axios` | ^1.7.2 | HTTP client for external API calls |
| `helmet` | ^7.1.0 | Security headers middleware |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `multer` | ^1.4.5 | Multipart file upload handling |
| `winston` | ^3.13.0 | Structured logging (console + file transport) |
| `express-rate-limit` | ^7.3.1 | IP-based rate limiting |
| `express-validator` | ^7.1.0 | Request body/param validation |
| `cookie-parser` | ^1.4.7 | Cookie parsing middleware |
| `uuid` | ^10.0.0 | UUID generation |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `nodemon` | ^3.1.4 | Auto-restart on file changes |

---

## 3. Project Structure

```
nerve-center/
├── .env                        # Environment variables (not committed)
├── .env.example                # Template for environment configuration
├── package.json                # Dependencies and scripts
├── uploads/                    # File upload storage
│   └── kyc/                    # KYC document images
└── src/
    ├── app.js                  # ★ Application entry point
    ├── config/
    │   ├── db.js               # PostgreSQL pool configuration
    │   ├── logger.js           # Winston logger setup
    │   └── redis.js            # IORedis client configuration
    ├── db/
    │   ├── init_schema.sql     # ★ Consolidated database schema
    │   ├── migrate.js          # Schema migration runner
    │   ├── rebuild.js          # Schema rebuild utility
    │   └── reset.js            # Database reset utility
    ├── middleware/
    │   ├── auth.js             # JWT authentication middleware
    │   └── rateLimiter.js      # Rate limiting configuration
    ├── modules/
    │   └── otp/
    │       ├── otp.controller.js  # OTP HTTP handlers
    │       └── otp.service.js     # OTP business logic (Redis-backed)
    ├── routes/
    │   ├── admin.js            # Admin panel endpoints
    │   ├── auth.js             # Authentication endpoints
    │   ├── domains.js          # Domain intelligence endpoints
    │   ├── inquiries.js        # Inquiry/negotiation endpoints
    │   ├── user.js             # User profile/portfolio/KYC endpoints
    │   └── watchlist.js        # Watchlist CRUD endpoints
    └── services/
        ├── mlService.js        # ★ Bridge to Intelligence Core
        ├── pricingService.js   # Registrar pricing logic
        ├── registrarService.js # Multi-registrar price aggregation
        ├── socketService.js    # Socket.IO initialization & room mgmt
        ├── verificationService.js # DNS TXT verification
        └── whoisService.js     # WhoisJSON API integration
```

---

## 4. Configuration & Environment

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server listen port |
| `NODE_ENV` | `development` | Environment mode |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | `info` | Winston log level |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `nexus` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | — | **Required**. Secret for JWT signing |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `INTELLIGENCE_CORE_URL` | `http://localhost:8000` | Intelligence Core address |
| `INTERNAL_API_KEY` | `nexus_test_secret_key_8000` | Shared secret for IC authentication |
| `GODADDY_KEY` / `GODADDY_SECRET` | — | GoDaddy API credentials |
| `PORKBUN_KEY` / `PORKBUN_SECRET` | — | Porkbun API credentials |
| `NAMECOM_USER` / `NAMECOM_TOKEN` | — | Name.com API credentials |
| `PREFERRED_CURRENCY` | `USD` | Currency for price display |
| `WHOISJSON_TOKEN` | — | WhoisJSON API token |
| `EMAIL_SERVICE_API` | — | External email service URL for OTP delivery |
| `REDIS_HOST` | `127.0.0.1` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | — | Redis password (optional) |

### Database Pool Configuration

```javascript
{
  max: 20,                          // Maximum concurrent connections
  idleTimeoutMillis: 30_000,        // Close idle connections after 30s
  connectionTimeoutMillis: 5_000,   // Connection timeout: 5s
}
```

---

## 5. Database Layer

### Schema Overview (PostgreSQL)

The database schema is defined in a single consolidated file: `src/db/init_schema.sql`.

#### Custom ENUM Types

| Type | Values | Purpose |
|---|---|---|
| `kyc_status` | `unverified`, `pending`, `verified`, `rejected` | User KYC verification lifecycle |
| `verification_status` | `pending`, `verified`, `failed` | Domain ownership verification state |
| `verification_method` | `dns` | Domain verification method |
| `inquiry_status` | `open`, `closed` | Inquiry/negotiation state |

#### Tables

##### `users`
Primary user identity table.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | User unique identifier |
| `email` | TEXT | UNIQUE, NOT NULL | Login credential |
| `password_hash` | TEXT | NOT NULL | bcrypt hash (12 rounds) |
| `name` | TEXT | — | Display name |
| `role` | TEXT | DEFAULT `'analyst'` | User role classification |
| `preferences` | JSONB | DEFAULT `{...}` | Tracking preferences |
| `kyc_status` | kyc_status | DEFAULT `'unverified'` | Current KYC state |
| `kyc_id_type` | TEXT | — | ID document type |
| `kyc_id_number_encrypted` | TEXT | — | Encrypted ID number |
| `kyc_document_url` | TEXT | — | Document URL |
| `kyc_verified_at` | TIMESTAMPTZ | — | Verification timestamp |
| `first_name`, `middle_name`, `last_name` | TEXT | — | Legal name fields |
| `father_name`, `mother_name` | TEXT | — | Parent names (for Aadhaar KYC) |
| `address` | TEXT | — | Residential address |
| `aadhaar_front_path`, `aadhaar_back_path` | TEXT | — | Uploaded document paths |
| `is_admin` | BOOLEAN | DEFAULT FALSE | Admin privilege flag |
| `kyc_rejection_reason` | TEXT | — | Rejection explanation |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation time |
| `updated_at` | TIMESTAMPTZ | — | Last modification time |

**Indexes**: `idx_users_email`, `idx_users_kyc_status`

##### `domain_cache`
Short-lived cache for domain availability and pricing lookups.

| Column | Type | Description |
|---|---|---|
| `domain` | TEXT (PK) | Domain name |
| `available` | BOOLEAN | Availability status |
| `initial_price`, `renewal_price`, `whois_privacy` | NUMERIC(10,2) | Pricing data |
| `nexus_score` | JSONB | Cached ML scores |
| `expires_at` | TIMESTAMPTZ | Cache expiry |

##### `watchlist`
User-tracked domains for monitoring.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Entry ID |
| `user_id` | UUID (FK → users) | Owner |
| `domain` | TEXT | Tracked domain |
| `valuation` | JSONB | Last valuation snapshot |
| `created_at`, `updated_at` | TIMESTAMPTZ | Timestamps |

**Constraint**: UNIQUE(user_id, domain)

##### `portfolio`
User-owned domain portfolio entries.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Entry ID |
| `user_id` | UUID (FK → users) | Owner |
| `domain` | TEXT (UNIQUE) | Domain name |
| `is_for_sale` | BOOLEAN | Sale listing flag |
| `asking_price` | NUMERIC(12,2) | Listed sale price |
| `bought_price` | NUMERIC(12,2) | Acquisition cost |
| `valuation_price` | NUMERIC(12,2) | ML-predicted value |
| `verification_status` | verification_status | DNS verification state |
| `verification_method` | verification_method | Always `'dns'` |
| `verification_token` | TEXT | Random 32-char hex token |
| `last_verified_at` | TIMESTAMPTZ | Verification timestamp |
| `created_at` | TIMESTAMPTZ | Entry creation |

##### `inquiries`
Domain purchase inquiries / negotiations.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Inquiry ID |
| `domain` | TEXT | Domain being negotiated |
| `sender_id`, `receiver_id` | UUID (FK → users) | Buyer and seller |
| `message` | TEXT | Initial inquiry message |
| `offer_price` | NUMERIC(12,2) | Proposed price |
| `status` | inquiry_status | `open` or `closed` |
| `created_at`, `updated_at` | TIMESTAMPTZ | Timestamps |

##### `messages`
Chat messages within inquiry threads.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Message ID |
| `inquiry_id` | UUID (FK → inquiries) | Parent inquiry |
| `sender_id` | UUID (FK → users) | Message author |
| `content` | TEXT | Message body |
| `created_at` | TIMESTAMPTZ | Send time |

#### Triggers

- **`update_watchlist_updated_at`**: Automatically updates `updated_at` on watchlist row modification via a `BEFORE UPDATE` trigger using the `update_updated_at_column()` function.

#### Seed Data

An admin user is seeded on migration:
- **Email**: `admin@nexus.io`
- **Password**: `NexusAdmin2026!`
- **Role**: analyst + `is_admin = TRUE`

### Migration System

- **`migrate.js`**: Reads `init_schema.sql` and executes within a single PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK).
- **`rebuild.js`**: Drop and recreate all tables.
- **`reset.js`**: Full database reset utility.

---

## 6. Authentication & Authorization

### Authentication Flow

```
1. User → POST /api/auth/signup or /login
2. Server validates credentials
3. Server creates JWT { id, email }
4. JWT set as HttpOnly cookie (7-day expiry)
5. Subsequent requests carry cookie automatically
```

### JWT Token Structure

```javascript
{
  id: "uuid",           // User UUID
  email: "user@x.com",  // User email
  iat: 1234567890,       // Issued at
  exp: 1235172690        // Expires (7 days)
}
```

### Cookie Configuration

| Property | Development | Production |
|---|---|---|
| `httpOnly` | `true` | `true` |
| `secure` | `false` | `true` |
| `sameSite` | `Lax` | `None` |
| `expires` | 7 days | 7 days |

### Token Extraction Priority

The `authenticate` middleware extracts tokens from (in order):
1. `req.cookies.token` (HttpOnly cookie)
2. `Authorization: Bearer <token>` header
3. `?token=<token>` query parameter

### Admin Authorization

The `requireAdmin` middleware checks `users.is_admin = TRUE` in the database on every admin request — not stored in the JWT.

### Password Security

- **Algorithm**: bcrypt
- **Salt Rounds**: 12
- **Validation Rules**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one number

---

## 7. API Reference

### Authentication Routes (`/api/auth`)

All auth routes use the `authLimiter` (100 req / 15 min per IP).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/signup` | ❌ | Register new user (requires prior OTP email verification) |
| `POST` | `/login` | ❌ | Authenticate and receive JWT cookie |
| `GET` | `/me` | ✅ | Retrieve current session user data |
| `POST` | `/logout` | ❌ | Invalidate JWT cookie |
| `POST` | `/send_otp` | ❌ | Send OTP to email for verification |
| `POST` | `/verify_otp` | ❌ | Verify OTP code |

#### `POST /api/auth/signup`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "StrongP4ss",
  "name": "Arun Jyoti"
}
```

**Pre-condition**: Email must be OTP-verified (checked via Redis).

**Response** (201):
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "analyst" }
}
```

### Domain Routes (`/api/domains`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/ping` | ❌ | Health check |
| `GET` | `/valuation-stream/:domain` | ✅ | Server-Sent Events domain intelligence stream |

#### `GET /api/domains/valuation-stream/:domain` (SSE)

Real-time streaming endpoint that performs a **4-stage intelligence pipeline**:

| Stage | Progress | Operations |
|---|---|---|
| 1. Scanning | 10% | Structural integrity analysis, TLD validation |
| 2. Core Processing | 40% | ML model prediction via Intelligence Core |
| 3. Ownership Audit | 65% | Portfolio DB check → WHOIS fallback |
| 4. Synthesizing | 85% | Registrar pricing aggregation |

**SSE Events**:
- `progress` → `{ stage, pct, message }`
- `complete` → Full `DomainValuationResponse` object
- `error` → `{ message }`

**Supported TLDs**: 100+ TLDs including `.com`, `.net`, `.org`, `.io`, `.ai`, `.co`, `.dev`, `.app`, `.in`, `.co.in`, country codes, and specialty extensions.

### User Routes (`/api/user`)

All routes require authentication.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/profile` | ✅ | Get user profile with preferences |
| `PUT` | `/profile` | ✅ | Update preferences |
| `GET` | `/dashboard` | ✅ | Get dashboard metrics (KYC status, portfolio stats) |
| `GET` | `/portfolio` | ✅ | List all portfolio entries |
| `POST` | `/portfolio` | ✅ | Add domain to portfolio |
| `POST` | `/portfolio/verify` | ✅ | Trigger DNS verification for a domain |
| `DELETE` | `/portfolio/:id` | ✅ | Remove domain from portfolio |
| `POST` | `/kyc/submit` | ✅ | Submit KYC documents (multipart/form-data) |

#### `POST /api/user/portfolio`

**Request Body**:
```json
{
  "domain": "example.com",
  "boughtPrice": 500,
  "isForSale": true,
  "askingPrice": 5000
}
```

**Logic**: Generates a random `verification_token` (32-char hex). Domains ending in `.test` are auto-verified for development.

#### `POST /api/user/kyc/submit`

**Multipart Fields**:
- `firstName`, `middleName`, `lastName`, `fatherName`, `motherName`, `address` (text fields)
- `aadhaar_front` (image file, max 20MB, jpg/jpeg/png)
- `aadhaar_back` (image file, max 20MB, jpg/jpeg/png)

Sets `kyc_status = 'pending'` and stores file paths.

### Inquiry Routes (`/api/inquiries`)

All routes require authentication.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/` | ✅ | Create new inquiry (buyer → seller) |
| `GET` | `/` | ✅ | List all user's inquiries |
| `GET` | `/:id/messages` | ✅ | Get chat history for an inquiry |
| `POST` | `/:id/messages` | ✅ | Send message in inquiry thread |
| `PATCH` | `/:id` | ✅ | Update inquiry status (open/closed) |

**Real-time Features**:
- New inquiry notifications via `emitToUser(receiverId, 'new_inquiry', ...)`
- New messages broadcast via Socket.IO room (`inquiry:{id}`) + direct user emit
- Status changes broadcast to both inquiry room and other party

### Admin Routes (`/api/admin`)

All routes require authentication + `is_admin = TRUE`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/stats` | ✅ Admin | Platform overview statistics |
| `GET` | `/kyc/pending` | ✅ Admin | List users awaiting KYC approval |
| `POST` | `/kyc/review` | ✅ Admin | Approve or reject KYC submission |

#### `GET /api/admin/stats`

**Response**:
```json
{
  "totalUsers": 42,
  "totalSellers": 8,
  "totalInquiries": 15,
  "totalPortfolioDomains": 23,
  "activeConnections": 15
}
```

### Watchlist Routes (`/api/watchlist`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | ✅ | List watchlist entries |
| `POST` | `/` | ✅ | Add/update watchlist entry (upsert) |
| `DELETE` | `/:domain` | ✅ | Remove from watchlist |

---

## 8. Service Layer

### `mlService.js` — Intelligence Core Bridge

Acts as an HTTP bridge to the Python Intelligence Core. Sends domain names to `POST /api/ml/nexus-score` and returns normalized scores.

**Input**: Domain string
**Output**: `{ model, semantic, predictedPrice, tier }`
**Authentication**: Uses `X-Internal-Key` header with shared secret.
**Timeout**: 15 seconds.

### `pricingService.js` — Pricing Aggregation Engine

#### `calculateRegistrarPricing(domain, scores, liveData, currency)`

Compares pricing across GoDaddy, Porkbun, and Name.com. Generates affiliate URLs for each registrar.

### `registrarService.js` — Multi-Registrar Aggregator

Queries three registrar APIs concurrently via `Promise.all`:

| Registrar | API Method | Features |
|---|---|---|
| **GoDaddy** | REST API v1 | Availability + pricing (price in microcurrency ÷ 1M) |
| **Porkbun** | JSON API v3 | Availability + full TLD pricing + free WHOIS privacy |
| **Name.com** | REST API v4 | Batch availability check + purchase/renewal pricing |

Currency conversion: If `PREFERRED_CURRENCY=INR`, multiplies USD prices by 95.93.

### `whoisService.js` — WHOIS Intelligence

Integrates with **WhoisJSON.com** API to retrieve:
- Registration status, creation/expiry dates
- Owner details (name, email, phone, organization, country)
- Registrar details (name, email, abuse contacts)
- Nameservers, DNSSEC status, domain status codes


### `verificationService.js` — DNS Ownership Verification

Verifies domain ownership by checking for a specific TXT record:
- Uses Google DNS (8.8.8.8) and Cloudflare (1.1.1.1) resolvers
- Expected record format: `nexus-site-verification={token}`
- Returns `{ success: boolean, method: 'dns' }`

### `socketService.js` — Real-Time Engine

See [Section 9](#9-real-time-communication-websocket).

---

## 9. Real-Time Communication (WebSocket)

### Technology

Socket.IO v4.8.3 running on the same HTTP server.

### Architecture

```
Client ──(auth token)──▶ Socket.IO Server
                              │
                    ┌─────────┼─────────┐
                    ▼                   ▼
              user:{userId}      inquiry:{inquiryId}
              (Private Room)     (Chat Room)
```

### Authentication

Socket connections are authenticated via JWT middleware:
1. Token extracted from `socket.handshake.auth.token` or cookie
2. Verified using `jwt.verify(token, JWT_SECRET)`
3. Decoded payload attached to `socket.user`

### Events

| Event | Direction | Description |
|---|---|---|
| `join_inquiry` | Client → Server | Join an inquiry-specific chat room (with DB authorization check) |
| `new_inquiry` | Server → Client | Notify seller of new incoming inquiry |
| `new_message` | Server → Client | Broadcast new chat message to room + direct user delivery |
| `inquiry_updated` | Server → Client | Notify status change (open/closed) |
| `status_updated` | Server → Client | Broadcast status change to inquiry room |

### Room Management

- **Private rooms**: `user:{userId}` — joined on connection, used for targeted notifications
- **Inquiry rooms**: `inquiry:{inquiryId}` — joined on request, used for real-time chat

---

## 10. OTP Module

### Architecture

Follows a **modular pattern** (`modules/otp/`):
- `otp.controller.js` — HTTP request handlers
- `otp.service.js` — Business logic (Redis-backed)

### Flow

```
1. Client → POST /api/auth/send_otp { email }
2. Server generates 6-digit OTP (100000–999999)
3. OTP stored in Redis: key=`otp:{email}`, value=JSON { otp, verified: false }
4. TTL: 300 seconds (5 minutes)
5. OTP sent via external email service (EMAIL_SERVICE_API)
6. Client → POST /api/auth/verify_otp { email, otp }
7. Server compares OTP, sets verified=true in Redis
8. Signup endpoint checks `isEmailVerified(email)` before allowing registration
```

### Redis Key Schema

```
otp:{email} → { "otp": "123456", "verified": false }  (TTL: 300s)
```

---

## 11. Security Architecture

### Middleware Stack (Order of Execution)

1. **Helmet** — Security headers (CSP disabled for dev, cross-origin resource policy relaxed)
2. **CORS** — Origin whitelist with credentials
3. **Body Parser** — JSON/URL-encoded with 50MB limit
4. **Cookie Parser** — HttpOnly cookie extraction
5. **Rate Limiter** — General: 1000 req/15min, Auth: 100 req/15min
6. **Request Logger** — Method + path + IP logging

### Rate Limiting Configuration

| Limiter | Window | Max Requests | Applied To |
|---|---|---|---|
| `generalLimiter` | 15 min | 1000 | All endpoints |
| `authLimiter` | 15 min | 100 | `/api/auth/*` |
| `domainCheckLimiter` | 1 min | 500 | Domain check endpoints |

### Input Validation

All user inputs validated via `express-validator`:
- Email: `isEmail().normalizeEmail()`
- Password: length ≥ 8, uppercase letter, number
- Domain: string, trimmed, lowercased
- Numeric fields: `isNumeric()`
- File types: jpg, jpeg, png only (max 20MB)

### Error Handling

- **404 handler**: Catch-all for undefined endpoints
- **Global error handler**: Logs stack traces, sanitizes error messages in production
- **Database errors**: PostgreSQL error code `23505` → 409 Conflict (duplicate domain)

---

## 12. Deployment

### Windows Local Setup (PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Configure Environment variables
Copy-Item .env.example .env
# (Edit .env with your specific keys)

# 3. Run database migrations
npm run migrate

# 4. Start the development server
npm run dev
```

### NPM Scripts

| Command | Description |
|---|---|
| `npm start` | Production start (`node src/app.js`) |
| `npm run dev` | Development with auto-reload (`nodemon src/app.js`) |
| `npm run migrate` | Run database migrations |

### Health Check

```
GET /health → { "status": "ok", "db": "connected", "ts": "2026-..." }
```

Returns `503` with `"db": "disconnected"` if PostgreSQL is unreachable.

---

## 13. Educational References

Here are resources to learn the core technologies used in the Nerve Center:

- **Node.js**: [Node.js Official Documentation](https://nodejs.org/en/docs/)
- **Express.js**: [Express API Reference](https://expressjs.com/en/4x/api.html)
- **PostgreSQL**: [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- **pg (node-postgres)**: [node-postgres Documentation](https://node-postgres.com/)
- **Socket.IO**: [Socket.IO Documentation](https://socket.io/docs/v4/)
- **JWT (JSON Web Tokens)**: [Introduction to JSON Web Tokens](https://jwt.io/introduction)
