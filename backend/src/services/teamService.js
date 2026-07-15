const Team = require('../models/Team');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Managers may only touch the team they manage; leadership/admin see all.
function assertCanViewTeam(requester, team) {
  const role = requester.role;
  if (role === 'admin' || role === 'leadership') return;
  // `manager` may be a populated doc or a raw ObjectId — normalize to its id.
  const managerId = team.manager && team.manager._id ? String(team.manager._id) : String(team.manager);
  if (role === 'manager' && managerId === requester.id) return;
  throw new ApiError(403, 'Forbidden');
}

async function listTeams() {
  return Team.find().populate('manager', 'name email role').sort({ createdAt: -1 });
}

async function getTeamById(requester, id) {
  const team = await Team.findById(id).populate('manager', 'name email role');
  if (!team) throw new ApiError(404, 'Team not found');
  assertCanViewTeam(requester, team);
  return team;
}

async function createTeam(data) {
  if (data.manager && !(await User.findById(data.manager))) {
    throw new ApiError(400, 'Manager not found');
  }
  return Team.create({ name: data.name, manager: data.manager || null });
}

async function updateTeam(id, data) {
  const team = await Team.findById(id);
  if (!team) throw new ApiError(404, 'Team not found');

  if (data.name !== undefined) team.name = data.name;
  if (data.manager !== undefined) {
    if (data.manager && !(await User.findById(data.manager))) {
      throw new ApiError(400, 'Manager not found');
    }
    team.manager = data.manager || null;
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

module.exports = { listTeams, getTeamById, createTeam, updateTeam, getTeamMembers };