import React from 'react';

const config = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700  ' },
  high:   { label: 'High',   cls: 'bg-blue-100 text-blue-700  ' },
  normal: { label: 'Normal', cls: 'bg-blue-100 text-blue-700  ' },
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600  ' },
};

export default function PriorityBadge({ priority }) {
  const { label, cls } = config[priority] || config.normal;
  return <span className={`badge ${cls}`}>{label}</span>;
}
