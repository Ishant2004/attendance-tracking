const mongoose = require('mongoose');

const STATUSES = ['WFO', 'WFH', 'Absent', 'Leave', 'Half Day', 'Holiday', 'Weekend'];

const attendanceRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: STATUSES, required: true },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    totalHours: { type: Number, default: 0 },
    officeLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeLocation',
      default: null,
    },
    isLate: { type: Boolean, default: false },
    // Set when a manager corrects the record (directly or via an approved change request).
    // The rollup then treats it as authoritative and won't re-derive it from events.
    manualOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One record per user per day.
attendanceRecordSchema.index({ user: 1, date: 1 }, { unique: true });

attendanceRecordSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

attendanceRecordSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);