'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');
const logger = require('../config/logger');

const router = express.Router();

// All watchlist routes require authentication
router.use(authenticate);

// ─── GET /api/watchlist ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT domain, valuation as "lastValuation", created_at as "addedAt" FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (err) {
    logger.error('GET /api/watchlist error', { userId: req.user.id, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve watchlist.' });
  }
});

// ─── POST /api/watchlist ─────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('domain').isString().notEmpty().withMessage('Domain is required'),
    body('valuation').isObject().notEmpty().withMessage('Valuation data is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { domain, valuation } = req.body;

    try {
      const result = await query(
        `INSERT INTO watchlist (user_id, domain, valuation)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, domain) 
         DO UPDATE SET valuation = $3, updated_at = NOW()
         RETURNING domain, valuation as "lastValuation", created_at as "addedAt"`,
        [req.user.id, domain.toLowerCase(), JSON.stringify(valuation)]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      logger.error('POST /api/watchlist error', { userId: req.user.id, domain, message: err.message });
      return res.status(500).json({ error: 'Failed to save to watchlist.' });
    }
  }
);

// ─── DELETE /api/watchlist/:domain ───────────────────────────────────────────
router.delete(
  '/:domain',
  [
    param('domain').isString().notEmpty().withMessage('Domain is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const domain = req.params.domain.toLowerCase();

    try {
      const result = await query(
        'DELETE FROM watchlist WHERE user_id = $1 AND domain = $2',
        [req.user.id, domain]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Domain not found in watchlist.' });
      }

      return res.json({ success: true, domain });
    } catch (err) {
      logger.error('DELETE /api/watchlist error', { userId: req.user.id, domain, message: err.message });
      return res.status(500).json({ error: 'Failed to remove from watchlist.' });
    }
  }
);

module.exports = router;
