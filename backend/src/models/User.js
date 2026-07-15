const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['employee', 'manager', 'leadership', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'employee' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    officeLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OfficeLocation' }],
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash a virtual `password` when set, before validation/save.
userSchema.virtual('password').set(function (plain) {
  this._plainPassword = plain;
});

userSchema.pre('validate', async function () {
    if (!this._plainPassword) return;
    this.passwordHash = await bcrypt.hash(this._plainPassword, 10);
  });

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash in JSON responses.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);