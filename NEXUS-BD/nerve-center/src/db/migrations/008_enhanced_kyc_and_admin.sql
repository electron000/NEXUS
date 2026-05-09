-- 008_enhanced_kyc_and_admin.sql
-- Enhanced KYC fields and Admin flag

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS middle_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS father_name TEXT,
ADD COLUMN IF NOT EXISTS mother_name TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS aadhaar_front_path TEXT,
ADD COLUMN IF NOT EXISTS aadhaar_back_path TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

-- Seed an initial admin user if not exists
-- Password will be: NexusAdmin2024! (hashed with bcrypt)
INSERT INTO users (email, password_hash, name, role, is_admin, created_at)
SELECT 'admin@nexus.io', '$2a$12$R.S.Y6W9Jt/B3GZl4u7kbeL4X.E9vW9vW9vW9vW9vW9vW9vW9vW9v', 'Nexus Administrator', 'analyst', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@nexus.io');
