# NEXUS Setup & Installation Guide 🚀

This guide provides step-by-step instructions to get the full NEXUS ecosystem running on your local machine.

## 🛠 Prerequisites

Ensure you have the following installed:
- **Node.js** (v18+ recommended)
- **Python** (v3.10+ recommended)
- **PostgreSQL** (v14+ recommended)
- **NPM** or **Yarn**

---

## 1. Backend 1: Nerve Center (Node.js) 🧠
The Nerve Center handles authentication, registrar integrations, and portfolio job orchestration.

### Installation
1. Navigate to the Nerve Center directory:
   ```bash
   cd NEXUS-BD/nerve-center
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration
1. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required variables in `.env`:
   - `JWT_SECRET`: A long random string for security.
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`: Your PostgreSQL credentials.
   - `INTERNAL_API_KEY`: A shared secret string (must match Intelligence Core).

### Database Setup
1. Create a database named `nexus` in PostgreSQL.
2. Run migrations to create tables:
   ```bash
   node src/db/migrate.js
   ```

### Execution
Start the development server:
```bash
npm run dev
```
The server will run at `http://localhost:3001` (or your configured `PORT`).

---

## 2. Backend 2: Intelligence Core (Python) 🤖
The Intelligence Core handles ML scoring, semantic analysis, and trend momentum tracking.

### Installation
1. Navigate to the Intelligence Core directory:
   ```bash
   cd NEXUS-BD/intelligence-core
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Configuration
1. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required variables in `.env`:
   - `INTERNAL_API_KEY`: Must match the value in Nerve Center.
   - `OPENAI_API_KEY` or `GEMINI_API_KEY`: Required for semantic scoring.

### Execution
Start the FastAPI server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

---

## 3. Frontend: Terminal (Next.js) 💻
The Frontend provides the institutional terminal interface and dashboard.

### Installation
1. Navigate to the Frontend directory:
   ```bash
   cd NEXUS-FD
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration
1. Create a `.env.local` file:
   ```bash
   cp .env.local.example .env.local  # If example exists, or create manually
   ```
2. Ensure the following variables are set:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_INTELLIGENCE_API_URL=http://localhost:8000
   ```

### Execution
Start the development server:
```bash
npm run dev
```
Access the terminal at `http://localhost:3000`.

---

## 📡 External API Key Setup

To enable live market data, you need to configure your registrar keys.

### 1. Porkbun (Live Pricing)
- Get your **API Key** and **Secret Key** from the [Porkbun API Console](https://porkbun.com/account/api).
- Add them in the NEXUS **Settings** page (stored in your encrypted user profile).

### 2. Cloudflare (Domain Management)
- Get your **Global API Key** and **Email** from your [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
- Add them in the NEXUS **Settings** page.

### 3. GoDaddy (Availability)
- Get your **Key** and **Secret** from the [GoDaddy Developer Portal](https://developer.godaddy.com/keys).
- **Note**: NEXUS currently uses the OTE (Test) environment. Transition to Production requires 50+ domains in your GoDaddy account.

---

## 🛠 Troubleshooting

- **CORS Errors**: Ensure `FRONTEND_ORIGIN` in Nerve Center's `.env` matches your frontend URL (`http://localhost:3000`).
- **DB Connection**: Verify that PostgreSQL is running and the credentials in `.env` are correct.
- **ML Scoring Failure**: Ensure Intelligence Core is running and the `INTERNAL_API_KEY` matches between services.
