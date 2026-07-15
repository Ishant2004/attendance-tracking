const bcrypt = require('bcryptjs');
const OtpToken = require('../models/OtpToken');
const ApiError = require('../utils/ApiError');
const { sendMail } = require('../utils/mailer');

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const sixDigit = () => String(Math.floor(100000 + Math.random() * 900000));

const SUBJECTS = {
  email_verify: 'Verify your email',
  password_change: 'Your password change code',
};

async function generateAndSend(user, purpose) {
  const recent = await OtpToken.findOne({ user: user._id, purpose, consumed: false }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'Please wait a minute before requesting another code');
  }
  await OtpToken.deleteMany({ user: user._id, purpose, consumed: false }); // invalidate old

  const code = sixDigit();
  await OtpToken.create({
    user: user._id,
    purpose,
    codeHash: await bcrypt.hash(code, 10),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
    lastSentAt: new Date(),
  });

  await sendMail({
    to: user.email,
    subject: SUBJECTS[purpose],
    text: `Your ${OTP_TTL_MIN}-minute code is ${code}.`,
    html: `<p>Your verification code is <b style="font-size:18px">${code}</b>.</p><p>It expires in ${OTP_TTL_MIN} minutes.</p>`,
  });
}

async function verify(user, purpose, code) {
  const token = await OtpToken.findOne({ user: user._id, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!token) throw new ApiError(400, 'No active code — request a new one');
  if (token.expiresAt.getTime() < Date.now()) throw new ApiError(400, 'Code expired — request a new one');
  if (token.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'Too many attempts — request a new code');

  const ok = await bcrypt.compare(String(code), token.codeHash);
  token.attempts += 1;
  if (!ok) {
    await token.save();
    throw new ApiError(400, 'Invalid code');
  }
  token.consumed = true;
  await token.save();
  return true;
}

module.exports = { generateAndSend, verify, OTP_TTL_MIN, MAX_ATTEMPTS };
