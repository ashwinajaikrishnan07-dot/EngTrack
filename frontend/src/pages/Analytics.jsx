import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2, Clock, Zap, AlertTriangle, Users, Award, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Analytics() {
  const { isLead } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLead) return;
    
    const fetchAnalytics = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get('/issues/analytics');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        if (!silent) setError('Failed to load analytics data.');
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(() => fetchAnalytics(true), 60000);
    return () => clearInterval(interval);
  }, [isLead]);

  // Lead Guard
  if (!isLead) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 card border-red-200  text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          The Analytics dashboard contains sensitive team performance statistics and is only accessible by Team Leads.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 font-medium">Loading analytics details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-2">
        <AlertTriangle size={36} className="text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">{error || 'An error occurred'}</h2>
        <p className="text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-7xl mx-auto">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#1e3a5f]">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Deep analytics on issues performance, resolution rates, and team departments workload</p>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-[#4361ee] rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Average Close Time</p>
            <p className="text-3xl font-black text-gray-900 mt-1">
              {data.avg_time_to_close !== null ? `${data.avg_time_to_close}h` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Average from opened to resolved hours</p>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Fastest Resolution</p>
            <p className="text-3xl font-black text-gray-900 mt-1">
              {data.fastest_resolved?.[0] ? `${data.fastest_resolved[0].resolution_time_hours}h` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Top record resolved this month</p>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-500 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Overdue Issues</p>
            <p className="text-3xl font-black text-red-600 mt-1">
              {data.slowest_overdue?.length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Open issues older than 3 days</p>
          </div>
        </div>
      </div>

      {/* Issues Over Time Chart */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart2 size={18} className="text-[#4361ee]" />
          Issues Over Time (Past 30 Days)
        </h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.issues_over_time}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(tick) => tick.substring(5)}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e3a5f',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#f69050"
                strokeWidth={3}
                dot={{ stroke: '#f69050', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Created Issues"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fastest vs Overdue Double Column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fastest Resolved */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Award size={18} className="text-yellow-500" />
            Fastest Resolved Issues (Top 5)
          </h2>
          {data.fastest_resolved?.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No resolved issues found yet.</p>
          ) : (
            <div className="space-y-3">
              {data.fastest_resolved.map((issue, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="max-w-[70%]">
                    <span className="font-semibold text-xs text-gray-400 block font-mono">#{issue.issue_id}</span>
                    <span className="text-sm font-semibold text-gray-800 line-clamp-1">{issue.title}</span>
                  </div>
                  <div className="text-right">
                    <span className="badge bg-green-100 text-green-800 text-xs font-bold">
                      {issue.resolution_time_hours} hours
                    </span>
                    <span className="block text-[10px] text-gray-400 font-medium mt-0.5">by {issue.assignee}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slowest / Overdue (>3 days) */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <AlertTriangle size={18} className="text-red-500" />
            Slowest / Overdue Open Issues (&gt;3 Days)
          </h2>
          {data.slowest_overdue?.length === 0 ? (
            <p className="text-sm text-green-600 py-6 text-center font-semibold">🎉 All issues resolved within 3 days!</p>
          ) : (
            <div className="space-y-3">
              {data.slowest_overdue.slice(0, 5).map((issue, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-red-50/50 rounded-lg hover:bg-red-50 transition-colors border border-red-100/50">
                  <div className="max-w-[70%]">
                    <span className="font-semibold text-xs text-red-400 block font-mono">#{issue.issue_id}</span>
                    <span className="text-sm font-semibold text-gray-800 line-clamp-1">{issue.title}</span>
                  </div>
                  <div className="text-right">
                    <span className="badge bg-red-100 text-red-800 text-xs font-bold">
                      {issue.days_open} days open
                    </span>
                    <span className="block text-[10px] text-gray-400 font-medium mt-0.5">Assignee: {issue.assignee}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Per Member Stats Table */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users size={18} className="text-[#4361ee]" />
          Team Members Productivity Review
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#d1dce8] text-sm text-gray-500 font-semibold">
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3 text-center">Total Assigned</th>
                <th className="py-3 px-3 text-center">Resolved</th>
                <th className="py-3 px-3 text-center">In Progress</th>
                <th className="py-3 px-3 text-center">Avg Resolution Time</th>
                <th className="py-3 px-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1dce8] text-sm text-gray-800">
              {data.member_stats.map((member, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-4 px-3 font-semibold text-[#1e3a5f] flex items-center gap-2">
                    {member.name}
                    {member.role_tag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-700 uppercase">
                        {member.role_tag}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-center font-bold">{member.total_assigned}</td>
                  <td className="py-4 px-3 text-center text-green-600 font-semibold">{member.resolved}</td>
                  <td className="py-4 px-3 text-center text-yellow-600 font-semibold">{member.in_progress}</td>
                  <td className="py-4 px-3 text-center">
                    {member.avg_resolution_time !== null ? (
                      <span className="badge bg-purple-50 text-purple-700 font-bold">
                        {member.avg_resolution_time}h
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right text-xs text-gray-400 font-medium">{member.last_active || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per Team Department Stats */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          🗂️ Department Department metrics Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {data.team_stats.map((t, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-[#d1dce8] bg-gray-50 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Department
                </span>
                <span className="text-lg font-black text-[#1e3a5f] uppercase">
                  💻 {t.team}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-[10px] text-gray-400 block">Total</span>
                  <span className="text-sm font-bold text-gray-800">{t.total}</span>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-[10px] text-gray-400 block text-green-600">Resolved</span>
                  <span className="text-sm font-bold text-green-600">{t.resolved}</span>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-[10px] text-gray-400 block text-blue-600">Open</span>
                  <span className="text-sm font-bold text-blue-600">{t.open}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold">Avg Close</span>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  {t.avg_close_time !== null ? `${t.avg_close_time}h` : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
