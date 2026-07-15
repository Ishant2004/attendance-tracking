const Holiday = require('../models/Holiday');
const ApiError = require('../utils/ApiError');
const { isWeekend } = require('../utils/datetime');

// Classify a 'YYYY-MM-DD' date: Holiday (name) > Weekend > Working.
async function getDayType(dateStr) {
  const holiday = await Holiday.findOne({ date: dateStr });
  if (holiday) return { type: 'Holiday', name: holiday.name };
  if (isWeekend(dateStr)) return { type: 'Weekend' };
  return { type: 'Working' };
}

function listHolidays() {
  return Holiday.find().sort({ date: 1 });
}

async function createHoliday({ date, name }) {
  if (await Holiday.findOne({ date })) throw new ApiError(409, 'Holiday already exists for that date');
  return Holiday.create({ date, name });
}

async function deleteHoliday(id) {
  const holiday = await Holiday.findByIdAndDelete(id);
  if (!holiday) throw new ApiError(404, 'Holiday not found');
  return holiday;
}

module.exports = { getDayType, listHolidays, createHoliday, deleteHoliday };