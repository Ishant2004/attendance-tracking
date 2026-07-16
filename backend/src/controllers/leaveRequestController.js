const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/leaveRequestService');

const create = asyncHandler(async (req, res) => {
  const request = await service.createRequest(req.user, req.body);
  res.status(201).json({ success: true, data: { request } });
});

const mine = asyncHandler(async (req, res) => {
  const requests = await service.listMine(req.user);
  res.json({ success: true, data: { requests } });
});

const inbox = asyncHandler(async (req, res) => {
  const requests = await service.listInbox(req.user);
  res.json({ success: true, data: { requests } });
});

const approve = asyncHandler(async (req, res) => {
  const request = await service.review(req.user, req.params.id, 'approve');
  res.json({ success: true, data: { request } });
});

const reject = asyncHandler(async (req, res) => {
  const request = await service.review(req.user, req.params.id, 'reject');
  res.json({ success: true, data: { request } });
});

const cancel = asyncHandler(async (req, res) => {
  const request = await service.cancelRequest(req.user, req.params.id);
  res.json({ success: true, data: { request } });
});

module.exports = { create, mine, inbox, approve, reject, cancel };
