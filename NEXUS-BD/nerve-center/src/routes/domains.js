'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { domainCheckLimiter } = require('../middleware/rateLimiter');
const { checkDomains } = require('../services/registrarService');
const { getNexusScore } = require('../services/mlService');
const logger = require('../config/logger');

const router = express.Router();

// ─── Validation helpers ───────────────────────────────────────────────────────
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function isValidDomain(d) {
  return typeof d === 'string' && DOMAIN_REGEX.test(d) && d.length <= 253;
}

// ─── POST /api/domains/check ──────────────────────────────────────────────────
router.post(
  '/check',
  authenticate,
  domainCheckLimiter,
  [
    body('domainList')
      .isArray({ min: 1, max: 50 })
      .withMessage('domainList must be an array of 1–50 domains'),
    body('domainList.*')
      .custom(isValidDomain)
      .withMessage('Each entry must be a valid domain name'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { domainList } = req.body;
    const normalised = domainList.map((d) => d.toLowerCase().trim());

    try {
      const settingsResult = await require('../config/db').query(
        'SELECT godaddy_key, godaddy_secret, porkbun_key, porkbun_secret, namecom_user, namecom_token, namecheap_user, namecheap_key, dynadot_key, cloudflare_key, cloudflare_email FROM user_settings WHERE user_id = $1',
        [req.user.id]
      );
      const userKeys = settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;

      const results = await checkDomains(normalised, userKeys);
      return res.json(results);
    } catch (err) {

      logger.error('Domain check failed', { message: err.message });
      return res.status(502).json({ error: 'Domain lookup service unavailable.' });
    }
  },
);

const { calculateRegistrarPricing, calculateTCO } = require('../services/pricingService');

// ─── GET /api/domains/valuation-stream/:domain ────────────────────────────────
/**
 * Server-Sent Events endpoint that streams real-time valuation progress.
 */
router.get(
  '/valuation-stream/:domain',
  authenticate,
  [
    param('domain')
      .custom(isValidDomain)
      .withMessage('Invalid domain name in URL'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const domain = req.params.domain.toLowerCase().trim();

    res.set({
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    function sendEvent(type, data) {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
    const cleanup = () => { clearInterval(heartbeat); res.end(); };
    req.on('close', cleanup);

    try {
      // Stage 1 – Linguistic Analysis
      sendEvent('progress', { stage: 'Scraping Registrars...', pct: 20, message: 'Extracting features...' });
      await sleep(800);

      // Stage 2 – ML Scoring
      sendEvent('progress', { stage: 'Analyzing Linguistics...', pct: 45, message: 'Running Nexus ML model...' });
      const nexusScore = await getNexusScore(domain);
      await sleep(800);

      // Stage 3 – Pricing Generation
      sendEvent('progress', { stage: 'Synthesizing Intelligence...', pct: 80, message: 'Calculating registrar arbitrage...' });
      
      // Fetch live data for arbitrage if keys are present
      const settingsResult = await require('../config/db').query(
        'SELECT godaddy_key, godaddy_secret, porkbun_key, porkbun_secret, namecom_user, namecom_token, namecheap_user, namecheap_key, dynadot_key, cloudflare_key, cloudflare_email FROM user_settings WHERE user_id = $1',
        [req.user.id]
      );
      const userKeys = settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
      const liveData = await checkDomains([domain], userKeys);

      const pricing = calculateRegistrarPricing(domain, nexusScore, liveData);
      const tco = calculateTCO(pricing);

      await sleep(600);

      const parts = domain.split('.');
      const sld = parts[0];
      const tld = parts.slice(1).join('.');

      const response = {
        domain,
        tld,
        sld,
        score: {
          overall: Math.round(nexusScore.quantitative * 0.35 + nexusScore.semantic * 0.4 + nexusScore.trend * 0.25),
          quantitative: nexusScore.quantitative,
          semantic: nexusScore.semantic,
          trend: nexusScore.trend,
          confidence: 0.85,
          grade: calculateGrade(nexusScore),
        },
        pricing,
        tco,
        summary: generateSummary(domain, nexusScore),
        tags: generateTags(domain, nexusScore),
        timestamp: new Date().toISOString(),
      };

      sendEvent('progress', { stage: 'complete', pct: 100, message: 'Valuation complete.' });
      sendEvent('complete', response);
    } catch (err) {
      logger.error('Valuation stream error', { domain, message: err.message });
      sendEvent('error', { message: 'Valuation failed.' });
    } finally {
      cleanup();
    }
  },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateGrade(score) {
  const overall = score.quantitative * 0.35 + score.semantic * 0.4 + score.trend * 0.25;
  if (overall >= 90) return 'S';
  if (overall >= 80) return 'A';
  if (overall >= 70) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 50) return 'D';
  return 'F';
}

function generateSummary(domain, score) {
  const grade = calculateGrade(score);
  return `${domain} evaluated by Nexus Intelligence Core. Score: ${Math.round(score.quantitative * 0.35 + score.semantic * 0.4 + score.trend * 0.25)}/100 (${grade}). ${score.semantic > 70 ? 'Strong linguistic signal detected.' : 'Standard memorability.'} ${score.trend > 65 ? 'Above-average trend velocity.' : 'Stable trend profile.'}`;
}

function generateTags(domain, score) {
  const parts = domain.split('.');
  const sld = parts[0];
  const tld = parts.slice(1).join('.');
  const overall = score.quantitative * 0.35 + score.semantic * 0.4 + score.trend * 0.25;

  return [
    `tld-${tld}`,
    overall >= 75 ? 'investment-grade' : 'speculative',
    score.semantic >= 75 ? 'brandable' : 'descriptive',
    sld.length <= 5 ? 'ultra-short' : sld.length <= 8 ? 'short' : 'standard-length',
  ];
}

module.exports = router;

