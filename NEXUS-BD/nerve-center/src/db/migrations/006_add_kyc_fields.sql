-- 006_add_kyc_fields.sql
-- Adds identity verification fields to the users table.

CREATE TYPE kyc_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS kyc_status kyc_status DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS kyc_id_type TEXT,
ADD COLUMN IF NOT EXISTS kyc_id_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS kyc_document_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
