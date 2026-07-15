const mongoose = require('mongoose');

const PURPOSES = ['email_verify', 'password_change'];

const otpTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: PURPOSES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

otpTokenSchema.index({ user: 1, purpose: 1 });
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

otpTokenSchema.statics.PURPOSES = PURPOSES;
module.exports = mongoose.model('OtpToken', otpTokenSchema);
