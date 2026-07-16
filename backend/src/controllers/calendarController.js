const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/calendarService');

const list = asyncHandler(async (req, res) => {
  // Only admins may see soft-deleted holidays.
  const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
  res.json({ success: true, data: { holidays: await service.listHolidays({ includeInactive }) } });
});

const create = asyncHandler(async (req, res) => {
  const holiday = await service.createHoliday(req.body);
  res.status(201).json({ success: true, data: { holiday } });
});

const update = asyncHandler(async (req, res) => {
  const holiday = await service.updateHoliday(req.params.id, req.body);
  res.json({ success: true, data: { holiday }, message: 'Holiday updated' });
});

const remove = asyncHandler(async (req, res) => {
  const holiday = await service.deleteHoliday(req.params.id);
  res.json({ success: true, data: { holiday }, message: 'Holiday deleted' });
});

module.exports = { list, create, update, remove };