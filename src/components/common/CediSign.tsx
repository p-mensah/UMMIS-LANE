import React from 'react';

export interface CediSignProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

/**
 * Ghanaian Cedi sign (₵) vector asset adhering to Lucide iconography conventions.
 * Features the signature geometric C with vertical anchor bar and horizontal cross stroke.
 */
export function CediSign({ size = 16, className = '', strokeWidth = 2 }: CediSignProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Top vertical anchor bar */}
      <line x1="12" y1="2" x2="12" y2="6.5" />
      {/* Bottom vertical anchor bar */}
      <line x1="12" y1="17.5" x2="12" y2="22" />
      {/* Center cross-stroke */}
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
      {/* Open C curvature */}
      <path d="M17 7.5A7.5 7.5 0 0 0 8 12a7.5 7.5 0 0 0 9 4.5" />
    </svg>
  );
}

export default CediSign;
