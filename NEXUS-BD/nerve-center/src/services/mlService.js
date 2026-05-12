'use strict';

const axios = require('axios');
const logger = require('../config/logger');

const INTELLIGENCE_URL = process.env.INTELLIGENCE_CORE_URL || 'http://localhost:8000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'nexus_test_secret_key_8000';

async function getNexusScore(domain) {
  try {
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
