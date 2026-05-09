# NEXUS Setup & Installation 🚀

Follow these steps to initialize the NEXUS production-ready stack.

---

## 🛠 1. Backend: Nerve Center (Port 4000)

1. **Install Dependencies**:
   ```bash
   cd NEXUS-BD/nerve-center
   npm install
   ```
2. **Environment Configuration**:
   Create a `.env` file:
   ```env
   PORT=4000
   FRONTEND_ORIGIN=http://localhost:3000
   DB_HOST=localhost
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=nexus
   INTERNAL_API_KEY=your_shared_secret
   INTELLIGENCE_CORE_URL=http://localhost:8000
   GODADDY_API_KEY=...
   PORKBUN_API_KEY=...
   NAMECOM_API_TOKEN=...
   ```
3. **Database Migration**:
   ```bash
   npm run migrate
   ```
4. **Execution**:
   ```bash
   npm run dev
   ```

---

## 🤖 2. Backend: Intelligence Core (Port 8000)

1. **Setup Environment**:
   ```bash
   cd NEXUS-BD/intelligence-core
   python -m venv venv
   source venv/bin/activate  # venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
2. **Environment Configuration**:
   Create a `.env` file:
   ```env
   INTERNAL_API_KEY=your_shared_secret (must match Nerve Center)
   NERVE_CENTER_ORIGIN=http://localhost:4000
   OPENAI_API_KEY=... (Optional for semantic scoring)
   ```
3. **Execution**:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

---

## 💻 3. Frontend: NEXUS Terminal (Port 3000)

1. **Install Dependencies**:
   ```bash
   cd NEXUS-FD
   npm install
   ```
2. **Environment Configuration**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```
3. **Execution**:
   ```bash
   npm run dev
   ```

---

## 🛡️ Production Security Notes

- **Authentication**: NEXUS uses HttpOnly cookies. Ensure `FRONTEND_ORIGIN` is correctly set in the backend to allow cross-origin credential passing.
- **Verification**: Use the `demo.nexus.io` domain to test the "Verified" asset flow instantly.
- **Registrar APIs**: You must have valid API keys for GoDaddy, Porkbun, or Name.com to receive live pricing signals.

---

**NEXUS** — *Institutional Intelligence for the Digital Asset Class.*
