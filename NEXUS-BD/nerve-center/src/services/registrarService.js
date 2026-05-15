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
const USD_TO_INR = 95.93; // Dynamic fallback if no live feed

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
// Uses the v3 /domain/checkDomain endpoint (the old /domain/availability is deprecated and returns 404)
async function checkPorkbun(domainList) {
  const apiKey    = MASTER_KEYS.porkbun.key;
  const apiSecret = MASTER_KEYS.porkbun.secret;
  if (!apiKey || !apiSecret) return {};

  const results = {};
  for (const domain of domainList) {
    const d = domain.toLowerCase();
    try {
      const res = await axios.post(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${d}`, {
        apikey: apiKey, secretapikey: apiSecret
      }, { timeout: 10000 });

      if (res.data.status === 'SUCCESS') {
        const resp = res.data.response;
        const isAvailable = resp.avail === 'yes';
        const isPremium   = resp.premium === 'yes';
        const regPrice    = parseFloat(resp.price || 0);
        const renewPrice  = parseFloat(resp.additional?.renewal?.price || resp.price || 0);
        const xferPrice   = parseFloat(resp.additional?.transfer?.price || resp.price || 0);

        results[d] = {
          available:    isAvailable,
          premium:      isPremium,
          registration: isAvailable ? formatPrice(regPrice) : 0,
          renewal:      formatPrice(renewPrice),
          transfer:     formatPrice(xferPrice),
          privacy:      0, // Porkbun includes WHOIS privacy for free
          currency:     PREFERRED_CURRENCY
        };
      }
    } catch (err) {
      // Downgrade to debug to avoid noise on unsupported TLDs like .ac.in
      logger.debug(`Porkbun checkDomain failed: ${d}`, { error: err.message });
    }
  }
  return results;
}

// ─── GoDaddy ──────────────────────────────────────────────────────────────────
// Set GODADDY_ENV=production for live keys; defaults to 'ote' for test/sandbox keys
const GODADDY_BASE = (process.env.GODADDY_ENV || 'ote') === 'production'
  ? 'https://api.godaddy.com'
  : 'https://api.ote-godaddy.com';

async function checkGoDaddy(domainList) {
  const apiKey    = MASTER_KEYS.godaddy.key;
  const apiSecret = MASTER_KEYS.godaddy.secret;
  if (!apiKey || !apiSecret) return {};

  const results = {};
  for (const d of domainList) {
    try {
      const res = await axios.get(`${GODADDY_BASE}/v1/domains/available?domain=${d}`, {
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
