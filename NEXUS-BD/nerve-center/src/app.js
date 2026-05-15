'use strict';

/**
 * NEXUS NERVE CENTER - Main Server
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { pool } = require('./config/db');
const logger = require('./config/logger');
const path = require('path');
const socketService = require('./services/socketService');
const { generalLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const userRoutes = require('./routes/user');
const watchlistRoutes = require('./routes/watchlist');
const inquiryRoutes = require('./routes/inquiries');
const adminRoutes = require('./routes/admin');



const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

/**
 * SECURITY & PARSING
 * Relaxing Helmet policies for development to allow cross-origin image loading.
 */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(generalLimiter);

// Static Serving for Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/**
 * LOGGING
 */
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

/**
 * HEALTH MONITOR
 */
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message });
  }
});

/**
 * ROUTE REGISTRATION
 */
app.use('/api/auth',      authRoutes);
app.use('/api/domains',   domainRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/admin',     adminRoutes);

/**
 * ERROR HANDLING
 */
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

/**
 * START
 */
server.listen(PORT, async () => {
  try {
    socketService.init(server);
    logger.info(`Nexus Nerve Center running on port ${PORT} (WebSockets Enabled)`);
  } catch (err) {
    logger.error('Initialization error', { error: err.message });
    logger.info(`Nexus Nerve Center running on port ${PORT}`);
  }
});

module.exports = app;
