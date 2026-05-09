-- 007_create_inquiries_table.sql
-- Facilitates communication between buyers and sellers.

CREATE TYPE inquiry_status AS ENUM ('open', 'negotiating', 'closed', 'spam');

CREATE TABLE IF NOT EXISTS inquiries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain        TEXT NOT NULL,
    sender_id     UUID NOT NULL REFERENCES users(id),
    receiver_id   UUID NOT NULL REFERENCES users(id),
    message       TEXT NOT NULL,
    offer_price   NUMERIC(12, 2),
    status        inquiry_status DEFAULT 'open',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inquiries_sender ON inquiries(sender_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_receiver ON inquiries(receiver_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_domain ON inquiries(domain);
