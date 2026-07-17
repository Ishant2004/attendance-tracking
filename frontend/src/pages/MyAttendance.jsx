import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { attendanceApi } from '../api/attendance';
import { flagsApi } from '../api/flags';
import { leaveApi } from '../api/leaveRequests';
import { recordChangeApi } from '../api/recordChangeRequests';
import { usersApi } from '../api/users';
import { getCurrentPosition } from '../utils/geo';
import { Card, Badge, Spinner, SortHeader, Select } from '../components/ui';
import { flagLabel, flagDetail } from '../utils/flagFormat';
import { useSort } from '../hooks/useSort';

const fmt = (dt) => (dt ? new Date(dt).toLocaleString() : '—');
const fmtDate = (dt) => (dt ? new Date(dt).toLocaleDateString() : '—');
const fmtDay = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString() : '—');
// The app runs in IST — render record dates/times in Asia/Kolkata regardless of viewer TZ.
const IST = 'Asia/Kolkata';
const fmtTime = (dt) =>
  dt ? new Date(dt).toLocaleTimeString('en-US', { timeZone: IST, hour: 'numeric', minute: '2-digit' }) : null;
const dateIST = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const weekdayIST = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-US', { timeZone: IST, weekday: 'short' }) : '';
const Dash = () => <span className="text-slate-300">—</span>;
// The record's `date` is IST midnight; format the IST calendar day (en-CA => YYYY-MM-DD).
const isoDay = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(dt));
const typeLabel = (t) => (t === 'half_day' ? 'Half day' : 'Leave');
const rangeLabel = (r) => (r.fromDate === r.toDate ? fmtDay(r.fromDate) : `${fmtDay(r.fromDate)} → ${fmtDay(r.toDate)}`);
const EMPTY_FORM = { type: 'leave', fromDate: '', toDate: '', reason: '' };
const STATUS_OPTIONS = ['WFO', 'WFH', 'Absent', 'Leave', 'Half Day', 'Holiday', 'Weekend'];
const HISTORY_ACCESSORS = {
  date: (r) => new Date(r.date).getTime(),
  status: (r) => r.status,
  checkIn: (r) => (r.checkInTime ? new Date(r.checkInTime).getTime() : null),
  checkOut: (r) => (r.checkOutTime ? new Date(r.checkOutTime).getTime() : null),
  hours: (r) => r.totalHours ?? 0,
  late: (r) => (r.isLate ? 1 : 0),
};

