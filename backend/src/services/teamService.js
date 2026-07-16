const Team = require('../models/Team');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Normalize a team's managers (populated docs or raw ObjectIds) to string ids.
function managerIds(team) {
  return (team.managers || []).map((m) => (m && m._id ? String(m._id) : String(m)));
}

// Is `userId` one of the team's managers?
function isManagerOf(team, userId) {
  return managerIds(team).includes(String(userId));
}

// Managers may only touch teams they manage; leadership/admin see all.
function assertCanViewTeam(requester, team) {
  const role = requester.role;
  if (role === 'admin' || role === 'leadership') return;
  if (role === 'manager' && isManagerOf(team, requester.id)) return;
  throw new ApiError(403, 'Forbidden');
}

async function validateManagers(managers) {
  if (!Array.isArray(managers) || managers.length === 0) {
    throw new ApiError(400, 'At least one manager is required');
  }
  const found = await User.find({ _id: { $in: managers } }).select('_id');
  if (found.length !== managers.length) throw new ApiError(400, 'One or more managers not found');
}

async function listTeams() {
  return Team.find().populate('managers', 'name email role').sort({ createdAt: -1 });
}

// Teams the requester manages (is listed in managers[]).
async function listManagedTeams(requester) {
  return Team.find({ managers: requester.id }).populate('managers', 'name email role').sort({ name: 1 });
}

async function getTeamById(requester, id) {
  const team = await Team.findById(id).populate('managers', 'name email role');
  if (!team) throw new ApiError(404, 'Team not found');
  assertCanViewTeam(requester, team);
  return team;
}

async function createTeam(data) {
  await validateManagers(data.managers);
  return Team.create({ name: data.name, managers: data.managers });
}

async function updateTeam(id, data) {
  const team = await Team.findById(id);
  if (!team) throw new ApiError(404, 'Team not found');

  if (data.name !== undefined) team.name = data.name;
  if (data.managers !== undefined) {
    await validateManagers(data.managers);
    team.managers = data.managers;
  }
  await team.save();
  return team;
}

async function getTeamMembers(requester, id) {
  const team = await Team.findById(id);
  if (!team) throw new ApiError(404, 'Team not found');
  assertCanViewTeam(requester, team);
  return User.find({ team: id, isActive: true }).sort({ name: 1 });
}

module.exports = { listTeams, listManagedTeams, getTeamById, createTeam, updateTeam, getTeamMembers, isManagerOf };
