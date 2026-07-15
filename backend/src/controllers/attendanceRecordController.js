const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/attendanceRecordService');

const list = asyncHandler(async (req, res) => {
  const { user, team, from, to } = req.query;
  const records = await service.listRecords(req.user, { user, team, from, to });
  res.json({ success: true, data: { records } });
});

const getUserHistory = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const records = await service.getUserRecords(req.user, req.params.userId, { from, to });
  res.json({ success: true, data: { records } });
});

const getByDate = asyncHandler(async (req, res) => {
  const record = await service.getUserRecordByDate(req.user, req.params.userId, req.params.date);
  res.json({ success: true, data: { record } });
});

const update = asyncHandler(async (req, res) => {
  const record = await service.updateRecord(req.user, req.params.id, req.body);
  res.json({ success: true, data: { record } });
});

const markLeave = asyncHandler(async (req, res) => {
  const record = await service.markLeave(req.user, req.body);
  res.status(201).json({ success: true, data: { record } });
});

module.exports = { list, getUserHistory, getByDate, update, markLeave };