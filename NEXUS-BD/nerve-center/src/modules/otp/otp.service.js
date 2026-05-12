const redis = require("../../config/redis");

const OTP_EXPIRY = 300; // 5 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveOTP(email, otp) {
  const key = `otp:${email}`;

  const data = {
    otp,
    verified: false
  };

  await redis.set(key, JSON.stringify(data), "EX", OTP_EXPIRY);
}

async function verifyOTP(email, otp) {
  const key = `otp:${email}`;

  const stored = await redis.get(key);
  if (!stored) return false;

  const data = JSON.parse(stored);

  if (data.otp !== otp) return false;

  data.verified = true;

  await redis.set(key, JSON.stringify(data), "EX", OTP_EXPIRY);

  return true;
}

async function isEmailVerified(email) {
  const key = `otp:${email}`;

  const stored = await redis.get(key);
  if (!stored) return false;

  const data = JSON.parse(stored);

  return data.verified === true;
}

async function clearOTP(email) {
  const key = `otp:${email}`;
  await redis.del(key);
}

module.exports = {
  generateOTP,
  saveOTP,
  verifyOTP,
  isEmailVerified,
  clearOTP
};