'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();
router.use(authLimiter);

// ─── Validation Rules ─────────────────────────────────────────────────────────
const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('name').notEmpty().withMessage('Full name is required'),
  body('role').optional().isIn(['investor', 'brand_manager', 'analyst']),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

function sanitizeUser(row) {
  const { password_hash, ...rest } = row; // eslint-disable-line no-unused-vars
  return rest;
}

// ─── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password, name, role } = req.body;

  try {
    // Check for existing user
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, name, role, created_at`,
      [email, password_hash, name, role || 'analyst'],
    );

    const user = result.rows[0];
    const token = signToken(user);
    logger.info('New user registered', { userId: user.id });

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    logger.error('Signup error', { message: err.message });
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      // Deliberate vague message to prevent user enumeration
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    logger.info('User logged in', { userId: user.id });

    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    logger.error('/me error', { message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve user session.' });
  }
});

module.exports = router;
