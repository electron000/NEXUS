'use strict';

const dns = require('dns').promises;
const logger = require('../config/logger');

const { Resolver } = dns;
const fallbackResolver = new Resolver();
fallbackResolver.setServers(['8.8.8.8', '1.1.1.1']);

/**
 * Helper to perform TXT resolution and check for the expected token
 */
async function checkResolverForToken(resolver, targetDomain, expectedToken) {
  try {
    const records = await resolver.resolveTxt(targetDomain);
    const flatRecords = records.flat();
    return flatRecords.some(r => r.trim().includes(expectedToken));
  } catch (err) {
    logger.debug(`TXT query failed for ${targetDomain}`, { error: err.message, code: err.code });
    return false;
  }
}

/**
 * Verify ownership via DNS TXT record.
 * Tries authoritative DNS servers first to bypass propagation/caching issues,
 * then falls back to public DNS resolvers.
 */
async function verifyDNS(domain, token) {
  const expected = `nexus-site-verification=${token}`;
  const normalizedDomain = domain.toLowerCase().trim();
  
  // Build list of domains to check (handles www prefix gracefully)
  const domainsToCheck = [normalizedDomain];
  if (normalizedDomain.startsWith('www.')) {
    domainsToCheck.push(normalizedDomain.substring(4));
  }

  for (const targetDomain of domainsToCheck) {
    // 1. Try authoritative nameservers first for instant propagation
    try {
      logger.info(`Attempting authoritative DNS verification for: ${targetDomain}`);
      const nsRecords = await dns.resolveNs(targetDomain);
      
      if (nsRecords && nsRecords.length > 0) {
        const ips = [];
        for (const ns of nsRecords) {
          try {
            const resolvedIps = await dns.resolve4(ns);
            if (resolvedIps && resolvedIps.length > 0) {
              ips.push(...resolvedIps);
            }
          } catch (nsErr) {
            logger.debug(`Could not resolve IP for nameserver ${ns}`, { error: nsErr.message });
          }
        }
        
        if (ips.length > 0) {
          for (const ip of ips) {
            try {
              const authResolver = new Resolver();
              authResolver.setServers([ip]);
              
              const verified = await checkResolverForToken(authResolver, targetDomain, expected);
              if (verified) {
                logger.info(`Authoritative DNS verification succeeded via NS IP ${ip}`, { targetDomain });
                return { success: true, method: 'dns' };
              }
            } catch (queryErr) {
              logger.debug(`Authoritative query failed for NS IP ${ip}`, { error: queryErr.message });
            }
          }
        }
      }
    } catch (err) {
      logger.warn(`Authoritative DNS resolution failed for ${targetDomain}, trying fallback`, { error: err.message });
    }

    // 2. Fallback to public resolvers (Google / Cloudflare)
    try {
      logger.info(`Attempting fallback public DNS verification for: ${targetDomain}`);
      const verified = await checkResolverForToken(fallbackResolver, targetDomain, expected);
      if (verified) {
        logger.info(`Fallback DNS verification succeeded for ${targetDomain}`);
        return { success: true, method: 'dns' };
      }
    } catch (err) {
      logger.debug('Fallback public DNS verification process failed', { targetDomain, code: err.code });
    }
  }

  return { success: false, method: 'dns' };
}

module.exports = { verifyDNS };
