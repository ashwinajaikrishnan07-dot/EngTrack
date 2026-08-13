import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, User, Calendar } from 'lucide-react';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';

export default function IssueCard({ issue }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/issues/${issue._id}`)}
      className="card p-4 cursor-pointer hover:shadow-md hover:border-blue-300 :border-blue-700 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400  font-mono">#{issue.issueId}</span>
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </div>
          <h3 className="font-semibold text-gray-900  text-sm leading-snug line-clamp-2">
            {issue.title}
          </h3>
          {issue.description && (
            <p className="text-xs text-gray-500  mt-1 line-clamp-2">
              {issue.description}
            </p>
          )}
        </div>
        {issue.githubUrl && (
          <a
            href={issue.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-blue-500 flex-shrink-0"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 ">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 ">
          <User size={12} />
          {issue.assignee ? (
            <span className="font-medium text-gray-700 ">{issue.assignee.name}</span>
          ) : (
            <span className="italic">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 ">
          <Calendar size={12} />
          {new Date(issue.createdAt).toLocaleDateString()}
        </div>
      </div>

      {issue.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {issue.labels.slice(0, 3).map((label) => (
            <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-gray-100  text-gray-600 ">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
