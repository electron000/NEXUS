'use strict';

/**
 * ML SERVICE BRIDGE
 * This service acts as a bridge between our Node.js app and the Python 
 * "Intelligence Core" (which runs the heavy ML models).
 */

const axios = require('axios');
const logger = require('../config/logger');


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
     * We send the domain name to the Python server.
     */
    const response = await axios.post(`${INTELLIGENCE_URL}/api/ml/nexus-score`, 
      { domain },
      { 
        headers: { 'X-Internal-Key': INTERNAL_KEY },
        timeout: 15000 
      }
    );

    const data = response.data;
    
    return {
      model:        data.model_score,
      semantic:     data.semantic_score,
      predictedPrice: data.predicted_price,
      tier:         data.predicted_tier
    };
  } catch (err) {
    logger.error('Intelligence Core failure', { domain, error: err.message });
    throw new Error('Intelligence Core unreachable');
  }
}

module.exports = { getNexusScore };
