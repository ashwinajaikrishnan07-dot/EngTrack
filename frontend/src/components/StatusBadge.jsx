import React from 'react';

const config = {
  open:        { label: 'Open',        cls: 'bg-green-100 text-green-700  ' },
  'in-progress': { label: 'In Progress', cls: 'bg-yellow-100 text-yellow-700  ' },
  closed:      { label: 'Closed',      cls: 'bg-gray-100 text-gray-600  ' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = config[status] || config.open;
  return <span className={`badge ${cls}`}>{label}</span>;
}
