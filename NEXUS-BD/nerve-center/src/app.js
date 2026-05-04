'use strict';

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./config/db');
const logger = require('./config/logger');

// Route imports
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const portfolioRoutes = require('./routes/portfolio');
const userRoutes = require('./routes/user');
const mlRoutes = require('./routes/ml');
const settingsRoutes = require('./routes/settings');


const { loadCsvData } = require('./services/csvService');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/domains',   domainRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/ml',        mlRoutes);
app.use('/api/user/settings', settingsRoutes);


// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  try {
    await loadCsvData();
    logger.info(`Nexus Nerve Center running on port ${PORT}`);
  } catch (err) {
    logger.error('Failed to initialize CSV data. App starting without ML data.', { error: err.message });
    logger.info(`Nexus Nerve Center running on port ${PORT}`);
  }
});

module.exports = app;
