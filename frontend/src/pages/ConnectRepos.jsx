import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { GitBranch, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ConnectRepos() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [repoInput, setRepoInput] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);

  if (user?.role !== 'lead' && user?.role !== 'tl') {
    navigate('/');
  }

  const addRepo = () => {
    const r = repoInput.trim();
    if (!r) return;
    if (!r.includes('/') || r.split('/').length !== 2) {
      toast.error('Format must be owner/repository');
      return;
    }
    if (repos.includes(r)) {
      toast.error('Repository already added');
      return;
    }
    setRepos([...repos, r]);
    setRepoInput('');
  };

  const removeRepo = (index) => {
    setRepos(repos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (repos.length === 0) {
      toast.error('Please add at least one repository');
      return;
    }

    setLoading(true);
    try {
      let lastTeam = null;
      
      // Create each repo as a separate team
      for (const repo of repos) {
        const res = await api.post('/team/repos', { githubRepo: repo });
        lastTeam = res.data.team;
      }

      if (lastTeam) {
        updateUser({
          teamId: lastTeam.id,
          team: lastTeam,
        });
      }

      toast.success(`${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'} connected!`);
      navigate('/lead');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect repositories');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl border border-subtle overflow-hidden">
        <div className="p-8 md:p-10">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-[#110a02] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <GitBranch className="w-8 h-8 text-[#4da6ff]" />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-3">Connect Your Repositories</h1>
            <p className="text-secondary max-w-md mx-auto">
              Add the GitHub repositories you want to track. Gitora will sync issues, manage assignments, and track resolution times.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Repositories Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Repositories to Track
                </label>
                <p className="text-xs text-muted mb-3">
                  Add the repositories you want to manage. Format: <code className="bg-input px-1.5 py-0.5 rounded">owner/repo</code>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRepo())}
                    placeholder="e.g. facebook/react"
                    className="flex-1 px-4 py-2.5 bg-card border border-subtle rounded-lg text-primary text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-1 focus:ring-[#4da6ff] transition-all"
                  />
                  <button
                    type="button"
                    onClick={addRepo}
                    className="px-4 py-2.5 bg-[#4da6ff]/10 text-[#4da6ff] hover:bg-[#4da6ff]/20 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
              </div>

              {repos.length > 0 && (
                <div className="space-y-2 mt-4">
                  {repos.map((repo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-subtle bg-input">
                      <div className="flex items-center gap-3">
                        <GitBranch size={16} className="text-secondary" />
                        <span className="text-sm font-medium text-primary">{repo}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRepo(idx)}
                        className="text-muted hover:text-red-500 transition-colors p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-subtle">
              <button
                type="submit"
                disabled={loading || repos.length === 0}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-[#4da6ff] hover:bg-[#3b8fe8] active:bg-[#2a7ed8] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}