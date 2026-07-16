import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { attendanceApi } from '../api/attendance';
import { flagsApi } from '../api/flags';
import { getCurrentPosition } from '../utils/geo';
import { Card, Badge, Spinner, SortHeader } from '../components/ui';
import { flagLabel, flagDetail } from '../utils/flagFormat';
import { useSort } from '../hooks/useSort';

const fmt = (dt) => (dt ? new Date(dt).toLocaleString() : '—');
const fmtDate = (dt) => (dt ? new Date(dt).toLocaleDateString() : '—');

export default function MyAttendance() {
  const { user } = useAuth();
  const uid = user._id || user.id; // /auth/me serializes _id

  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [coords, setCoords] = useState({ latitude: '', longitude: '' });
  const { sort, toggle, sortRows } = useSort('date', 'desc');

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
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

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
          <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
            <button
              disabled={busy}
              onClick={() => punch('in')}
              className="flex-1 sm:flex-none rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {busy ? '…' : 'Check in'}
            </button>
            <button
              disabled={busy}
              onClick={() => punch('out')}
              className="flex-1 sm:flex-none rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
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

      <Card title="Attendance history">
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">No records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <SortHeader label="Date" sortKey="date" sort={sort} onSort={toggle} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggle} />
                  <SortHeader label="Check in" sortKey="checkIn" sort={sort} onSort={toggle} />
                  <SortHeader label="Check out" sortKey="checkOut" sort={sort} onSort={toggle} />
                  <SortHeader label="Hours" sortKey="hours" sort={sort} onSort={toggle} />
                  <SortHeader label="Late" sortKey="late" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortRows(records, {
                  date: (r) => new Date(r.date).getTime(),
                  status: (r) => r.status,
                  checkIn: (r) => (r.checkInTime ? new Date(r.checkInTime).getTime() : null),
                  checkOut: (r) => (r.checkOutTime ? new Date(r.checkOutTime).getTime() : null),
                  hours: (r) => r.totalHours ?? 0,
                  late: (r) => (r.isLate ? 1 : 0),
                }).map((r) => (
                  <tr key={r._id} className="border-b border-slate-50">
                    <td className="py-2 pr-4">{fmtDate(r.date)}</td>
                    <td className="py-2 pr-4"><Badge tone={r.status}>{r.status}</Badge></td>
                    <td className="py-2 pr-4">{fmt(r.checkInTime)}</td>
                    <td className="py-2 pr-4">{fmt(r.checkOutTime)}</td>
                    <td className="py-2 pr-4">{r.totalHours ?? 0}</td>
                    <td className="py-2 pr-4">{r.isLate ? <Badge tone="high">Late</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}