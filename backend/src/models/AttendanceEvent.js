const mongoose = require('mongoose');

const EVENT_TYPES = ['check_in', 'check_out', 'ping'];
const LOCATION_TYPES = ['WFO', 'WFH'];

const attendanceEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    timestamp: { type: Date, default: Date.now },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    detectedLocationType: { type: String, enum: LOCATION_TYPES, required: true },
    officeLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeLocation',
      default: null,
    },
  },
  { timestamps: true }
);

attendanceEventSchema.index({ user: 1, timestamp: -1 });

attendanceEventSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

attendanceEventSchema.statics.EVENT_TYPES = EVENT_TYPES;

module.exports = mongoose.model('AttendanceEvent', attendanceEventSchema);