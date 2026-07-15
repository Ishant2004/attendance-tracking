const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/calendarService');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { holidays: await service.listHolidays() } });
});

const create = asyncHandler(async (req, res) => {
  const holiday = await service.createHoliday(req.body);
  res.status(201).json({ success: true, data: { holiday } });
});

const remove = asyncHandler(async (req, res) => {
  const holiday = await service.deleteHoliday(req.params.id);
  res.json({ success: true, data: { holiday }, message: 'Holiday deleted' });
});

module.exports = { list, create, remove };