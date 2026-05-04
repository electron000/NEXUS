'use strict';

/**
 * mlService.js
 *
 * Prediction service using local CSV data (nexus_domain_india_4000.csv).
 * Handles scoring and feature-based valuation.
 */

const axios = require('axios');
const { predictDomainMetrics } = require('./csvService');

const INTELLIGENCE_CORE_URL = process.env.INTELLIGENCE_CORE_URL || 'http://localhost:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * Calculate Nexus Value Score for a domain.
 * Attempts to use Intelligence Core (FastAPI), falls back to local CSV KNN.
 *
 * @param {string} domain
 * @returns {Promise<{ quantitative: number, semantic: number, trend: number, predictedPrice: number, tier: string }>}
 */
async function getNexusScore(domain) {
  try {
    logger.info('Calling Intelligence Core for domain score', { domain });
    
    const response = await axios.post(`${INTELLIGENCE_CORE_URL}/api/ml/nexus-score`, {
      domain
    }, {
      headers: { 'X-Internal-API-Key': INTERNAL_API_KEY },
      timeout: parseInt(process.env.ML_TIMEOUT_MS || '30000', 10)
    });

    const data = response.data;
    
    return {
      quantitative: data.ensemble_quantitative_score, // Use the new ensemble model!
      semantic: data.semantic_score,
      trend: data.trend_momentum,
      predictedPrice: 0, // Intelligence core doesn't return price yet
      tier: data.ensemble_quantitative_score > 75 ? 'high' : data.ensemble_quantitative_score > 50 ? 'medium' : 'low',
      model_used: data.model_used
    };
  } catch (err) {
    logger.warn('Intelligence Core failed, falling back to CSV KNN', { 
      domain, 
      error: err.message,
      code: err.code
    });
    
    try {
      const metrics = await predictDomainMetrics(domain);
      return metrics;
    } catch (csvErr) {
      logger.error('ML scoring fallback failed', { domain, message: csvErr.message });
      return fallbackScore(domain);
    }
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

