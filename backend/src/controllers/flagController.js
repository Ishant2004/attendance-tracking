const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/flagService');

const list = asyncHandler(async (req, res) => {
  const { team, severity, type, resolved } = req.query;
  const flags = await service.listFlags(req.user, { team, severity, type, resolved });
  res.json({ success: true, data: { flags } });
});

const userFlags = asyncHandler(async (req, res) => {
  const flags = await service.getUserFlags(req.user, req.params.userId);
  res.json({ success: true, data: { flags } });
});

const teamFlags = asyncHandler(async (req, res) => {
  const flags = await service.getTeamFlags(req.user, req.params.teamId);
  res.json({ success: true, data: { flags } });
});

const create = asyncHandler(async (req, res) => {
  const flag = await service.createFlag(req.body);
  res.status(201).json({ success: true, data: { flag } });
});

const resolve = asyncHandler(async (req, res) => {
  const flag = await service.resolveFlag(req.user, req.params.id);
  res.json({ success: true, data: { flag }, message: 'Flag resolved' });
});

const runDetection = asyncHandler(async (req, res) => {
  const windowDays = Number(req.query.windowDays) || 7;
  const flags = await service.runDetection({ windowDays });
  res.json({ success: true, data: { flagsCreated: flags.length, flags } });
});

module.exports = { list, userFlags, teamFlags, create, resolve, runDetection };