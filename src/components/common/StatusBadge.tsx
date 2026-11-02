import React from 'react';

export type BadgeVariant = 
  // Order & Transaction Statuses
  | 'completed'
  | 'refunded'
  | 'pending'
  | 'cancelled'
  | 'partial'
  | 'in_transit'
  // Stock Proximity & Inventory Statuses
  | 'healthy'
  | 'nearing'
  | 'breached'
  | 'out_of_stock'
  | 'velocity_critical'
  | 'velocity_warning'
  // Shift Statuses
  | 'open'
  | 'closed'
  | 'overdue'
  // User & Account Statuses
  | 'active'
  | 'inactive'
  | 'suspended'
  // Roles
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'staff'
  | 'supplier'
  // Payment Methods
  | 'cash'
  | 'momo'
  | 'mobile money'
  | 'card'
  | 'visa'
  | 'bank'
  | 'bank transfer'
  | 'credit'
  // Stock Adjustment Types
  | 'increase'
  | 'decrease'
  | 'damaged'
  | 'audit_count'
  // Purchase Order Statuses
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'received'
  // Generic Neutral / Live
  | 'live'
  | 'neutral';

export interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  pulseDot?: boolean;
  className?: string;
}

interface StyleConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  defaultLabel: string;
}

const variantStyles: Record<string, StyleConfig> = {
  // Successful / Healthy / Active
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Completed',
  },
  healthy: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Optimal Stock',
  },
  active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Active',
  },
  received: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Received',
  },
  approved: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Approved',
  },
  increase: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Restocked',
  },

  // Urgent / Danger / Out of Stock / Refunded
  out_of_stock: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Out of Stock',
  },
  refunded: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Refunded',
  },
  cancelled: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Cancelled',
  },
  suspended: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Suspended',
  },
  velocity_critical: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Runway Critical',
  },
  damaged: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    defaultLabel: 'Damaged / Write-off',
  },

  // Warning / Breached / Nearing
  breached: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'Threshold Breached',
  },
  nearing: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    dot: 'bg-orange-500',
    defaultLabel: 'Nearing Reorder',
  },
  velocity_warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'High Velocity',
  },
  overdue: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'Overdue Shift',
  },
  decrease: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'Reduction',
  },
  partial: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'Partial Return',
  },

  // Informational / Pending / In Progress
  open: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
    defaultLabel: 'Open Till',
  },
  pending: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
    defaultLabel: 'Pending',
  },
  draft: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    dot: 'bg-slate-400',
    defaultLabel: 'Draft',
  },
  submitted: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200/80',
    dot: 'bg-sky-500',
    defaultLabel: 'Submitted',
  },
  in_transit: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200/80',
    dot: 'bg-cyan-500',
    defaultLabel: 'In Transit',
  },
  live: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Live',
  },

  // Neutral / Closed / Inactive
  closed: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    dot: 'bg-slate-400',
    defaultLabel: 'Closed',
  },
  inactive: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200/80',
    dot: 'bg-slate-400',
    defaultLabel: 'Inactive',
  },
  audit_count: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
    defaultLabel: 'Audit Count',
  },

  // User Roles
  admin: {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200/80',
    dot: 'bg-purple-500',
    defaultLabel: 'Admin',
  },
  manager: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
    defaultLabel: 'Manager',
  },
  cashier: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200/80',
    dot: 'bg-slate-500',
    defaultLabel: 'Cashier',
  },
  staff: {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200/80',
    dot: 'bg-slate-500',
    defaultLabel: 'Staff',
  },
  supplier: {
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200/80',
    dot: 'bg-teal-500',
    defaultLabel: 'Supplier',
  },

  // Payment Methods
  cash: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    defaultLabel: 'Cash',
  },
  momo: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'MoMo',
  },
  'mobile money': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    defaultLabel: 'Mobile Money',
  },
  card: {
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200/80',
    dot: 'bg-violet-500',
    defaultLabel: 'Card',
  },
  visa: {
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200/80',
    dot: 'bg-violet-500',
    defaultLabel: 'Visa',
  },
  bank: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
    defaultLabel: 'Bank',
  },
  'bank transfer': {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
    defaultLabel: 'Bank Transfer',
  },
  credit: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    dot: 'bg-orange-500',
    defaultLabel: 'Store Credit',
  },

  // Fallback
  neutral: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    dot: 'bg-slate-400',
    defaultLabel: 'Standard',
  },
};

export default function StatusBadge({
  status,
  variant,
  label,
  size = 'sm',
  showDot = true,
  pulseDot,
  className = '',
}: StatusBadgeProps) {
  // Normalize key safely
  const rawKey = typeof variant === 'string' ? variant : (typeof status === 'string' ? status : 'neutral');
  const normalizedKey = (rawKey || 'neutral').toLowerCase().trim();
  const config = variantStyles[normalizedKey] || variantStyles.neutral;

  // Compute label text safely
  const displayText = label || (typeof status === 'string' ? status.replace(/_/g, ' ') : (status != null ? String(status) : config.defaultLabel));

  // Pulse dot logic: pulse by default for open shifts, velocity critical, or live
  const shouldPulse = pulseDot !== undefined 
    ? pulseDot 
    : (normalizedKey === 'open' || normalizedKey === 'velocity_critical' || normalizedKey === 'live');

  // Sizing definitions
  const sizeClasses = {
    xs: 'text-[9px] px-2 py-0.2 gap-1 font-extrabold',
    sm: 'text-[10px] px-2.5 py-0.5 gap-1.5 font-extrabold',
    md: 'text-xs px-3 py-1 gap-2 font-black',
  }[size];

  const dotSizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full uppercase tracking-wider border shadow-2xs shrink-0 select-none ${sizeClasses} ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showDot && (
        <span
          className={`rounded-full shrink-0 ${dotSizeClasses} ${config.dot} ${
            shouldPulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span className="truncate">{displayText}</span>
    </span>
  );
}
