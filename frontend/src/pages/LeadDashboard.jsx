import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, RefreshCw, Copy, Send, X,
  Users, BarChart2, Sun, Moon, GitBranch, Plus, Bell,
  Clock, CheckCircle, LayoutDashboard, Settings as SettingsIcon, Menu, Brain, Download, AlertTriangle
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

import Settings from './Settings';
import Chat from './Chat';
import Analytics from './Analytics';
import Team from './Team';

function NetworkNodesIcon({ className = "w-5 h-5", size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="2.5" fill="currentColor" />
      <circle cx="5" cy="18" r="2.5" fill="currentColor" />
      <circle cx="19" cy="18" r="2.5" fill="currentColor" />
      <path d="M12 7.5v6" />
      <path d="M12 13.5H5.5V15.5" />
      <path d="M12 13.5h6.5v15.5" />
    </svg>
  );
}

function SeverityBadge({ severity }) {
  if (!severity) {
    return <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Unclassified</span>;
  }
  const map = {
    critical: { bg: 'bg-red-50 text-red-700 border border-red-200/60', dot: 'bg-[#E24B4A]', label: 'Urgent' },
    moderate: { bg: 'bg-yellow-50 text-yellow-800 border border-yellow-200/60', dot: 'bg-[#EF9F27]', label: 'Moderate' },
    low: { bg: 'bg-blue-50 text-[#4361ee] border border-[#4361ee]/20', dot: 'bg-[#639922]', label: 'Low' },
  };
  const { bg, dot, label } = map[severity] || { bg: 'bg-gray-50 text-gray-700 border border-gray-200', dot: 'bg-gray-400', label: severity };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function StatCard({ label, value, color, icon: Icon, borderLeftColor }) {
  return (
    <div className={`card p-4 transition-all flex flex-col justify-between ${borderLeftColor ? `border-l-2 ${borderLeftColor}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
        {Icon && <div className="text-gray-400"><Icon size={14} /></div>}
      </div>
      <p className={`text-xl font-bold mt-2 tracking-tight ${color}`}>{value ?? 0}</p>
    </div>
  );
}

function SeverityBreakdownChart({ stats }) {
  const critical = stats?.bySeverity?.critical || 0;
  const moderate = stats?.bySeverity?.moderate || 0;
  const low = stats?.bySeverity?.low || 0;
  const total = critical + moderate + low || 1;
  const items = [
    { label: 'Urgent', value: critical, pct: Math.round((critical / total) * 100), color: 'bg-red-500' },
    { label: 'Moderate', value: moderate, pct: Math.round((moderate / total) * 100), color: 'bg-[#f59e0b]' },
    { label: 'Low', value: low, pct: Math.round((low / total) * 100), color: 'bg-[#4361ee]' },
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-gray-500">{item.label}</span>
            <span className="text-gray-900 font-bold">{item.value} ({item.pct}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
            <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadDashboard() {
  const { user, logout, updateUser } = useAuth();
  const { dark, toggle, theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Teams/repositories state - fetch from backend
  const [teams, setTeams] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [addingRepo, setAddingRepo] = useState(false);

  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '', description: '', priority: 'normal', assignee_id: '', repository_id: ''
  });
  const [creatingIssue, setCreatingIssue] = useState(false);

  // Fetch teams/repos on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data } = await api.get('/team/repos');
        const fetchedTeams = data.teams || [];
        setTeams(fetchedTeams);
        // Set default selected repo to first team if available
        if (fetchedTeams.length > 0 && !selectedRepo) {
          setSelectedRepo(fetchedTeams[0]._id);
          setNewIssue(prev => ({ ...prev, repository_id: fetchedTeams[0]._id }));
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    };
    fetchTeams();
  }, []);

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!newIssue.title || !newIssue.repository_id) return toast.error('Title and Repository are required');
    setCreatingIssue(true);
    try {
      const { data } = await api.post('/issues/create/', newIssue);
      setIssues(prev => [data, ...prev]);
      toast.success('Issue created successfully!');
      setShowCreateIssueModal(false);
      setNewIssue({ ...newIssue, title: '', description: '', priority: 'normal', assignee_id: '' });
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create issue');
    } finally {
      setCreatingIssue(false);
    }
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = selectedRepo ? { repository: selectedRepo } : {};
      const [statsRes, issuesRes] = await Promise.all([
        api.get('/team/stats', { params }),
        api.get('/issues/?limit=100', { params }),
      ]);
      setStats(statsRes.data);
      setIssues(issuesRes.data.results || issuesRes.data.issues || []);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedRepo]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/issues/sync', { repository: selectedRepo });
      toast.success(`Synced: ${data.created} new, ${data.updated} updated`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'GitHub sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddRepo = async (e) => {
    e.preventDefault();
    if (!newRepoName.trim() || !newRepoName.includes('/')) {
      toast.error('Format must be owner/repository');
      return;
    }
    setAddingRepo(true);
    try {
      const { data } = await api.post('/team/repos', { githubRepo: newRepoName.trim() });
      // Add the new team to our local teams state
      if (data.team) {
        setTeams(prev => [...prev, data.team]);
        setSelectedRepo(data.team.id);
      }
      toast.success('Repository added successfully!');
      setShowAddRepoModal(false);
      setNewRepoName('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add repository');
    } finally {
      setAddingRepo(false);
    }
  };

  const fetchInvite = async () => {
    try {
      const { data } = await api.get('/team/invite-link', { params: { repository: selectedRepo } });
      setInviteData(data);
      setShowInvite(true);
    } catch (err) {
      toast.error('Failed to get invite link');
    }
  };

  const handleSendInvites = async () => {
    const emails = inviteEmails.split(/[ ,]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) { toast.error('Enter at least one email'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/team/send-invite', { emails, repository: selectedRepo });
      toast.success(data.message);
      setInviteEmails('');
    } catch (err) {
      toast.error('Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  const exportToExcel = () => {
    if (!issues || issues.length === 0) { toast.error('No issues to export'); return; }
    const headers = ['Issue Number', 'Title', 'Status', 'Severity', 'Classified Team', 'Created At', 'Closed At', 'Assignee/Resolved By', 'GitHub URL'];
    const rows = issues.map(issue => [
      `#${issue.issueId || ''}`,
      `"${(issue.title || '').replace(/"/g, '""')}"`,
      issue.workflowStatus || issue.status || 'open',
      issue.severity || 'unclassified',
      issue.classifiedTeam || 'unassigned',
      issue.openedAt ? new Date(issue.openedAt).toLocaleString() : issue.createdAt ? new Date(issue.createdAt).toLocaleString() : '',
      (issue.resolvedAt || issue.closedAt) ? new Date(issue.resolvedAt || issue.closedAt).toLocaleString() : '',
      issue.resolvedByUserId?.name || issue.assignee?.name || 'Unassigned',
      issue.githubUrl || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Issues_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel export downloaded successfully');
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      toast.error('Failed to mark read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all/');
      setNotifications([]);
      setShowNotifications(false);
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  useEffect(() => {
    fetchAll();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchAll(true);
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchNotifications]);

  // Refresh data when switching back to dashboard view
  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchAll(true);
    }
  }, [activeView, fetchAll]);

  const handleLogout = async () => { await logout(); window.location.href = '/login'; };

  const daysOpen = (d) => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0;

  const overdueCount = issues.filter((i) => {
    const days = daysOpen(i.openedAt || i.createdAt);
    return days >= 3 && i.workflowStatus !== 'resolved';
  }).length;

  const sortedIssues = [...issues].sort((a, b) => {
    const aResolved = a.workflowStatus === 'resolved' ? 1 : 0;
    const bResolved = b.workflowStatus === 'resolved' ? 1 : 0;
    if (aResolved !== bResolved) return aResolved - bResolved;
    return new Date(b.openedAt || b.createdAt) - new Date(a.openedAt || a.createdAt);
  });

  const recentlyClosedIssues = issues
    .filter(i => {
      const isClosed = i.workflowStatus === 'resolved' || i.status === 'closed';
      const closedAtStr = i.resolvedAt || i.closedAt;
      if (!isClosed || !closedAtStr) return false;
      const closedTime = new Date(closedAtStr).getTime();
      const diffMs = Date.now() - closedTime;
      const closedDate = new Date(closedAtStr);
      const today = new Date();
      const isSameDay = closedDate.getDate() === today.getDate() && closedDate.getMonth() === today.getMonth() && closedDate.getFullYear() === today.getFullYear();
      return isSameDay || diffMs < 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.resolvedAt || b.closedAt) - new Date(a.resolvedAt || a.closedAt))
    .slice(0, 5);

  const getClosedTimeAgo = (closedAtStr) => {
    if (!closedAtStr) return 'some time ago';
    const diffMs = Date.now() - new Date(closedAtStr);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'closed just now';
    if (diffMins < 60) return `closed ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `closed ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `closed ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getClosedBy = (issue) => issue.resolvedByUserId?.name || issue.closedBy?.name || issue.assignee?.name || 'GitHub';

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col pt-5">
        <div className="flex items-center gap-3 px-6 pb-6 border-b border-subtle">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-primary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700 }}>
              Gitora
            </div>
            <div className="text-gray-500" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '0.5px' }}>
              TEAM LEAD
            </div>
          </div>
        </div>

        <nav className="mt-6 px-3 space-y-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'team', label: 'Team Directory', icon: Users },
            { id: 'chat', label: 'AI Chat', icon: Brain },
            { id: 'analytics', label: 'Analytics', icon: BarChart2, tlOnly: true },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map((item) => {
            if (item.tlOnly && user?.role !== 'tl' && user?.role !== 'lead') return null;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${active
                    ? 'bg-input text-[#4da6ff]'
                    : 'text-secondary hover:bg-input hover:text-primary'
                  }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-subtle space-y-3 bg-card">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#4da6ff] flex items-center justify-center text-primary font-bold shadow-inner">
            {user?.name?.[0]?.toUpperCase() || 'L'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate leading-snug">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate capitalize leading-none mt-0.5">{user?.role_tag || 'Team Lead'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/30 transition-colors">
            <LogOut size={14} />
            <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app text-gray-200 transition-colors flex overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 bg-card flex-shrink-0 border-r border-subtle h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-card flex flex-col z-10 animate-slide-in">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-input">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <header className="lg:hidden bg-card text-primary px-4 py-3 flex items-center justify-between border-b border-subtle flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-input"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm tracking-wide text-primary">Gitora</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Mobile */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-transparent text-secondary border border-subtle rounded text-xs p-1 focus:outline-none"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeView === 'settings' && <Settings />}
          {activeView === 'chat' && <Chat />}
          {activeView === 'analytics' && <Analytics />}
          {activeView === 'team' && <Team />}

          {activeView === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-primary">Dashboard</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Track and manage your GitHub issues</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Repo Switcher */}
                  {teams.length > 1 && (
                    <select
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      className="bg-input text-primary border border-subtle rounded-lg text-sm px-3 py-2 font-medium focus:outline-none focus:border-[#4da6ff]"
                    >
                      {teams.map(team => (
                        <option key={team._id} value={team._id}>{team.githubRepo || team.name}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => setShowAddRepoModal(true)} className="flex items-center gap-1.5 bg-white border border-[#d1d5db] text-[#374151] px-[14px] py-[6px] rounded-[8px] text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors">
                    <Plus size={13} /> Add Repo
                  </button>
                  {/* Theme Switcher */}
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="bg-card text-secondary border border-subtle rounded-lg text-sm px-3 py-2 font-medium focus:outline-none focus:border-[#4da6ff] hidden sm:block"
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                    <option value="system">System Mode</option>
                  </select>
                  
                  {/* Notifications Dropdown */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative flex items-center justify-center p-2 rounded-lg bg-card hover:bg-input border border-subtle transition-colors text-secondary"
                    >
                      <Bell size={18} />
                      {notifications.length > 0 && (
                        <span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[#1f2937]">
                          {notifications.length > 99 ? '99+' : notifications.length}
                        </span>
                      )}
                    </button>
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-card border border-subtle rounded-xl shadow-2xl overflow-hidden z-50">
                        <div className="flex items-center justify-between p-3 border-b border-subtle bg-app">
                          <h3 className="font-bold text-sm text-primary">Notifications</h3>
                          {notifications.length > 0 && (
                            <button onClick={markAllAsRead} className="text-xs text-[#4da6ff] hover:text-[#3b82f6] font-medium">Mark all read</button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length > 0 ? (
                            notifications.map(n => (
                              <div key={n.id} onClick={() => markAsRead(n.id)} className="p-3 border-b border-subtle hover:bg-input cursor-pointer transition-colors group flex flex-col gap-1">
                                <p className="text-xs text-primary group-hover:text-[#4da6ff] line-clamp-3 leading-snug">{n.message}</p>
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {new Date(n.created_at).toLocaleString()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="p-6 text-center text-sm text-gray-500">No unread notifications</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={handleSync} disabled={syncing || !selectedRepo} className="flex items-center gap-1.5 bg-white border border-[#d1d5db] text-[#374151] px-[14px] py-[6px] rounded-[8px] text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <GitBranch size={13} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing...' : 'Sync GitHub'}
                  </button>
                  <button onClick={fetchAll} className="flex items-center gap-1.5 bg-white border border-[#d1d5db] text-[#374151] px-[14px] py-[6px] rounded-[8px] text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors" title="Refresh stats">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => setShowCreateIssueModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all">
                    <Plus size={13} /> Create Issue
                  </button>
                  <button onClick={fetchInvite} className="flex items-center gap-1.5 px-3 py-2 bg-[#4da6ff] hover:bg-[#3b82f6] text-primary text-xs font-semibold rounded-lg shadow-sm transition-all">
                    <Users size={13} /> Invite Team
                  </button>
                  <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-2 bg-green-900/50 hover:bg-green-800 text-green-100 text-xs font-semibold rounded-lg shadow-sm transition-all">
                    <Download size={13} /> Export Excel
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-24">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4da6ff]" />
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard label="Total Issues" value={stats?.totalIssues} color="text-primary" borderLeftColor="border-l-[#4da6ff]" icon={BarChart2} />
                    <StatCard label="Urgent" value={stats?.bySeverity?.critical} color="text-red-500" borderLeftColor="border-l-red-500" icon={AlertTriangle} />
                    <StatCard label="Moderate" value={stats?.bySeverity?.moderate} color="text-yellow-500" borderLeftColor="border-l-[#f59e0b]" icon={Clock} />
                    <StatCard label="Low" value={stats?.bySeverity?.low} color="text-[#4da6ff]" borderLeftColor="border-l-[#4da6ff]" icon={CheckCircle} />
                    <StatCard label="Resolved" value={stats?.byStatus?.resolved} color="text-green-500" borderLeftColor="border-l-green-500" icon={CheckCircle} />
                    <StatCard label="Overdue" value={overdueCount} color="text-red-500" borderLeftColor="border-l-red-500" icon={AlertTriangle} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 text-primary">
                          <GitBranch size={14} className="text-[#4da6ff]" />
                          Issues Directory
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#1e2a38] text-gray-400 rounded-full">{issues.length}</span>
                        </h3>
                      </div>

                      {issues.length === 0 ? (
                        <div className="card p-12 text-center border border-subtle bg-card">
                          <GitBranch size={30} className="mx-auto text-gray-700 mb-3" />
                          <p className="text-gray-400 text-xs font-semibold">No issues currently tracked</p>
                          <p className="text-gray-600 text-[10px] mt-1">Click "Sync GitHub" to retrieve issues from your configured repository.</p>
                          <button onClick={handleSync} disabled={syncing} className="mt-3 px-3 py-1.5 bg-[#4da6ff] hover:bg-[#3b82f6] text-primary text-[10px] font-semibold rounded-lg transition-all">
                            Sync GitHub Now
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sortedIssues.map((issue) => {
                            const days = daysOpen(issue.openedAt || issue.createdAt);
                            const timeAgoText = days === 0 ? 'today' : `${days}d ago`;
                            const borderMap = { critical: 'border-l-2 border-l-red-500', moderate: 'border-l-2 border-l-[#f59e0b]', low: 'border-l-2 border-l-[#4da6ff]' };
                            const borderClass = borderMap[issue.severity] || 'border-l-2 border-l-[#1e2a38]';
                            return (
                              <div
                                key={issue._id}
                                onClick={() => navigate(`/issues/${issue._id}`)}
                                className={`card bg-card border border-subtle ${borderClass} rounded-r-lg rounded-l-sm p-4 hover:border-[#4da6ff]/40 transition-all cursor-pointer flex flex-col justify-between min-h-[120px] group`}
                              >
                                <div>
                                  <div className="flex justify-between items-center text-[10px] text-gray-600 font-mono mb-1.5">
                                    <span>#{issue.issueId}</span>
                                    <span className="font-semibold text-gray-600">{timeAgoText}</span>
                                  </div>
                                  <h4 className="font-bold text-primary text-xs leading-snug line-clamp-2 mb-1.5 group-hover:text-[#4da6ff] transition-colors">{issue.title}</h4>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <SeverityBadge severity={issue.severity} />
                                  {issue.workflowStatus && (
                                    <span className={
                                      issue.workflowStatus === 'resolved' ? 'text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-green-900/20 text-green-400 border border-green-900/40' :
                                      issue.workflowStatus === 'in_progress' ? 'text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-900/20 text-[#4da6ff] border border-[#4da6ff]/10' :
                                      'bg-[#E6F1FB] text-[#185FA5] border border-[#B5D4F4] rounded-[20px] text-[11px] font-medium px-[10px] py-[3px] uppercase tracking-wider'
                                    }>
                                      {issue.workflowStatus.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-8">
                      <div className="card p-4 space-y-3 bg-card border border-subtle">
                        <h3 className="font-bold text-xs flex items-center gap-2 text-primary">
                          <BarChart2 size={14} className="text-[#4da6ff]" /> Severity Distribution
                        </h3>
                        <SeverityBreakdownChart stats={stats} />
                      </div>

                      <div className="card overflow-hidden bg-card border border-subtle">
                        <div className="px-4 py-3 border-b border-subtle bg-card">
                          <h3 className="font-bold text-xs flex items-center gap-2 text-primary">
                            <Users size={14} className="text-[#4da6ff]" /> Team Leaderboard
                          </h3>
                        </div>
                        <div className="p-3 space-y-2">
                          {(stats?.memberStats || []).sort((a, b) => b.issuesResolved - a.issuesResolved).map((m, i) => (
                            <div key={m.name} className="flex items-center gap-2 p-2 rounded-xl bg-app border border-subtle">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-500 text-primary' : 'bg-[#1e2a38] text-gray-400'}`}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-primary truncate">{m.name}</p>
                                {m.avgResolutionTime && <p className="text-[10px] text-gray-500 font-medium">avg: {m.avgResolutionTime}h</p>}
                              </div>
                              <span className="text-[10px] font-bold text-[#4da6ff] bg-[#4da6ff]/10 px-2 py-0.5 rounded-md">{m.issuesResolved} solved</span>
                            </div>
                          ))}
                          {(!stats?.memberStats?.length) && <p className="text-center text-gray-600 text-[10px] py-4">No team activity recorded.</p>}
                        </div>
                      </div>

                      <div className="card overflow-hidden bg-card border border-subtle">
                        <div className="px-4 py-3 border-b border-subtle bg-card">
                          <h3 className="font-bold text-xs flex items-center gap-2 text-primary">
                            <CheckCircle size={14} className="text-[#4da6ff]" /> Recently Closed
                          </h3>
                        </div>
                        <div className="p-3 space-y-2">
                          {recentlyClosedIssues.length > 0 ? (
                            recentlyClosedIssues.map((issue) => (
                              <div key={issue._id} style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px' }} className="flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 style={{ color: '#111827', fontSize: '13px', fontWeight: 500 }} className="line-clamp-2 leading-snug">{issue.title}</h4>
                                  <span style={{ background: '#1f2937', color: '#ffffff', fontSize: '11px', padding: '2px 7px', borderRadius: '4px' }} className="font-mono flex-shrink-0">#{issue.issueId}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{getClosedTimeAgo(issue.resolvedAt || issue.closedAt)}</span>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px' }} className="uppercase tracking-wider">
                                    by {getClosedBy(issue)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-gray-400 text-[10px] py-4">No issues closed recently.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showInvite && inviteData && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">Invite Team Members</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-center border border-[#d1dce8]">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Invite Code</p>
              <p className="text-3xl font-black text-[#f69050] font-mono tracking-widest mt-1">{inviteData.inviteCode}</p>
              <button onClick={() => { navigator.clipboard.writeText(inviteData.signupUrl); toast.success('Signup link copied!'); }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4361ee] hover:text-[#324ad1] transition-colors p-1 px-2 bg-[#4361ee]/5 rounded-md">
                <Copy size={12} /> Copy registration link
              </button>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Recipient Emails</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4361ee] resize-none transition-all"
              rows={3} placeholder="developer@company.com, support@company.com"
              value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)}
            />
            <button onClick={handleSendInvites} disabled={sending}
              className="mt-4 w-full py-3 bg-[#4361ee] hover:bg-[#324ad1] text-primary text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
              <Send size={14} /> {sending ? 'Sending Invites...' : 'Send Invitations'}
            </button>
          </div>
        </div>
      )}

      {showAddRepoModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">Add Repository</h3>
              <button onClick={() => setShowAddRepoModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddRepo}>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Repository Name</label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4361ee] transition-all text-gray-900"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={addingRepo || !newRepoName}
                className="w-full py-3 bg-[#4da6ff] hover:bg-[#3b8fe8] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shadow-sm">
                {addingRepo ? 'Adding...' : 'Add Repository'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCreateIssueModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-subtle overflow-hidden">
            <div className="p-5 border-b border-subtle flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Create New Issue</h3>
              <button onClick={() => setShowCreateIssueModal(false)} className="text-gray-400 hover:text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateIssue} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Repository *</label>
                <select
                  value={newIssue.repository_id}
                  onChange={(e) => setNewIssue({ ...newIssue, repository_id: e.target.value })}
                  className="w-full bg-input text-primary border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da6ff]"
                  required
                >
                  <option value="">Select a repository</option>
                  {teams.map(team => (
                    <option key={team._id} value={team._id}>{team.githubRepo || team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="w-full bg-input text-primary border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da6ff]"
                  placeholder="e.g., Bug: Login button unresponsive"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Description</label>
                <textarea
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  className="w-full bg-input text-primary border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da6ff] h-24 resize-none"
                  placeholder="Provide context or steps to reproduce..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Severity</label>
                  <select
                    value={newIssue.priority}
                    onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                    className="w-full bg-input text-primary border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da6ff]"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Assignee</label>
                  <select
                    value={newIssue.assignee_id}
                    onChange={(e) => setNewIssue({ ...newIssue, assignee_id: e.target.value })}
                    className="w-full bg-input text-primary border border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4da6ff]"
                  >
                    <option value="">Unassigned</option>
                    {stats?.memberStats?.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateIssueModal(false)} className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creatingIssue} className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {creatingIssue ? <RefreshCw size={14} className="animate-spin" /> : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}