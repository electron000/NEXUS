'use strict';

/**
 * registrarService.js
 *
 * Orchestrates domain availability and pricing lookups across:
 *   - Namecheap API
 *   - GoDaddy API
 *
 * Falls back gracefully if a provider key is absent.
 * Returns a unified map: { [domain]: DomainInfo }
 */

const axios = require('axios');
const logger = require('../config/logger');

/** @typedef {{ available: boolean, initialPrice: number, renewalPrice: number, whoisPrivacy: number }} DomainInfo */

// ─── Namecheap ────────────────────────────────────────────────────────────────
async function checkNamecheap(domainList, userKeys = null) {
  const apiUser  = userKeys?.namecheap_user || process.env.NAMECHEAP_API_USER;
  const apiKey   = userKeys?.namecheap_key  || process.env.NAMECHEAP_API_KEY;
  const clientIp = process.env.NAMECHEAP_CLIENT_IP || '127.0.0.1';

  if (!apiUser || !apiKey) {
    logger.warn('Namecheap credentials not configured – skipping');
    return {};
  }

  try {
    const url = 'https://api.namecheap.com/xml.response';
    const params = {
      ApiUser: apiUser,
      ApiKey:  apiKey,
      UserName: apiUser,
      ClientIp: clientIp,
      Command: 'namecheap.domains.check',
      DomainList: domainList.join(','),
    };

    const res = await axios.get(url, { params, timeout: 10_000 });
    return parseNamecheapXml(res.data, domainList);
  } catch (err) {
    logger.error('Namecheap API error', { message: err.message });
    return {};
  }
}

