'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');
const { send_otp_for_email_verification, verify_otp_for_email_verification } = require('../modules/otp/otp.controller');
const { isEmailVerified } = require('../modules/otp/otp.service');

const router = express.Router();
router.use(authLimiter); 

const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number'),
  body('name').notEmpty().withMessage('Full name is required'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];


function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

// Simple function to remove sensitive data (like password hashes) before sending a user object to the frontend
function sanitizeUser(row) {
  const { password_hash, ...rest } = row;
  return rest;
}

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      user: sanitizeUser(user)
    });
};

// for signup
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password, name } = req.body;

  try {
    const verified = await isEmailVerified(email);

    if (!verified) {
      return res.status(404).json({ error: 'Email not verified.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, name, role, created_at`,
      [email, password_hash, name, 'analyst'],
    );

    const user = result.rows[0];
    logger.info('New user registered', { userId: user.id });

    return sendTokenResponse(user, 201, res);
  } catch (err) {
    logger.error('Signup error', { message: err.message });
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// for login
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT id, email, password_hash, name, role, is_admin, kyc_status, created_at FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    logger.info('User logged in', { userId: user.id });

    return sendTokenResponse(user, 200, res);
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});


// Used by the frontend to see if the user is still logged in and get their latest profile data.
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, is_admin, kyc_status, created_at FROM users WHERE id = $1',
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

// for logout
router.post('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// for email otp verification
router.post("/send_otp", send_otp_for_email_verification);
router.post("/verify_otp", verify_otp_for_email_verification);

module.exports = router;