export default function MyAttendance() {
  const { user } = useAuth();
  const uid = user._id || user.id; // /auth/me serializes _id
  const canApprove = user.role !== 'employee';

  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [coords, setCoords] = useState({ latitude: '', longitude: '' });
  const { sort, toggle, sortRows } = useSort('date', 'desc');

  const [me, setMe] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [myChanges, setMyChanges] = useState([]);
  const [changeInbox, setChangeInbox] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reqError, setReqError] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [changeFor, setChangeFor] = useState(null); // attendance row being corrected
  const [changeForm, setChangeForm] = useState({ status: '', reason: '' });

  const loadRequests = useCallback(async () => {
    const [meRes, lMine, lInbox, cMine, cInbox] = await Promise.all([
      usersApi.get(uid),
      leaveApi.mine(),
      canApprove ? leaveApi.inbox() : Promise.resolve([]),
      recordChangeApi.mine(),
      canApprove ? recordChangeApi.inbox() : Promise.resolve([]),
    ]);
    setMe(meRes);
    setMyRequests(lMine);
    setInbox(lInbox);
    setMyChanges(cMine);
    setChangeInbox(cInbox);
  }, [uid, canApprove]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, f] = await Promise.all([
        attendanceApi.currentStatus(uid),
        attendanceApi.records(uid),
        flagsApi.forUser(uid),
      ]);
      setStatus(s);
      setRecords(r);
      setFlags(f);
      await loadRequests();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [uid, loadRequests]);

  useEffect(() => {
    load();
  }, [load]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setReqError('');
    setReqBusy(true);
    try {
      const body = { type: form.type, fromDate: form.fromDate, reason: form.reason.trim() };
      if (form.type === 'leave') body.toDate = form.toDate || form.fromDate;
      await leaveApi.create(body);
      setForm(EMPTY_FORM);
      await loadRequests();
    } catch (e) {
      setReqError(e.response?.data?.message || 'Failed to submit request');
    } finally {
      setReqBusy(false);
    }
  };

  const review = async (id, action) => {
    try {
      await (action === 'approve' ? leaveApi.approve(id) : leaveApi.reject(id));
      await loadRequests();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    }
  };

  const cancelRequest = async (id) => {
    try {
      await leaveApi.cancel(id);
      await loadRequests();
    } catch (e) {
      setReqError(e.response?.data?.message || 'Failed to cancel request');
    }
  };

  const submitChange = async (e) => {
    e.preventDefault();
    setReqError('');
    setReqBusy(true);
    try {
      await recordChangeApi.create({
        date: isoDay(changeFor.date),
        requestedStatus: changeForm.status,
        reason: changeForm.reason.trim(),
      });
      setChangeFor(null);
      setChangeForm({ status: '', reason: '' });
      await loadRequests();
    } catch (e) {
      setReqError(e.response?.data?.message || 'Failed to submit change request');
    } finally {
      setReqBusy(false);
    }
  };

  const reviewChange = async (id, action) => {
    try {
      await (action === 'approve' ? recordChangeApi.approve(id) : recordChangeApi.reject(id));
      await loadRequests();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    }
  };

  const cancelChange = async (id) => {
    try {
      await recordChangeApi.cancel(id);
      await loadRequests();
    } catch (e) {
      setReqError(e.response?.data?.message || 'Failed to cancel change request');
    }
  };

  const requestChange = (r) => {
    setReqError('');
    setChangeForm({ status: '', reason: '' });
    setChangeFor(r);
  };

  const punch = async (kind) => {
    setBusy(true);
    setError('');
    try {
      let payload;
      if (manual) {
        payload = { latitude: Number(coords.latitude), longitude: Number(coords.longitude) };
        if (Number.isNaN(payload.latitude) || Number.isNaN(payload.longitude))
          throw new Error('Enter valid coordinates');
      } else {
        payload = await getCurrentPosition();
      }
      if (kind === 'in') await attendanceApi.checkIn(payload);
      else await attendanceApi.checkOut(payload);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">My Attendance</h1>
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <Card title="Current status">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-sm text-slate-500">Location</div>
            <Badge tone={status?.status || 'unknown'}>{status?.status || 'unknown'}</Badge>
          </div>
          <div>
            <div className="text-sm text-slate-500">Checked in</div>
            <span className="font-medium">{status?.checkedIn ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <div className="text-sm text-slate-500">Last event</div>
            <span className="text-sm">{fmt(status?.lastEvent?.timestamp)}</span>
          </div>
          <div>
            <div className="text-sm text-slate-500">Reporting manager</div>
            <span className="font-medium">{me?.manager?.name || '—'}</span>
          </div>
          <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
            <button
              disabled={busy || status?.checkedIn}
              onClick={() => punch('in')}
              title={status?.checkedIn ? 'You are already checked in' : 'Check in'}
              className="flex-1 sm:flex-none rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? '…' : 'Check in'}
            </button>
            <button
              disabled={busy || !status?.checkedIn}
              onClick={() => punch('out')}
              title={status?.checkedIn ? 'Check out' : 'Check in first'}
              className="flex-1 sm:flex-none rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? '…' : 'Check out'}
            </button>
          </div>
        </div>

        {/* Manual coordinate entry is a spoofing vector — enable only via VITE_ALLOW_MANUAL_LOCATION=true. */}
        {import.meta.env.VITE_ALLOW_MANUAL_LOCATION === 'true' && (
          <>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              Enter location manually <span className="text-xs text-amber-600">(dev only)</span>
            </label>
            {manual && (
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="latitude (e.g. 12.9716)"
                  value={coords.latitude}
                  onChange={(e) => setCoords((c) => ({ ...c, latitude: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-48"
                />
                <input
                  placeholder="longitude (e.g. 77.5946)"
                  value={coords.longitude}
                  onChange={(e) => setCoords((c) => ({ ...c, longitude: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-48"
                />
              </div>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Request time off">
          <form onSubmit={submitRequest} className="space-y-3">
            {reqError && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{reqError}</div>}
            <div>
              <label className="block text-sm text-slate-600 mb-1">Type</label>
              <Select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="leave">Leave (a day or a period)</option>
                <option value="half_day">Half day (single day)</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[8rem]">
                <label className="block text-sm text-slate-600 mb-1">
                  {form.type === 'half_day' ? 'Date' : 'From'}
                </label>
                <input
                  type="date"
                  required
                  value={form.fromDate}
                  onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {form.type === 'leave' && (
                <div className="flex-1 min-w-[8rem]">
                  <label className="block text-sm text-slate-600 mb-1">To</label>
                  <input
                    type="date"
                    required
                    min={form.fromDate || undefined}
                    value={form.toDate}
                    onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Reason <span className="text-slate-400">(optional)</span></label>
              <input
                type="text"
                value={form.reason}
                maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. family function"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={reqBusy || !form.fromDate}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {reqBusy ? 'Submitting…' : 'Send to my manager'}
            </button>
            <p className="text-xs text-slate-400">
              Your reporting manager approves the request. Once approved, those days show as{' '}
              <Badge tone="Leave">Leave</Badge> or <Badge tone="Half Day">Half Day</Badge> on your record.
            </p>
          </form>
        </Card>

        <Card title="My requests">
          {myRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {myRequests.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-50 pb-2 last:border-0">
                  <span className="font-medium text-slate-700">{typeLabel(r.type)}</span>
                  <span className="text-slate-500">{rangeLabel(r)}</span>
                  {r.reason && <span className="text-slate-400 italic">“{r.reason}”</span>}
                  <span className="ml-auto flex items-center gap-2">
                    <Badge tone={r.status}>{r.status}</Badge>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => cancelRequest(r._id)}
                        className="rounded-lg bg-slate-200 text-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canApprove && (() => {
        const pendingCount =
          inbox.filter((r) => r.status === 'pending').length +
          changeInbox.filter((r) => r.status === 'pending').length;
        const byPending = (a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);
        const actions = (r, fn) =>
          r.status === 'pending' ? (
            <span className="ml-auto flex gap-2">
              <button onClick={() => fn(r._id, 'approve')} className="rounded-lg bg-green-600 text-white px-3 py-1 text-xs font-medium hover:bg-green-700">Approve</button>
              <button onClick={() => fn(r._id, 'reject')} className="rounded-lg bg-slate-200 text-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-300">Reject</button>
            </span>
          ) : (
            <Badge tone={r.status}>{r.status}</Badge>
          );
        return (
          <Card title={`Approvals${pendingCount ? ` (${pendingCount} pending)` : ''}`}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Time off</h3>
                {inbox.length === 0 ? (
                  <p className="text-sm text-slate-500">No time-off requests from your reports.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...inbox].sort(byPending).map((r) => (
                      <li key={r._id} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-50 pb-2 last:border-0">
                        <span className="font-medium text-slate-700">{r.user?.name || '—'}</span>
                        <span className="text-slate-500">{typeLabel(r.type)} · {rangeLabel(r)}</span>
                        {r.reason && <span className="text-slate-400 italic">“{r.reason}”</span>}
                        {actions(r, review)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Record corrections</h3>
                {changeInbox.length === 0 ? (
                  <p className="text-sm text-slate-500">No record-change requests from your reports.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...changeInbox].sort(byPending).map((r) => (
                      <li key={r._id} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-50 pb-2 last:border-0">
                        <span className="font-medium text-slate-700">{r.user?.name || '—'}</span>
                        <span className="text-slate-500">{fmtDay(r.date)}:</span>
                        <Badge tone={r.currentStatus || 'unknown'}>{r.currentStatus || 'none'}</Badge>
                        <span className="text-slate-400">→</span>
                        <Badge tone={r.requestedStatus}>{r.requestedStatus}</Badge>
                        {r.reason && <span className="text-slate-400 italic">“{r.reason}”</span>}
                        {actions(r, reviewChange)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      <Card title="Attendance history">
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">No records yet.</p>
        ) : (
          <>
            {/* Desktop: full sortable table */}
            <div className="hidden md:block overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                    <SortHeader label="Date" sortKey="date" sort={sort} onSort={toggle} />
                    <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggle} />
                    <SortHeader label="Check in" sortKey="checkIn" sort={sort} onSort={toggle} />
                    <SortHeader label="Check out" sortKey="checkOut" sort={sort} onSort={toggle} />
                    <SortHeader label="Hours" sortKey="hours" sort={sort} onSort={toggle} className="py-2 pr-4 text-right" />
                    <SortHeader label="Late" sortKey="late" sort={sort} onSort={toggle} />
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortRows(records, HISTORY_ACCESSORS).map((r) => (
                    <tr key={r._id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className="text-slate-400 mr-1.5">{weekdayIST(r.date)}</span>
                        <span className="font-medium text-slate-700">{dateIST(r.date)}</span>
                      </td>
                      <td className="py-2.5 pr-4"><Badge tone={r.status}>{r.status}</Badge></td>
                      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums">
                        {fmtTime(r.checkInTime) ? (
                          <span className={r.isLate ? 'text-red-600 font-medium' : 'text-slate-700'}>
                            {fmtTime(r.checkInTime)}
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-700">
                        {fmtTime(r.checkOutTime) || <Dash />}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                        {r.totalHours ? `${r.totalHours}h` : <Dash />}
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.isLate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Late
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className="py-2.5 pr-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => requestChange(r)}
                          title="Request a change to this day"
                          aria-label="Request a change to this day"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100 transition"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards (no horizontal scroll) */}
            <ul className="md:hidden space-y-2">
              {sortRows(records, HISTORY_ACCESSORS).map((r) => (
                <li key={r._id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">
                      <span className="text-slate-400 mr-1">{weekdayIST(r.date)}</span>
                      {dateIST(r.date)}
                    </span>
                    <Badge tone={r.status}>{r.status}</Badge>
                    <button
                      onClick={() => requestChange(r)}
                      aria-label="Request a change to this day"
                      className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
                    <span className="text-slate-500 whitespace-nowrap">
                      In{' '}
                      <span className={r.isLate ? 'text-red-600 font-medium' : 'text-slate-700 font-medium'}>
                        {fmtTime(r.checkInTime) || '—'}
                      </span>
                    </span>
                    <span className="text-slate-500 whitespace-nowrap">
                      Out <span className="text-slate-700 font-medium">{fmtTime(r.checkOutTime) || '—'}</span>
                    </span>
                    {r.totalHours ? <span className="text-slate-600 whitespace-nowrap">{r.totalHours}h</span> : null}
                    {r.isLate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">
                        Late
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="My record-change requests">
        {myChanges.length === 0 ? (
          <p className="text-sm text-slate-500">
            No change requests. Use “Request change” on any row above to ask your manager to correct a day.
          </p>
        ) : (
          <ul className="space-y-2">
            {myChanges.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-50 pb-2 last:border-0">
                <span className="text-slate-500">{fmtDay(r.date)}:</span>
                <Badge tone={r.currentStatus || 'unknown'}>{r.currentStatus || 'none'}</Badge>
                <span className="text-slate-400">→</span>
                <Badge tone={r.requestedStatus}>{r.requestedStatus}</Badge>
                {r.reason && <span className="text-slate-400 italic">“{r.reason}”</span>}
                <span className="ml-auto flex items-center gap-2">
                  <Badge tone={r.status}>{r.status}</Badge>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => cancelChange(r._id)}
                      className="rounded-lg bg-slate-200 text-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="My flags">
        {flags.length === 0 ? (
          <p className="text-sm text-slate-500">No flags 🎉</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f._id} className="flex items-center gap-3 text-sm">
                <Badge tone={f.severity}>{f.severity}</Badge>
                <span className="font-medium text-slate-700">{flagLabel(f.flagType)}</span>
                <span className="text-slate-500">{flagDetail(f)}</span>
                {f.resolved && <span className="ml-auto text-green-600 text-xs">resolved</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {changeFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setChangeFor(null)}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-slate-800">Request record change</h2>
            <p className="text-sm text-slate-500 mt-1">
              {fmtDate(changeFor.date)} — currently <Badge tone={changeFor.status}>{changeFor.status}</Badge>
            </p>
            <form onSubmit={submitChange} className="space-y-3 mt-3">
              {reqError && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{reqError}</div>}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Change to</label>
                <Select
                  required
                  value={changeForm.status}
                  onChange={(e) => setChangeForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="" disabled>Select status…</option>
                  {STATUS_OPTIONS.filter((s) => s !== changeFor.status).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Reason <span className="text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  maxLength={500}
                  value={changeForm.reason}
                  onChange={(e) => setChangeForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="why this should change"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setChangeFor(null)} className="text-sm rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">Cancel</button>
                <button
                  type="submit"
                  disabled={reqBusy || !changeForm.status}
                  className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  {reqBusy ? 'Sending…' : 'Send to my manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}