const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/dashboardService');

const individual = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await service.individual(req.user, req.params.userId, { from, to });
  res.json({ success: true, data });
});

const team = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await service.team(req.user, req.params.teamId, { from, to });
  res.json({ success: true, data });
});

const leadership = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await service.leadership({ from, to });
  res.json({ success: true, data });
});

const wfoRatio = asyncHandler(async (req, res) => {
  const { userId, teamId, from, to } = req.query;
  const data = await service.wfoRatio(req.user, { userId, teamId, from, to });
  res.json({ success: true, data });
});

const trends = asyncHandler(async (req, res) => {
  const { userId, teamId, from, to } = req.query;
  const data = await service.trends(req.user, { userId, teamId, from, to });
  res.json({ success: true, data });
});

module.exports = { individual, team, leadership, wfoRatio, trends };