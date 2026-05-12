'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');
const { verifyDNS } = require('../services/verificationService');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// Setup multer storage for KYC documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/kyc/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user.id}-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpg, jpeg, png)'));
    }
  }
});

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// ─── GET /api/user/profile ─────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT email, created_at, preferences, kyc_status, first_name, middle_name, last_name 
       FROM users WHERE id = $1`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const row = result.rows[0];
    const preferences = row.preferences || {
      trackingExtensions: ['.com', '.net', '.io'],
    };

    return res.json({
      email:      row.email,
      createdAt:  row.created_at,
      preferences,
      kyc_status: row.kyc_status,
      firstName:  row.first_name,
      middleName: row.middle_name,
      lastName:   row.last_name,
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
    const { getNexusScore } = require('../services/mlService');
    const { calculateRegistrarPricing, USD_TO_INR } = require('../services/pricingService');

    // 1. Get User Portfolio & Calculate Metrics
    const portfolioResult = await query(
      'SELECT id, domain, verification_status, bought_price, valuation_price FROM portfolio WHERE user_id = $1',
      [req.user.id]
    );
    const portfolioRows = portfolioResult.rows;
    const verifiedAssets = portfolioRows.filter(r => r.verification_status === 'verified');

    let totalValue = 0;
    let totalInvested = 0;

    const portfolioData = [];

    // Calculate metrics for each portfolio asset
    await Promise.all(portfolioRows.map(async (row) => {
      let val = parseFloat(row.valuation_price || 0);
      let scores = { model: 50, semantic: 50 }; // Default scores for pricing if not fetched

      // One-time fetching: Only call the ML model if we don't have a valuation yet
      if (val === 0) {
        try {
          const mlResult = await getNexusScore(row.domain);
          val = mlResult.predictedPrice || 0;
          scores = mlResult;

          // Cache the valuation in the database
          await query(
            'UPDATE portfolio SET valuation_price = $1 WHERE id = $2',
            [val, row.id]
          );
        } catch (mlErr) {
          logger.error('Failed to fetch one-time valuation', { domain: row.domain, error: mlErr.message });
        }
      }

      totalValue += val;

      
      const bPrice = parseFloat(row.bought_price || 0);
      totalInvested += bPrice;

      // Only include verified domains in the detailed table list
      if (row.verification_status === 'verified') {
        const growth = bPrice > 0 ? ((val - bPrice) / bPrice) * 100 : 0;
        portfolioData.push({
          domain: row.domain,
          boughtPrice: bPrice,
          valuation: val,
          growth: parseFloat(growth.toFixed(2))
        });
      }
    }));

    const metrics = {
      portfolioValue: {
        label: "Portfolio Net Worth",
        value: totalValue || 0,
        change: 0,
        prefix: "₹",
      },
      activeDomains: {
        label: "Verified Assets",
        value: verifiedAssets.length,
        change: 0,
      },
      totalInvested: {
        label: "Total Investment",
        value: totalInvested || 0,
        change: 0,
        prefix: "₹",
      },
      portfolio: portfolioData
    };

    return res.json(metrics);
  } catch (err) {
    logger.error('/dashboard error', { userId: req.user.id, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
});


// ─── GET /api/user/portfolio ──────────────────────────────────────────────────
router.get('/portfolio', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portfolio WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch portfolio.' });
  }
});

// ─── POST /api/user/portfolio ─────────────────────────────────────────────────
router.post(
  '/portfolio',
  [
    body('domain').isString().trim().toLowerCase(),
    body('isForSale').optional().isBoolean(),
    body('askingPrice').optional().isNumeric(),
    body('boughtPrice').isNumeric().withMessage('boughtPrice is required and must be a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('POST /api/user/portfolio validation failed', { 
        userId: req.user.id, 
        errors: errors.array(),
        body: req.body 
      });
      return res.status(422).json({ errors: errors.array() });
    }

    const { domain, isForSale, askingPrice, boughtPrice } = req.body;
    const token = crypto.randomBytes(16).toString('hex');
    
    // Auto-verify .test domains for development/testing
    const isTestDomain = domain.endsWith('.test');
    const status = isTestDomain ? 'verified' : 'pending';
    const lastVerifiedAt = isTestDomain ? new Date() : null;

    try {
      const result = await query(
        `INSERT INTO portfolio (user_id, domain, is_for_sale, asking_price, bought_price, verification_token, verification_status, last_verified_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [req.user.id, domain, isForSale || false, askingPrice || null, boughtPrice, token, status, lastVerifiedAt]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      logger.error('POST /api/user/portfolio error', { 
        userId: req.user.id, 
        domain, 
        message: err.message,
        code: err.code 
      });
      if (err.code === '23505') return res.status(409).json({ error: 'Domain already listed.' });
      return res.status(500).json({ error: 'Failed to add domain to portfolio.' });
    }
  }
);

