const cron = require('node-cron');
const User = require('../models/User');
const { rollupEventsToRecord } = require('../services/attendanceRecordService');
const { runDetection } = require('../services/flagService');
const { dateStrInTZ } = require('../utils/datetime');
const { timezone } = require('../config/env');

// Roll up one day for every active user. Users with no events get
// Absent / Weekend / Holiday per the rollup precedence. Idempotent.
async function rollupAllUsersForDate(dateStr) {
  const users = await User.find({ isActive: true }).select('_id');
  let ok = 0;
  for (const u of users) {
    try {
      await rollupEventsToRecord(u._id, dateStr);
      ok++;
    } catch (e) {
      console.error('[rollup] failed for', u._id.toString(), e.message);
    }
  }
  return { date: dateStr, users: users.length, rolledUp: ok };
}

// Yesterday's calendar date in app timezone (IST).
function yesterdayStr() {
  return dateStrInTZ(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

async function runNightlyRollup() {
  const res = await rollupAllUsersForDate(yesterdayStr());
  console.log(`[nightly-rollup] ${res.date}: rolled up ${res.rolledUp}/${res.users} users`);
  return res;
}

async function runWeeklyDetection({ windowDays = 7 } = {}) {
  const flags = await runDetection({ windowDays });
  console.log(`[weekly-detection] ${windowDays}-day window: ${flags.length} flags upserted`);
  return flags;
}

function scheduleJobs() {
  // 00:30 every day, in app timezone — rolls up the day that just ended.
  cron.schedule(
    '30 0 * * *',
    () => {
      runNightlyRollup().catch((e) => console.error('[nightly-rollup] error', e));
    },
    { timezone }
  );
  console.log(`[jobs] nightly rollup scheduled at 00:30 ${timezone}`);

  // Sunday 01:30 (after Saturday's rollup) — outlier detection over the past week.
  cron.schedule(
    '30 1 * * 0',
    () => {
      runWeeklyDetection().catch((e) => console.error('[weekly-detection] error', e));
    },
    { timezone }
  );
  console.log(`[jobs] weekly detection scheduled Sun 01:30 ${timezone}`);
}

module.exports = {
  scheduleJobs,
  runNightlyRollup,
  runWeeklyDetection,
  rollupAllUsersForDate,
  yesterdayStr,
};
