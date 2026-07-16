const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

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

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password changed' });
});

module.exports = { login, refresh, logout, me, changePassword };