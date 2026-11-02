import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  History, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Clock, 
  User, 
  RefreshCw,
  Layers,
  FileText,
  AlertCircle,
  ExternalLink,
  Receipt,
  Eye
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import RowActionMenu from './common/RowActionMenu';
import StatusBadge from './common/StatusBadge';

export interface RecentActivityItem {
  id: string | number;
  type: 'sale' | 'inventory_adjustment' | 'audit';
  title: string;
  subtitle: string;
  timestamp: string;
  badge?: {
    text: string;
    variant: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate' | 'rose';
  };
  amount?: number;
  quantityChange?: number;
  user?: string;
  link?: string;
}

interface RecentActivityPanelProps {
  sales?: any[];
  auditLogs?: any[];
  stockAdjustments?: any[];
  onViewSaleReceipt?: (saleId: number) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function RecentActivityPanel({
  sales = [],
  auditLogs = [],
  stockAdjustments = [],
  onViewSaleReceipt,
  onRefresh,
  isLoading = false,
}: RecentActivityPanelProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'sales' | 'inventory'>('all');

  // Format relative timestamp helper
  const formatRelativeTime = (dateStr: string): string => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0 || isNaN(diffMs)) return 'just now';
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Harmonize unified feed of transactions & inventory changes
  const combinedActivities: RecentActivityItem[] = [];
  const isStaff = user?.role === 'staff';

  // 1. Transaction entries (Sales)
  sales.forEach((s) => {
    if (isStaff) {
      if (s.user_id && user?.id && s.user_id !== user.id) return;
      const uLower = (s.user_name || '').toLowerCase();
      if (uLower.includes('admin') || uLower.includes('owner') || uLower.includes('mensah') || uLower.includes('superadmin')) return;
    }
    combinedActivities.push({
      id: `sale-${s.id}`,
      type: 'sale',
      title: `Sale #SALE-${s.id}`,
      subtitle: `${s.customer_name || 'Walk-in Customer'} • ${s.payment_method || 'Cash'}`,
      timestamp: s.created_at,
      badge: {
        text: 'Transaction',
        variant: 'emerald'
      },
      amount: s.total_amount,
      user: s.user_name || 'Cashier',
      link: `/sales`
    });
  });

  // 2. Direct stock adjustments (if supplied)
  stockAdjustments.forEach((adj) => {
    if (isStaff) {
      if (adj.user_id && user?.id && adj.user_id !== user.id) return;
      const uLower = (adj.user_name || '').toLowerCase();
      if (uLower.includes('admin') || uLower.includes('owner') || uLower.includes('mensah') || uLower.includes('superadmin')) return;
    }
    const isPositive = (adj.quantity_change || 0) > 0;
    combinedActivities.push({
      id: `adj-${adj.id}`,
      type: 'inventory_adjustment',
      title: `${adj.product_name || 'Stock Adjustment'}`,
      subtitle: adj.reason || (isPositive ? 'Restock / Delivery' : 'Damaged / Wastage / Correction'),
      timestamp: adj.created_at,
      badge: {
        text: 'Inventory',
        variant: isPositive ? 'blue' : 'amber'
      },
      quantityChange: adj.quantity_change,
      user: adj.user_name || 'Inventory Staff',
      link: `/adjustments`
    });
  });

  // 3. Audit logs related to sales or inventory
  auditLogs.forEach((log) => {
    if (isStaff) {
      if (log.user_id && user?.id && log.user_id !== user.id) return;
      const uLower = (log.user_name || '').toLowerCase();
      const roleLower = (log.actor_role || '').toLowerCase();
      if (roleLower === 'admin' || roleLower === 'superadmin' || uLower.includes('admin') || uLower.includes('owner') || uLower.includes('mensah')) return;
    }
    // Avoid double counting if already covered by sales
    const actionLower = (log.action || '').toLowerCase();
    const catLower = (log.category || '').toLowerCase();
    const details = log.details || '';

    const isSale = catLower === 'sales' || actionLower.includes('sale') || actionLower.includes('checkout');
    const isInventory = catLower === 'inventory' || catLower === 'products' || actionLower.includes('stock') || actionLower.includes('product');

    // Only inject audit log if not already covered by exact sales or adjustments
    if (isSale && !sales.some(s => details.includes(`#SALE-${s.id}`) || details.includes(`Sale #${s.id}`))) {
      combinedActivities.push({
        id: `audit-${log.id}`,
        type: 'sale',
        title: log.action || 'Sales Activity',
        subtitle: log.details || 'Register transaction',
        timestamp: log.created_at,
        badge: {
          text: 'Transaction',
          variant: 'emerald'
        },
        user: log.user_name || log.actor_role || 'System',
        link: `/sales`
      });
    } else if (isInventory && !stockAdjustments.some(a => details.includes(a.product_name))) {
      combinedActivities.push({
        id: `audit-${log.id}`,
        type: 'inventory_adjustment',
        title: log.action || 'Inventory Change',
        subtitle: log.details || 'Stock level modified',
        timestamp: log.created_at,
        badge: {
          text: 'Inventory',
          variant: actionLower.includes('restock') || actionLower.includes('received') ? 'blue' : 'amber'
        },
        user: log.user_name || 'Staff',
        link: `/adjustments`
      });
    }
  });

