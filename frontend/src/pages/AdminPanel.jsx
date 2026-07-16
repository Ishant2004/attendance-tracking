import { useEffect, useState } from 'react';
import { usersApi } from '../api/users';
import { teamsApi } from '../api/teams';
import { locationsApi } from '../api/locations';
import { holidaysApi } from '../api/holidays';
import { Card, Badge, Spinner, Select, PasswordInput, MultiSelect } from '../components/ui';
import LocationPickerModal from '../components/LocationPickerModal';
import { useAuth } from '../auth/AuthContext';

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btnCls =
  'rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60';

const TABS = ['Users', 'Teams', 'Office Locations', 'Holidays'];

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
      {tab === 'Holidays' && <HolidaysAdmin />}
    </div>
  );
}

function HolidaysAdmin() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const load = async () => {
    setLoading(true);
    try {
      setHolidays(await holidaysApi.list({ includeInactive: true }));
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
      await holidaysApi.create({ date: form.date, name: form.name });
      setForm({ date: '', name: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await holidaysApi.remove(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <Card title="Add holiday">
        <form onSubmit={submit} className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date</label>
            <input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls + ' w-full'} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input required placeholder="e.g. Diwali" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls + ' w-full'} />
          </div>
          <div><button disabled={saving} className={btnCls}>{saving ? 'Adding…' : 'Add holiday'}</button></div>
        </form>
      </Card>

      <Card title={`Holidays (${holidays.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h._id} className="border-b border-slate-50">
                  <td className="py-2 pr-4">{h.date}</td>
                  <td className="py-2 pr-4">{h.name}</td>
                  <td className="py-2 pr-4">{h.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 text-right">
                    {h.isActive && (
                      <button onClick={() => remove(h._id)} className="text-red-600 text-xs hover:underline">
                        Delete
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

function UsersAdmin() {
  const { user: me } = useAuth();
  const myId = me._id || me.id;
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
          <PasswordInput required placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="employee">employee</option>
            <option value="manager">manager</option>
            <option value="leadership">leadership</option>
            <option value="admin">admin</option>
          </Select>
          <Select value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </Select>
          <Select value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))}>
            <option value="">No manager</option>
            {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </Select>
          <div className="md:col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Assigned offices (WFO)</label>
            <MultiSelect
              options={locations.map((l) => ({ value: l._id, label: l.name }))}
              selected={form.officeLocations}
              onChange={(vals) => setForm((f) => ({ ...f, officeLocations: vals }))}
              placeholder="Select offices…"
            />
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
                    {u._id === myId ? (
                      <span className="text-xs text-slate-400">You</span>
                    ) : (
                      u.isActive && (
                        <button onClick={() => deactivate(u._id)} className="text-red-600 text-xs hover:underline">
                          Deactivate
                        </button>
                      )
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
  const [form, setForm] = useState({ name: '', managers: [] });
  const [editId, setEditId] = useState(null);
  const [editManagers, setEditManagers] = useState([]);

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

  const managers = users.filter((u) => ['manager', 'leadership'].includes(u.role));
  const managerName = Object.fromEntries(users.map((u) => [u._id, u.name]));
  const managerOptions = managers.map((m) => ({ value: m._id, label: `${m.name} (${m.role})` }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.managers.length) return setError('Select at least one manager');
    setSaving(true);
    try {
      await teamsApi.create({ name: form.name, managers: form.managers });
      setForm({ name: '', managers: [] });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t) => {
    setError('');
    setEditId(t._id);
    setEditManagers((t.managers || []).map((m) => m._id || m));
  };
  const saveEdit = async (id) => {
    if (!editManagers.length) return setError('A team needs at least one manager');
    try {
      await teamsApi.update(id, { managers: editManagers });
      setEditId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Update failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <Card title="Create team">
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            placeholder="Team name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls + ' w-full md:w-1/2'}
          />
          <div className="md:w-1/2">
            <label className="block text-xs text-slate-500 mb-1">Managers (at least one)</label>
            <MultiSelect
              options={managerOptions}
              selected={form.managers}
              onChange={(vals) => setForm((f) => ({ ...f, managers: vals }))}
              placeholder="Select managers…"
            />
          </div>
          <button disabled={saving} className={btnCls}>{saving ? 'Creating…' : 'Create team'}</button>
        </form>
      </Card>

      <Card title={`Teams (${teams.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Managers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t._id} className="border-b border-slate-50 align-top">
                  <td className="py-2 pr-4 font-medium text-slate-700">{t.name}</td>
                  <td className="py-2 pr-4">
                    {editId === t._id ? (
                      <div className="min-w-[16rem]">
                        <MultiSelect
                          options={managerOptions}
                          selected={editManagers}
                          onChange={setEditManagers}
                          placeholder="Select managers…"
                        />
                      </div>
                    ) : (
                      (t.managers || []).map((m) => m.name || managerName[m] || '—').join(', ') || '—'
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    {editId === t._id ? (
                      <span className="flex gap-3 justify-end">
                        <button onClick={() => saveEdit(t._id)} className="text-indigo-600 text-xs hover:underline">Save</button>
                        <button onClick={() => setEditId(null)} className="text-slate-500 text-xs hover:underline">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => startEdit(t)} className="text-indigo-600 text-xs hover:underline">Edit managers</button>
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

function LocationsAdmin() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: '' });
  const [showMap, setShowMap] = useState(false);

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
          <div className="md:col-span-4 flex items-center gap-3">
            <button disabled={saving} className={btnCls}>{saving ? 'Creating…' : 'Create location'}</button>
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              📍 Choose location
            </button>
          </div>
        </form>
      </Card>

      {showMap && (
        <LocationPickerModal
          initial={{ latitude: form.latitude, longitude: form.longitude }}
          onPick={({ latitude, longitude }) => {
            setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }));
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

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