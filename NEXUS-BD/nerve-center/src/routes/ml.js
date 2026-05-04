'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { getNexusScore } = require('../services/mlService');
const logger = require('../config/logger');

const router = express.Router();

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
function isValidDomain(d) {
  return typeof d === 'string' && DOMAIN_REGEX.test(d) && d.length <= 253;
}

// ─── POST /api/ml/nexus-score ──────────────────────────────────────────────────
router.post(
  '/nexus-score',
  authenticate,
  [
    body('domain')
      .custom(isValidDomain)
      .withMessage('Valid domain name required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { domain } = req.body;

    try {
      const score = await getNexusScore(domain.toLowerCase().trim());
      return res.json(score);
    } catch (err) {
      logger.error('ML scoring proxy failed', { domain, message: err.message });
      return res.status(502).json({ error: 'Intelligence Core unavailable.' });
    }
  },
);

module.exports = router;