  // Deduplicate and sort by most recent timestamp
  const sortedActivities = combinedActivities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter based on toggle and user role (staff only sees their own logged items)
  const filteredActivities = sortedActivities.filter((item) => {
    if (user?.role === 'staff') {
      const selfName = (user.name || '').toLowerCase();
      const itemUser = (item.user || '').toLowerCase();
      if (!itemUser || (!itemUser.includes(selfName) && !selfName.includes(itemUser))) {
        return false;
      }
    }
    if (filter === 'sales') return item.type === 'sale';
    if (filter === 'inventory') return item.type === 'inventory_adjustment';
    return true;
  });

  // Display the last 5 transactions or inventory changes for quick status tracking
  const displayItems = filteredActivities.slice(0, 5);

  const getBadgeStyle = (variant: string) => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="recent-activity-panel" className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <History size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Recent Activity
              </h2>
              <span className="px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-700 text-[10px] font-bold">
                Last 5 Events
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Real-time feed of recent sales transactions and inventory changes
            </p>
          </div>
        </div>

        {/* Action controls & filter toggles */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('sales')}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${
                filter === 'sales'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setFilter('inventory')}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${
                filter === 'inventory'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Stock
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Activity"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-slate-100">
        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-1">
            <Clock size={20} className="mx-auto text-slate-300 mb-1" />
            <div>No recent transactions or inventory modifications logged yet.</div>
            <div className="text-[11px] text-slate-400">New sales or inventory changes will appear here automatically.</div>
          </div>
        ) : (
          displayItems.map((item) => {
            const isSale = item.type === 'sale';
            const hasQty = item.quantityChange !== undefined && item.quantityChange !== null;
            const isPositiveQty = hasQty && (item.quantityChange || 0) > 0;

            return (
              <div
                key={item.id}
                className="p-3.5 sm:px-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3"
              >
                {/* Left: Icon & Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    isSale 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : isPositiveQty 
                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {isSale ? (
                      <ShoppingCart size={16} />
                    ) : (
                      <Package size={16} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {item.title}
                      </span>
                      {item.badge && (
                        <StatusBadge
                          status={item.badge.text}
                          variant={item.badge.variant === 'emerald' ? 'completed' : item.badge.variant === 'rose' ? 'out_of_stock' : item.badge.variant === 'amber' ? 'breached' : 'neutral'}
                          label={item.badge.text}
                          size="xs"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                      <span>{item.subtitle}</span>
                      {item.user && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 flex items-center gap-0.5 font-medium">
                            <User size={10} /> {item.user}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Value, Time & Action */}
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    {item.amount !== undefined ? (
                      <div className="text-xs font-black text-slate-900 font-mono">
                        {formatGHS(item.amount)}
                      </div>
                    ) : hasQty ? (
                      <div className={`text-xs font-black font-mono flex items-center justify-end gap-0.5 ${
                        isPositiveQty ? 'text-blue-600' : 'text-amber-600'
                      }`}>
                        {isPositiveQty ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isPositiveQty ? `+${item.quantityChange}` : item.quantityChange} units
                      </div>
                    ) : null}
                    <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1 mt-0.5">
                      <Clock size={10} />
                      {formatRelativeTime(item.timestamp)}
                    </div>
                  </div>

                  {/* Kebab Action Menu */}
                  <div className="shrink-0 flex items-center">
                    <RowActionMenu
                      triggerTitle={`Actions for ${item.title}`}
                      actions={[
                        isSale && onViewSaleReceipt && typeof item.id === 'string' && item.id.startsWith('sale-') ? {
                          label: 'View Receipt',
                          sublabel: 'View transaction invoice',
                          icon: <Receipt size={14} className="text-blue-600" />,
                          onClick: () => onViewSaleReceipt(parseInt(item.id.toString().replace('sale-', ''), 10)),
                        } : null,
                        {
                          label: item.type === 'sale' ? 'Open in POS' : 'Open Adjustments',
                          sublabel: 'View module details',
                          icon: <Eye size={14} />,
                          onClick: () => {
                            window.location.href = item.link;
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer link */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
        <span className="text-slate-400 font-normal">
          Displaying {displayItems.length} most recent status changes
        </span>
        <div className="flex items-center gap-3">
          <Link to="/transactions" className="text-blue-600 hover:underline flex items-center gap-1">
            Sales Ledger <ExternalLink size={11} />
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/adjustments" className="text-blue-600 hover:underline flex items-center gap-1">
            Inventory Logs <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
