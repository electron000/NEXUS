-- 003_add_user_profile_fields.sql
-- Add name and role columns to users table.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'analyst';

-- Update the demo user to have a name
UPDATE users SET name = 'Demo User', role = 'analyst' WHERE email = 'demo@nexus.io';
