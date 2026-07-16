import { useEffect, useState, useCallback } from 'react';
import { teamsApi } from '../api/teams';
import { dashboardApi } from '../api/dashboard';
import { flagsApi } from '../api/flags';
import { Card, Badge, Spinner, Stat, Select } from '../components/ui';

export default function TeamDashboard() {
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [data, setData] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Which teams does this manager manage?
  useEffect(() => {
    (async () => {
      try {
        const t = await teamsApi.managed();
        setTeams(t);
        if (t.length) setTeamId(t[0]._id);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load teams');
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [d, f] = await Promise.all([dashboardApi.team(teamId), flagsApi.forTeam(teamId)]);
      setData(d);
      setFlags(f);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id) => {
    try {
      await flagsApi.resolve(id);
      setFlags((fs) => fs.map((f) => (f._id === id ? { ...f, resolved: true } : f)));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to resolve');
    }
  };

  if (loadingTeams) return <Spinner />;

  if (!teams.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Team</h1>
        <div className="rounded bg-amber-50 text-amber-700 text-sm px-3 py-2">
          You don’t manage any team yet. Ask an admin to add you as a manager of a team.
        </div>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Team</h1>
          {teams.length > 1 ? (
            <div className="w-56">
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </Select>
            </div>
          ) : (
            <span className="text-lg text-slate-600">— {teams[0].name}</span>
          )}
        </div>
        {data && <span className="text-sm text-slate-500">{data.memberCount} members · last 30 days</span>}
      </div>

      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="WFO days" value={s.WFO} />
            <Stat label="WFH days" value={s.WFH} />
            <Stat label="Absent" value={s.Absent} />
            <Stat label="Late arrivals" value={s.lateCount} />
            <Stat label="WFO ratio" value={`${Math.round(s.wfoRatio * 100)}%`} />
            <Stat label="Avg hours" value={s.avgHours} />
            <Stat label="Present days" value={s.presentDays} />
            <Stat label="Open flags" value={data.openFlags} />
          </div>

          <Card title="Members">
            {data.members.length === 0 ? (
              <p className="text-sm text-slate-500">No members.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Present</th>
                      <th className="py-2 pr-4">WFO</th>
                      <th className="py-2 pr-4">WFH</th>
                      <th className="py-2 pr-4">Absent</th>
                      <th className="py-2 pr-4">Late</th>
                      <th className="py-2 pr-4">WFO ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.user.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4">
                          <div className="font-medium text-slate-700">{m.user.name}</div>
                          <div className="text-xs text-slate-400">{m.user.email}</div>
                        </td>
                        <td className="py-2 pr-4">{m.summary.presentDays}</td>
                        <td className="py-2 pr-4">{m.summary.WFO}</td>
                        <td className="py-2 pr-4">{m.summary.WFH}</td>
                        <td className="py-2 pr-4">{m.summary.Absent}</td>
                        <td className="py-2 pr-4">{m.summary.lateCount}</td>
                        <td className="py-2 pr-4">{Math.round(m.summary.wfoRatio * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Team flags">
            {flags.length === 0 ? (
              <p className="text-sm text-slate-500">No flags 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {flags.map((f) => (
                  <li key={f._id} className="flex items-center gap-3 py-2 text-sm">
                    <Badge tone={f.severity}>{f.severity}</Badge>
                    <span className="font-medium text-slate-700">{f.flagType.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500">{f.user?.name}</span>
                    <span className="text-slate-400 text-xs">{f.details ? JSON.stringify(f.details) : ''}</span>
                    <div className="ml-auto">
                      {f.resolved ? (
                        <span className="text-green-600 text-xs">resolved</span>
                      ) : (
                        <button
                          onClick={() => resolve(f._id)}
                          className="rounded bg-indigo-600 text-white px-3 py-1 text-xs hover:bg-indigo-700"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
