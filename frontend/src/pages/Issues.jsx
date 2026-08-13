import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import api from '../api/axios';
import IssueCard from '../components/IssueCard';
import CreateIssueModal from '../components/CreateIssueModal';
import toast from 'react-hot-toast';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/issues', { params: { ...filters, page, limit: 18 } });
      setIssues(data.issues);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleFilterChange = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 ">Issues</h1>
          <p className="text-sm text-gray-500  mt-0.5">{total} total issues</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> New Issue
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by title or description..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          <select className="input sm:w-40" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <select className="input sm:w-40" value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)}>
            <option value="">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Issue list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : issues.length === 0 ? (
        <div className="card p-12 text-center text-gray-500 ">
          No issues match your filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {issues.map((issue) => <IssueCard key={issue._id} issue={issue} />)}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary">Prev</button>
              <span className="text-sm text-gray-500 ">Page {page} of {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn-secondary">Next</button>
            </div>
          )}
        </>
      )}

      <CreateIssueModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => fetchIssues()} />
    </div>
  );
}
