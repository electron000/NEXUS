'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('../config/db');
const logger = require('../config/logger');
const fs = require('fs');
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

    // 2. Run Consolidated Migration
    const schemaFile = path.join(__dirname, 'init_schema.sql');
    if (!fs.existsSync(schemaFile)) {
      throw new Error('Consolidated schema file (init_schema.sql) not found.');
    }

    const sql = fs.readFileSync(schemaFile, 'utf-8');
    logger.info('[rebuild] Applying consolidated system schema...');
    await client.query(sql);
    
    logger.info('[rebuild] System rebuild successful.');

  } catch (err) {
    logger.error('[rebuild] FATAL ERROR during database reconstruction', { message: err.message });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

rebuild();
