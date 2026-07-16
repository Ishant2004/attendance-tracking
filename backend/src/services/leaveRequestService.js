const LeaveRequest = require('../models/LeaveRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { dayWindow } = require('../utils/datetime');
const { getDayType } = require('./calendarService');

// Inclusive list of 'YYYY-MM-DD' strings from `from` to `to`.
function eachDate(from, to) {
  const out = [];
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// Employees/managers/leadership request time off to their reporting manager.
async function createRequest(requester, { type, fromDate, toDate, reason }) {
  if (!['leave', 'half_day'].includes(type)) throw new ApiError(400, 'Invalid request type');
  if (!requester.manager) {
    throw new ApiError(400, 'You have no reporting manager to approve this request');
  }

  const from = fromDate;
  const to = type === 'half_day' ? fromDate : toDate || fromDate;
  if (to < from) throw new ApiError(400, 'End date cannot be before start date');

  // Block overlapping requests. Dates are 'YYYY-MM-DD' strings, so lexical comparison
  // is equivalent to date comparison. Ranges overlap when start<=otherEnd && end>=otherStart.
  const clash = await LeaveRequest.findOne({
    user: requester.id,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: to },
    toDate: { $gte: from },
  });
  if (clash) {
    throw new ApiError(
      409,
      `You already have a ${clash.status} request for ${clash.fromDate}${clash.fromDate === clash.toDate ? '' : ` – ${clash.toDate}`} that overlaps these dates`
    );
  }

  return LeaveRequest.create({
    user: requester.id,
    manager: requester.manager,
    type,
    fromDate: from,
    toDate: to,
    reason: reason || '',
    status: 'pending',
  });
}

// The caller's own requests (any role).
async function listMine(requester) {
  return LeaveRequest.find({ user: requester.id })
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });
}

// Requests addressed to the caller (i.e. from their direct reports) awaiting/after review.
// Withdrawn (cancelled) requests never need manager attention, so they're hidden here.
async function listInbox(requester) {
  return LeaveRequest.find({ manager: requester.id, status: { $ne: 'cancelled' } })
    .populate('user', 'name email role')
    .sort({ createdAt: -1 }); // newest first; the UI floats pending requests to the top
}

// A requester withdraws their own still-pending request.
async function cancelRequest(requester, id) {
  const request = await LeaveRequest.findById(id);
  if (!request) throw new ApiError(404, 'Leave request not found');
  if (String(request.user) !== requester.id) throw new ApiError(403, 'Forbidden');
  if (request.status !== 'pending') {
    throw new ApiError(400, `Only pending requests can be cancelled (this one is ${request.status})`);
  }
  request.status = 'cancelled';
  await request.save();
  return request;
}

// Approve or reject. Only the assigned manager, or leadership/admin, may act.
async function review(requester, id, action) {
  const request = await LeaveRequest.findById(id);
  if (!request) throw new ApiError(404, 'Leave request not found');

  const isAssignedManager = String(request.manager) === requester.id;
  const isPrivileged = ['leadership', 'admin'].includes(requester.role);
  if (!isAssignedManager && !isPrivileged) throw new ApiError(403, 'Forbidden');

  if (request.status !== 'pending') {
    throw new ApiError(400, `Request already ${request.status}`);
  }

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.reviewedBy = requester.id;
  request.reviewedAt = new Date();
  await request.save();

  if (action === 'approve') await applyToRecords(request);
  return request;
}

// Materialize approved time off onto the daily records (working days only).
async function applyToRecords(request) {
  const status = request.type === 'half_day' ? 'Half Day' : 'Leave';
  for (const dateStr of eachDate(request.fromDate, request.toDate)) {
    const dayType = await getDayType(dateStr);
    if (dayType.type !== 'Working') continue; // weekends & holidays keep their own status

    const { start } = dayWindow(dateStr);
    await AttendanceRecord.updateOne(
      { user: request.user, date: start },
      {
        $set: {
          user: request.user,
          date: start,
          status,
          checkInTime: null,
          checkOutTime: null,
          totalHours: 0,
          officeLocation: null,
          isLate: false,
        },
      },
      { upsert: true }
    );
  }
}

module.exports = { createRequest, listMine, listInbox, review, cancelRequest, eachDate };
