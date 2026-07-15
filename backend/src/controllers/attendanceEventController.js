const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/attendanceEventService');

// All ingest endpoints act on the authenticated user (the device's owner).
function ingest(eventType) {
  return asyncHandler(async (req, res) => {
    const { latitude, longitude, timestamp } = req.body;
    const event = await service.recordEvent(req.user.id, {
      eventType,
      latitude,
      longitude,
      timestamp,
    });
    res.status(201).json({ success: true, data: { event } });
  });
}

const logPing = ingest('ping');
const checkIn = ingest('check_in');
const checkOut = ingest('check_out');

const history = asyncHandler(async (req, res) => {
  const { limit, from, to } = req.query;
  const events = await service.getUserEvents(req.user, req.params.userId, { limit, from, to });
  res.json({ success: true, data: { events } });
});

const currentStatus = asyncHandler(async (req, res) => {
  const status = await service.getCurrentStatus(req.user, req.params.userId);
  res.json({ success: true, data: status });
});

module.exports = { logPing, checkIn, checkOut, history, currentStatus };