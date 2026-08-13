import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import CreateIssueModal from '../components/CreateIssueModal';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, valueColor, subLabel }) => (
  <div className="bg-white flex flex-col" style={{ borderRadius: '10px', border: '0.5px solid #E2E8F0', padding: '14px 16px' }}>
    <span className="text-gray-500 uppercase tracking-wide font-medium" style={{ fontSize: '11px' }}>{label}</span>
    <span className="font-medium mt-1" style={{ fontSize: '22px', color: valueColor || '#111827' }}>{value}</span>
    {subLabel && <span className="text-gray-400 mt-1" style={{ fontSize: '11px' }}>{subLabel}</span>}
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, issuesRes] = await Promise.all([
        api.get('/issues/stats'),
        api.get('/issues', { params: { ...filters, limit: 50 } }),
      ]);
      setStats(statsRes.data);
      setIssues(issuesRes.data.issues);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/issues/sync');
      toast.success(`Synced: ${data.created} new, ${data.updated} updated`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleIssueCreated = (issue) => {
    setIssues((prev) => [issue, ...prev]);
    fetchData();
  };

  const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return { bg: '#DBEAFE', text: '#1E40AF', label: 'Open' };
      case 'in progress':
      case 'in-progress': return { bg: '#FEF3C7', text: '#92400E', label: 'In Progress' };
      case 'closed': return { bg: '#D1FAE5', text: '#065F46', label: 'Closed' };
      default: return { bg: '#F3F4F6', text: '#374151', label: status || 'Unknown' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#2563EB' }} />
      </div>
    );
  }

  const totalIssues = (stats.open || 0) + (stats.inProgress || 0) + (stats.closed || 0);

  return (
    <div style={{ padding: '20px 24px' }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage your GitHub issues</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn-secondary" style={{ borderRadius: '8px' }}>
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync GitHub'}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ borderRadius: '8px' }}>
            <Plus size={16} />
            New Issue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '12px' }}>
        <StatCard label="Total" value={totalIssues} valueColor="#111827" subLabel="All tracked issues" />
        <StatCard label="Open" value={stats.open || 0} valueColor="#2563EB" subLabel="Needs attention" />
        <StatCard label="In Progress" value={stats.inProgress || 0} valueColor="#D97706" subLabel="Currently working" />
        <StatCard label="Closed" value={stats.closed || 0} valueColor="#059669" subLabel="Resolved issues" />
      </div>

      {/* Filters */}
      <div className="bg-white flex flex-col sm:flex-row gap-3" style={{ borderRadius: '10px', border: '0.5px solid #E2E8F0', padding: '16px' }}>
        <input
          className="input flex-1"
          placeholder="Search issues..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select
          className="input sm:w-40"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="input sm:w-40"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        {(filters.status || filters.priority || filters.search) && (
          <button
            onClick={() => setFilters({ status: '', priority: '', search: '' })}
            className="btn-secondary whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Issues Table */}
      <div className="bg-white overflow-hidden" style={{ borderRadius: '10px', border: '0.5px solid #E2E8F0' }}>
        {issues.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No issues found</p>
            <p className="text-sm text-gray-400 mt-1">
              Try syncing from GitHub or create a new issue
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
              <Plus size={16} /> Create Issue
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {issues.map((issue, index) => {
              const statusStyle = getStatusStyles(issue.status);
              return (
                <div 
                  key={issue._id} 
                  className="flex items-center" 
                  style={{ 
                    padding: '11px 16px', 
                    borderBottom: index === issues.length - 1 ? 'none' : '0.5px solid #E2E8F0' 
                  }}
                >
                  <div className="text-gray-500 font-medium truncate" style={{ fontSize: '12px', minWidth: '52px' }}>
                    #{issue.githubId || issue._id.substring(0, 4)}
                  </div>
                  <div className="flex-1 text-gray-900 truncate mx-3" style={{ fontSize: '14px' }}>
                    {issue.title}
                  </div>
                  <div className="flex-shrink-0 mx-3">
                    <span 
                      className="inline-flex items-center font-medium"
                      style={{ 
                        backgroundColor: statusStyle.bg, 
                        color: statusStyle.text, 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px' 
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                  <div className="text-gray-500 text-right truncate" style={{ fontSize: '12px', minWidth: '80px' }}>
                    {issue.assignee?.name || 'Unassigned'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateIssueModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleIssueCreated}
      />
    </div>
  );
}
