const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceFlag = require('../models/AttendanceFlag');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');
const { assertCanView } = require('./userService');
const { isManagerOf } = require('./teamService');

const DAY = 24 * 60 * 60 * 1000;

// Default window: trailing 30 days.
function parseRange({ from, to } = {}) {
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - 29 * DAY);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Roll a list of daily records into headline numbers.
function summarize(records) {
  const s = { totalDays: records.length, WFO: 0, WFH: 0, Absent: 0, Leave: 0, Holiday: 0, lateCount: 0, totalHours: 0 };
  for (const r of records) {
    s[r.status] = (s[r.status] || 0) + 1;
    if (r.isLate) s.lateCount += 1;
    s.totalHours += r.totalHours || 0;
  }
  const worked = s.WFO + s.WFH;
  s.presentDays = worked;
  s.wfoRatio = worked ? Number((s.WFO / worked).toFixed(2)) : 0;
  s.avgHours = worked ? Number((s.totalHours / worked).toFixed(2)) : 0;
  s.totalHours = Number(s.totalHours.toFixed(2));
  return s;
}

async function individual(requester, userId, range) {
  const target = await User.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  assertCanView(requester, target);

  const { start, end } = parseRange(range);
  const records = await AttendanceRecord.find({ user: userId, date: { $gte: start, $lte: end } }).sort({ date: 1 });
  const openFlags = await AttendanceFlag.countDocuments({ user: userId, resolved: false });

  return {
    user: { id: target.id, name: target.name, email: target.email, role: target.role },
    range: { from: start, to: end },
    summary: summarize(records),
    openFlags,
    records, // day-by-day, for pattern charts
  };
}

async function team(requester, teamId, range) {
  const t = await Team.findById(teamId);
  if (!t) throw new ApiError(404, 'Team not found');
  if (requester.role === 'manager' && !isManagerOf(t, requester.id)) throw new ApiError(403, 'Forbidden');

  const { start, end } = parseRange(range);
  const members = await User.find({ team: teamId, isActive: true }).select('name email');
  const memberIds = members.map((m) => m._id);
  const records = await AttendanceRecord.find({ user: { $in: memberIds }, date: { $gte: start, $lte: end } });

  const byUser = {};
  members.forEach((m) => { byUser[m._id] = { user: { id: m.id, name: m.name, email: m.email }, records: [] }; });
  records.forEach((r) => { if (byUser[r.user]) byUser[r.user].records.push(r); });
  const perMember = Object.values(byUser).map((x) => ({ user: x.user, summary: summarize(x.records) }));

  return {
    team: { id: t.id, name: t.name },
    range: { from: start, to: end },
    memberCount: members.length,
    summary: summarize(records),
    openFlags: await AttendanceFlag.countDocuments({ user: { $in: memberIds }, resolved: false }),
    members: perMember,
  };
}

async function leadership(range) {
  const { start, end } = parseRange(range);
  const teams = await Team.find().select('name');

  const perTeam = [];
  for (const t of teams) {
    const memberIds = (await User.find({ team: t._id, isActive: true }).select('_id')).map((u) => u._id);
    const records = await AttendanceRecord.find({ user: { $in: memberIds }, date: { $gte: start, $lte: end } });
    perTeam.push({ team: { id: t.id, name: t.name }, memberCount: memberIds.length, summary: summarize(records) });
  }

  return {
    range: { from: start, to: end },
    totalUsers: await User.countDocuments({ isActive: true }),
    org: summarize(await AttendanceRecord.find({ date: { $gte: start, $lte: end } })),
    openFlags: await AttendanceFlag.countDocuments({ resolved: false }),
    teams: perTeam,
  };
}

// Resolve which user-ids a ratio/trend query should cover + enforce scoping.
async function resolveScope(requester, { userId, teamId }) {
  if (userId) {
    const target = await User.findById(userId);
    if (!target) throw new ApiError(404, 'User not found');
    assertCanView(requester, target);
    return { scope: 'user', userIds: [target._id] };
  }
  if (teamId) {
    const t = await Team.findById(teamId);
    if (!t) throw new ApiError(404, 'Team not found');
    if (requester.role === 'manager' && !isManagerOf(t, requester.id)) throw new ApiError(403, 'Forbidden');
    const ids = (await User.find({ team: teamId }).select('_id')).map((u) => u._id);
    return { scope: 'team', userIds: ids };
  }
  // org-wide
  if (!['leadership', 'admin'].includes(requester.role)) throw new ApiError(403, 'Forbidden');
  return { scope: 'org', userIds: null };
}

async function wfoRatio(requester, { userId, teamId, from, to }) {
  const { scope, userIds } = await resolveScope(requester, { userId, teamId });
  const { start, end } = parseRange({ from, to });

  const match = { date: { $gte: start, $lte: end } };
  if (userIds) match.user = { $in: userIds };
  const records = await AttendanceRecord.find(match);

  const wfo = records.filter((r) => r.status === 'WFO').length;
  const wfh = records.filter((r) => r.status === 'WFH').length;
  const worked = wfo + wfh;
  return {
    scope,
    range: { from: start, to: end },
    wfo,
    wfh,
    worked,
    wfoRatio: worked ? Number((wfo / worked).toFixed(2)) : 0,
    wfhRatio: worked ? Number((wfh / worked).toFixed(2)) : 0,
  };
}

async function trends(requester, { userId, teamId, from, to }) {
  const { scope, userIds } = await resolveScope(requester, { userId, teamId });
  const { start, end } = parseRange({ from, to });

  const match = { date: { $gte: start, $lte: end } };
  if (userIds) match.user = { $in: userIds };

  const series = await AttendanceRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        WFO: { $sum: { $cond: [{ $eq: ['$status', 'WFO'] }, 1, 0] } },
        WFH: { $sum: { $cond: [{ $eq: ['$status', 'WFH'] }, 1, 0] } },
        Absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        Leave: { $sum: { $cond: [{ $eq: ['$status', 'Leave'] }, 1, 0] } },
        late: { $sum: { $cond: ['$isLate', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', WFO: 1, WFH: 1, Absent: 1, Leave: 1, late: 1 } },
  ]);

  return { scope, range: { from: start, to: end }, series };
}

module.exports = { individual, team, leadership, wfoRatio, trends };