// ─── POST /api/user/portfolio/verify ──────────────────────────────────────────
router.post('/portfolio/verify', async (req, res) => {
  const { domain } = req.body;

  try {
    const result = await query(
      'SELECT * FROM portfolio WHERE user_id = $1 AND domain = $2',
      [req.user.id, domain]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Domain not found in portfolio.' });

    const p = result.rows[0];
    const verification = await verifyDNS(domain, p.verification_token);


    if (verification.success) {
      await query(
        "UPDATE portfolio SET verification_status = 'verified', last_verified_at = NOW() WHERE id = $1",
        [p.id]
      );
      return res.json({ success: true, message: 'Domain verified successfully (Nexus Developer Bypass).' });
    } else {
      return res.json({ success: false, error: 'Verification failed. Please check your settings and try again.' });
    }
  } catch (err) {
    logger.error('Verification error', { domain, error: err.message });
    return res.status(500).json({ error: 'Verification process failed.' });
  }
});

// ─── POST /api/user/kyc/submit ────────────────────────────────────────────────
router.post(
  '/kyc/submit',
  upload.fields([
    { name: 'aadhaar_front', maxCount: 1 },
    { name: 'aadhaar_back',  maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { 
        firstName, middleName, lastName, 
        fatherName, motherName, address 
      } = req.body;

      const frontPath = req.files['aadhaar_front'] ? `/uploads/kyc/${req.files['aadhaar_front'][0].filename}` : null;
      const backPath = req.files['aadhaar_back'] ? `/uploads/kyc/${req.files['aadhaar_back'][0].filename}` : null;

      if (!frontPath || !backPath) {
        return res.status(400).json({ error: 'Both Aadhaar sides are required.' });
      }

      await query(
        `UPDATE users 
         SET kyc_status = 'pending',
             first_name = $1, middle_name = $2, last_name = $3,
             father_name = $4, mother_name = $5, address = $6,
             aadhaar_front_path = $7, aadhaar_back_path = $8,
             updated_at = NOW()
         WHERE id = $9`,
        [firstName, middleName, lastName, fatherName, motherName, address, frontPath, backPath, req.user.id]
      );

      logger.info('KYC submitted for user', { userId: req.user.id });
      return res.json({ success: true, message: 'KYC documents submitted for manual review.' });
    } catch (err) {
      logger.error('KYC submission error', { userId: req.user.id, message: err.message });
      return res.status(500).json({ error: 'Failed to submit KYC documents.' });
    }
  }
);

// ─── DELETE /api/user/portfolio/:id ──────────────────────────────────────────
router.delete('/portfolio/:id', async (req, res) => {
  const portfolioId = req.params.id;

  try {
    const result = await query(
      'DELETE FROM portfolio WHERE id = $1 AND user_id = $2 RETURNING *',
      [portfolioId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Portfolio record not found or you do not have permission to delete it.' 
      });
    }

    logger.info('Portfolio record deleted', { userId: req.user.id, portfolioId });
    
    return res.json({ 
      success: true, 
      message: 'Domain removed from portfolio successfully.',
      deletedRecord: result.rows[0]
    });
  } catch (err) {
    logger.error('DELETE /portfolio error', { 
      userId: req.user.id, 
      portfolioId, 
      message: err.message 
    });
    return res.status(500).json({ error: 'Failed to delete portfolio record.' });
  }
});

module.exports = router;
