const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD' — matches how we key days
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

holidaySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Holiday', holidaySchema);