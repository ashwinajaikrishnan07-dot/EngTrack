import React, { useState } from 'react';
import { Brain, RefreshCw, Clock, User, Zap, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const severityConfig = {
  Critical: { cls: 'bg-red-100 text-red-700   border border-red-200 ', dot: 'bg-red-500' },
  High:     { cls: 'bg-blue-100 text-blue-700   border border-blue-200 ', dot: 'bg-blue-500' },
  Normal:   { cls: 'bg-blue-100 text-blue-700   border border-blue-200 ', dot: 'bg-blue-500' },
  Low:      { cls: 'bg-gray-100 text-gray-600   border border-gray-200 ', dot: 'bg-gray-400' },
};

export default function AiTriagePanel({ issue, onRetriage }) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const triage = issue?.aiTriage;

  const handleRetriage = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/issues/${issue._id}/retriage`);
      toast.success('AI triage updated');
      if (onRetriage) onRetriage(data.triage);
    } catch {
      toast.error('Retriage failed');
    } finally {
      setLoading(false);
    }
  };

  if (!triage || !triage.severity) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900  flex items-center gap-2">
            <Brain size={16} className="text-purple-500" /> AI Triage
          </h2>
          <button onClick={handleRetriage} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analyzing...' : 'Run Triage'}
          </button>
        </div>
        <p className="text-sm text-gray-400  italic">
          AI triage not yet run. Click "Run Triage" to analyze this issue.
        </p>
      </div>
    );
  }

  const sev = severityConfig[triage.severity] || severityConfig.Normal;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900  flex items-center gap-2">
          <Brain size={16} className="text-purple-500" /> AI Triage
          <span className={`badge text-xs ${sev.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} mr-1`} />
            {triage.severity}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={handleRetriage} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analyzing...' : 'Re-triage'}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1.5">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* Likely Cause */}
          {triage.likelyCause && (
            <div className="flex gap-3">
              <AlertTriangle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500  uppercase tracking-wide mb-0.5">Likely Cause</p>
                <p className="text-sm text-gray-800 ">{triage.likelyCause}</p>
              </div>
            </div>
          )}

          {/* Suggested Assignee + ETA */}
          <div className="grid grid-cols-2 gap-3">
            {triage.suggestedAssignee && (
              <div className="bg-gray-50  rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500  mb-1">
                  <User size={12} /> Suggested Assignee
                </div>
                <p className="text-sm font-semibold text-gray-900 ">{triage.suggestedAssignee}</p>
              </div>
            )}
            {triage.estimatedResolution && (
              <div className="bg-gray-50  rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500  mb-1">
                  <Clock size={12} /> Est. Resolution
                </div>
                <p className="text-sm font-semibold text-gray-900 ">{triage.estimatedResolution}</p>
              </div>
            )}
          </div>

          {/* Impacted Modules */}
          {triage.impactedModules?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500  uppercase tracking-wide mb-2">
                Impacted Modules
              </p>
              <div className="flex flex-wrap gap-1.5">
                {triage.impactedModules.map((mod) => (
                  <span key={mod} className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700   font-medium">
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Debugging Steps */}
          {triage.debuggingSteps?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500  uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap size={11} /> Debugging Steps
              </p>
              <ol className="space-y-1.5">
                {triage.debuggingSteps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-700 ">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100  text-purple-700  text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {triage.triageAt && (
            <p className="text-xs text-gray-400  pt-1 border-t border-gray-100 ">
              Analyzed {new Date(triage.triageAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
