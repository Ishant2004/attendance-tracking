import { useEffect, useState } from 'react';
import { usersApi } from '../api/users';
import { teamsApi } from '../api/teams';
import { locationsApi } from '../api/locations';
import { Card, Badge, Spinner } from '../components/ui';

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btnCls =
  'rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60';

const TABS = ['Users', 'Teams', 'Office Locations'];

export default function AdminPanel() {
  const [tab, setTab] = useState('Users');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              tab === t
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Users' && <UsersAdmin />}
      {tab === 'Teams' && <TeamsAdmin />}
      {tab === 'Office Locations' && <LocationsAdmin />}
    </div>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee', team: '', manager: '', officeLocations: [],
  });


  const load = async () => {
    setLoading(true);
    try {
      const [u, t, l] = await Promise.all([usersApi.list(), teamsApi.list(), locationsApi.list()]);
      setUsers(u);
      setTeams(t);
      setLocations(l);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.team) delete body.team;
      if (!body.manager) delete body.manager;
      if (!body.officeLocations?.length) delete body.officeLocations;
      await usersApi.create(body);
      setForm({ name: '', email: '', password: '', role: 'employee', team: '', manager: '', officeLocations: [] });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    try {
      await usersApi.deactivate(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    }
  };

  const managers = users.filter((u) => ['manager', 'leadership', 'admin'].includes(u.role));
  const locName = Object.fromEntries(locations.map((l) => [l._id, l.name]));
  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <Card title="Create user">
        <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
          <input required type="password" placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inputCls}>
            <option value="employee">employee</option>
            <option value="manager">manager</option>
            <option value="leadership">leadership</option>
            <option value="admin">admin</option>
          </select>
          <select value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))} className={inputCls}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))} className={inputCls}>
            <option value="">No manager</option>
            {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
          <div className="md:col-span-3">
            <label className="block text-xs text-slate-500 mb-1">
              Assigned offices (WFO) — Ctrl/Cmd-click to select multiple
            </label>
            <select
              multiple
              value={form.officeLocations}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  officeLocations: [...e.target.selectedOptions].map((o) => o.value),
                }))
              }
              className={inputCls + ' w-full h-28'}
            >
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <button disabled={saving} className={btnCls}>{saving ? 'Creating…' : 'Create user'}</button>
          </div>
        </form>
      </Card>

      <Card title={`Users (${users.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Offices</th>
                <th className="py-2 pr-4">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-slate-50">
                  <td className="py-2 pr-4">{u.name}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4"><Badge tone={u.role === 'admin' ? 'high' : 'unknown'}>{u.role}</Badge></td>
                  <td className="py-2 pr-4 text-slate-500">
                    {(u.officeLocations || []).map((id) => locName[id] || '—').join(', ') || '—'}
                  </td>
                  <td className="py-2 pr-4">{u.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 text-right">
                    {u.isActive && (
                      <button onClick={() => deactivate(u._id)} className="text-red-600 text-xs hover:underline">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TeamsAdmin() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', manager: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([teamsApi.list(), usersApi.list()]);
      setTeams(t);
      setUsers(u);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { name: form.name };
      if (form.manager) body.manager = form.manager;
      await teamsApi.create(body);
      setForm({ name: '', manager: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const managers = users.filter((u) => ['manager', 'leadership', 'admin'].includes(u.role));
  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <Card title="Create team">
        <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
          <input required placeholder="Team name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          <select value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))} className={inputCls}>
            <option value="">No manager</option>
            {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
          <div><button disabled={saving} className={btnCls}>{saving ? 'Creating…' : 'Create team'}</button></div>
        </form>
      </Card>

      <Card title={`Teams (${teams.length})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Manager</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t._id} className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">{t.name}</td>
                <td className="py-2 pr-4">{t.manager?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function LocationsAdmin() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: '' });

  const load = async () => {
    setLoading(true);
    try {
      setLocations(await locationsApi.list({ includeInactive: true }));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await locationsApi.create({
        name: form.name,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters),
      });
      setForm({ name: '', latitude: '', longitude: '', radiusMeters: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    try {
      await locationsApi.deactivate(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <Card title="Create office location (geofence)">
        <form onSubmit={submit} className="grid md:grid-cols-4 gap-3">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          <input required placeholder="Latitude" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} className={inputCls} />
          <input required placeholder="Longitude" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} className={inputCls} />
          <input required placeholder="Radius (m)" value={form.radiusMeters} onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))} className={inputCls} />
          <div className="md:col-span-4"><button disabled={saving} className={btnCls}>{saving ? 'Creating…' : 'Create location'}</button></div>
        </form>
      </Card>

      <Card title={`Office locations (${locations.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Lat</th>
                <th className="py-2 pr-4">Lng</th>
                <th className="py-2 pr-4">Radius</th>
                <th className="py-2 pr-4">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l._id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{l.name}</td>
                  <td className="py-2 pr-4">{l.latitude}</td>
                  <td className="py-2 pr-4">{l.longitude}</td>
                  <td className="py-2 pr-4">{l.radiusMeters} m</td>
                  <td className="py-2 pr-4">{l.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 text-right">
                    {l.isActive && (
                      <button onClick={() => deactivate(l._id)} className="text-red-600 text-xs hover:underline">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}