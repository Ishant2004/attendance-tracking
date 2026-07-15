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
  const query = {};
  if (filters.team) query.team = filters.team;
  if (filters.role) query.role = filters.role;

  // Managers see only their reports + themselves; leadership/admin see all.
  if (requester.role === 'manager') {
    query.$or = [{ manager: requester.id }, { _id: requester.id }];
  }
  return User.find(query).sort({ createdAt: -1 });
}

async function getUserById(requester, id) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  assertCanView(requester, user);
  return user;
}

async function createUser(data) {
  const email = data.email.toLowerCase();
  if (await User.findOne({ email })) throw new ApiError(409, 'Email already in use');

  const user = new User({
    name: data.name,
    email,
    role: data.role,                 // enum-validated by the schema
    team: data.team || null,
    manager: data.manager || null,
    password: data.password,         // hashed by the pre('validate') hook
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
    ['name', 'email', 'role', 'team', 'manager', 'isActive'].forEach((f) => {
      if (data[f] !== undefined) user[f] = data[f];
    });
  } else {
    // self-service: only allowed to change their own name
    if (data.name !== undefined) user.name = data.name;
  }
  if (data.password) user.password = data.password;

  await user.save();
  return user;
}

async function deactivateUser(id) {
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
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getUserTeam,
};