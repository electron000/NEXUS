'use strict';
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testWhois() {
  const token = process.env.WHOISJSON_TOKEN;
  const domain = 'dec.ac.in';
  try {
    const response = await axios.get(`https://whoisjson.com/api/v1/whois/?domain=${domain}`, {
      headers: { 'Authorization': `TOKEN=${token}` }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testWhois();
