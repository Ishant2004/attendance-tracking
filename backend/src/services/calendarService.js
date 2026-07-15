const Holiday = require('../models/Holiday');
const ApiError = require('../utils/ApiError');
const { isWeekend } = require('../utils/datetime');

// Classify a 'YYYY-MM-DD' date: Holiday (name) > Weekend > Working.
// Only active holidays count — soft-deleted ones are ignored.
async function getDayType(dateStr) {
  const holiday = await Holiday.findOne({ date: dateStr, isActive: true });
  if (holiday) return { type: 'Holiday', name: holiday.name };
  if (isWeekend(dateStr)) return { type: 'Weekend' };
  return { type: 'Working' };
}

function listHolidays({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  return Holiday.find(query).sort({ date: 1 });
}

async function createHoliday({ date, name }) {
  const existing = await Holiday.findOne({ date });
  if (existing && existing.isActive) throw new ApiError(409, 'Holiday already exists for that date');
  if (existing) {
    // Reactivate a previously soft-deleted holiday (date is unique).
    existing.isActive = true;
    existing.name = name;
    await existing.save();
    return existing;
  }
  return Holiday.create({ date, name });
}

async function deleteHoliday(id) {
  const holiday = await Holiday.findById(id);
  if (!holiday) throw new ApiError(404, 'Holiday not found');
  holiday.isActive = false; // soft delete
  await holiday.save();
  return holiday;
}

module.exports = { getDayType, listHolidays, createHoliday, deleteHoliday };