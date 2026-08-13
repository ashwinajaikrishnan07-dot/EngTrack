import React, { useState, useEffect } from 'react';
import { Mail, Clock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTeamMembers = async () => {
    try {
      const { data } = await api.get('/team/members');
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
      toast.error('Failed to load team statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeamMembers(); }, []);

  const getRoleBadge = (roleTag) => {
    switch (roleTag) {
      case 'frontend': return <span className="badge bg-blue-100 text-blue-800">💻 Frontend</span>;
      case 'backend': return <span className="badge bg-purple-100 text-purple-800">⚙️ Backend</span>;
      case 'devops': return <span className="badge bg-blue-100 text-blue-800">🚀 DevOps</span>;
      case 'fullstack': return <span className="badge bg-green-100 text-green-800">🌐 Full Stack</span>;
      default: return <span className="badge bg-gray-100 text-gray-800">🛠️ Member</span>;
    }
  };

  const getStatusBadge = (workflowStatus, status) => {
    const s = workflowStatus || status;
    if (s === 'resolved' || s === 'closed') return <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-blue-50 text-blue-700">RESOLVED</span>;
    if (s === 'in_progress' || s === 'in-progress') return <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-yellow-50 text-yellow-700">IN PROGRESS</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-red-50 text-red-700">OPEN</span>;
  };

  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'critical': return '🔴 Urgent';
      case 'moderate': return '🟡 Moderate';
      case 'low': return '🔵 Low';
      default: return '⚪ Normal';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-extrabold text-[#1e3a5f]">Team Directory</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.role === 'lead' || user?.role === 'tl'
            ? "View comprehensive performance metrics and live work logs for all developers"
            : "Review your personal workload metrics and recent tickets details"
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map((m) => {
          const stats = m.stats || { totalAssigned: 0, resolved: 0, inProgress: 0, open: 0, avgResolutionHours: null };
          const resolveRate = stats.totalAssigned > 0 ? Math.round((stats.resolved / stats.totalAssigned) * 100) : 0;

          return (
            <div key={m.id} className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4361ee] to-indigo-600 flex items-center justify-center text-primary font-bold text-lg">
                      {m.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base">{m.name}</h3>
                      <p className="text-xs text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                        <Mail size={11} /> {m.email}
                      </p>
                    </div>
                  </div>
                  {getRoleBadge(m.role_tag)}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center my-5 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div><span className="text-[10px] text-gray-400 font-bold block">TOTAL</span><span className="text-base font-extrabold text-[#1e3a5f]">{stats.totalAssigned}</span></div>
                  <div><span className="text-[10px] text-gray-400 font-bold block text-blue-600">RESOLVED</span><span className="text-base font-extrabold text-blue-600">{stats.resolved}</span></div>
                  <div><span className="text-[10px] text-gray-400 font-bold block text-yellow-600">PROGRESS</span><span className="text-base font-extrabold text-yellow-600">{stats.inProgress}</span></div>
                  <div><span className="text-[10px] text-gray-400 font-bold block text-red-500">OPEN</span><span className="text-base font-extrabold text-red-500">{stats.open}</span></div>
                </div>

                <div className="space-y-1.5 mb-5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Resolve Rate</span>
                    <span className="text-[#4361ee]">{resolveRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-[#4361ee] h-full rounded-full transition-all duration-300" style={{ width: `${resolveRate}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold py-2 border-t border-b border-gray-100 mb-5">
                  <span className="text-gray-400 flex items-center gap-1"><Clock size={12} /> Avg Resolution</span>
                  <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-black">
                    {stats.avgResolutionHours !== null ? `${stats.avgResolutionHours}h` : 'N/A'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Recent Assigned Issues</h4>
                  {(!stats.lastIssues || stats.lastIssues.length === 0) ? (
                    <p className="text-xs text-gray-400 py-3 italic">No recent issues assigned.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.lastIssues.map((issue, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded border border-[#d1dce8] hover:bg-gray-50 transition-colors">
                          <div className="max-w-[70%]">
                            <span className="font-mono text-[9px] font-bold text-[#1e3a5f] block">#{issue.issue_id}</span>
                            <span className="text-xs text-gray-700 font-semibold line-clamp-1">{issue.title}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(issue.workflow_status, issue.status)}
                            <span className="text-[9px] font-bold text-gray-400">{getSeverityColor(issue.severity)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-semibold text-right">
                Last Active: {stats.lastActive || 'N/A'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}