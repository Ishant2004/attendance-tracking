const mongoose = require('mongoose');
const AttendanceRecord = require('./AttendanceRecord');

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const recordChangeRequestSchema = new mongoose.Schema(
  {
    // Who wants their attendance record corrected.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The reporting manager who approves it (snapshot of user.manager at request time).
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The day being corrected (timezone-proof string).
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // What the record says now (snapshot, for the approver's context) and the desired value.
    currentStatus: { type: String, default: null },
    requestedStatus: { type: String, enum: AttendanceRecord.STATUSES, required: true },
    reason: { type: String, trim: true, default: '' },
    status: { type: String, enum: STATUSES, default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recordChangeRequestSchema.index({ user: 1, createdAt: -1 });
recordChangeRequestSchema.index({ manager: 1, status: 1, createdAt: -1 });

recordChangeRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

recordChangeRequestSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('RecordChangeRequest', recordChangeRequestSchema);
