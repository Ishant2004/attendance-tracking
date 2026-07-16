const asyncHandler = require('../utils/asyncHandler');
const teamService = require('../services/teamService');

const list = asyncHandler(async (req, res) => {
  const teams = await teamService.listTeams();
  res.json({ success: true, data: { teams } });
});

const managed = asyncHandler(async (req, res) => {
  const teams = await teamService.listManagedTeams(req.user);
  res.json({ success: true, data: { teams } });
});

const get = asyncHandler(async (req, res) => {
  const team = await teamService.getTeamById(req.user, req.params.id);
  res.json({ success: true, data: { team } });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.body);
  res.status(201).json({ success: true, data: { team } });
});

const update = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.body);
  res.json({ success: true, data: { team } });
});

const members = asyncHandler(async (req, res) => {
  const users = await teamService.getTeamMembers(req.user, req.params.id);
  res.json({ success: true, data: { members: users } });
});

module.exports = { list, managed, get, create, update, members };