function parseNamecheapXml(xml, domainList) {
  /**
   * Minimal regex-based XML parser for Namecheap response.
   * Production code should use an xml2js parser for robustness.
   */
  const results = {};
  const domainPattern = /<DomainCheckResult\s+Domain="([^"]+)"\s+Available="([^"]+)"/g;
  let match;
  while ((match = domainPattern.exec(xml)) !== null) {
    const [, domain, available] = match;
    results[domain.toLowerCase()] = {
      available:    available === 'true',
      initialPrice: available === 'true' ? 10.98 : 0,
      renewalPrice: 13.98,
      whoisPrivacy: 2.88,
    };
  }
  // Ensure every requested domain has an entry (mark unavailable if missing)
  for (const d of domainList) {
    if (!results[d.toLowerCase()]) {
      results[d.toLowerCase()] = { available: false, initialPrice: 0, renewalPrice: 0, whoisPrivacy: 0 };
    }
  }
  return results;
}

// ─── Porkbun ─────────────────────────────────────────────────────────────────
async function checkPorkbun(domainList, userKeys = null) {
  const apiKey    = userKeys?.porkbun_key;
  const apiSecret = userKeys?.porkbun_secret;

  if (!apiKey || !apiSecret) return {};

  const results = {};
  try {
    const res = await axios.post(`https://api.porkbun.com/api/json/v3/pricing/get`, {
      apikey: apiKey,
      secretapikey: apiSecret
    });

    if (res.data.status === 'SUCCESS') {
      const pricing = res.data.pricing;
      for (const domain of domainList) {
        const tld = domain.split('.').slice(1).join('.');
        const tldData = pricing[tld];
        if (tldData) {
          results[domain.toLowerCase()] = {
            available:    true, // We assume true for arbitrage if we can get a price
            initialPrice: parseFloat(tldData.registration || 0),
            renewalPrice: parseFloat(tldData.renewal || 0),
            whoisPrivacy: 0,
            currency:     'USD'
          };
        }
      }
    }
  } catch (err) {
    logger.error('Porkbun pricing lookup failed', { error: err.message });
  }
  return results;
}


// ─── GoDaddy ──────────────────────────────────────────────────────────────────
async function checkGoDaddy(domainList, userKeys = null) {
  const apiKey    = userKeys?.godaddy_key    || process.env.GODADDY_API_KEY;
  const apiSecret = userKeys?.godaddy_secret || process.env.GODADDY_API_SECRET;

  if (!apiKey || !apiSecret) return {};

  const results = {};
  const environments = [
    'https://api.godaddy.com/v1/domains/available',
    'https://api.ote-godaddy.com/v1/domains/available'
  ];

  for (const url of environments) {
    try {
      const res = await axios.post(url, domainList, {
        headers: { 
          Authorization: `sso-key ${apiKey}:${apiSecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 10_000,
      });

      const domainsData = res.data.domains || [];
      for (const data of domainsData) {
        const domain = data.domain.toLowerCase();
        const price = data.price || 0;
        results[domain] = {
          available:    data.available === true,
          initialPrice: price > 0 ? price / 1_000_000 : 0,
          renewalPrice: price > 0 ? (price / 1_000_000) * 1.15 : 0,
          whoisPrivacy: 7.99,
          currency:     data.currency || 'USD'
        };
      }
      
      if (Object.keys(results).length > 0) {
        logger.info(`GoDaddy lookup success via ${url.includes('ote') ? 'OTE' : 'Prod'}`);
        return results;
      }
    } catch (err) {
      // Continue to next environment if this one fails
      logger.debug(`GoDaddy ${url.includes('ote') ? 'OTE' : 'Prod'} check failed`, { error: err.message });
    }
  }

  return results;
}

// ─── Name.com ────────────────────────────────────────────────────────────────
async function checkNamecom(domainList, userKeys = null) {
  const username = userKeys?.namecom_user;
  const token    = userKeys?.namecom_token;

  if (!username || !token) return {};

  const results = {};
  const environments = [
    'https://api.name.com/v4/domains:checkAvailability',
    'https://api.dev.name.com/v4/domains:checkAvailability'
  ];

  for (const url of environments) {
    try {
      const auth = Buffer.from(`${username}:${token}`).toString('base64');
      const res = await axios.post(url, {
        domainNames: domainList
      }, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 5000
      });

      const resultsArr = res.data.results || [];
      for (const r of resultsArr) {
        if (r.purchasable) {
          results[r.domainName.toLowerCase()] = {
            available:    true,
            initialPrice: r.purchasePrice || 0,
            renewalPrice: r.renewalPrice  || 0,
            currency:     'USD'
          };
        }
      }
      
      if (Object.keys(results).length > 0) {
        logger.info(`Name.com lookup success via ${url.includes('dev') ? 'Dev' : 'Prod'}`);
        return results;
      }
    } catch (err) {
      logger.debug(`Name.com ${url.includes('dev') ? 'Dev' : 'Prod'} check failed`, { error: err.message });
    }
  }
  return results;
}


// ─── Dynadot ─────────────────────────────────────────────────────────────────
async function checkDynadot(domainList, userKeys = null) {
  const key = userKeys?.dynadot_key;
  if (!key) return {};

  const results = {};
  try {
    // Dynadot usually handles 1 domain at a time for search in API v3
    for (const domain of domainList) {
      const res = await axios.get(`https://api.dynadot.com/api3.json`, {
        params: {
          key:     key,
          command: 'search',
          domain0: domain
        }
      });

      const data = res.data.SearchResponse?.SearchInfo0;
      if (data && data.Available === 'yes') {
        results[domain.toLowerCase()] = {
          available:    true,
          initialPrice: parseFloat(data.Price || 0),
          renewalPrice: parseFloat(data.RenewalPrice || 0),
          currency:     'USD'
        };
      }
    }
  } catch (err) {
    logger.error('Dynadot lookup failed', { error: err.message });
  }
  return results;
}

// ─── Cloudflare ──────────────────────────────────────────────────────────────
async function checkCloudflare(domainList, userKeys = null) {
  const key   = userKeys?.cloudflare_key;
  const email = userKeys?.cloudflare_email;
  if (!key) return {};

  const results = {};

  // Headers logic: use Global Auth if email is present, else Bearer Token
  // Note: New Cloudflare keys include the prefix (cfk_ or cfut_) which must be sent
  const headers = email 
    ? { 'X-Auth-Email': email, 'X-Auth-Key': key }
    : { Authorization: `Bearer ${key.replace('cfk_', '')}` };


  try {
    // 1. Get Account ID (using the first one found)
    const accountsRes = await axios.get('https://api.cloudflare.com/client/v4/accounts', {
      headers
    });
    
    if (accountsRes.data.result && accountsRes.data.result.length > 0) {
      const accountId = accountsRes.data.result[0].id;
      
      // 2. Check domains
      for (const domain of domainList) {
        try {
          const res = await axios.post(`https://api.cloudflare.com/client/v4/accounts/${accountId}/registrar/domains/check`, {
            domain: domain
          }, {
            headers
          });

          if (res.data.result) {
            const data = res.data.result;
            results[domain.toLowerCase()] = {
              available:    data.available === true,
              initialPrice: data.price || 0,
              renewalPrice: data.renewal_price || data.price || 0,
              currency:     'USD'
            };
          }
        } catch (e) {
          // Individual domain check might fail if TLD not supported by CF
        }
      }
    }
  } catch (err) {
    logger.debug('Cloudflare lookup failed', { error: err.message });
  }
  return results;
}


/**
 * Check domain availability and pricing via configured registrar.
 * For arbitrage, it returns data for all configured registrars.
 */
async function checkDomains(domainList, userKeys = null) {
  const finalResults = {};
  
  // Fetch from all available providers
  const [nc, gd, pb, nm, dd, cf] = await Promise.all([
    checkNamecheap(domainList, userKeys),
    checkGoDaddy(domainList, userKeys),
    checkPorkbun(domainList, userKeys),
    checkNamecom(domainList, userKeys),
    checkDynadot(domainList, userKeys),
    checkCloudflare(domainList, userKeys)
  ]);

  // Combine into a registrar-first map for arbitrage if domainList.length == 1
  if (domainList.length === 1) {
    const domain = domainList[0].toLowerCase();
    return {
      namecheap: nc[domain],
      godaddy:   gd[domain],
      porkbun:   pb[domain],
      namecom:   nm[domain],
      dynadot:   dd[domain],
      cloudflare: cf[domain],
      available: nc[domain]?.available || gd[domain]?.available || pb[domain]?.available || nm[domain]?.available || dd[domain]?.available || cf[domain]?.available
    };
  }




  // Otherwise, return domain-first map (picking best available)
  for (const domain of domainList) {
    const d = domain.toLowerCase();
    finalResults[d] = cf[d] || pb[d] || gd[d] || nm[d] || dd[d] || nc[d];
  }




  // Stub fallback
  if (Object.keys(finalResults).length === 0) {
    for (const domain of domainList) {
      finalResults[domain.toLowerCase()] = {
        available: true,
        initialPrice: 10.00,
        renewalPrice: 15.00,
        currency: 'USD'
      };
    }
  }

  return finalResults;
}


module.exports = { checkDomains };
