const RecordChangeRequest = require('../models/RecordChangeRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const ApiError = require('../utils/ApiError');
const { dayWindow } = require('../utils/datetime');

// Statuses that represent "not a normal working day" — clear the time fields when set.
const NON_WORKING = ['Absent', 'Leave', 'Half Day', 'Holiday', 'Weekend'];

// A user asks their manager to correct one day's attendance record.
async function createRequest(requester, { date, requestedStatus, reason }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new ApiError(400, 'date must be YYYY-MM-DD');
  if (!AttendanceRecord.STATUSES.includes(requestedStatus)) {
    throw new ApiError(400, 'Invalid requestedStatus');
  }
  if (!requester.manager) {
    throw new ApiError(400, 'You have no reporting manager to approve this request');
  }

  // Only one open request per day.
  const existing = await RecordChangeRequest.findOne({
    user: requester.id,
    date,
    status: 'pending',
  });
  if (existing) throw new ApiError(409, `You already have a pending change request for ${date}`);

  const { start } = dayWindow(date);
  const record = await AttendanceRecord.findOne({ user: requester.id, date: start });
  const currentStatus = record ? record.status : null;
  if (currentStatus === requestedStatus) {
    throw new ApiError(400, `The record is already "${requestedStatus}"`);
  }

  return RecordChangeRequest.create({
    user: requester.id,
    manager: requester.manager,
    date,
    currentStatus,
    requestedStatus,
    reason: reason || '',
    status: 'pending',
  });
}

async function listMine(requester) {
  return RecordChangeRequest.find({ user: requester.id })
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });
}

async function listInbox(requester) {
  return RecordChangeRequest.find({ manager: requester.id, status: { $ne: 'cancelled' } })
    .populate('user', 'name email role')
    .sort({ createdAt: -1 });
}

async function review(requester, id, action) {
  const request = await RecordChangeRequest.findById(id);
  if (!request) throw new ApiError(404, 'Change request not found');

  const isAssignedManager = String(request.manager) === requester.id;
  const isPrivileged = ['leadership', 'admin'].includes(requester.role);
  if (!isAssignedManager && !isPrivileged) throw new ApiError(403, 'Forbidden');

  if (request.status !== 'pending') throw new ApiError(400, `Request already ${request.status}`);

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.reviewedBy = requester.id;
  request.reviewedAt = new Date();
  await request.save();

  if (action === 'approve') await applyToRecord(request);
  return request;
}

// Write the approved status onto the day's record and pin it against future rollups.
async function applyToRecord(request) {
  const { start } = dayWindow(request.date);
  let record = await AttendanceRecord.findOne({ user: request.user, date: start });
  if (!record) record = new AttendanceRecord({ user: request.user, date: start });

  record.status = request.requestedStatus;
  record.manualOverride = true;
  if (NON_WORKING.includes(request.requestedStatus)) {
    record.checkInTime = null;
    record.checkOutTime = null;
    record.totalHours = 0;
    record.officeLocation = null;
    record.isLate = false;
  }
  await record.save();
  return record;
}

async function cancelRequest(requester, id) {
  const request = await RecordChangeRequest.findById(id);
  if (!request) throw new ApiError(404, 'Change request not found');
  if (String(request.user) !== requester.id) throw new ApiError(403, 'Forbidden');
  if (request.status !== 'pending') {
    throw new ApiError(400, `Only pending requests can be cancelled (this one is ${request.status})`);
  }
  request.status = 'cancelled';
  await request.save();
  return request;
}

module.exports = { createRequest, listMine, listInbox, review, cancelRequest };
