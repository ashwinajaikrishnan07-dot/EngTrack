import React, { useState, useEffect } from 'react';
import { Send, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', normal: '#3b82f6', low: '#6b7280' };

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/analytics', { params: { days } })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  const handleSendEOD = async () => {
    setSending(true);
    try {
      await api.post('/reports/eod');
      toast.success('EOD report sent to TL');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const statusData = data?.byStatus?.map((s) => ({ name: s._id, value: s.count })) || [];
  const priorityData = data?.byPriority?.map((p) => ({ name: p._id, value: p.count, fill: PRIORITY_COLORS[p._id] })) || [];

  // Merge created and closed per day
  const allDates = new Set([
    ...(data?.createdPerDay || []).map((d) => d._id),
    ...(data?.closedPerDay || []).map((d) => d._id),
  ]);
  const trendData = Array.from(allDates).sort().map((date) => ({
    date: date.slice(5),
    created: data?.createdPerDay?.find((d) => d._id === date)?.count || 0,
    closed: data?.closedPerDay?.find((d) => d._id === date)?.count || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 ">Reports & Analytics</h1>
          <p className="text-sm text-gray-500  mt-0.5">Issue trends and team performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {user?.role === 'tl' && (
            <button onClick={handleSendEOD} disabled={sending} className="btn-primary">
              <Send size={14} />
              {sending ? 'Sending...' : 'Send EOD Report'}
            </button>
          )}
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend line chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900  mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" /> Issue Trend
          </h2>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} dot={false} name="Created" />
                <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} dot={false} name="Closed" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
          )}
        </div>

        {/* Status pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900  mb-4">Issues by Status</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority bar */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900  mb-4">Issues by Priority</h2>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Issues">
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>

        {/* Top assignees */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900  mb-4">Top Assignees (Open Issues)</h2>
          {data?.topAssignees?.length > 0 ? (
            <div className="space-y-3">
              {data.topAssignees.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900 ">{a.name}</span>
                      <span className="text-gray-500 ">{a.count} issues</span>
                    </div>
                    <div className="h-1.5 bg-gray-100  rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(a.count / (data.topAssignees[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No assigned issues</div>
          )}
        </div>
      </div>
    </div>
  );
}
