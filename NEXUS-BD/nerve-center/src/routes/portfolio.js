'use strict';

const express = require('express');
const multer  = require('multer');
const csv     = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { checkDomains } = require('../services/registrarService');
const { getNexusScore } = require('../services/mlService');
const { query } = require('../config/db');
const logger = require('../config/logger');

const router = express.Router();

// ─── Multer – in-memory storage (max 10 MB) ───────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// ─── In-memory job store (replace with Redis/DB in production) ─────────────────
const jobStore = new Map();  // jobId -> { status, results, error, createdAt, userId }

// ─── POST /api/portfolio/upload ───────────────────────────────────────────────
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type rejected.' });
  }

  const jobId = uuidv4();
  const userId = req.user.id;

  jobStore.set(jobId, {
    status:    'pending',
    results:   [],
    error:     null,
    createdAt: new Date().toISOString(),
    userId,
  });

  // Persist job metadata to DB
  try {
    await query(
      `INSERT INTO portfolio_jobs (id, user_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())`,
      [jobId, userId],
    );
  } catch (err) {
    logger.warn('Failed to persist job to DB – continuing with in-memory only', { message: err.message });
  }

  // Start async processing (don't await – respond immediately)
  processCsvJob(jobId, req.file.buffer, userId).catch((err) => {
    logger.error('Unhandled job processing error', { jobId, message: err.message });
  });

  return res.status(202).json({ jobId, status: 'pending' });
});

// ─── GET /api/portfolio/status/:jobId ─────────────────────────────────────────
router.get('/status/:jobId', authenticate, async (req, res) => {
  const { jobId } = req.params;

  let job = jobStore.get(jobId);

  // Fall back to DB if not in memory (e.g. server restart)
  if (!job) {
    try {
      const dbResult = await query(
        'SELECT * FROM portfolio_jobs WHERE id = $1 AND user_id = $2',
        [jobId, req.user.id],
      );
      if (dbResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      job = dbResult.rows[0];
    } catch (err) {
      logger.error('DB job fetch error', { message: err.message });
      return res.status(404).json({ error: 'Job not found.' });
    }
  }

  // Authorisation check – users can only access their own jobs
  if (job.userId !== req.user.id && job.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  return res.json({
    jobId,
    status:    job.status,
    results:   job.results || [],
    error:     job.error   || null,
    createdAt: job.createdAt || job.created_at,
  });
});

// ─── POST /api/portfolio/analyze-manual ───────────────────────────────────────
router.post('/analyze-manual', authenticate, async (req, res) => {
  const { entries } = req.body; // Array of { domain, purchasePrice }

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'No entries provided.' });
  }

  const jobId = uuidv4();
  const userId = req.user.id;

  jobStore.set(jobId, {
    status:    'pending',
    results:   [],
    error:     null,
    createdAt: new Date().toISOString(),
    userId,
  });

  // Start async processing
  processManualJob(jobId, entries, userId).catch((err) => {
    logger.error('Unhandled manual job processing error', { jobId, message: err.message });
  });

  return res.status(202).json({ jobId, status: 'pending' });
});

// ─── Shared domain processor ──────────────────────────────────────────────────
async function processDomains(domains, jobId, userId, purchasePrices = {}) {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'processing';
  const { calculateRegistrarPricing } = require('../services/pricingService');
  const results = [];
  const BATCH = 10;

  try {
    const settingsResult = await query(
      'SELECT godaddy_key, godaddy_secret, porkbun_key, porkbun_secret, namecom_user, namecom_token, namecheap_user, namecheap_key, dynadot_key, cloudflare_key, cloudflare_email FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const userKeys = settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;

    for (let i = 0; i < domains.length; i += BATCH) {
      const batch = domains.slice(i, i + BATCH);
      const mlScores = await Promise.all(batch.map((d) => getNexusScore(d)));
      const registrarData = await checkDomains(batch, userKeys);

      for (let j = 0; j < batch.length; j++) {
        const domain = batch[j];
        const ml = mlScores[j];
        const reg = registrarData[domain] || {};
        
        // Use real price from registrar if available, otherwise fallback to simulation
        const realPrice = reg.initialPrice || 0;
        const simulatedPricing = calculateRegistrarPricing(domain, ml);
        const finalValuation = realPrice > 0 ? realPrice : simulatedPricing[0].initial;

        const overall = Math.round(ml.quantitative * 0.35 + ml.semantic * 0.4 + ml.trend * 0.25);

        const grade = overall >= 90 ? 'S' : overall >= 80 ? 'A' : overall >= 70 ? 'B' : overall >= 60 ? 'C' : overall >= 50 ? 'D' : 'F';

        results.push({
          domain,
          simulatedValuation: finalValuation,
          semanticScore: ml.semantic,
          trendMomentum: ml.trend,
          grade,
          tld: domain.split('.').slice(1).join('.'),
          purchasePrice: purchasePrices[domain] || null,
          uploadDate: new Date().toISOString(),
          isLive: realPrice > 0,
          currency: reg.currency || 'USD'
        });

      }
      job.results = results;
    }

    job.status = 'complete';

    await query(
      `UPDATE portfolio_jobs SET status = 'complete', results = $1, completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(results), jobId],
    ).catch((err) => logger.warn('Failed to persist results to DB', { message: err.message }));

  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    await query(
      `UPDATE portfolio_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [err.message, jobId],
    ).catch(() => {});
  }
}

// ─── Background CSV processor ─────────────────────────────────────────────────
async function processCsvJob(jobId, buffer, userId) {
  const domains = await parseCsvBuffer(buffer);
  if (domains.length === 0) {
    const job = jobStore.get(jobId);
    job.status = 'failed';
    job.error = 'No valid domains found.';
    return;
  }
  return processDomains(domains, jobId, userId);
}

// ─── Background Manual processor ──────────────────────────────────────────────
async function processManualJob(jobId, entries, userId) {
  const domains = entries.map(e => e.domain).filter(d => d);
  const purchasePrices = entries.reduce((acc, e) => {
    if (e.domain) acc[e.domain] = e.purchasePrice;
    return acc;
  }, {});
  
  return processDomains(domains, jobId, userId, purchasePrices);
}


/**
 * Parse a CSV buffer and return an array of lowercase domain strings.
 * Supports both single-column CSVs and CSVs with a "domain" header.
 */
function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const domains = [];
    const stream = Readable.from(buffer.toString('utf-8'));

    stream
      .pipe(csv({ headers: false }))
      .on('data', (row) => {
        // Try column named "domain" first, else use first column
        const raw = row['domain'] || row['Domain'] || Object.values(row)[0] || '';
        const d = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (d && /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}/.test(d)) {
          domains.push(d);
        }
      })
      .on('error', reject)
      .on('end', () => resolve([...new Set(domains)]));   // deduplicate
  });
}

module.exports = router;
