const jwt = require('jsonwebtoken');
const { jwt: cfg } = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, cfg.accessSecret, {
    expiresIn: cfg.accessExpires,
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, cfg.refreshSecret, {
    expiresIn: cfg.refreshExpires,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, cfg.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, cfg.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };