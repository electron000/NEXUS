'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');

const router = express.Router();

// GET /api/user/settings
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT godaddy_key, godaddy_secret, preferred_currency FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ godaddy_key: '', godaddy_secret: '', preferred_currency: 'USD' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/user/settings
router.post('/', authenticate, async (req, res) => {
  const { godaddy_key, godaddy_secret, preferred_currency } = req.body;
  
  try {
    await query(
      `INSERT INTO user_settings (user_id, godaddy_key, godaddy_secret, preferred_currency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
       godaddy_key = EXCLUDED.godaddy_key,
       godaddy_secret = EXCLUDED.godaddy_secret,
       preferred_currency = EXCLUDED.preferred_currency`,
      [req.user.id, godaddy_key, godaddy_secret, preferred_currency || 'USD']
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/user/settings/test-connection
router.post('/test-connection', authenticate, async (req, res) => {
  const { godaddy_key, godaddy_secret } = req.body;
  
  if (!godaddy_key || !godaddy_secret) {
    return res.status(400).json({ error: 'API Key and Secret are required' });
  }

  try {
    const { checkDomains } = require('../services/registrarService');
    const testResult = await checkDomains(['google.com'], { godaddy_key, godaddy_secret });
    
    if (Object.keys(testResult).length > 0 && !testResult['google.com'].available) {
      return res.json({ success: true, message: 'Connection successful' });
    } else {
      return res.status(502).json({ error: 'Connection failed or invalid response' });
    }
  } catch (err) {
    res.status(502).json({ error: `Connection failed: ${err.message}` });
  }
});

module.exports = router;

