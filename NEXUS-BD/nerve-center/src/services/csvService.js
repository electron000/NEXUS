'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const logger = require('../config/logger');

const CSV_PATH = path.join(__dirname, '../../../intelligence-core/data/nexus_domain_india_4000.csv');

let domainData = [];
let isLoaded = false;

/**
 * Loads the CSV data into memory on startup.
 */
async function loadCsvData() {
  if (isLoaded) return;

  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (data) => {
        results.push({
          domain: data.domain,
          tld: data.tld,
          length: parseInt(data.length, 10),
          vowel_ratio: parseFloat(data.vowel_ratio),
          has_number: parseInt(data.has_number, 10),
          tld_score: parseFloat(data.tld_score),
          keyword_score: parseFloat(data.keyword_score),
          brand_score: parseFloat(data.brand_score),
          price: parseFloat(data.price),
          tier: data.tier,
        });
      })
      .on('end', () => {
        domainData = results;
        isLoaded = true;
        logger.info(`CSV Data loaded: ${domainData.length} rows`);
        resolve();
      })
      .on('error', (err) => {
        logger.error('Failed to load CSV data', err);
        reject(err);
      });
  });
}

/**
 * Maps common TLDs to scores based on the CSV data averages.
 */
const TLD_SCORES = {
  '.com': 1.0,
  '.ai': 0.95,
  '.io': 0.85,
  '.in': 0.9,
  '.app': 0.75,
  '.net': 0.65,
  '.org': 0.58,
  '.dev': 0.7,
  '.co': 0.8,
  '.tech': 0.55,
  '.co.in': 0.6,
  '.biz': 0.15,
  '.xyz': 0.3,
  '.online': 0.25,
  '.site': 0.2,
  '.info': 0.18,
};

/**
 * Extracts features from a domain string for prediction.
 */
function extractFeatures(domain) {
  const parts = domain.split('.');
  const sld = parts[0];
  const tld = `.${parts.slice(1).join('.')}`;

  const length = sld.length;
  const vowels = sld.match(/[aeiou]/gi) || [];
  const vowel_ratio = length > 0 ? vowels.length / length : 0;
  const has_number = /\d/.test(sld) ? 1 : 0;
  const tld_score = TLD_SCORES[tld] || 0.4;

  return { sld, tld, length, vowel_ratio, has_number, tld_score };
}

/**
 * Predicts scores and price for a domain using a simple KNN-like approach.
 */
async function predictDomainMetrics(domain) {
  if (!isLoaded) await loadCsvData();

  const normalised = domain.toLowerCase().trim();
  
  // Exact match check
  const exactMatch = domainData.find(d => d.domain === normalised);
  if (exactMatch) {
    return {
      quantitative: Math.round(exactMatch.tld_score * 100),
      semantic: Math.round(exactMatch.keyword_score * 100),
      trend: Math.round(exactMatch.brand_score * 100),
      predictedPrice: exactMatch.price,
      tier: exactMatch.tier,
      isExact: true
    };
  }

  const features = extractFeatures(normalised);

  // Find 5 closest neighbors based on Euclidean distance of common features
  // We weight length and tld_score higher
  const neighbors = domainData
    .map(d => {
      const dist = Math.sqrt(
        Math.pow((features.length - d.length) * 2, 2) +
        Math.pow((features.vowel_ratio - d.vowel_ratio) * 5, 2) +
        Math.pow((features.has_number - d.has_number) * 10, 2) +
        Math.pow((features.tld_score - d.tld_score) * 15, 2)
      );
      return { ...d, dist };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  // Average the scores
  const avg = neighbors.reduce((acc, n) => {
    acc.tld += n.tld_score;
    acc.keyword += n.keyword_score;
    acc.brand += n.brand_score;
    acc.price += n.price;
    return acc;
  }, { tld: 0, keyword: 0, brand: 0, price: 0 });

  const k = neighbors.length;
  
  return {
    quantitative: Math.round((avg.tld / k) * 100),
    semantic: Math.round((avg.keyword / k) * 100),
    trend: Math.round((avg.brand / k) * 100),
    predictedPrice: Math.round(avg.price / k),
    tier: (avg.price / k) > 1000000 ? 'high' : (avg.price / k) > 100000 ? 'medium' : 'low',
    isExact: false
  };
}

module.exports = {
  loadCsvData,
  predictDomainMetrics,
  extractFeatures
};
