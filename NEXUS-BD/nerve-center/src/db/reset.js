'use strict';

require('dotenv').config();
const { pool } = require('../config/db');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

async function reset() {
  const client = await pool.connect();

  try {
    logger.info('[reset] Starting database wipe...');

    // Drop all tables in the public schema
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    logger.info('[reset] Database wiped. Starting re-initialization...');

    // Now run migrations sequentially
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Re-create the migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      logger.info(`[reset] Applying: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`[reset] Success: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    logger.info('[reset] Database rebuilt successfully.');
  } catch (err) {
    logger.error('[reset] Fatal error during reset', { message: err.message });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
