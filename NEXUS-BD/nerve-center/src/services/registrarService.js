'use strict';

/**
 * registrarService.js
 *
 * Orchestrates domain availability and pricing lookups across:
 *   - GoDaddy API
 *   - Porkbun API
 *   - Name.com API
 *
 * Unified Domain Intelligence Model:
 *   - available:   Binary purchase status
 *   - registration: Entry cost for new buyers
 *   - renewal:      Annual maintenance liability
 *   - transfer:     Cost to migrate to this registrar
 *   - privacy:      WHOIS protection cost (0 = Included)
 *   - currency:     Standardized unit (USD/INR)
 */

const axios = require('axios');
const logger = require('../config/logger');

const MASTER_KEYS = {
  godaddy: {
    key: process.env.GODADDY_KEY,
    secret: process.env.GODADDY_SECRET
  },
  porkbun: {
    key: process.env.PORKBUN_KEY,
    secret: process.env.PORKBUN_SECRET
  },
  namecom: {
    user: process.env.NAMECOM_USER,
    token: process.env.NAMECOM_TOKEN
  }
};

const PREFERRED_CURRENCY = process.env.PREFERRED_CURRENCY || 'USD';
const USD_TO_INR = 83.50; // Dynamic fallback if no live feed

/**
 * Converts price based on preferred currency
 */
function formatPrice(val, currency = 'USD') {
    const num = parseFloat(val || 0);
    if (PREFERRED_CURRENCY === 'INR' && currency === 'USD') {
        return Math.round(num * USD_TO_INR * 100) / 100;
    }
    return Math.round(num * 100) / 100;
}

// ─── Porkbun ─────────────────────────────────────────────────────────────────
async function checkPorkbun(domainList) {
  const apiKey    = MASTER_KEYS.porkbun.key;
  const apiSecret = MASTER_KEYS.porkbun.secret;
  if (!apiKey || !apiSecret) return {};

  const results = {};
  try {
    const pricingRes = await axios.post(`https://api.porkbun.com/api/json/v3/pricing/get`, {
      apikey: apiKey, secretapikey: apiSecret
    });

    if (pricingRes.data.status === 'SUCCESS') {
      const pricing = pricingRes.data.pricing;
      for (const domain of domainList) {
        const d = domain.toLowerCase();
        const tld = d.split('.').slice(1).join('.');
        const tldData = pricing[tld];
        
        if (tldData) {
          let isAvailable = false;
          try {
            const availRes = await axios.post(`https://api.porkbun.com/api/json/v3/domain/availability/${d}`, {
              apikey: apiKey, secretapikey: apiSecret
            });
            isAvailable = availRes.data.status === 'SUCCESS' && availRes.data.available === 'yes';
          } catch (e) { logger.warn(`Porkbun avail check failed: ${d}`); }

          results[d] = {
            available:    isAvailable,
            registration: isAvailable ? formatPrice(tldData.registration) : 0,
            renewal:      formatPrice(tldData.renewal),
            transfer:     formatPrice(tldData.transfer),
            privacy:      0, // Porkbun includes WHOIS privacy for free
            currency:     PREFERRED_CURRENCY
          };
        }
      }
    }
  } catch (err) {
    logger.error('Porkbun lookup failed', { error: err.message });
  }
  return results;
}

// ─── GoDaddy ──────────────────────────────────────────────────────────────────
async function checkGoDaddy(domainList) {
  const apiKey    = MASTER_KEYS.godaddy.key;
  const apiSecret = MASTER_KEYS.godaddy.secret;
  if (!apiKey || !apiSecret) return {};

  const results = {};
  for (const d of domainList) {
    try {
      const res = await axios.get(`https://api.godaddy.com/v1/domains/available?domain=${d}`, {
        headers: { Authorization: `sso-key ${apiKey}:${apiSecret}` },
        timeout: 5000
      });
      
      const price = res.data.price || 0;
      const registration = price > 0 ? (price / 1000000) : 0;
      
      results[d.toLowerCase()] = {
        available:    res.data.available === true,
        registration: formatPrice(registration),
        renewal:      formatPrice(registration * 1.15), // Heuristic: GoDaddy renewals are typically ~15% higher
        transfer:     formatPrice(registration * 0.95), // Heuristic: Transfers usually slightly cheaper
        privacy:      formatPrice(7.99),                 // Standard GoDaddy privacy add-on
        currency:     PREFERRED_CURRENCY
      };
    } catch (err) {
      logger.debug(`GoDaddy check failed: ${d}`, { error: err.message });
    }
  }
  return results;
}

// ─── Name.com ────────────────────────────────────────────────────────────────
async function checkNamecom(domainList) {
  const username = MASTER_KEYS.namecom.user;
  const token    = MASTER_KEYS.namecom.token;
  if (!username || !token) return {};

  const results = {};
  const auth = Buffer.from(`${username}:${token}`).toString('base64');
  try {
    const res = await axios.post('https://api.name.com/v4/domains:checkAvailability', {
      domainNames: domainList
    }, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 5000
    });

    const resultsArr = res.data.results || [];
    for (const r of resultsArr) {
      const d = r.domainName.toLowerCase();
      results[d] = {
        available:    r.purchasable === true,
        registration: r.purchasable ? formatPrice(r.purchasePrice) : 0,
        renewal:      formatPrice(r.renewalPrice || r.purchasePrice),
        transfer:     formatPrice(r.renewalPrice || r.purchasePrice),
        privacy:      formatPrice(4.99), // Name.com standard privacy fee
        currency:     PREFERRED_CURRENCY
      };
    }
  } catch (err) {
    logger.debug('Name.com lookup failed', { error: err.message });
  }
  return results;
}

/**
 * Aggregates all registrar data into a unified analyst-grade structure.
 */
async function checkDomains(domainList) {
  const [gd, pb, nm] = await Promise.all([
    checkGoDaddy(domainList),
    checkPorkbun(domainList),
    checkNamecom(domainList)
  ]);

  // If single domain, return the comparative registrar-by-registrar breakdown
  if (domainList.length === 1) {
    const domain = domainList[0].toLowerCase();
    return {
      godaddy:   gd[domain] || { available: false, error: 'No Data' },
      porkbun:   pb[domain] || { available: false, error: 'No Data' },
      namecom:   nm[domain] || { available: false, error: 'No Data' },
      available: (gd[domain]?.available || pb[domain]?.available || nm[domain]?.available) || false
    };
  }

  // For multiple domains, return the best registrar result per domain
  const finalResults = {};
  for (const domain of domainList) {
    const d = domain.toLowerCase();
    // Prioritize results that actually have data
    finalResults[d] = pb[d] || gd[d] || nm[d] || { available: false, error: 'Unavailable' };
  }
  return finalResults;
}

module.exports = { checkDomains };
