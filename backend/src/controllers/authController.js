const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const otpService = require('../services/otpService');
const ApiError = require('../utils/ApiError');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  res.json({ success: true, data: { user, accessToken, refreshToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const { accessToken } = await authService.refresh(req.body.refreshToken);
  res.json({ success: true, data: { accessToken } });
});

// Stateless JWT: logout is client-side (discard tokens). Endpoint kept for API parity.
const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// Send (or resend) the email-verification OTP to the logged-in user.
const sendEmailOtp = asyncHandler(async (req, res) => {
  if (req.user.emailVerified) throw new ApiError(400, 'Email already verified');
  await otpService.generateAndSend(req.user, 'email_verify');
  res.json({ success: true, message: 'Verification code sent' });
});

// Verify the OTP and mark the user's email as verified.
const verifyEmail = asyncHandler(async (req, res) => {
  if (req.user.emailVerified) {
    return res.json({ success: true, data: { user: req.user }, message: 'Already verified' });
  }
  await otpService.verify(req.user, 'email_verify', req.body.code);
  req.user.emailVerified = true;
  await req.user.save();
  res.json({ success: true, data: { user: req.user }, message: 'Email verified' });
});

module.exports = { login, refresh, logout, me, sendEmailOtp, verifyEmail };