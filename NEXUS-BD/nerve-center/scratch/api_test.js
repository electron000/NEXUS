const axios = require('axios');
require('dotenv').config();

const MASTER_KEYS = {
  godaddy: { key: process.env.GODADDY_KEY, secret: process.env.GODADDY_SECRET },
  porkbun: { key: process.env.PORKBUN_KEY, secret: process.env.PORKBUN_SECRET },
  namecom: { user: process.env.NAMECOM_USER, token: process.env.NAMECOM_TOKEN }
};

const domain = 'nexus-terminal-test-' + Math.random().toString(36).substring(7) + '.com';
const takenDomain = 'google.com';

async function testGoDaddy() {
    console.log('--- GoDaddy ---');
    try {
        const res = await axios.get(`https://api.godaddy.com/v1/domains/available?domain=${domain}`, {
            headers: { Authorization: `sso-key ${MASTER_KEYS.godaddy.key}:${MASTER_KEYS.godaddy.secret}` }
        });
        console.log('Available:', JSON.stringify(res.data, null, 2));
        
        const resTaken = await axios.get(`https://api.godaddy.com/v1/domains/available?domain=${takenDomain}`, {
            headers: { Authorization: `sso-key ${MASTER_KEYS.godaddy.key}:${MASTER_KEYS.godaddy.secret}` }
        });
        console.log('Taken:', JSON.stringify(resTaken.data, null, 2));
    } catch (e) { console.error('GoDaddy Error:', e.response?.data || e.message); }
}

async function testPorkbun() {
    console.log('--- Porkbun ---');
    try {
        const pricing = await axios.post('https://api.porkbun.com/api/json/v3/pricing/get', {
            apikey: MASTER_KEYS.porkbun.key, secretapikey: MASTER_KEYS.porkbun.secret
        });
        const check = await axios.post(`https://api.porkbun.com/api/json/v3/domain/availability/${domain}`, {
            apikey: MASTER_KEYS.porkbun.key, secretapikey: MASTER_KEYS.porkbun.secret
        });
        console.log('Pricing (.com):', JSON.stringify(pricing.data.pricing.com, null, 2));
        console.log('Check (Available):', JSON.stringify(check.data, null, 2));
    } catch (e) { console.error('Porkbun Error:', e.response?.data || e.message); }
}

async function testNamecom() {
    console.log('--- Name.com ---');
    try {
        const auth = Buffer.from(`${MASTER_KEYS.namecom.user}:${MASTER_KEYS.namecom.token}`).toString('base64');
        const res = await axios.get(`https://api.name.com/v4/domains/${domain}`, {
            headers: { Authorization: `Basic ${auth}` }
        });
        console.log('Check (Available):', JSON.stringify(res.data, null, 2));
    } catch (e) { console.error('Name.com Error:', e.response?.data || e.message); }
}

async function run() {
    await testGoDaddy();
    await testPorkbun();
    await testNamecom();
}

run();
