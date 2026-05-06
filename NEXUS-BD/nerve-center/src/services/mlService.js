'use strict';

/**
 * mlService.js
 *
 * Prediction service using local CSV data (nexus_domain_india_4000.csv).
 * Handles scoring and feature-based valuation.
 */

const logger = require('../config/logger');
const { predictDomainMetrics } = require('./csvService');

/**
 * Calculate Nexus Value Score for a domain using CSV data.
 *
 * @param {string} domain
 * @returns {Promise<{ quantitative: number, semantic: number, trend: number, predictedPrice: number, tier: string }>}
 */
async function getNexusScore(domain) {
  try {
    const metrics = await predictDomainMetrics(domain);
    return metrics;
  } catch (err) {
    logger.error('ML scoring failed', { domain, message: err.message });
    return fallbackScore(domain);
  }
}

/**
 * Fallback scores in case CSV prediction fails.
 */
function fallbackScore(domain) {
  const seed = domain.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const norm = (n, lo, hi) => lo + (n % (hi - lo));
  return {
    quantitative: norm(seed,      40, 85),
    semantic:     norm(seed * 3,  30, 90),
    trend:        norm(seed * 7,  20, 75),
    predictedPrice: norm(seed * 11, 10, 5000),
    tier: 'low',
    _fallback: true,
  };
}

module.exports = { getNexusScore };

