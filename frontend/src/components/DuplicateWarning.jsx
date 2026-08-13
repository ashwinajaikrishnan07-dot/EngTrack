import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DuplicateWarning({ duplicates }) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  if (!duplicates || duplicates.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-300  bg-blue-50  p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-blue-600  flex-shrink-0" />
          <p className="text-sm font-semibold text-blue-800 ">
            {duplicates.length} similar issue{duplicates.length > 1 ? 's' : ''} found — possible duplicate
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-600  hover:text-blue-800">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {duplicates.map((d) => (
            <div
              key={d._id}
              className="flex items-center justify-between bg-white  rounded-lg px-3 py-2 border border-blue-200 "
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-gray-400">#{d.issueId}</span>
                <span className="text-sm text-gray-800  truncate">{d.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs font-bold text-blue-700  bg-blue-100  px-2 py-0.5 rounded-full">
                  {d.similarity}% match
                </span>
                <button
                  onClick={() => navigate(`/issues/${d._id}`)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-blue-700  mt-1">
            Review these before submitting to avoid duplicate work.
          </p>
        </div>
      )}
    </div>
  );
}
