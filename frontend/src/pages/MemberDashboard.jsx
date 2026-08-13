import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LogOut, RefreshCw, CheckCircle, Users,
  Play, GitBranch, LayoutDashboard, Settings as SettingsIcon, Menu, X, Brain, Wrench
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

import Settings from './Settings';
import Chat from './Chat';
import Team from './Team';



function SeverityBadge({ severity }) {
  if (!severity) {
    return (
      <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
        Unclassified
      </span>
    );
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

function StatCard({ label, value, color, borderLeftColor }) {
  return (
    <div className={`card bg-white dark:bg-[#111111] p-4 transition-all flex flex-col justify-between border-subtle dark:border-[#222222] ${borderLeftColor ? `border-l-2 ${borderLeftColor}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 dark:text-[#a0a0a0] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-bold mt-2 tracking-tight ${color} dark:text-white`}>{value ?? 0}</p>
    </div>
  );
}

export default function MemberDashboard() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [repositories, setRepositories] = useState(user?.repositories || []);
  const [selectedRepo, setSelectedRepo] = useState(
    user?.repositories?.[0]?.id || ''
  );
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  const detailRef = useRef(null);

  const handleIssueClick = (issueId) => {
    setSelectedIssueId(issueId);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const fetchRepos = useCallback(async () => {
    try {
      // Members don't list repos - they're already assigned to a team
      // Use the team info from the user object instead
      if (user?.teamId) {
        // Member is part of a team - fetch issues directly
        setRepositories([{ id: user.teamId, name: user.team?.name || 'My Team' }]);
        setSelectedRepo(user.teamId);
      } else {
        setRepositories([]);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [user?.teamId, user?.team?.name]);

  const handleJoinRepo = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return toast.error('Invite code is required');
    setJoining(true);
    try {
      // Members join teams via the registration process, not by joining repos
      // This modal should redirect to register with the invite code
      toast.error('To join a new team, please register with the invite code at /register/lead');
      setShowJoinModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join repository');
    } finally {
      setJoining(false);
    }
  };

  const fetchIssues = useCallback(async (silent = false) => {
    if (!selectedRepo) return;
    if (!silent) setLoading(true);
    try {
      const params = { classifiedTeam: user?.roleTag, limit: 50, repository: selectedRepo };
      
      const { data } = await api.get('/issues/', { params });
      const items = data.results || data.issues || [];
      setIssues(items);
      if (!silent) {
        const unresolved = items.filter(i => i.workflowStatus !== 'resolved');
        if (unresolved.length > 0) {
          setSelectedIssueId(unresolved[0]._id);
        } else if (items.length > 0) {
          setSelectedIssueId(items[0]._id);
        }
      }
    } catch (err) {
      toast.error('Failed to load issues');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.roleTag, selectedRepo]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  useEffect(() => {
    if (!selectedRepo) return;
    fetchIssues();
    const interval = setInterval(() => fetchIssues(true), 60000);
    return () => clearInterval(interval);
  }, [fetchIssues, selectedRepo]);

  const updateStatus = async (issueId, status) => {
    setUpdating(issueId);
    try {
      await api.patch(`/issues/${issueId}/status`, { status });
      toast.success(`Marked as ${status.replace('_', ' ')}`);
      setIssues((prev) => prev.map((i) => i._id === issueId ? { ...i, workflowStatus: status } : i));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const daysOpen = (d) => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0;

  const isToday = (d) => {
    if (!d) return false;
    const date = new Date(d);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const handleLogout = async () => { await logout(); window.location.href = '/login'; };

  const totalCount = issues.length;
  const inProgCount = issues.filter((i) => i.workflowStatus === 'in_progress').length;
  const resolvedCount = issues.filter((i) => i.workflowStatus === 'resolved').length;
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

  const filteredIssues = sortedIssues.filter((issue) => {
    const unresolved = issue.workflowStatus !== 'resolved';
    if (activeFilter === 'All') return unresolved;
    if (activeFilter === 'Urgent') return issue.severity === 'critical' && unresolved;
    if (activeFilter === 'Moderate') return issue.severity === 'moderate' && unresolved;
    if (activeFilter === 'Low') return issue.severity === 'low' && unresolved;
    if (activeFilter === 'Open') return (issue.workflowStatus === 'open' || issue.workflowStatus === 'in_progress') && unresolved;
    if (activeFilter === 'Resolved') return issue.workflowStatus === 'resolved';
    if (activeFilter === 'Today') return isToday(issue.openedAt || issue.createdAt) && unresolved;
    return true;
  });

  const selectedIssue = issues.find(i => i._id === selectedIssueId);

  const roleEmojiMap = {
    frontend: '💻 Frontend',
    backend: '⚙️ Backend',
    devops: '🚀 DevOps',
    fullstack: '🌐 Fullstack',
  };
  const roleBadgeText = roleEmojiMap[user?.roleTag] || '🛠️ Member';

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col pt-5">
        <div className="flex items-center gap-3 px-6 pb-6 border-b border-subtle dark:border-[#222222]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-primary dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700 }}>
              Gitora
            </div>
            <div className="text-gray-500 dark:text-[#a0a0a0]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '10px', fontWeight: 500, letterSpacing: '0.5px' }}>
              DEVELOPER
            </div>
          </div>
        </div>

        <nav className="mt-6 px-3 space-y-1.5">
          {[
            { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
            { id: 'team', label: 'Team Metrics', icon: Users },
            { id: 'chat', label: 'AI Chat', icon: Brain },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${active
                    ? 'bg-input dark:bg-[#111111] text-[#4da6ff]'
                    : 'text-secondary dark:text-[#a0a0a0] hover:bg-input dark:hover:bg-[#111111] hover:text-primary dark:hover:text-white'
                  }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-subtle dark:border-[#222222] space-y-3 bg-card dark:bg-black">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#4da6ff] flex items-center justify-center text-primary dark:text-white font-bold shadow-inner">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary dark:text-white truncate leading-snug">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 dark:text-[#a0a0a0] truncate capitalize leading-none mt-0.5">{user?.role_tag || 'Member'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold hover:bg-input text-red-500 transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${theme === 'dark' ? 'dark' : ''} bg-app dark:bg-black`}>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-card dark:bg-black border-r border-subtle dark:border-[#222222] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-card dark:bg-black flex flex-col z-10 animate-slide-in border-r border-subtle dark:border-[#222222]">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-input">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <header className="lg:hidden bg-card dark:bg-black text-primary dark:text-white px-4 py-3 flex items-center justify-between border-b border-subtle dark:border-[#222222] flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-input">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm tracking-wide text-primary dark:text-white">Gitora</span>
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
          {activeView === 'team' && <Team />}

          {activeView === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle dark:border-[#222222] pb-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-primary dark:text-white">
                    Developer Dashboard
                    <span className="bg-white text-gray-800 border border-gray-300 dark:bg-[#111111] dark:text-gray-200 dark:border-[#222222]" style={{ borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: 500 }}>
                      {roleBadgeText}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-[#a0a0a0] mt-1">Manage and resolve your department's issues</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Repo Switcher */}
                  {repositories.length > 0 && (
                    <select
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      className="bg-input text-primary border border-subtle rounded-lg text-sm px-3 py-2 font-medium focus:outline-none focus:border-[#4da6ff]"
                    >
                      {repositories.map(repo => (
                        <option key={repo.id} value={repo.id}>{repo.name}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => setShowJoinModal(true)} className="flex items-center gap-1.5 bg-white border border-[#d1d5db] text-[#374151] px-[14px] py-[6px] rounded-[8px] text-[13px] font-medium cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap">
                    + Join Repo
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
                  <button onClick={fetchIssues} disabled={loading} style={{ background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 500 }} className="flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {loading && !repositories.length ? (
                <div className="flex justify-center py-24">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4da6ff]" />
                </div>
              ) : repositories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-16 h-16 bg-[#1e2a38] rounded-full flex items-center justify-center mb-4">
                    <GitBranch size={32} className="text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">No Repositories Assigned</h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">You haven't been assigned to any repositories yet. Please contact your Team Lead to send you an invite code for a repository.</p>
                  <button onClick={() => setShowJoinModal(true)} className="px-6 py-2.5 bg-[#4da6ff] hover:bg-[#3b82f6] text-primary text-sm font-bold rounded-lg shadow-sm transition-all">
                    + Join Repo
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Issues" value={totalCount} color="text-primary" borderLeftColor="border-l-[#4da6ff]" />
                    <StatCard label="In Progress" value={inProgCount} color="text-primary" borderLeftColor="border-l-[#f59e0b]" />
                    <StatCard label="Resolved" value={resolvedCount} color="text-primary" borderLeftColor="border-l-[#10b981]" />
                    <StatCard label="Overdue" value={overdueCount} color="text-primary" borderLeftColor="border-l-red-500" />
                  </div>

                  <div className="space-y-4">
                    <div className="sticky top-0 z-10 bg-app dark:bg-black py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2 py-1">
                        {['All', 'Urgent', 'Moderate', 'Low', 'Open', 'Resolved', 'Today'].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => {
                              setActiveFilter(filter);
                              const newlyFiltered = sortedIssues.filter((i) => {
                                const unresolved = i.workflowStatus !== 'resolved';
                                if (filter === 'All') return unresolved;
                                if (filter === 'Urgent') return i.severity === 'critical' && unresolved;
                                if (filter === 'Moderate') return i.severity === 'moderate' && unresolved;
                                if (filter === 'Low') return i.severity === 'low' && unresolved;
                                if (filter === 'Open') return (i.workflowStatus === 'open' || i.workflowStatus === 'in_progress') && unresolved;
                                if (filter === 'Resolved') return i.workflowStatus === 'resolved';
                                if (filter === 'Today') return isToday(i.openedAt || i.createdAt) && unresolved;
                                return true;
                              });
                              setSelectedIssueId(newlyFiltered.length > 0 ? newlyFiltered[0]._id : null);
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${activeFilter === filter
                                ? 'bg-[#4da6ff] text-primary border-[#4da6ff] shadow-sm font-black'
                                : 'bg-card text-gray-400 border-subtle hover:border-[#2d3a4a] hover:text-primary'
                              }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Urgent</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Moderate</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4da6ff] inline-block" /> Low</span>
                      </div>
                    </div>

                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 h-auto overflow-visible pr-1">
                        {filteredIssues.length === 0 ? (
                          <div className="col-span-1 md:col-span-2 p-10 text-center space-y-2 border border-subtle dark:border-[#222222] bg-card dark:bg-[#111111] rounded-2xl">
                            <GitBranch size={28} className="mx-auto text-gray-600 dark:text-[#a0a0a0]" />
                            <p className="text-gray-500 dark:text-[#a0a0a0] text-xs font-semibold">No issues matching this filter</p>
                          </div>
                        ) : (
                          filteredIssues.map((issue) => {
                            const days = daysOpen(issue.openedAt || issue.createdAt);
                            const timeAgoText = days === 0 ? 'today' : `${days}d ago`;
                            const borderMap = {
                              critical: 'border-l-2 border-l-red-500',
                              moderate: 'border-l-2 border-l-[#f59e0b]',
                              low: 'border-l-2 border-l-[#4da6ff]',
                            };
                            const borderClass = borderMap[issue.severity] || 'border-l-2 border-l-[#1e2a38]';
                            const isSelected = selectedIssueId === issue._id;

                            return (
                              <div
                                key={issue._id}
                                onClick={() => handleIssueClick(issue._id)}
                                className={`card p-4 ${borderClass} bg-white dark:bg-[#111111] rounded-r-xl rounded-l-sm transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${isSelected ? 'border border-[#4da6ff] dark:border-[#4da6ff]' : 'border border-subtle dark:border-[#222222] hover:border-[#4da6ff]/40 dark:hover:border-[#4da6ff]/40'} group`}
                              >
                                <div>
                                  <div className="flex justify-between items-center text-[10px] text-gray-600 dark:text-[#a0a0a0] font-mono mb-1.5">
                                    <span>#{issue.issueId}</span>
                                    <span className="font-semibold text-gray-600 dark:text-[#a0a0a0]">{timeAgoText}</span>
                                  </div>
                                  <h4 className="font-bold text-primary dark:text-white text-xs leading-snug line-clamp-2 mb-1.5 group-hover:text-[#4da6ff] transition-colors">{issue.title}</h4>
                                  {issue.aiExplanation && (
                                    <p className="text-[10px] text-gray-500 dark:text-[#a0a0a0] font-normal line-clamp-1 mt-1 leading-normal">{issue.aiExplanation}</p>
                                  )}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                  <SeverityBadge severity={issue.severity} />
                                  {issue.workflowStatus && (
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                      issue.workflowStatus === 'resolved' ? 'bg-green-50 text-green-700 border border-green-200/60 dark:bg-[#1a3d2e] dark:text-[#10b981] dark:border-[#245c41]' :
                                      issue.workflowStatus === 'in_progress' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200/60 dark:bg-[#3d331a] dark:text-yellow-400 dark:border-[#5c4d24]' :
                                      'bg-white text-red-600 border border-red-300 dark:bg-[#3d1a1a] dark:text-red-400 dark:border-[#5c2424]'
                                    }`}>
                                      {issue.workflowStatus.replace('_', ' ')}
                                    </span>
                                  )}
                                  {issue.aiExplanation && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-[#2a1a3d] dark:text-purple-400 dark:border-[#3d245c] font-bold uppercase tracking-wider">
                                      🤖 AI Explained
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}

                      <div ref={detailRef} className="col-span-1 md:col-span-2 w-full p-5 min-h-[400px] border border-subtle dark:border-[#222222] bg-card dark:bg-[#111111] rounded-2xl">
                        {!selectedIssue ? (
                          <div className="h-[350px] flex flex-col justify-center items-center text-center text-gray-600 dark:text-[#a0a0a0] space-y-2">
                            <Brain size={36} className="text-gray-800 dark:text-[#a0a0a0]" />
                            <p className="text-sm font-semibold text-gray-400 dark:text-[#a0a0a0]">Select an issue from the inbox</p>
                            <p className="text-xs">Click any card on the left to see its full AI-triage analysis.</p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            <div>
                              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-[#a0a0a0] font-mono mb-1.5">
                                <span>ISSUE #{selectedIssue.issueId}</span>
                                <span className="font-semibold">{daysOpen(selectedIssue.openedAt || selectedIssue.createdAt)} days old</span>
                              </div>
                              <h3 className="text-xl font-extrabold text-primary dark:text-white leading-snug">{selectedIssue.title}</h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <SeverityBadge severity={selectedIssue.severity} />
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                                selectedIssue.workflowStatus === 'resolved' ? 'bg-green-50 text-green-700 border border-green-200/60 dark:bg-[#1a3d2e] dark:text-[#10b981] dark:border-[#245c41]' :
                                selectedIssue.workflowStatus === 'in_progress' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200/60 dark:bg-[#3d331a] dark:text-yellow-400 dark:border-[#5c4d24]' :
                                'bg-white text-red-600 border border-red-300 dark:bg-[#3d1a1a] dark:text-red-400 dark:border-[#5c2424]'
                              }`}>
                                {(selectedIssue.workflowStatus || 'open').replace('_', ' ')}
                              </span>
                              {selectedIssue.classifiedTeam && (
                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-white text-gray-800 border border-gray-300 dark:bg-[#111111] dark:text-gray-200 dark:border-[#222222] font-bold uppercase tracking-wider">
                                  {selectedIssue.classifiedTeam} team
                                </span>
                              )}
                            </div>

                            {selectedIssue.description && (
                              <div className="bg-input dark:bg-[#222222] p-4 rounded-xl border border-subtle dark:border-[#333333]">
                                <p className="text-[10px] font-extrabold text-secondary dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Issue Description</p>
                                <p className="text-xs text-primary dark:text-white leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-y-auto">{selectedIssue.description}</p>
                              </div>
                            )}

                            {selectedIssue.aiExplanation && (
                              <div className="bg-[#4da6ff]/10 border border-[#4da6ff]/20 p-5 rounded-2xl space-y-2">
                                <div className="flex items-center gap-1.5 text-[#4da6ff]">
                                  <Brain size={16} />
                                  <p className="text-[10px] font-black uppercase tracking-widest">🤖 AI Explanation</p>
                                </div>
                                <p className="text-xs text-primary leading-relaxed font-semibold">{selectedIssue.aiExplanation}</p>
                              </div>
                            )}

                            {selectedIssue.severityReason && (
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-[#a0a0a0] uppercase tracking-wide">Why this severity?</h4>
                                <p className="text-xs text-gray-400 dark:text-[#a0a0a0] leading-relaxed">{selectedIssue.severityReason}</p>
                              </div>
                            )}

                            {selectedIssue.suggestedAction && (
                              <div className="p-4 rounded-xl border-l-4 border-indigo-600 bg-indigo-500/10 space-y-1.5">
                                <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                                  <Wrench size={12} /> Suggested Action
                                </h4>
                                <p className="text-xs font-bold text-primary dark:text-white leading-relaxed">{selectedIssue.suggestedAction}</p>
                              </div>
                            )}

                            <div className="pt-3 border-t border-subtle dark:border-[#222222] flex justify-end gap-3">
                              {selectedIssue.workflowStatus === 'open' && (
                                <button
                                  onClick={() => updateStatus(selectedIssue._id, 'in_progress')}
                                  disabled={updating === selectedIssue._id}
                                  className="px-4 py-2 bg-[#4da6ff] hover:bg-[#3b82f6] text-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                                >
                                  <Play size={12} />
                                  <span>Start Working</span>
                                </button>
                              )}
                              {selectedIssue.workflowStatus !== 'resolved' ? (
                                <button
                                  onClick={() => updateStatus(selectedIssue._id, 'resolved')}
                                  disabled={updating === selectedIssue._id}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                  <CheckCircle size={12} />
                                  <span>Mark as Resolved</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 border border-green-200 rounded-lg text-xs font-bold">
                                  <CheckCircle size={14} />
                                  <span>Resolved by {selectedIssue.resolvedByUserId?.name || 'you'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">Join Repository</h3>
              <button onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleJoinRepo}>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Invite Code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code e.g. BD9E0C"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4361ee] transition-all text-gray-900 uppercase"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={joining || !inviteCode}
                className="w-full py-3 bg-[#4da6ff] hover:bg-[#3b8fe8] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center shadow-sm">
                {joining ? 'Joining...' : 'Join Repository'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}