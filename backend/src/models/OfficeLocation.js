const mongoose = require('mongoose');

const officeLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true ,unique: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

officeLocationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('OfficeLocation', officeLocationSchema);