'use strict';
const { pool } = require('./src/config/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log('--- Table: portfolio ---');
    const portfolioCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'portfolio'
    `);
    portfolioCols.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));

    console.log('\n--- Table: users ---');
    const userCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    userCols.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));

    console.log('\n--- Enum: verification_status ---');
    const verifStatusValues = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE typname = 'verification_status'
    `);
    verifStatusValues.rows.forEach(row => console.log(row.enumlabel));

    console.log('\n--- Enum: kyc_status ---');
    const kycStatusValues = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE typname = 'kyc_status'
    `);
    kycStatusValues.rows.forEach(row => console.log(row.enumlabel));

  } catch (err) {
    console.error('Error checking schema:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
