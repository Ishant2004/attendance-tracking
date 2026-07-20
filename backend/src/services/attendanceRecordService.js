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

// Aggregate a user's events for one day into their daily record. Precedence:
//   1. approved Leave / Half Day / Holiday, or a manager override → preserved as-is
//   2. Weekend / Holiday (calendar) → always that, regardless of any events
//   3. working day → WFO/WFH from events, else Absent
// Reused by the check-in/out APIs, on-read, and the nightly cron.
async function rollupEventsToRecord(userId, dateStr) {
  const { start, end } = dayWindow(dateStr);
  let record = await AttendanceRecord.findOne({ user: userId, date: start });

  // Approved leave / half-day / holidays and manager corrections are authoritative —
  // events never override them.
  if (record && (record.manualOverride || ['Leave', 'Half Day', 'Holiday'].includes(record.status)))
    return record;

  if (!record) record = new AttendanceRecord({ user: userId, date: start });

  // Weekends and company holidays are days off for everyone — always classified as
  // Weekend/Holiday, regardless of any pings/check-ins/check-outs on that date.
  const dayType = await getDayType(dateStr);
  if (dayType.type !== 'Working') {
    record.status = dayType.type; // 'Weekend' or 'Holiday'
    record.checkInTime = null;
    record.checkOutTime = null;
    record.totalHours = 0;
    record.officeLocation = null;
    record.isLate = false;
    await record.save();
    return record;
  }

  // Working day → derive from the day's events (Absent if there are none).
  const events = await AttendanceEvent.find({
    user: userId,
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: 1 });

  if (!events.length) {
    record.status = 'Absent';
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
  // A manual status change should stick against the next rollup.
  if (data.status !== undefined) record.manualOverride = true;
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