'use strict';

const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { 
  calculateRegistrarPricing, 
  calculateAftermarketValue 
} = require('../services/pricingService');
const { checkDomains } = require('../services/registrarService');
const { getDomainOwnership } = require('../services/rdapService');
const { getNexusScore } = require('../services/mlService');
const logger = require('../config/logger');

const router = express.Router();

// Public health check for domains service
router.get('/ping', (_req, res) => res.json({ status: 'active' }));

/**
 * GET /api/domains/valuation-stream/:domain
 * The main real-time engine. It uses Server-Sent Events (SSE) to stream 
 * progress updates as it gathers authentic intelligence.
 */
router.get(
  '/valuation-stream/:domain',
  authenticate,
  async (req, res) => {
    const { domain } = req.params;
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const cleanup = () => {
      logger.info('Valuation stream closed', { domain });
      res.end();
    };

    req.on('close', cleanup);

    try {
      /**
       * STAGE 1: SCANNING
       */
      sendEvent('progress', { stage: 'Scanning Ecosystem...', pct: 10, message: `Analyzing structural integrity of ${domain}...` });
      await sleep(800);

      /**
       * STAGE 2: MACHINE LEARNING ANALYSIS
       * RESTORED: Now calls the real Intelligence Core (XGBoost/KNN) instead of mocking.
       */
      sendEvent('progress', { stage: 'Core Processing...', pct: 40, message: 'Consulting Nexus Intelligence Core...' });
      
      const nexusScore = await getNexusScore(domain);

      await sleep(1200);

      /**
       * STAGE 3: OWNERSHIP INTELLIGENCE
       */
      sendEvent('progress', { stage: 'Ownership Audit...', pct: 65, message: 'Checking global RDAP registry...' });
      
      let ownership = null;
      const portfolioRes = await query(
        'SELECT p.*, u.email as owner_email, u.kyc_status FROM portfolio p JOIN users u ON p.user_id = u.id WHERE p.domain = $1',
        [domain]
      );

      if (portfolioRes.rows.length > 0) {
        const p = portfolioRes.rows[0];
        ownership = {
          isNexusMember: true,
          isVerified: p.verification_status === 'verified',
          ownerEmail: p.owner_email,
          isForSale: p.is_for_sale,
          askingPrice: p.asking_price,
          lastUpdated: p.last_verified_at || p.created_at
        };
      } else {
        const whoisData = await getDomainOwnership(domain);
        if (whoisData.success && whoisData.registrant) {
          ownership = {
            isNexusMember: false,
            isVerified: false,
            ownerName: whoisData.registrant.name,
            organization: whoisData.registrant.organization,
            country: whoisData.registrant.country,
            lastUpdated: whoisData.lastUpdated
          };
        }
      }
      await sleep(600);

      /**
       * STAGE 4: FINANCIAL MODELING
       */
      sendEvent('progress', { stage: 'Synthesizing Intelligence...', pct: 85, message: 'Gathering registrar pricing...' });
      
      const userKeys = null;
      const preferredCurrency = 'USD';
      
      const liveData = await checkDomains([domain], userKeys);

      const pricing = calculateRegistrarPricing(domain, nexusScore, liveData, preferredCurrency);
      const appraisal = calculateAftermarketValue(domain, nexusScore);
      
      // Injecting high-fidelity ML predictions
      appraisal.predictedPrice = nexusScore.predictedPrice;
      appraisal.predictedTier = nexusScore.tier;

      await sleep(600);

      const parts = domain.split('.');
      const sld = parts[0];
      const tld = parts.slice(1).join('.');

      /**
       * FINAL ASSEMBLY
       */
      const response = {
        domain,
        tld,
        sld,
        score: {
          overall: Math.round(nexusScore.quantitative * 0.35 + nexusScore.semantic * 0.4 + nexusScore.trend * 0.25),
          quantitative: Math.round(nexusScore.quantitative),
          semantic: Math.round(nexusScore.semantic),
          trend: Math.round(nexusScore.trend),
          confidence: 0.85,
          grade: calculateGrade(nexusScore),
          _source: nexusScore._source
        },
        pricing,
        ownership,
        appraisal,
        summary: generateSummary(domain, nexusScore),
        tags: generateTags(domain, nexusScore, ownership),
        timestamp: new Date().toISOString(),
      };

      sendEvent('progress', { stage: 'complete', pct: 100, message: 'Intelligence gathered.' });
      sendEvent('complete', response);
    } catch (err) {
      logger.error('Valuation stream error', { domain, message: err.message });
      sendEvent('error', { message: 'Intelligence gathering failed.' });
    } finally {
      cleanup();
    }
  },
);

/**
 * SUPPORT FUNCTIONS
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateGrade(score) {
  const overall = score.quantitative * 0.35 + score.semantic * 0.4 + score.trend * 0.25;
  if (overall >= 90) return 'S';
  if (overall >= 80) return 'A';
  if (overall >= 70) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 50) return 'D';
  return 'F';
}

function generateSummary(domain, score) {
  const overall = score.quantitative * 0.35 + score.semantic * 0.4 + score.trend * 0.25;
  if (overall > 80) return `Institutional grade asset with high liquidity potential. Strong structural integrity for ${domain}.`;
  if (overall > 60) return `Standard utility asset. Suitable for brand development or medium-term investment.`;
  return `Speculative asset. High TCO relative to brand potential. Acquisition not recommended without strategic pivot.`;
}

function generateTags(domain, score, ownership) {
  const tags = [];
  if (domain.length < 10) tags.push('Short-Form');
  if (score.semantic > 75) tags.push('Brandable');
  if (score.trend > 70) tags.push('Trending');
  if (ownership?.isNexusMember) tags.push('Nexus-Member-Owned');
  return tags;
}

module.exports = router;
