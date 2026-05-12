// 'use strict';

// const axios = require('axios');
// const logger = require('../config/logger');

// /**
//  * Fetches domain ownership data using the RDAP protocol.
//  * RDAP is the modern, structured successor to WHOIS.
//  */
// async function getDomainOwnership(domain) {
//   try {
//     // rdap.org acts as a redirector to the authoritative RDAP server
//     const response = await axios.get(`https://rdap.org/domain/${domain.toLowerCase()}`, {
//       timeout: 8000,
//       headers: { 'Accept': 'application/rdap+json' }
//     });

//     const data = response.data;
//     const entities = data.entities || [];
//     let registrant = null;

//     // Search for the entity with the 'registrant' role
//     for (const entity of entities) {
//       if (entity.roles && entity.roles.includes('registrant')) {
//         // vCard data format: [ ["version", {}, "text", "4.0"], ["fn", {}, "text", "Name"], ... ]
//         const vcard = entity.vcardArray ? entity.vcardArray[1] : [];
//         const fn = vcard.find(item => item[0] === 'fn');
//         const org = vcard.find(item => item[0] === 'org');
//         const country = vcard.find(item => item[0] === 'adr' && item[3]);

//         registrant = {
//           name: fn ? fn[3] : 'Redacted',
//           organization: org ? org[3] : 'Redacted',
//           country: (country && country[3] && country[3][6]) ? country[3][6] : 'Unknown'
//         };
//         break;
//       }
//     }

//     return {
//       success: true,
//       registrant,
//       registrar: data.port43 || 'Unknown',
//       status: data.status || [],
//       lastUpdated: new Date().toISOString()
//     };
//   } catch (err) {
//     if (err.response && err.response.status === 404) {
//       logger.info('Domain not found in RDAP registry (Available)', { domain });
//       return { success: false, error: 'Domain is unregistered or RDAP data unavailable' };
//     }
//     logger.error('RDAP lookup failed', { domain, message: err.message });
//     return {
//       success: false,
//       error: 'Ownership data temporarily unavailable via RDAP'
//     };
//   }
// }

// // module.exports = { getDomainOwnership };
