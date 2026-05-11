'use strict';

const dns = require('dns').promises;
const axios = require('axios');
const logger = require('../config/logger');

const { Resolver } = require('dns').promises;
const resolver = new Resolver();

// uses Google's DNS (8.8.8.8) or Cloudflare (1.1.1.1)
resolver.setServers(['8.8.8.8', '1.1.1.1']);

//  Verify ownership via DNS TXT record.
async function verifyDNS(domain, token) {
  try {
    const records = await resolver.resolveTxt(domain);
    const flatRecords = records.flat();
    const expected = `nexus-site-verification=${token}`;
    
    const verified = flatRecords.some(r => r.trim().includes(expected));
    
    return { success: verified, method: 'dns' };
  } catch (err) {
    logger.debug('DNS verification process finished', { domain, code: err.code });
    return { success: false, method: 'dns', error: err.code };
  }
}

module.exports = { verifyDNS };
