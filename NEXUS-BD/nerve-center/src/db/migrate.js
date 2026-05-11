'use strict';

/**
 * Simple sequential migration runner.
 * Run with:  node src/db/migrate.js
 */

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('../config/db');
const logger = require('../config/logger');

async function migrate() {
  const client = await pool.connect();

  try {
    const schemaFile = path.join(__dirname, 'init_schema.sql');
    if (!fs.existsSync(schemaFile)) {
      throw new Error('Consolidated schema file (init_schema.sql) not found.');
    }

    const sql = fs.readFileSync(schemaFile, 'utf-8');
    logger.info('[migrate] Applying consolidated schema...');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      logger.info('[migrate] Schema initialization successful.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed: ${err.message}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error('[migrate] Fatal error', { message: err.message });
  process.exit(1);
});
