const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceEvent = require('../models/AttendanceEvent');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { assertCanView } = require('./userService');
const { dayWindow: tzDayWindow } = require('../utils/datetime');
const { getDayType } = require('./calendarService');

const LATE_THRESHOLD_HOUR = 10; // check-in at/after 10:00 (server local) counts as late

// [start, end] of a 'YYYY-MM-DD' day, in app timezone (IST).
function dayWindow(dateStr) {
  try {
    return tzDayWindow(dateStr);
  } catch {
    throw new ApiError(400, 'Invalid date (use YYYY-MM-DD)');
  }
}

// Aggregate a user's events for one day into their daily record.
// Never overwrites a manually-set Leave/Holiday. Reused by APIs and (future) cron.
async function rollupEventsToRecord(userId, dateStr) {
  const { start, end } = dayWindow(dateStr);
  let record = await AttendanceRecord.findOne({ user: userId, date: start });

  if (record && ['Leave', 'Holiday'].includes(record.status)) return record;

  const events = await AttendanceEvent.find({
    user: userId,
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: 1 });

  if (!record) record = new AttendanceRecord({ user: userId, date: start });

  if (!events.length) {
    const dayType = await getDayType(dateStr);
    record.status =
      dayType.type === 'Holiday' ? 'Holiday' : dayType.type === 'Weekend' ? 'Weekend' : 'Absent';
    record.checkInTime = null;
    record.checkOutTime = null;
    record.totalHours = 0;
    record.officeLocation = null;
    record.isLate = false;
    await record.save();
    return record;
  }

  const checkIns = events.filter((e) => e.eventType === 'check_in');
  const checkOuts = events.filter((e) => e.eventType === 'check_out');
  const checkInTime = (checkIns[0] || events[0]).timestamp;
  const checkOutTime = (checkOuts[checkOuts.length - 1] || events[events.length - 1]).timestamp;

  const wfoEvent = events.find((e) => e.detectedLocationType === 'WFO');

  record.status = wfoEvent ? 'WFO' : 'WFH';
  record.officeLocation = wfoEvent ? wfoEvent.officeLocation : null;
  record.checkInTime = checkInTime;
  record.checkOutTime = checkOutTime;
  record.totalHours = Number(Math.max(0, (checkOutTime - checkInTime) / 3600000).toFixed(2));
  record.isLate = checkInTime.getHours() >= LATE_THRESHOLD_HOUR;

  await record.save();
  return record;
}

async function listRecords(requester, { user, team, from, to } = {}) {
  const userQuery = {};
  if (team) userQuery.team = team;
  if (user) userQuery._id = user;
  if (requester.role === 'manager') {
    userQuery.$or = [{ manager: requester.id }, { _id: requester.id }];
  }
  const userIds = (await User.find(userQuery).select('_id')).map((u) => u._id);

  const query = { user: { $in: userIds } };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = dayWindow(from).start;
    if (to) query.date.$lte = dayWindow(to).end;
  }
  return AttendanceRecord.find(query)
    .populate('user', 'name email')
    .populate('officeLocation', 'name')
    .sort({ date: -1 });
}

async function getUserRecords(requester, userId, { from, to } = {}) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);

  const query = { user: userId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = dayWindow(from).start;
    if (to) query.date.$lte = dayWindow(to).end;
  }
  return AttendanceRecord.find(query).populate('officeLocation', 'name').sort({ date: -1 });
}

async function getUserRecordByDate(requester, userId, dateStr) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);

  // Roll up on read so the day is always current (no cron needed for demo).
  const record = await rollupEventsToRecord(userId, dateStr);
  await record.populate('officeLocation', 'name');
  return record;
}

async function updateRecord(requester, id, data) {
  const record = await AttendanceRecord.findById(id);
  if (!record) throw new ApiError(404, 'Record not found');

  if (requester.role === 'manager') {
    const target = await User.findById(record.user);
    if (!target || String(target.manager) !== requester.id) throw new ApiError(403, 'Forbidden');
  }

  ['status', 'checkInTime', 'checkOutTime', 'totalHours', 'officeLocation', 'isLate'].forEach(
    (f) => {
      if (data[f] !== undefined) record[f] = data[f];
    }
  );
  await record.save();
  return record;
}

async function markLeave(requester, { userId, date, status = 'Leave' }) {
  const targetId = userId || requester.id;
  const target = await User.findById(targetId);
  if (!target) throw new ApiError(404, 'User not found');

  const isSelf = requester.id === String(target._id);
  const isManagerOf = requester.role === 'manager' && String(target.manager) === requester.id;
  const isPrivileged = ['admin', 'leadership'].includes(requester.role);
  if (!isSelf && !isManagerOf && !isPrivileged) throw new ApiError(403, 'Forbidden');

  const { start } = dayWindow(date);
  let record = await AttendanceRecord.findOne({ user: targetId, date: start });
  if (!record) record = new AttendanceRecord({ user: targetId, date: start });

  record.status = status; // 'Leave' or 'Holiday'
  record.checkInTime = null;
  record.checkOutTime = null;
  record.totalHours = 0;
  record.officeLocation = null;
  record.isLate = false;
  await record.save();
  return record;
}

module.exports = {
  rollupEventsToRecord,
  listRecords,
  getUserRecords,
  getUserRecordByDate,
  updateRecord,
  markLeave,
};