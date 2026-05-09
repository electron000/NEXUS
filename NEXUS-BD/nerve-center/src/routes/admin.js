'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Middleware to restrict to admins only
 */
async function requireAdmin(req, res, next) {
  try {
    const result = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// All admin routes require authentication AND admin privileges
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Returns platform overview statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const userCount = await query('SELECT COUNT(*) FROM users');
    const sellerCount = await query("SELECT COUNT(*) FROM users WHERE kyc_status = 'verified'");
    const inquiryCount = await query('SELECT COUNT(*) FROM inquiries');
    const domainCount = await query('SELECT COUNT(*) FROM portfolio');

    return res.json({
      totalUsers: parseInt(userCount.rows[0].count, 10),
      totalSellers: parseInt(sellerCount.rows[0].count, 10),
      totalInquiries: parseInt(inquiryCount.rows[0].count, 10),
      totalPortfolioDomains: parseInt(domainCount.rows[0].count, 10),
      activeConnections: parseInt(inquiryCount.rows[0].count, 10),
    });
  } catch (err) {
    logger.error('Admin stats error', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

/**
 * GET /api/admin/kyc/pending
 * List all users waiting for KYC approval.
 * Normalizes file paths for cross-platform browser compatibility.
 */
router.get('/kyc/pending', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, first_name, last_name, middle_name, father_name, mother_name, address, 
              aadhaar_front_path, aadhaar_back_path, created_at 
       FROM users 
       WHERE kyc_status = 'pending' 
       ORDER BY created_at ASC`
    );

    // Normalize paths: ensure they start with / and use forward slashes
    const normalizedRows = result.rows.map(row => {
      const normalize = (p) => {
        if (!p) return null;
        // Convert Windows backslashes to forward slashes and ensure leading slash
        const clean = p.replace(/\\/g, '/');
        return clean.startsWith('/') ? clean : `/${clean}`;
      };

      return {
        ...row,
        aadhaar_front_path: normalize(row.aadhaar_front_path),
        aadhaar_back_path: normalize(row.aadhaar_back_path)
      };
    });

    return res.json(normalizedRows);
  } catch (err) {
    logger.error('Admin pending KYC error', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve pending KYC requests.' });
  }
});

/**
 * POST /api/admin/kyc/review
 * Approve or reject a user's KYC.
 */
router.post('/kyc/review', async (req, res) => {
  const { userId, status, reason } = req.body; // status: 'verified' | 'rejected'

  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    await query(
      `UPDATE users 
       SET kyc_status = $1, kyc_rejection_reason = $2, kyc_verified_at = NOW() 
       WHERE id = $3`,
      [status, reason || null, userId]
    );

    logger.info(`KYC review complete for user ${userId}`, { status });
    return res.json({ success: true, message: `User KYC marked as ${status}.` });
  } catch (err) {
    logger.error('KYC review error', { message: err.message });
    return res.status(500).json({ error: 'Failed to process KYC review.' });
  }
});

module.exports = router;
