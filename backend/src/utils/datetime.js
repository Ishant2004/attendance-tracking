const { tzOffsetMinutes } = require('../config/env');

const MS_DAY = 24 * 60 * 60 * 1000;
const offsetMs = tzOffsetMinutes * 60 * 1000;

// 'YYYY-MM-DD' for the given instant, in app timezone (IST).
function dateStrInTZ(date = new Date()) {
  const d = new Date(date.getTime() + offsetMs); // shift to wall-clock, then read UTC parts
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

// UTC instants for [start, end] of a 'YYYY-MM-DD' calendar day in app timezone.
function dayWindow(dateStr) {
  const startUtc = Date.parse(`${dateStr}T00:00:00Z`) - offsetMs;
  if (Number.isNaN(startUtc)) throw new Error('Invalid date (use YYYY-MM-DD)');
  return { start: new Date(startUtc), end: new Date(startUtc + MS_DAY - 1) };
}

// Day of week for a calendar date, 0=Sun .. 6=Sat (timezone-independent).
function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function isWeekend(dateStr) {
  const d = weekdayOf(dateStr);
  return d === 0 || d === 6; // Sun or Sat
}

module.exports = { dateStrInTZ, dayWindow, weekdayOf, isWeekend };