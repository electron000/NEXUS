'use strict';

const dns = require('dns').promises;
const logger = require('../config/logger');

/**
 * Performs DNS intelligence audit for a domain.
 * Currently checks for MX records to detect mail infrastructure.
 */
async function getDnsIntelligence(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain).catch(() => []);
    
    // Sort by priority
    mxRecords.sort((a, b) => a.priority - b.priority);

    const hasMail = mxRecords.length > 0;
    let provider = 'Unknown';

    if (hasMail) {
      const primaryExchange = mxRecords[0].exchange.toLowerCase();
      if (primaryExchange.includes('google.com') || primaryExchange.includes('googlemail.com')) provider = 'Google Workspace';
      else if (primaryExchange.includes('outlook.com')) provider = 'Microsoft 365';
      else if (primaryExchange.includes('secureserver.net')) provider = 'GoDaddy Mail';
      else if (primaryExchange.includes('zoho.com')) provider = 'Zoho Mail';
      else if (primaryExchange.includes('hostinger.com')) provider = 'Hostinger Mail';
    }

    return {
      hasMail,
      mailProvider: provider,
      mxRecords: mxRecords.map(r => r.exchange)
    };
  } catch (err) {
    logger.warn('DNS lookup failed during intelligence audit', { domain, error: err.message });
    return {
      hasMail: false,
      mailProvider: 'None',
      mxRecords: []
    };
  }
}

module.exports = { getDnsIntelligence };
