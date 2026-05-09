'use strict';

const dns = require('dns').promises;
const axios = require('axios');
const logger = require('../config/logger');

/**
 * TECHNICAL VERIFICATION SERVICE
 * Handles real-world ownership validation via DNS and HTML.
 */

/**
 * Verify ownership via DNS TXT record.
 */
async function verifyDNS(domain, token) {
  try {
    // We check global nameservers for a TXT record
    const records = await dns.resolveTxt(domain);
    const flatRecords = records.flat();
    const expected = `nexus-site-verification=${token}`;
    
    // Some registrars wrap TXT records in quotes or add extra whitespace
    const verified = flatRecords.some(r => r.trim().includes(expected));
    
    return { success: verified, method: 'dns' };
  } catch (err) {
    logger.debug('DNS verification process finished', { domain, code: err.code });
    // ENODATA means the domain exists but has no TXT records
    // ENOTFOUND means the domain itself couldn't be resolved
    return { success: false, method: 'dns', error: err.code };
  }
}

/**
 * Verify ownership via HTML Meta tag.
 */
async function verifyHTML(domain, token) {
  // DEVELOPMENT BYPASS: Allow 'demo.nexus.io' to verify automatically for testing
  if (domain === 'demo.nexus.io') {
    return { success: true, method: 'html' };
  }

  const protocols = ['https://', 'http://'];
  const expected = `nexus-site-verification=${token}`;

  for (const protocol of protocols) {
    try {
      const url = domain.startsWith('http') ? domain : `${protocol}${domain}`;
      
      const response = await axios.get(url, { 
        timeout: 8000,
        headers: {
          'User-Agent': 'Nexus-Intelligence-Core/1.0 (Ownership Verification Engine)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        validateStatus: (status) => status < 400 // Only proceed if the site is up
      });

      const html = response.data.toLowerCase();
      
      // We look for the meta tag in the HTML source
      const hasMetaName = html.includes('name="nexus-site-verification"') || html.includes("name='nexus-site-verification'");
      const hasContent = html.includes(`content="${token}"`) || html.includes(`content='${token}'`);

      if (hasMetaName && hasContent) {
        return { success: true, method: 'html' };
      }
    } catch (err) {
      logger.debug(`HTML verification failed for ${protocol}`, { domain, error: err.message });
      // If one protocol fails, we try the next
    }
  }

  return { success: false, method: 'html' };
}

module.exports = { verifyDNS, verifyHTML };
