'use strict';

/**
 * FINANCIAL MODELING SERVICE
 * This file handles all the money-related logic. It calculates registration 
 * prices and estimates the resale value.
 */

const USD_TO_INR = 83.5;

/**
 * CALCULATE REGISTRAR PRICING
 * We compare different registrars (GoDaddy, Porkbun, etc.) to see who offers
 * the best deal for this specific domain.
 */
function calculateRegistrarPricing(domain, scores, liveData = {}, preferredCurrency = 'USD') {
  const registrars = [
    { name: 'GoDaddy',    slug: 'godaddy' },
    { name: 'Porkbun',    slug: 'porkbun' },
    { name: 'Name.com',   slug: 'namecom' },
  ];

  return registrars.map(reg => {
    let registration = 0, renewal = 0, transfer = 0, privacy = 0, available = false;
    let currency = preferredCurrency;

    const live = liveData[reg.slug];
    if (live) {
      registration = live.registration || 0;
      renewal = live.renewal || 0;
      transfer = live.transfer || 0;
      privacy = live.privacy || 0;
      available = live.available;
      currency = live.currency || preferredCurrency;
    }
    
    const affiliateUrls = {
      godaddy:    `https://www.godaddy.com/domainsearch/find?domainToCheck=${domain}`,
      porkbun:    `https://porkbun.com/checkout/search?q=${domain}`,
      namecom:    `https://www.name.com/domain/search/${domain}`,
    };

    return {
      registrar: reg.name,
      logoSlug: reg.slug,
      registration: parseFloat(registration.toFixed(2)),
      renewal: parseFloat(renewal.toFixed(2)),
      transfer: parseFloat(transfer.toFixed(2)),
      privacy: privacy === 0 ? 0 : parseFloat(privacy.toFixed(2)),
      available,
      currency,
      affiliateUrl: affiliateUrls[reg.slug] || `https://www.google.com/search?q=register+${domain}+${reg.name}`
    };
  });
}

module.exports = {
  calculateRegistrarPricing,
  USD_TO_INR
};
