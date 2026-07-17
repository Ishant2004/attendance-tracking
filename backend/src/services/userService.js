const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Can `requester` view `target`'s record?
function assertCanView(requester, target) {
  const role = requester.role;
  if (role === 'admin' || role === 'leadership') return;
  if (requester.id === String(target._id)) return;                 // self
  if (role === 'manager' && String(target.manager) === requester.id) return; // report
  throw new ApiError(403, 'Forbidden');
}

async function listUsers(requester, filters = {}) {
  const query = { isActive: true }; // deleted (deactivated) users are hidden
  if (filters.team) query.team = filters.team;
  if (filters.role) query.role = filters.role;

  // Managers see only their reports + themselves; leadership/admin see all.
  if (requester.role === 'manager') {
    query.$or = [{ manager: requester.id }, { _id: requester.id }];
  }
  return User.find(query).sort({ createdAt: -1 });
}

// Org-wide directory for the hierarchy tree — all active users, minimal fields.
// Visible to every authenticated role (read-only, no sensitive data).
async function listTree() {
  return User.find({ isActive: true })
    .select('name role team manager')
    .populate('team', 'name')
    .sort({ name: 1 });
}

async function getUserById(requester, id) {
  const user = await User.findById(id).populate('manager', 'name email').populate('team', 'name');
  if (!user) throw new ApiError(404, 'User not found');
  assertCanView(requester, user);
  return user;
}

// Non-admin users must be mapped to at least one office (for WFO detection).
function assertOfficesRequired(role, officeLocations) {
  if (role !== 'admin' && (!Array.isArray(officeLocations) || officeLocations.length === 0)) {
    throw new ApiError(400, 'At least one assigned office is required');
  }
}

// Reporting hierarchy: which role a user's manager must have.
const MANAGER_ROLE = { employee: 'manager', manager: 'leadership', leadership: 'admin' };

// Non-admin users must have a team and a manager of the correct role.
async function assertTeamAndManager(role, teamId, managerId) {
  if (role === 'admin') return; // admins have no team/manager
  if (!teamId) throw new ApiError(400, 'Team is required');
  if (!managerId) throw new ApiError(400, 'Manager is required');
  const expected = MANAGER_ROLE[role];
  const mgr = await User.findById(managerId).select('role isActive');
  if (!mgr) throw new ApiError(400, 'Manager not found');
  if (mgr.role !== expected) {
    throw new ApiError(400, `A ${role}'s manager must be a ${expected}`);
  }
}

async function createUser(data) {
  const email = data.email.toLowerCase();
  if (await User.findOne({ email })) throw new ApiError(409, 'Email already in use');
  const role = data.role || 'employee';
  assertOfficesRequired(role, data.officeLocations);
  await assertTeamAndManager(role, data.team, data.manager);

  const user = new User({
    name: data.name,
    email,
    role: data.role,                 // enum-validated by the schema
    team: data.team || null,
    manager: data.manager || null,
    password: data.password,         // hashed by the pre('validate') hook
    officeLocations: data.officeLocations || [],
  });
  await user.save();
  return user;
}

async function updateUser(requester, id, data) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  const isSelf = requester.id === String(user._id);
  const isAdmin = requester.role === 'admin';
  if (!isAdmin && !isSelf) throw new ApiError(403, 'Forbidden');

  if (isAdmin) {
    ['name', 'email', 'role', 'team', 'manager', 'isActive', 'officeLocations'].forEach((f) => {
      if (data[f] !== undefined) user[f] = data[f];
    });
    // Enforce invariants on the resulting user.
    assertOfficesRequired(user.role, user.officeLocations);
    await assertTeamAndManager(user.role, user.team, user.manager);
  } else {
    // self-service: only allowed to change their own name
    if (data.name !== undefined) user.name = data.name;
  }
  if (data.password) user.password = data.password;

  await user.save();
  return user;
}

async function deactivateUser(requester, id) {
  if (String(id) === String(requester.id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  user.isActive = false;
  await user.save();
  return user;
}

async function getUserTeam(requester, id) {
    const user = await User.findById(id).populate('team');
    if (!user) throw new ApiError(404, 'User not found');
    assertCanView(requester, user);
    return user.team;   // full team document now, or null
  }

module.exports = {
  listUsers,
  listTree,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getUserTeam,
  assertCanView,
};