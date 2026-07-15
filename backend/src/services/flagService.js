const AttendanceFlag = require('../models/AttendanceFlag');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');
const { assertCanView } = require('./userService');

const THRESHOLDS = { lateCount: 3, absenceCount: 3, lowWfoRatio: 0.2, irregularCount: 3 };

function severityFor(count, mediumAt, highAt) {
  if (count >= highAt) return 'high';
  if (count >= mediumAt) return 'medium';
  return 'low';
}

// Scan the trailing window of daily records and upsert flags. Idempotent per window.
async function runDetection({ windowDays = 7 } = {}) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - windowDays);
  start.setHours(0, 0, 0, 0);
  const weekStartDate = new Date(start);

  const users = await User.find({ isActive: true }).select('_id');
  const flags = [];

  for (const u of users) {
    const records = await AttendanceRecord.find({
      user: u._id,
      date: { $gte: start, $lte: end },
    });
    if (!records.length) continue;

    // Only working days count — weekends, holidays, and leave never trigger flags.
    const workingRecords = records.filter(
      (r) => !['Weekend', 'Holiday', 'Leave'].includes(r.status)
    );
    if (!workingRecords.length) continue;

    const lateCount = workingRecords.filter((r) => r.isLate).length;
    const absenceCount = workingRecords.filter((r) => r.status === 'Absent').length;
    const wfo = workingRecords.filter((r) => r.status === 'WFO').length;
    const worked = wfo + workingRecords.filter((r) => r.status === 'WFH').length;
    const irregularCount = workingRecords.filter(
      (r) => r.totalHours > 0 && (r.totalHours < 4 || r.totalHours > 12)
    ).length;

    const candidates = [];
    if (lateCount >= THRESHOLDS.lateCount)
      candidates.push({
        flagType: 'frequent_late',
        severity: severityFor(lateCount, 3, 5),
        details: { lateCount, windowDays },
      });
    if (absenceCount >= THRESHOLDS.absenceCount)
      candidates.push({
        flagType: 'frequent_absence',
        severity: severityFor(absenceCount, 3, 5),
        details: { absenceCount, windowDays },
      });
    if (worked >= 3 && wfo / worked < THRESHOLDS.lowWfoRatio)
      candidates.push({
        flagType: 'low_wfo_ratio',
        severity: 'medium',
        details: { wfo, worked, ratio: Number((wfo / worked).toFixed(2)) },
      });
    if (irregularCount >= THRESHOLDS.irregularCount)
      candidates.push({
        flagType: 'irregular_hours',
        severity: severityFor(irregularCount, 3, 5),
        details: { irregularCount, windowDays },
      });

    for (const c of candidates) {
      const flag = await AttendanceFlag.findOneAndUpdate(
        { user: u._id, flagType: c.flagType, weekStartDate },
        { $set: { severity: c.severity, details: c.details, resolved: false } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      flags.push(flag);
    }
  }
  return flags;
}

async function listFlags(requester, { team, severity, type, resolved } = {}) {
  const userQuery = {};
  if (team) userQuery.team = team;
  if (requester.role === 'manager') {
    userQuery.$or = [{ manager: requester.id }, { _id: requester.id }];
  }

  const query = {};
  if (Object.keys(userQuery).length) {
    const userIds = (await User.find(userQuery).select('_id')).map((u) => u._id);
    query.user = { $in: userIds };
  }
  if (severity) query.severity = severity;
  if (type) query.flagType = type;
  if (resolved !== undefined) query.resolved = resolved === 'true' || resolved === true;

  return AttendanceFlag.find(query).populate('user', 'name email team').sort({ createdAt: -1 });
}

async function getUserFlags(requester, userId) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);
  return AttendanceFlag.find({ user: userId }).sort({ createdAt: -1 });
}

async function getTeamFlags(requester, teamId) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');
  if (requester.role === 'manager' && String(team.manager) !== requester.id) {
    throw new ApiError(403, 'Forbidden');
  }
  const userIds = (await User.find({ team: teamId }).select('_id')).map((u) => u._id);
  return AttendanceFlag.find({ user: { $in: userIds } })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
}

async function createFlag(data) {
  if (!(await User.findById(data.user))) throw new ApiError(400, 'User not found');
  return AttendanceFlag.create({
    user: data.user,
    flagType: data.flagType,
    severity: data.severity || 'medium',
    weekStartDate: data.weekStartDate ? new Date(data.weekStartDate) : new Date(),
    details: data.details,
  });
}

async function resolveFlag(requester, id) {
  const flag = await AttendanceFlag.findById(id);
  if (!flag) throw new ApiError(404, 'Flag not found');
  if (requester.role === 'manager') {
    const target = await User.findById(flag.user);
    if (!target || String(target.manager) !== requester.id) throw new ApiError(403, 'Forbidden');
  }
  flag.resolved = true;
  await flag.save();
  return flag;
}

module.exports = {
  runDetection,
  listFlags,
  getUserFlags,
  getTeamFlags,
  createFlag,
  resolveFlag,
};