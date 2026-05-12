const {
  generateOTP,
  saveOTP,
  verifyOTP
} = require("./otp.service");

async function send_otp_for_email_verification(req, res) {
  const { email } = req.body;

  const otp = generateOTP();

  await saveOTP(email, otp);

  // send email
  await fetch(`${process.env.EMAIL_SERVICE_API}/sendemail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: email,
      subject: "Verify your email",
      message: `Your OTP is ${otp}`,
      html: `<h2>Your OTP: ${otp}</h2>`
    })
  });

  return res.json({ message: "OTP sent" });
}

async function verify_otp_for_email_verification(req, res) {
  const { email, otp } = req.body;

  const valid = await verifyOTP(email, otp);

  if (!valid) {
    return res.status(400).json({
      message: "Invalid or expired OTP"
    });
  }

  return res.json({ message: "Email verified" });
}

module.exports = {
  send_otp_for_email_verification,
  verify_otp_for_email_verification
};