-- 001_initial_schema.sql
-- Creates the core tables for the Nexus Digital Asset Terminal.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    preferences   JSONB NOT NULL DEFAULT '{"trackingExtensions": [".com", ".net", ".io"], "currency": "USD"}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── Portfolio Jobs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_jobs (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    results      JSONB,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portfolio_jobs_user_id ON portfolio_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_jobs_status  ON portfolio_jobs (status);

-- ─── Domain Cache ─────────────────────────────────────────────────────────────
-- Short-lived cache to reduce hammering registrar APIs for the same domains.
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
