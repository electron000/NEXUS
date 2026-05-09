'use strict';

/**
 * ML SERVICE BRIDGE
 * This service acts as a bridge between our Node.js app and the Python 
 * "Intelligence Core" (which runs the heavy ML models).
 */

const axios = require('axios');
const logger = require('../config/logger');
const { predictDomainMetrics } = require('./csvService');

// The address where the Python Intelligence Core is listening
const INTELLIGENCE_URL = process.env.INTELLIGENCE_CORE_URL || 'http://localhost:8000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'nexus_test_secret_key_8000';

/**
 * GET NEXUS SCORE
 * This is the main function we call to get an AI-driven valuation of a domain.
 * It tries to talk to the high-power Python models first, but has several 
 * layers of backup if things go wrong.
 */
async function getNexusScore(domain) {
  try {
    /**
     * TRY THE INTELLIGENCE CORE
     * We send the domain name to the Python server. It uses its custom
     * XGBoost models to predict price, quality tier, and market momentum.
     */
    const response = await axios.post(`${INTELLIGENCE_URL}/api/ml/nexus-score`, 
      { domain },
      { 
        headers: { 'X-Internal-Key': INTERNAL_KEY },
        timeout: 10000 
      }
    );

    const data = response.data;
    
    // We translate the Python data format into something the rest of our app understands
    return {
      quantitative: data.quantitative_baseline,
      semantic:     data.semantic_score,
      trend:        data.trend_momentum,
      predictedPrice: data.predicted_price || (data.quantitative_baseline * 50),
      tier:         data.predicted_tier || (data.quantitative_baseline >= 80 ? 'premium' : 'mid'),
      _source: 'intelligence-core'
    };
  } catch (err) {
    /**
     * FALLBACK 1: CSV HISTORICAL DATA
     * If the Python server is down, we use our local CSV service. It looks at 
     * 20 million historical data points to estimate a score.
     */
    logger.warn('Intelligence Core unreachable, falling back to local historical data', { domain, error: err.message });
    try {
      const metrics = await predictDomainMetrics(domain);
      return { ...metrics, _source: 'csv-fallback' };
    } catch (csvErr) {
      /**
       * FALLBACK 2: PROCEDURAL ESTIMATE
       * If everything else fails (e.g., files are missing), we use a safe 
       * procedural estimate so the user still gets a result.
       */
      logger.error('All ML scoring paths failed', { domain, message: csvErr.message });
      return fallbackScore(domain);
    }
  }
}

/**
 * PROCEDURAL FALLBACK
 * A safety net function that generates a consistent (but basic) estimate 
 * based on the domain string itself.
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
    _source: 'procedural-fallback',
  };
}

module.exports = { getNexusScore };
