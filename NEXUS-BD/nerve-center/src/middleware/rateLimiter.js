'use strict';

const rateLimit = require('express-rate-limit');

/** General API limiter – 200 req / 15 min per IP */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Strict limiter for auth endpoints – 20 req / 15 min per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/** Domain check limiter – 60 req / min (each call may hit external APIs) */
const domainCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Domain check rate limit exceeded.' },
});

module.exports = { generalLimiter, authLimiter, domainCheckLimiter };
