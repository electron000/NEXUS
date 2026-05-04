-- 002_seed_demo_user.sql
-- Seed a demo user for the Nexus Digital Asset Terminal.
-- Password is 'password' hashed with bcrypt (12 rounds).

INSERT INTO users (email, password_hash, created_at)
VALUES (
    'demo@nexus.io', 
    '$2a$12$qu52Peq7q0CkAQ/ozvzm0eMklS6LYy4OBPFpZq23PfNr3mBnBBjLS', -- Hash for 'password'
    NOW()
)
ON CONFLICT (email) DO NOTHING;
