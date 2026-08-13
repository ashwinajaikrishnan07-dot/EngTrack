import React from 'react';

export default function CustomLogo({ size = 24, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="4" cy="4" r="3" />
      <circle cx="12" cy="4" r="3" />
      <circle cx="20" cy="4" r="3" />
      
      <circle cx="4" cy="12" r="3" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="20" cy="12" r="3" />
      
      <circle cx="4" cy="20" r="3" />
      <circle cx="12" cy="20" r="3" />
      <circle cx="20" cy="20" r="3" />
      
      <path d="M12 4 C 12 8.5, 8.5 12, 4 12" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M12 12 C 12 16.5, 8.5 20, 4 20" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M20 12 C 20 16.5, 16.5 20, 12 20" fill="none" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}
