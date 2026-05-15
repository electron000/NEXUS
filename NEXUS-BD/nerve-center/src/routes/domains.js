'use strict';

const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { 
  calculateRegistrarPricing
} = require('../services/pricingService');
const { checkDomains } = require('../services/registrarService');
const { getWhoisData } = require('../services/whoisService');
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
    const parts = domain.split('.');
    const tld = parts.length > 1 ? `.${parts.slice(1).join('.')}` : '';
    const ALLOWED_TLDS = [
      '.com', '.net', '.org', '.in', '.co.in', '.io', '.ai', '.co', '.dev', '.app', '.info', '.biz', '.tech', '.xyz', '.online', '.site',
      '.shop', '.store', '.blog', '.life', '.world', '.global', '.cloud', '.digital', '.agency', '.solutions', '.network', '.software', '.media', '.services',
      '.me', '.us', '.co.uk', '.ca', '.de', '.fr', '.jp', '.au', '.ru', '.ch', '.it', '.nl', '.se', '.no', '.es', '.br', '.mx', '.at', '.be', '.dk', '.fi', '.pt', '.pl', '.tr', '.kr', '.tw', '.hk', '.sg', '.my', '.th', '.id', '.ph', '.vn', '.ae', '.sa', '.qa', '.il',
      '.top', '.test', '.inc', '.ac.in', 'icu', '.vip', '.club', '.win', '.bid', '.click', '.link', '.help', '.work', '.today', '.news', '.live', '.studio', '.design', '.expert', '.marketing', '.consulting', '.legal', '.finance', '.money', '.loan', '.credit', '.bank', '.insurance', '.events', '.party', '.wedding', '.family', '.yoga', '.fitness', '.health', '.clinic', '.doctor', '.hospital', '.vet', '.pet', '.dog', '.cat', '.farm', '.green', '.earth', '.garden', '.eco', '.bio', '.nature', '.space', '.science', '.education', '.academy', '.institute', '.center', '.gov', '.edu'
    ];

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

    if (parts.length < 2 || !ALLOWED_TLDS.includes(tld)) {
      sendEvent('error', { message: `TLD '${tld}' is not currently supported for deep intelligence analysis.` });
      return cleanup();
    }

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
        'SELECT p.*, u.email as owner_email, u.name as owner_name, u.kyc_status FROM portfolio p JOIN users u ON p.user_id = u.id WHERE p.domain = $1',
        [domain]
      );

      if (portfolioRes.rows.length > 0) {
        const p = portfolioRes.rows[0];
        ownership = {
          isNexusMember: true,
          isVerified: p.verification_status === 'verified',
          ownerEmail: p.owner_email,
          ownerName: p.owner_name,
          isForSale: p.is_for_sale,
          askingPrice: p.asking_price,
          lastUpdated: p.last_verified_at || p.created_at
        };
      } else {
        const whoisData = await getWhoisData(domain);
        
        if (whoisData.success) {
          ownership = {
            isNexusMember: false,
            isVerified: false,
            registered: whoisData.registered,
            ownerName: whoisData.owner?.name,
            ownerEmail: whoisData.owner?.email,
            ownerPhone: whoisData.owner?.phone,
            organization: whoisData.owner?.organization,
            country: whoisData.owner?.country,
            address: whoisData.owner?.address,
            registrarName: whoisData.registrar?.name,
            registrarEmail: whoisData.registrar?.email,
            registrarPhone: whoisData.registrar?.phone,
            registrarUrl: whoisData.registrar?.url,
            registrarAbuseEmail: whoisData.registrar?.abuseEmail,
            registrarAbusePhone: whoisData.registrar?.abusePhone,
            creationDate: whoisData.created,
            expiryDate: whoisData.expires,
            status: whoisData.status,
            nameservers: whoisData.nameservers,
            dnssec: whoisData.dnssec,
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
      const preferredCurrency = 'INR';
      
      const liveData = await checkDomains([domain], userKeys);

      const pricing = calculateRegistrarPricing(domain, nexusScore, liveData, preferredCurrency);
      
      const appraisal = {};
      appraisal.predictedPrice = nexusScore.predictedPrice;
      appraisal.predictedTier = nexusScore.tier;

      await sleep(600);

      const parts = domain.split('.');
      const sld = parts[0];
      const tld = parts.slice(1).join('.');

      const response = {
        domain,
        tld,
        sld,
        score: {
          model: Math.round(nexusScore.model),
          semantic: Math.round(nexusScore.semantic)
        },
        pricing,
        ownership,
        appraisal,
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

module.exports = router;
