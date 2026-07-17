const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const list = asyncHandler(async (req, res) => {
  const { team, role } = req.query;
  const users = await userService.listUsers(req.user, { team, role });
  res.json({ success: true, data: { users } });
});

const get = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user, req.params.id);
  res.json({ success: true, data: { user } });
});

const tree = asyncHandler(async (req, res) => {
  const users = await userService.listTree();
  res.json({ success: true, data: { users } });
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, data: { user } });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.user, req.params.id, req.body);
  res.json({ success: true, data: { user } });
});

const remove = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.user, req.params.id);
  res.json({ success: true, data: { user }, message: 'User deactivated' });
});

const getTeam = asyncHandler(async (req, res) => {
  const team = await userService.getUserTeam(req.user, req.params.id);
  res.json({ success: true, data: { team } });
});

module.exports = { list, tree, get, create, update, remove, getTeam };