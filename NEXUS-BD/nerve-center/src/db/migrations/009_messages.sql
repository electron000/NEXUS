-- 006_create_inquiry_messages_table.sql
-- Tracks individual messages sent within an inquiry thread.

CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id  UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching all messages in a specific inquiry thread quickly
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id ON inquiries(id);

-- Index for finding all messages sent by a specific user (useful for analytics or user data deletion)
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_sender_id ON inquiries(sender_id);

-- Composite index to optimize fetching a user's messages within a specific thread (optional but good for strict RBAC checks)
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_sender ON inquiries(id, sender_id);