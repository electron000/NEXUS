# NEXUS Frontend — Technical Documentation

> **Module**: `NEXUS-FD`  
> **Framework**: Next.js 16.1.6 · React 19 · TypeScript 5  
> **Port**: 3000  
> **Role**: User-facing SPA with SSR capabilities — provides the dashboard, domain intelligence terminal, portfolio management, real-time messaging, and admin panel.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Configuration](#4-configuration)
5. [Routing & Layout Architecture](#5-routing--layout-architecture)
6. [State Management](#6-state-management)
7. [Service Layer (API Client)](#7-service-layer-api-client)
8. [Authentication Flow](#8-authentication-flow)
9. [Key Features & Components](#9-key-features--components)
10. [Real-Time Communication](#10-real-time-communication)
11. [Type System](#11-type-system)
12. [Styling & Design System](#12-styling--design-system)
13. [Deployment](#13-deployment)

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    NEXUS-FD (Next.js)                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Marketing │  │   Auth   │  │Dashboard │  │ Admin  │ │
│  │  (SSR)    │  │  Pages   │  │  Pages   │  │ Panel  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│       │              │              │            │      │
│  ┌────┴──────────────┴──────────────┴────────────┴──┐  │
│  │              Zustand Store (useAppStore)          │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │         Service Layer (Axios + SSE + Socket.IO)   │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │ HTTP / WS
              ┌───────────┴───────────┐
              │    Nerve Center       │
              │    (Port 4000)        │
              └───────────────────────┘
```

---

## 2. Technology Stack

### Core

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | React meta-framework (App Router) |
| `react` / `react-dom` | 19.2.3 | UI library |
| `typescript` | ^5 | Type safety |

### State & Data

| Package | Purpose |
|---|---|
| `zustand` (5.0.5) | Global state management with persistence |
| `axios` (1.16.0) | HTTP client with interceptors |
| `socket.io-client` (4.8.3) | Real-time WebSocket communication |
| `zod` (3.24.4) | Runtime schema validation |
| `react-hook-form` (7.56.0) | Form state management |
| `@hookform/resolvers` (4.1.3) | Zod integration for react-hook-form |

### UI & Animation

| Package | Purpose |
|---|---|
| `tailwindcss` (v4) | Utility-first CSS framework |
| `framer-motion` (12.36.0) | Animation library (page transitions, modals, sidebar) |
| `lucide-react` (0.577.0) | Icon library |
| `recharts` (2.15.3) | Data visualization charts |
| `sonner` (2.0.7) | Toast notification system |
| `@tanstack/react-table` (8.21.3) | Headless table library |
| `class-variance-authority` (0.7.1) | Component variant management |
| `clsx` + `tailwind-merge` | Conditional class merging |

### Fonts

| Font | Usage |
|---|---|
| **Space Grotesk** | Primary sans-serif (`--font-sans`) |
| **JetBrains Mono** | Monospace / terminal aesthetic (`--font-mono`) |

---

## 3. Project Structure

```
NEXUS-FD/
├── Dockerfile                    # Multi-stage production build
├── package.json
├── next.config.ts
├── tsconfig.json
├── components.json               # shadcn/ui component config
├── postcss.config.mjs
├── public/
│   └── nexus.webp                # Logo asset
└── src/
    ├── app/
    │   ├── layout.tsx            # ★ Root layout (fonts, metadata, Toaster)
    │   ├── globals.css           # Global styles & CSS variables
    │   ├── not-found.tsx         # Custom 404 page
    │   ├── favicon.ico
    │   ├── (auth)/               # Auth route group
    │   │   ├── layout.tsx        # Auth layout (centered card + grid bg)
    │   │   ├── login/
    │   │   └── register/
    │   ├── (dashboard)/          # Protected route group
    │   │   ├── layout.tsx        # ★ Dashboard layout (sidebar, auth guard, socket)
    │   │   ├── overview/         # Nerve Center dashboard
    │   │   ├── terminal/         # Domain intelligence terminal
    │   │   ├── portfolio/        # Portfolio management
    │   │   ├── watchlist/        # Tracked domains
    │   │   └── messages/         # Inquiry chat
    │   ├── (marketing)/          # Public marketing pages
    │   │   ├── layout.tsx        # Marketing layout
    │   │   └── page.tsx          # Landing page
    │   ├── admin/                # Admin panel
    │   │   ├── login/
    │   │   ├── dashboard/
    │   │   └── page.tsx
    │   └── unauthorized/         # Access denied page
    ├── components/
    │   ├── terminal/             # Domain terminal components
    │   │   ├── ArbitrageTable.tsx # Registrar price comparison
    │   │   ├── InquiryModal.tsx  # Domain inquiry form
    │   │   ├── SSEProgressBar.tsx # Real-time progress indicator
    │   │   └── ScoreGauge.tsx    # Circular score visualization
    │   └── ui/                   # Reusable UI primitives
    │       ├── badge.tsx, button.tsx, card.tsx, input.tsx
    │       ├── progress.tsx, skeleton.tsx, table.tsx
    │       ├── tooltip.tsx
    │       └── HeroLogo.tsx      # Animated logo component
    ├── lib/
    │   ├── routes.ts             # ★ Central route registry
    │   ├── socket.ts             # Socket.IO client singleton
    │   ├── utils.ts              # cn() utility
    │   └── valuation.ts          # SSE-based domain valuation fetcher
    ├── services/
    │   ├── config.ts             # ★ Axios instance, interceptors, apiCall()
    │   ├── index.ts              # Service barrel export
    │   ├── auth/index.ts         # Auth API + session storage
    │   ├── domains/index.ts      # Domain check API
    │   ├── user/index.ts         # Profile, dashboard, portfolio, KYC API
    │   └── admin/index.ts        # Admin stats, KYC review API
    ├── store/
    │   └── useAppStore.ts        # ★ Zustand global store
    └── types/
        └── index.ts              # ★ Central type manifest
```

---

## 4. Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Nerve Center API base URL |
| `NEXT_PUBLIC_INTELLIGENCE_API_URL` | `http://localhost:8000` | Intelligence Core URL (reference only) |

---

## 5. Routing & Layout Architecture

### Route Groups (Next.js App Router)

| Group | Path Pattern | Layout | Auth Required |
|---|---|---|---|
| `(marketing)` | `/` | Marketing layout | ❌ |
| `(auth)` | `/login`, `/register` | Auth layout (centered card) | ❌ |
| `(dashboard)` | `/overview`, `/terminal`, `/portfolio`, `/watchlist`, `/messages` | Dashboard layout (sidebar + guard) | ✅ |
| `admin` | `/admin/login`, `/admin/dashboard` | Admin layout | ✅ + Admin |

### Route Registry (`lib/routes.ts`)

Centralized route constants with helper functions:

```typescript
ROUTES.PUBLIC    → HOME, FEATURES, LOGIN, REGISTER
ROUTES.PROTECTED → TERMINAL, OVERVIEW, PORTFOLIO, KYC, WATCHLIST, MESSAGES
ROUTES.ADMIN     → LOGIN, DASHBOARD, KYC_REVIEW, USER_MANAGEMENT
```

Helpers: `isProtectedRoute(path)`, `isAdminRoute(path)`

### Dashboard Layout Features

The `(dashboard)/layout.tsx` is the most complex layout (~588 lines):

- **AuthGuard**: Waits for Zustand hydration, redirects to `/login` if unauthenticated
- **Sidebar**: Collapsible desktop navigation with animated expand/collapse (Framer Motion)
- **MobileDrawer**: Slide-in mobile navigation with overlay
- **MobileBottomNav**: Fixed bottom tab bar for mobile
- **Session Refresh**: Calls `GET /api/auth/me` on mount and on every pathname change to sync KYC status
- **Socket Connection**: Initializes WebSocket on successful auth
- **Logout Confirmation**: Modal dialog before sign-out

### Navigation Items

| ID | Label | Icon | Path |
|---|---|---|---|
| `overview` | Nerve Center | LayoutDashboard | `/overview` |
| `terminal` | Domain Terminal | Terminal | `/terminal` |
| `portfolio` | Sale Portfolio | Briefcase | `/portfolio` |
| `watchlist` | Watchlist | Bookmark | `/watchlist` |
| `messages` | Messages | MessageSquare | `/messages` |

---

## 6. State Management

### Zustand Store (`useAppStore`)

Persisted to `localStorage` under key `nexus-terminal-store`.

#### State Shape

| Slice | Fields | Description |
|---|---|---|
| **Session** | `isLoggedIn`, `userProfile`, `_hasHydrated` | Auth state + hydration tracking |
| **Watchlist** | `watchlist: WatchlistEntry[]` | Client-side domain tracking |
| **Terminal** | `lastQuery`, `lastValuation`, `queryHistory` | Search history (last 20) |
| **UI** | `sidebarCollapsed`, `commandPaletteOpen`, `unreadMessagesCount` | Layout preferences + notification count |

#### Persisted Fields

Only these fields survive page reload:
`isLoggedIn`, `userProfile`, `watchlist`, `queryHistory`, `sidebarCollapsed`

#### Key Actions

| Action | Description |
|---|---|
| `login(user)` | Sets auth state, generates avatar initials |
| `setAuthFromSession()` | Restores from localStorage |
| `logout()` | Clears all session and cached data |
| `updateProfile(updates)` | Partial profile update + localStorage sync |
| `setLastValuation(domain, data)` | Stores valuation result + adds to history |
| `fetchUnreadMessagesCount()` | Fetches total unread messages from backend |
| `toggleSidebar()` | Collapse/expand sidebar |

#### Hydration Tracking

The store uses `onRehydrateStorage` callback to set `_hasHydrated = true` after localStorage data is loaded. The AuthGuard waits for this before making redirect decisions.

---

## 7. Service Layer (API Client)

### Axios Instance (`services/config.ts`)

```typescript
apiClient = axios.create({
  baseURL: API_BASE_URL,      // http://localhost:4000
  withCredentials: true,       // Send cookies automatically
  headers: { 'Content-Type': 'application/json' }
})
```

### Response Interceptor

- **Success**: Unwraps `response.data` automatically
- **401 Handling**: Checks if the user is on a login page; if not, clears localStorage and redirects to `/login?expired=true`
- **Error Wrapping**: All errors thrown as `APIError(status, message, details)`

### SSE Client (`lib/valuation.ts`)

For domain valuation, uses native `EventSource` API:

```typescript
const es = new EventSource(
  `${API_BASE_URL}/api/domains/valuation-stream/${domain}?token=${token}`
);
es.addEventListener("complete", (e) => { /* resolve */ });
es.onerror = (err) => { /* reject */ };
setTimeout(() => { es.close(); reject("timeout"); }, 30000);
```

Token passed as query parameter since EventSource doesn't support custom headers.

### Service Modules

| Module | Functions |
|---|---|
| **auth** | `signup()`, `login()`, `sendOTP()`, `verifyOTP()`, `getCurrentUser()`, `loginUser()`, `signupUser()`, `logoutUser()`, `isAuthenticated()`, `saveUser()`, `getUser()`, `clearSession()` |
| **domains** | `checkDomains()`, `getDomainDetails()` |
| **user** | `getUserProfile()`, `updateUserProfile()`, `getDashboardMetrics()`, `submitKYC()`, `deletePortfolioItem()`, `healthCheck()` |
| **admin** | `getAdminStats()`, `getPendingKYCs()`, `reviewKYC()` |

---

## 8. Authentication Flow

```
┌──────────┐   OTP    ┌──────────┐  Signup   ┌──────────┐
│ Register │───────▶ │ Verify   │─────────▶│ Dashboard│
│  Page    │ sendOTP  │  Email   │ POST      │  (Auth   │
│          │◀──OTP──  │          │ /signup   │  Guard)  │
└──────────┘         └──────────┘           └──────────┘

┌──────────┐ Login    ┌──────────┐
│  Login   │─────────▶│ Dashboard│
│  Page    │ POST     │  (Auth   │
│          │ /login   │  Guard)  │
└──────────┘          └──────────┘
```

1. **Registration**: Email → OTP → Verify → Signup → JWT cookie + Zustand login
2. **Login**: Email + Password → JWT cookie + Zustand login
3. **Session Restore**: On dashboard mount, `GET /api/auth/me` validates cookie → Zustand login
4. **Logout**: `POST /api/auth/logout` → Clear cookie + localStorage + Zustand reset → Redirect to `/`

---

## 9. Key Features & Components

### Domain Intelligence Terminal (`/terminal`)

- Search input for domain names
- **SSEProgressBar**: Animated 4-stage progress bar showing real-time backend pipeline progress
- **ScoreGauge**: Circular gauge visualization for Nexus Score (model + semantic)
- **ArbitrageTable**: Registrar price comparison table (GoDaddy, Porkbun, Name.com) with affiliate links
- **InquiryModal**: Modal form for sending purchase inquiries to domain owners
- Ownership intelligence panel (WHOIS, RDAP, DNS, MX records)

### Nerve Center Overview (`/overview`)

- KYC status banner with CTA
- Portfolio net worth metric card
- Verified assets count
- Total investment metric
- Portfolio performance table (domain, bought price, valuation, growth %)

### Sale Portfolio (`/portfolio`)

- Add domain form (domain name, bought price, sale toggle, asking price)
- DNS verification workflow with token display
- Portfolio table with verification status badges
- Delete portfolio entries

### Messages (`/messages`)

- Inquiry list (sent + received)
- Real-time chat per inquiry thread
- Auto-scroll on new messages
- Socket.IO room-based real-time sync

### Admin Dashboard (`/admin/dashboard`)

- Platform statistics (users, sellers, inquiries, domains)
- Pending KYC review queue
- Aadhaar document image viewer
- Approve/Reject actions with reason field

### UI Component Library

| Component | Description |
|---|---|
| `Button` | CVA-based variant system (default, destructive, outline, ghost) |
| `Card` | Container with header, title, description, content, footer |
| `Badge` | Status indicator with variants |
| `Input` | Styled form input |
| `Table` | Full table structure (header, body, row, cell, caption) |
| `Progress` | Animated progress bar |
| `Skeleton` | Loading placeholder |
| `Tooltip` | Hover tooltip with animation |
| `HeroLogo` | Animated SVG logo for landing page |

---

## 10. Real-Time Communication

### Socket.IO Client (`lib/socket.ts`)

Singleton pattern with lazy initialization:

```typescript
const socket = io(API_BASE_URL, {
  auth: { token },
  withCredentials: true,
  autoConnect: true,
  transports: ['websocket', 'polling']
});
```

### Connection Lifecycle

1. **Connect**: On successful `GET /api/auth/me` in dashboard layout
2. **Disconnect**: On logout (explicit `disconnectSocket()`)
3. **Events**: `new_inquiry`, `new_message`, `inquiry_updated`, `status_updated`
4. **Unread Count Sync**: Automatically triggers `fetchUnreadMessagesCount()` on `new_message` or `new_inquiry` events to update UI badges.

---

## 11. Type System

### Core Types (`types/index.ts`)

| Type | Description |
|---|---|
| `UserProfile` | User identity with KYC status, role, avatar |
| `LoadingPhase` | SSE progress stages (idle → scanning → processing → audit → synthesizing → complete) |
| `NexusValueScore` | `{ overall, model, semantic }` |
| `RegistrarPricing` | Per-registrar pricing breakdown |
| `OwnershipInfo` | WHOIS/RDAP/DNS intelligence composite |
| `AppraisalInfo` | ML-predicted value and tier |
| `DomainValuationResponse` | Complete valuation response envelope |
| `WatchlistEntry` | Tracked domain with optional alert price |
| `DashboardMetrics` | Overview page metric cards + portfolio table |

---

## 12. Styling & Design System

- **Theme**: Dark mode only (`html.dark`, `colorScheme: "dark"`)
- **Background**: `#09090b` (zinc-950)
- **Accent**: Blue-400/500 for active states
- **Fonts**: Space Grotesk (UI) + JetBrains Mono (terminal aesthetic)
- **Animations**: Framer Motion for page transitions, sidebar, modals
- **Toasts**: Sonner (bottom-right, dark theme, close button)
- **Grid Background**: CSS linear-gradient grid pattern on auth pages

---

## 13. Deployment

### Windows Local Setup (PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Configure Environment variables
Copy-Item .env.example .env
# (Edit .env with your backend API URLs)

# 3. Start the development server
npm run dev
```

### NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint check |

---

## 14. Educational References

Here are resources to learn the core technologies used in the Frontend:

- **Next.js**: [Next.js App Router Documentation](https://nextjs.org/docs/app)
- **Zustand**: [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- **TailwindCSS**: [TailwindCSS Documentation](https://tailwindcss.com/docs)
- **shadcn/ui**: [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- **React Hook Form**: [React Hook Form Documentation](https://react-hook-form.com/get-started)
- **Zod**: [Zod Documentation](https://zod.dev/)
