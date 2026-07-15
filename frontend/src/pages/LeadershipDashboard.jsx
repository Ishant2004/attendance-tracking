import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { dashboardApi } from '../api/dashboard';
import { Card, Spinner, Stat } from '../components/ui';

const fmtDay = (d) => (d ? d.slice(5) : d); // 'YYYY-MM-DD' -> 'MM-DD'

export default function LeadershipDashboard() {
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [d, t] = await Promise.all([dashboardApi.leadership(), dashboardApi.trends()]);
        setData(d);
        setSeries(t.series || []);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>;

  const org = data.org;
  const trendData = series.map((s) => ({ ...s, day: fmtDay(s.date) }));
  const teamBars = data.teams.map((t) => ({
    name: t.team.name,
    WFO: t.summary.WFO,
    WFH: t.summary.WFH,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Organization</h1>
        <span className="text-sm text-slate-500">{data.totalUsers} users · last 30 days</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="WFO days" value={org.WFO} />
        <Stat label="WFH days" value={org.WFH} />
        <Stat label="Absent" value={org.Absent} />
        <Stat label="Late arrivals" value={org.lateCount} />
        <Stat label="WFO ratio" value={`${Math.round(org.wfoRatio * 100)}%`} />
        <Stat label="Avg hours" value={org.avgHours} />
        <Stat label="Present days" value={org.presentDays} />
        <Stat label="Open flags" value={data.openFlags} />
      </div>

      <Card title="Attendance trend">
        {trendData.length === 0 ? (
          <p className="text-sm text-slate-500">No data in range.</p>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="WFO" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="WFH" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Absent" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="late" name="Late" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Team comparison (WFO vs WFH)">
        {teamBars.length === 0 ? (
          <p className="text-sm text-slate-500">No teams.</p>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={teamBars} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="WFO" fill="#16a34a" />
                <Bar dataKey="WFH" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Teams">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4">Members</th>
                <th className="py-2 pr-4">Present</th>
                <th className="py-2 pr-4">WFO</th>
                <th className="py-2 pr-4">WFH</th>
                <th className="py-2 pr-4">Absent</th>
                <th className="py-2 pr-4">Late</th>
                <th className="py-2 pr-4">WFO ratio</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((t) => (
                <tr key={t.team.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{t.team.name}</td>
                  <td className="py-2 pr-4">{t.memberCount}</td>
                  <td className="py-2 pr-4">{t.summary.presentDays}</td>
                  <td className="py-2 pr-4">{t.summary.WFO}</td>
                  <td className="py-2 pr-4">{t.summary.WFH}</td>
                  <td className="py-2 pr-4">{t.summary.Absent}</td>
                  <td className="py-2 pr-4">{t.summary.lateCount}</td>
                  <td className="py-2 pr-4">{Math.round(t.summary.wfoRatio * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}