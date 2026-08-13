import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Brain,
  Clock, CheckCircle, Play, RotateCcw, Sun, Moon,
  AlertTriangle, Users, Wrench, Tag,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

function SeverityBadge({ severity, isUrgent }) {
  if (!severity) return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">Unclassified</span>;
  const map = {
    critical: { cls: 'bg-red-100 text-red-700 border border-red-200', icon: '🔴' },
    moderate: { cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200', icon: '🟡' },
    low: { cls: 'bg-green-100 text-green-700 border border-green-200', icon: '🟢' },
  };
  const { cls, icon } = map[severity] || map.low;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-semibold ${cls}`}>
      {icon} {severity.charAt(0).toUpperCase() + severity.slice(1)}
      {isUrgent && <span className="ml-1 text-xs font-bold animate-pulse">URGENT</span>}
    </span>
  );
}

function TeamBadge({ team }) {
  if (!team) return null;
  if (team === 'backend') {
    return (
      <span style={{
        background: '#EFF6FF',
        color: '#1D4ED8',
        border: '1px solid #BFDBFE',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 500,
        padding: '3px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Users size={14} /> Backend Team
      </span>
    );
  }
  const map = {
    frontend: { cls: 'bg-blue-100 text-blue-700', label: 'Frontend Team' },
    devops: { cls: 'bg-blue-100 text-blue-700', label: 'DevOps Team' },
    fullstack: { cls: 'bg-indigo-100 text-indigo-700', label: 'Full Stack Team' },
  };
  const { cls, label } = map[team] || map.fullstack;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-semibold ${cls}`}>
      <Users size={14} /> {label}
    </span>
  );
}

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dark, toggle } = useTheme();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    api.get(`/issues/${id}`)
      .then((r) => setIssue(r.data))
      .catch(() => { toast.error('Issue not found'); navigate(-1); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await api.patch(`/issues/${id}/status`, { status });
      setIssue((prev) => ({ ...prev, workflowStatus: status }));
      toast.success(`Marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  );

  if (!issue) return null;

  const daysOpen = issue.openedAt ? Math.floor((Date.now() - new Date(issue.openedAt)) / 86400000) : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors">
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-500">Issue #{issue.issueId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-all">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {issue.githubUrl && (
            <a href={issue.githubUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
              <ExternalLink size={13} /> View on GitHub
            </a>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SeverityBadge severity={issue.severity} isUrgent={issue.isUrgent} />
            <TeamBadge team={issue.classifiedTeam} />
            {(!issue.workflowStatus || issue.workflowStatus === 'open') ? (
              <span style={{
                background: '#E6F1FB',
                color: '#185FA5',
                border: '0.5px solid #B5D4F4',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 10px',
                textTransform: 'uppercase'
              }}>
                open
              </span>
            ) : (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${issue.workflowStatus === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {issue.workflowStatus.replace('_', ' ')}
              </span>
            )}
            {daysOpen > 0 && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${daysOpen >= 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                {daysOpen}d open
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold leading-snug mb-3">{issue.title}</h1>

          {issue.description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{issue.description}</p>
          )}

          {issue.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {issue.labels.map((l) => (
                <span key={l} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  <Tag size={10} /> {l}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            {issue.openedAt && <span>Opened: {new Date(issue.openedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            {issue.closedAt && <span>Closed: {new Date(issue.closedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            {issue.resolutionTimeHours && <span>Resolved in: {issue.resolutionTimeHours}h</span>}
          </div>
        </div>

        <div className={`rounded-2xl border-2 p-6 ${issue.isUrgent ? 'bg-red-50 border-red-300' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${issue.isUrgent ? 'bg-red-500' : 'bg-indigo-600'}`}>
                <Brain size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-sm">AI Analysis</h2>
                <p className="text-xs text-gray-500">Powered by Groq llama-3.3-70b</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {issue.isUrgent && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-100 border border-red-300 rounded-xl">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-700">This issue is URGENT — it may be blocking users or production</p>
              </div>
            )}

            {issue.aiExplanation ? (
              <div className="bg-white/70 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What's the problem?</p>
                <p className="text-sm text-gray-800 leading-relaxed">{issue.aiExplanation}</p>
              </div>
            ) : (
              <div className="bg-white/70 rounded-xl p-4 text-center py-6">
                <Brain size={24} className="mx-auto text-gray-300 mb-2 animate-pulse" />
                <p className="text-xs text-gray-500 font-medium">Analyzing issue details...</p>
              </div>
            )}

            {issue.severityReason && (
              <div className="bg-white/70 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Why this severity?</p>
                <p className="text-sm text-gray-800">{issue.severityReason}</p>
              </div>
            )}

            {issue.suggestedAction && (
              <div className="bg-white/70 rounded-xl p-4 border-l-4 border-indigo-500">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Wrench size={12} /> First step to fix this
                </p>
                <p className="text-sm font-medium text-gray-900">{issue.suggestedAction}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {issue.estimatedComplexity && (
                <div className="bg-white/70 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Complexity</p>
                  <p className="text-sm font-bold capitalize">{issue.estimatedComplexity.replace('-', ' ')}</p>
                </div>
              )}
              {issue.classifiedTeam && (
                <div className="bg-white/70 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Classified Team Scope</p>
                  <p className="text-sm font-bold capitalize">{issue.classifiedTeam}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {issue.workflowStatus !== 'resolved' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Clock size={14} className="text-blue-500" /> Update Status
            </h2>
            <div className="flex flex-wrap gap-3">
              {issue.workflowStatus === 'open' && (
                <button onClick={() => updateStatus('in_progress')} disabled={updating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-xl border border-blue-200 transition-all disabled:opacity-50">
                  <Play size={14} /> Start Working
                </button>
              )}
              <button onClick={() => updateStatus('resolved')} disabled={updating}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-primary text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm">
                <CheckCircle size={14} /> Mark as Resolved
              </button>
            </div>
          </div>
        )}

        {issue.workflowStatus === 'resolved' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-700">Issue Resolved</p>
              {issue.resolvedAt && (
                <p className="text-xs text-green-600 mt-0.5">
                  Resolved on {new Date(issue.resolvedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {issue.resolutionTimeHours && ` · took ${issue.resolutionTimeHours}h`}
                </p>
              )}
            </div>
            <button onClick={() => updateStatus('open')} disabled={updating}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
              <RotateCcw size={12} /> Reopen
            </button>
          </div>
        )}
      </main>
    </div>
  );
}