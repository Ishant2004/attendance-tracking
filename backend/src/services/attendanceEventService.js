const AttendanceEvent = require('../models/AttendanceEvent');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { assertCanView } = require('./userService');
const { resolveLocation } = require('../utils/geofence');

// Ingest one event for a user; geofence resolution happens here.
async function recordEvent(userId, { eventType, latitude, longitude, timestamp }) {
  const { detectedLocationType, officeLocation } = await resolveLocation(latitude, longitude);
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
    checkedIn: last.eventType !== 'check_out', // still "in" unless last event was a check-out
    officeLocation: last.officeLocation,
    lastEvent: last,
  };
}

module.exports = { recordEvent, getUserEvents, getCurrentStatus };