import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Copy, RefreshCw, X, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

/**
 * RepoSetupModal
 * Props:
 *   open        — boolean
 *   onClose     — fn (called when user dismisses; only allowed if at least 1 repo exists)
 *   onRepoAdded — fn(team) called after a repo is successfully added
 */
export default function RepoSetupModal({ open, onClose, onRepoAdded }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', githubRepo: '' });
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/team/repos');
      setRepos(data.teams || []);
    } catch {
      // ignore — might be first load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRepos();
  }, [open, fetchRepos]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.githubRepo.trim()) return;
    if (!form.githubRepo.includes('/')) {
      toast.error('Format must be owner/repo  e.g. ashwina/my-project');
      return;
    }
    setAdding(true);
    try {
      const { data } = await api.post('/team/repos', {
        name: form.name.trim() || form.githubRepo.split('/')[1],
        githubRepo: form.githubRepo.trim(),
      });
      toast.success(`Repo added! Invite code: ${data.team.inviteCode}`);
      setForm({ name: '', githubRepo: '' });
      await fetchRepos();
      if (onRepoAdded) onRepoAdded(data.team);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add repo');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (teamId) => {
    setSaving(true);
    try {
      await api.patch(`/team/repos/${teamId}`, editForm);
      toast.success('Repo updated');
      setExpandedId(null);
      await fetchRepos();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = async (team) => {
    try {
      const { data } = await api.get(`/team/repos/${team._id}/invite`);
      await navigator.clipboard.writeText(data.signupUrl);
      setCopiedId(team._id);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy invite link');
    }
  };

  const copyInviteCode = async (team) => {
    await navigator.clipboard.writeText(team.inviteCode);
    setCopiedId(team._id + '_code');
    toast.success(`Invite code ${team.inviteCode} copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!open) return null;

  const canClose = repos.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white  rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-200 ">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 ">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <GitBranch size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900  text-base">Manage Repos</h2>
              <p className="text-xs text-gray-500 ">Each repo gets its own invite code</p>
            </div>
          </div>
          {canClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 :bg-gray-800 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Add new repo form */}
          <form onSubmit={handleAdd} className="space-y-3">
            <p className="text-xs font-bold text-gray-500  uppercase tracking-wider">Add a GitHub Repo</p>
            <div>
              <input
                className="w-full px-3 py-2.5 border border-gray-300  rounded-xl text-sm bg-white  text-gray-900  placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="owner/repo  e.g. ashwina/em-jeans"
                value={form.githubRepo}
                onChange={(e) => setForm({ ...form, githubRepo: e.target.value })}
                required
              />
            </div>
            <div>
              <input
                className="w-full px-3 py-2.5 border border-gray-300  rounded-xl text-sm bg-white  text-gray-900  placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Team name (optional — defaults to repo name)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-primary text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {adding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {adding ? 'Adding...' : 'Add Repo'}
            </button>
          </form>

          {/* Existing repos */}
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : repos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500  uppercase tracking-wider">Your Repos ({repos.length})</p>
              {repos.map((team) => (
                <div key={team._id} className="border border-gray-200  rounded-xl overflow-hidden">
                  {/* Repo row */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 ">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900  truncate">{team.name}</p>
                      <p className="text-xs text-gray-500  font-mono truncate">{team.githubRepo || 'No repo set'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {/* Invite code badge */}
                      <button
                        onClick={() => copyInviteCode(team)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50  text-blue-700  border border-blue-200  rounded-lg text-xs font-mono font-bold hover:bg-blue-100 transition-colors"
                        title="Copy invite code"
                      >
                        {copiedId === team._id + '_code' ? <Check size={10} /> : <Copy size={10} />}
                        {team.inviteCode}
                      </button>
                      {/* Copy invite link */}
                      <button
                        onClick={() => copyInviteLink(team)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 :bg-blue-950/20 transition-colors"
                        title="Copy invite link"
                      >
                        {copiedId === team._id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                      {/* Expand/edit */}
                      <button
                        onClick={() => {
                          if (expandedId === team._id) {
                            setExpandedId(null);
                          } else {
                            setExpandedId(team._id);
                            setEditForm({ name: team.name, githubRepo: team.githubRepo });
                          }
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 :bg-gray-700 transition-colors"
                      >
                        {expandedId === team._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="px-4 py-2 flex gap-4 text-xs text-gray-500  border-t border-gray-100 ">
                    <span>{team.memberCount ?? 0} members</span>
                    <span>{team.issueCount ?? 0} issues</span>
                  </div>

                  {/* Edit panel */}
                  {expandedId === team._id && (
                    <div className="px-4 py-3 border-t border-gray-200  bg-white  space-y-2">
                      <input
                        className="w-full px-3 py-2 border border-gray-300  rounded-lg text-sm bg-white  text-gray-900  focus:outline-none focus:border-blue-500"
                        placeholder="Team name"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                      <input
                        className="w-full px-3 py-2 border border-gray-300  rounded-lg text-sm bg-white  text-gray-900  font-mono focus:outline-none focus:border-blue-500"
                        placeholder="owner/repo"
                        value={editForm.githubRepo || ''}
                        onChange={(e) => setEditForm({ ...editForm, githubRepo: e.target.value })}
                      />
                      <button
                        onClick={() => handleSaveEdit(team._id)}
                        disabled={saving}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-primary text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400  text-sm">
              <GitBranch size={28} className="mx-auto mb-2 opacity-40" />
              <p>No repos yet. Add one above to get started.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!canClose && (
          <div className="px-6 py-3 border-t border-gray-200  bg-blue-50 ">
            <p className="text-xs text-blue-700  font-medium text-center">
              Add at least one repo to continue to the dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
