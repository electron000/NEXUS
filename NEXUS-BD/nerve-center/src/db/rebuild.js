'use strict';

require('dotenv').config();
const { pool } = require('../config/db');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

/**
 * MASTER DATABASE REBUILD & SEEDING SCRIPT
 * 1. Drops everything
 * 2. Runs all migrations
 * 3. Seeds Admin User
 */
async function rebuild() {
  const client = await pool.connect();

  try {
    logger.info('[rebuild] Initiating full system wipe...');

    // 1. Drop and Recreate Schema
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    logger.info('[rebuild] Schema purged.');

    // 2. Run Migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      logger.info(`[rebuild] Applying Migration: ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    }
    logger.info('[rebuild] Schema re-initialization complete.');

    // 3. Seed Admin User
    const adminEmail = 'admin@nexus.io';
    const adminPass = 'NexusAdmin2026!';
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(adminPass, salt);

    logger.info('[rebuild] Seeding Admin credentials...');
    
    // We use a DELETE first to ensure no conflict, though CASCADE already handled it
    await client.query('DELETE FROM users WHERE email = $1', [adminEmail]);

    await client.query(`
      INSERT INTO users (
        email, 
        password_hash, 
        name, 
        role, 
        is_admin, 
        kyc_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      adminEmail, 
      hash, 
      'Nexus Administrator', 
      'root', 
      true, 
      'verified'
    ]);

    logger.info('[rebuild] System rebuild successful.');
    logger.info('------------------------------------------------');
    logger.info(`ADMIN EMAIL: ${adminEmail}`);
    logger.info(`ADMIN PASS : ${adminPass}`);
    logger.info('------------------------------------------------');

  } catch (err) {
    logger.error('[rebuild] FATAL ERROR during database reconstruction', { message: err.message });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

rebuild();
