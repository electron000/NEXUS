'use strict';

const axios = require('axios');
const logger = require('../config/logger');

/**
 * Fetches domain WHOIS data using whoisjson.com API.
 */
async function getWhoisData(domain) {
  const token = process.env.WHOISJSON_TOKEN;
  if (!token) {
    logger.error('WHOISJSON_TOKEN is missing in environment');
    return { success: false, error: 'WHOIS service misconfigured' };
  }

  try {
    const response = await axios.get(`https://whoisjson.com/api/v1/whois/?domain=${domain.toLowerCase()}`, {
      headers: { 'Authorization': `TOKEN=${token}` },
      timeout: 10000
    });

    const data = response.data;
    
    // Normalize data
    const owner = (data.contacts && data.contacts.owner && data.contacts.owner.length > 0) ? data.contacts.owner[0] : null;
    const registrar = data.registrar || {};

    return {
      success: true,
      registered: data.registered === true,
      domain: data.name,
      created: data.created || null,
      expires: data.expires || null,
      status: Array.isArray(data.status) ? data.status : (data.status ? [data.status] : []),
      nameservers: data.nameserver || [],
      dnssec: data.dnssec || null,
      registrar: {
        name: registrar.name || null,
        email: registrar.email || null,
        phone: registrar.phone || null,
        url: registrar.url || null,
        abuseEmail: data.registrar?.abuseEmail || (data.contacts?.abuse?.[0]?.email) || null,
        abusePhone: data.registrar?.abusePhone || (data.contacts?.abuse?.[0]?.phone) || null
      },
      owner: {
        name: owner ? owner.name : null,
        email: owner ? owner.email : null,
        phone: owner ? owner.phone : null,
        organization: owner ? owner.organization : null,
        country: owner ? owner.country : null,
        address: owner ? owner.address : null
      },
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (err) {
    logger.error('WhoisJSON lookup failed', { domain, message: err.message });
    return {
      success: false,
      error: 'Whois data temporarily unavailable'
    };
  }
}

module.exports = { getWhoisData };
