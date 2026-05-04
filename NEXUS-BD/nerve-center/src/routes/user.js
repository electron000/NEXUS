'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');
const logger = require('../config/logger');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// ─── GET /api/user/profile ─────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT email, created_at, preferences FROM users WHERE id = $1`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const row = result.rows[0];
    const preferences = row.preferences || {
      trackingExtensions: ['.com', '.net', '.io'],
      currency: 'USD',
    };

    return res.json({
      email:      row.email,
      createdAt:  row.created_at,
      preferences,
    });
  } catch (err) {
    logger.error('GET /profile error', { userId: req.user.id, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// ─── PUT /api/user/profile ─────────────────────────────────────────────────────
const VALID_EXTENSIONS = [
  '.com', '.net', '.org', '.io', '.co', '.app', '.dev',
  '.ai', '.xyz', '.info', '.biz', '.us', '.uk', '.de',
];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'];

router.put(
  '/profile',
  [
    body('preferences').isObject().withMessage('preferences must be an object'),
    body('preferences.trackingExtensions')
      .isArray({ min: 1, max: 20 })
      .withMessage('trackingExtensions must be an array of 1–20 items'),
    body('preferences.trackingExtensions.*')
      .isIn(VALID_EXTENSIONS)
      .withMessage(`Each extension must be one of: ${VALID_EXTENSIONS.join(', ')}`),
    body('preferences.currency')
      .isIn(VALID_CURRENCIES)
      .withMessage(`currency must be one of: ${VALID_CURRENCIES.join(', ')}`),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { preferences } = req.body;

    try {
      await query(
        `UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(preferences), req.user.id],
      );

      return res.json({ success: true, preferences });
    } catch (err) {
      logger.error('PUT /profile error', { userId: req.user.id, message: err.message });
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  },
);

// ─── GET /api/user/dashboard ───────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const { predictDomainMetrics } = require('../services/csvService');
    const { calculateRegistrarPricing } = require('../services/pricingService');

    // Generate dynamic sentiment based on CSV averages
    // In a real app, this would be a time-series aggregation
    const sentiment = 65 + (Math.random() * 10 - 5);

    // Pick 5 top movers from interesting domains
    const moverDomains = ['nexus.io', 'protocol.ai', 'vertex.com', 'cipher.io', 'matrix.ai'];
    const topMovers = await Promise.all(moverDomains.map(async (d) => {
      const score = await predictDomainMetrics(d);
      const pricing = calculateRegistrarPricing(d, score);
      const change = (Math.random() * 15) * (Math.random() > 0.3 ? 1 : -1);
      return {
        domain: d,
        change: parseFloat(change.toFixed(2)),
        value: pricing[0].initial * 10, // Simulated asset value
      };
    }));

    const metrics = {
      portfolioValue: {
        label: "Portfolio Value",
        value: 512400.00 + (Math.random() * 5000 - 2500),
        change: 4.2 + (Math.random() * 0.5 - 0.25),
        prefix: "$",
        sparkline: Array.from({ length: 12 }, () => 500 + Math.random() * 50),
      },
      activeDomains: {
        label: "Active Domains",
        value: 154,
        change: 1.2,
        sparkline: Array.from({ length: 12 }, () => 140 + Math.random() * 20),
      },
      monthlyRevenue: {
        label: "Monthly Revenue",
        value: 15800.00 + (Math.random() * 1000 - 500),
        change: 5.5 + (Math.random() * 1.0 - 0.5),
        prefix: "$",
        sparkline: Array.from({ length: 12 }, () => 14000 + Math.random() * 2000),
      },
      watchlistSize: {
        label: "Watchlist",
        value: 32,
        change: -0.8,
        sparkline: Array.from({ length: 12 }, () => 25 + Math.random() * 10),
      },
      marketSentiment: parseFloat(sentiment.toFixed(1)),
      topMovers,
    };

    return res.json(metrics);
  } catch (err) {
    logger.error('/dashboard error', { userId: req.user.id, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
});


module.exports = router;
