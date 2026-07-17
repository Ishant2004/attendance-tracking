const AttendanceEvent = require('../models/AttendanceEvent');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { assertCanView } = require('./userService');
const { resolveAgainstOffices } = require('../utils/geofence');

// The user's current punch state, based only on check-in/check-out (pings are ignored).
async function isCheckedIn(userId) {
  const lastPunch = await AttendanceEvent.findOne({
    user: userId,
    eventType: { $in: ['check_in', 'check_out'] },
  }).sort({ timestamp: -1 });
  return lastPunch ? lastPunch.eventType === 'check_in' : false;
}

// Ingest one event for a user; geofence resolution happens here.
async function recordEvent(userId, { eventType, latitude, longitude, timestamp }) {
    // Enforce the check-in/out toggle: can't check in twice, can't check out when not in.
    if (eventType === 'check_in' || eventType === 'check_out') {
      const checkedIn = await isCheckedIn(userId);
      if (eventType === 'check_in' && checkedIn) throw new ApiError(400, 'You are already checked in');
      if (eventType === 'check_out' && !checkedIn) throw new ApiError(400, 'You are not checked in');
    }

    const user = await User.findById(userId).populate('officeLocations');
    const { detectedLocationType, officeLocation } = resolveAgainstOffices(
      user?.officeLocations || [],
      latitude,
      longitude
    );
    return AttendanceEvent.create({
      user: userId,
      eventType,
      latitude,
      longitude,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      detectedLocationType,
      officeLocation,
    });
  }

async function getUserEvents(requester, userId, { limit = 50, from, to } = {}) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);

  const query = { user: userId };
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }
  return AttendanceEvent.find(query)
    .populate('officeLocation', 'name')
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit) || 50, 200));
}

async function getCurrentStatus(requester, userId) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);

  const last = await AttendanceEvent.findOne({ user: userId })
    .populate('officeLocation', 'name')
    .sort({ timestamp: -1 });

  if (!last) return { status: 'unknown', checkedIn: false, lastEvent: null };

  return {
    status: last.detectedLocationType,        // WFO / WFH
    checkedIn: await isCheckedIn(userId),      // based on last check-in/out, ignoring pings
    officeLocation: last.officeLocation,
    lastEvent: last,
  };
}

module.exports = { recordEvent, getUserEvents, getCurrentStatus, isCheckedIn };