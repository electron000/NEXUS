-- 005_create_portfolio_table.sql
-- Tracks domains owned by Nexus users with verification status.

CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE verification_method AS ENUM ('dns', 'html');

CREATE TABLE IF NOT EXISTS portfolio (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain              TEXT NOT NULL,
    is_for_sale         BOOLEAN DEFAULT FALSE,
    asking_price        NUMERIC(12, 2),
    verification_status verification_status DEFAULT 'pending',
    verification_method verification_method DEFAULT 'dns',
    verification_token  TEXT NOT NULL,
    last_verified_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(domain) -- One domain can only be in one portfolio at a time
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_domain ON portfolio(domain);
