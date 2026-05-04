'use strict';

/**
 * pricingService.js
 * 
 * Handles registrar-grade pricing calculations and 5-year TCO projections.
 * Based on industry standards (GoDaddy, Hostinger, etc.)
 */

const BASE_RATES = {
  '.com': { initial: 12.98, renewal: 19.99, transfer: 10.99 },
  '.net': { initial: 14.99, renewal: 21.99, transfer: 12.99 },
  '.org': { initial: 13.99, renewal: 20.99, transfer: 11.99 },
  '.io':  { initial: 39.99, renewal: 49.99, transfer: 35.99 },
  '.ai':  { initial: 79.98, renewal: 99.98, transfer: 74.98 },
  '.in':  { initial: 7.99,  renewal: 14.99, transfer: 7.49 },
  '.co.in': { initial: 5.99, renewal: 11.99, transfer: 5.49 },
  '.app': { initial: 15.99, renewal: 22.99, transfer: 14.99 },
  '.dev': { initial: 14.99, renewal: 21.99, transfer: 13.99 },
  '.tech': { initial: 4.99,  renewal: 39.99, transfer: 34.99 },
  '.xyz': { initial: 1.99,  renewal: 16.99, transfer: 14.99 },
  'default': { initial: 15.00, renewal: 20.00, transfer: 13.00 }
};

/**
 * Calculates pricing for various registrars based on the TLD and Nexus Score.
 * @param {string} domain
 * @param {object} scores
 * @param {object} liveData - Optional live data from registrars
 */
function calculateRegistrarPricing(domain, scores, liveData = {}) {
  const tld = '.' + domain.split('.').slice(1).join('.');
  const rates = BASE_RATES[tld] || BASE_RATES['default'];
  
  const premiumMultiplier = scores.quantitative > 80 ? (scores.quantitative / 50) : 1;
  
  const registrars = [
    { name: 'Namecheap',  slug: 'namecheap',  margin: 0.95,  promo: 'NEXUS10' },
    { name: 'GoDaddy',    slug: 'godaddy',    margin: 1.25,  promo: null },
    { name: 'Porkbun',    slug: 'porkbun',    margin: 0.90,  promo: 'PORK20' },
    { name: 'Name.com',   slug: 'namecom',    margin: 0.92,  promo: null },
    { name: 'Cloudflare', slug: 'cloudflare', margin: 1.00,  promo: null },
    { name: 'Dynadot',    slug: 'dynadot',    margin: 0.98,  promo: null },
  ];


  return registrars.map(reg => {
    let initial, renewal, transfer, isLive = false;
    let currency = 'USD';

    // Override with live data if available for this specific registrar
    const live = liveData[reg.slug];
    if (live && live.available) {
      initial = live.initialPrice;
      renewal = live.renewalPrice;
      transfer = live.transferPrice || (live.initialPrice * 0.9);
      isLive = true;
      currency = live.currency || 'USD';
    } else {

      initial = parseFloat((rates.initial * premiumMultiplier * reg.margin).toFixed(2));
      renewal = parseFloat((rates.renewal * reg.margin).toFixed(2));
      transfer = parseFloat((rates.transfer * reg.margin).toFixed(2));
    }
    
    const affiliateUrls = {
      namecheap:  `https://www.namecheap.com/domains/registration/results/?domain=${domain}`,
      godaddy:    `https://www.godaddy.com/domainsearch/find?domainToCheck=${domain}`,
      porkbun:    `https://porkbun.com/checkout/search?q=${domain}`,
      namecom:    `https://www.name.com/domain/search/${domain}`,
      cloudflare: `https://www.cloudflare.com/registrar/search?domain=${domain}`,
      dynadot:    `https://www.dynadot.com/domain/search.html?domain=${domain}`
    };


    return {
      registrar: reg.name,
      logoSlug: reg.slug,
      initial,
      renewal,
      transfer,
      promo: reg.promo,
      available: true,
      isLive,
      currency,
      affiliateUrl: affiliateUrls[reg.slug] || `https://www.google.com/search?q=register+${domain}+${reg.name}`
    };
  });
}


/**
 * Calculates 5-year Total Cost of Ownership (TCO).
 */
function calculateTCO(pricing) {
  // Use the best (Cloudflare or Porkbun) as best case, GoDaddy as worst
  const best = pricing.find(p => p.logoSlug === 'cloudflare') || pricing[0];
  const expected = pricing.find(p => p.logoSlug === 'namecheap') || pricing[0];
  const worst = pricing.find(p => p.logoSlug === 'godaddy') || pricing[0];

  return [1, 2, 3, 4, 5].map(year => {
    if (year === 1) {
      return {
        year,
        bestCase: best.initial,
        expected: expected.initial,
        worstCase: worst.initial
      };
    }
    
    return {
      year,
      bestCase: parseFloat((best.initial + best.renewal * (year - 1)).toFixed(2)),
      expected: parseFloat((expected.initial + expected.renewal * (year - 1)).toFixed(2)),
      worstCase: parseFloat((worst.initial + worst.renewal * (year - 1)).toFixed(2))
    };
  });
}

module.exports = {
  calculateRegistrarPricing,
  calculateTCO
};
