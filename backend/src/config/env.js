require('dotenv').config();

module.exports = {
  port: process.env.PORT,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES,
    refreshExpires: process.env.JWT_REFRESH_EXPIRES,
  },
  // Single-timezone app. IST = UTC+5:30, no DST. Override via env if ever needed.
  tzOffsetMinutes: Number(process.env.TZ_OFFSET_MINUTES || 330),
  // IANA zone name for the cron scheduler.
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
};