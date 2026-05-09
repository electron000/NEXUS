const path = require('path');
const fs = require('fs');

const uploadsPath = path.join(__dirname, '../uploads');
console.log('__dirname:', __dirname);
console.log('Resolved uploads path:', uploadsPath);

if (fs.existsSync(uploadsPath)) {
  console.log('✅ Uploads directory exists.');
  const contents = fs.readdirSync(uploadsPath);
  console.log('Contents:', contents);
  
  if (contents.includes('kyc')) {
    const kycPath = path.join(uploadsPath, 'kyc');
    console.log('✅ KYC directory exists.');
    console.log('KYC Contents:', fs.readdirSync(kycPath));
  } else {
    console.log('❌ KYC directory MISSING inside uploads.');
  }
} else {
  console.log('❌ Uploads directory MISSING at resolved path.');
}
