const mongoose = require('mongoose');

const TYPES = ['leave', 'half_day'];
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const leaveRequestSchema = new mongoose.Schema(
  {
    // Who is requesting time off.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The reporting manager this request is addressed to (snapshot of user.manager at request time).
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    // Inclusive day range as 'YYYY-MM-DD' strings (timezone-proof). half_day => fromDate === toDate.
    fromDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    toDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reason: { type: String, trim: true, default: '' },
    status: { type: String, enum: STATUSES, default: 'pending' },
    // Approval audit.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// Fast "my requests" and "requests awaiting my approval" lookups.
leaveRequestSchema.index({ user: 1, createdAt: -1 });
leaveRequestSchema.index({ manager: 1, status: 1, createdAt: -1 });

leaveRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

leaveRequestSchema.statics.TYPES = TYPES;
leaveRequestSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
