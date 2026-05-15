-- NEXUS MASTER SCHEMA INITIALIZATION
-- Consolidated from legacy migration files

-- ── 1. Types ──────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
        CREATE TYPE kyc_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_method') THEN
        CREATE TYPE verification_method AS ENUM ('dns');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status') THEN
        CREATE TYPE inquiry_status AS ENUM ('open', 'closed');
    END IF;
END $$;

-- ── 2. Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT,
    role          TEXT DEFAULT 'analyst',
    preferences   JSONB NOT NULL DEFAULT '{"trackingExtensions": [".com", ".net", ".io"], "currency": "USD"}',
    kyc_status    kyc_status DEFAULT 'unverified',
    kyc_id_type   TEXT,
    kyc_id_number_encrypted TEXT,
    kyc_document_url TEXT,
    kyc_verified_at TIMESTAMPTZ,
    first_name    TEXT,
    middle_name   TEXT,
    last_name     TEXT,
    father_name   TEXT,
    mother_name   TEXT,
    address       TEXT,
    aadhaar_front_path TEXT,
    aadhaar_back_path TEXT,
    is_admin      BOOLEAN DEFAULT FALSE,
    kyc_rejection_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

-- ── 3. Domain Cache ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domain_cache (
    domain        TEXT PRIMARY KEY,
    available     BOOLEAN NOT NULL,
    initial_price NUMERIC(10, 2),
    renewal_price NUMERIC(10, 2),
    whois_privacy NUMERIC(10, 2),
    nexus_score   JSONB,
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_cache_expires ON domain_cache (expires_at);

-- ── 4. Watchlist ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain      TEXT NOT NULL,
    valuation   JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_domain  ON watchlist (domain);

-- ── 5. Portfolio ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain              TEXT NOT NULL,
    is_for_sale         BOOLEAN DEFAULT FALSE,
    asking_price        NUMERIC(12, 2),
    bought_price        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valuation_price     NUMERIC(12, 2) DEFAULT 0,
    verification_status verification_status DEFAULT 'pending',
    verification_method verification_method DEFAULT 'dns',
    verification_token  TEXT NOT NULL,
    last_verified_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(domain)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_domain ON portfolio(domain);

-- ── 6. Inquiries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain        TEXT NOT NULL,
    sender_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message       TEXT NOT NULL,
    offer_price   NUMERIC(12, 2),
    status        inquiry_status DEFAULT 'open',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inquiries_sender ON inquiries(sender_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_receiver ON inquiries(receiver_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_domain ON inquiries(domain);

-- ── 7. Messages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id  UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_inquiry_id ON messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- ── 8. Triggers & Functions ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_watchlist_updated_at ON watchlist;
CREATE TRIGGER update_watchlist_updated_at
    BEFORE UPDATE ON watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── 8.1 Robustness Fixes ──────────────────────────────────────────────────────
-- Ensure columns exist in case the database was initialized with an older schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS bought_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS valuation_price NUMERIC(12, 2) DEFAULT 0;


-- ── 9. Seed Data ──────────────────────────────────────────────────────────────
-- Password: NexusAdmin2026!
INSERT INTO users (email, password_hash, name, role, is_admin, created_at)
SELECT 'admin@nexus.io', '$2a$10$v0qob5/a4QbeqlhBt1yWl.WPcFhv8XFnj4pDH9VRQPlBncei/kgq.', 'Nexus Administrator', 'analyst', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@nexus.io');
