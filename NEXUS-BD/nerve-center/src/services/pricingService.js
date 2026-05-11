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

/**
 * THE APPRAISAL ENGINE (Fair Market Value)
 */
function calculateAftermarketValue(domain, scores) {
  const parts = domain.split('.');
  const tld = parts.slice(1).join('.');
  const sld = parts[0];

  const baseValues = {
    'com': 800 * USD_TO_INR, 
    'ai': 1200 * USD_TO_INR, 
    'io': 600 * USD_TO_INR, 
    'net': 300 * USD_TO_INR, 
    'org': 400 * USD_TO_INR,
    'xyz': 150 * USD_TO_INR, 
    'app': 250 * USD_TO_INR, 
    'dev': 300 * USD_TO_INR
  };

  const baseValue = baseValues[tld] || 100;
  const overall = Math.round(scores.model * 0.45 + scores.semantic * 0.55);
  const lengthMultiplier = sld.length <= 3 ? 8 : sld.length <= 5 ? 3 : 1;
  const qualityMultiplier = Math.pow(overall / 55, overall > 80 ? 3 : 2.2);

  let estimatedValue = baseValue * lengthMultiplier * qualityMultiplier;
  if (scores.semantic > 80) estimatedValue *= 1.5;

  return {
    value: parseFloat(estimatedValue.toFixed(0)),
    tier: estimatedValue > (10000 * USD_TO_INR) ? 'Premium' : estimatedValue > (5000 * USD_TO_INR) ? 'Investment' : 'Standard'
  };
}

module.exports = {
  calculateRegistrarPricing,
  calculateAftermarketValue,
  USD_TO_INR
};
