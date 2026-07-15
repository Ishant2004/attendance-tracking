const mongoose = require('mongoose');

const FLAG_TYPES = ['frequent_late', 'frequent_absence', 'low_wfo_ratio', 'irregular_hours'];
const SEVERITIES = ['low', 'medium', 'high'];

const attendanceFlagSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    weekStartDate: { type: Date, required: true },
    flagType: { type: String, enum: FLAG_TYPES, required: true },
    severity: { type: String, enum: SEVERITIES, default: 'medium' },
    details: { type: mongoose.Schema.Types.Mixed },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One flag of a given type per user per detection window (enables idempotent upsert).
attendanceFlagSchema.index({ user: 1, flagType: 1, weekStartDate: 1 }, { unique: true });

attendanceFlagSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

attendanceFlagSchema.statics.FLAG_TYPES = FLAG_TYPES;
attendanceFlagSchema.statics.SEVERITIES = SEVERITIES;

module.exports = mongoose.model('AttendanceFlag', attendanceFlagSchema);