import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, 
  ShoppingBag, ArrowRight, RefreshCw, Search, X, PackageOpen, SlidersHorizontal
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock_quantity: number;
  cost_price?: number;
  selling_price?: number;
  barcode?: string;
  min_stock_level?: number;
  threshold?: number;
}

interface AutomatedLowStockNotificationProps {
  products: Product[];
  globalThreshold: number;
  onQuickRestock?: (product: Product) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  userRole?: string;
}

export default function AutomatedLowStockNotification({
  products,
  globalThreshold,
  onQuickRestock,
  onRefresh,
  isLoading = false,
  userRole = 'admin'
}: AutomatedLowStockNotificationProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'out_of_stock' | 'critical'>('all');

  // Filter items where stock quantity is at or below defined reorder point (min_stock_level or globalThreshold)
  const warningList = useMemo(() => {
    return products.filter(p => {
      const reorderPoint = p.min_stock_level ?? p.threshold ?? globalThreshold;
      return p.stock_quantity <= reorderPoint;
    });
  }, [products, globalThreshold]);

  const outOfStockItems = useMemo(() => {
    return warningList.filter(p => p.stock_quantity <= 0);
  }, [warningList]);

  const criticalItems = useMemo(() => {
    return warningList.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 3);
  }, [warningList]);

  const totalDeficit = useMemo(() => {
    return warningList.reduce((acc, p) => {
      const reorderPoint = p.min_stock_level ?? p.threshold ?? globalThreshold;
      const deficit = Math.max(0, reorderPoint - p.stock_quantity);
      return acc + deficit;
    }, 0);
  }, [warningList, globalThreshold]);

  const filteredWarningList = useMemo(() => {
    return warningList.filter(p => {
      // Status filter
      if (statusFilter === 'out_of_stock' && p.stock_quantity > 0) return false;
      if (statusFilter === 'critical' && (p.stock_quantity <= 0 || p.stock_quantity > 3)) return false;

      // Query filter
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [warningList, statusFilter, filterQuery]);

  if (isDismissed) {
    return (
      <div className="bg-amber-50/80 border border-amber-200 rounded px-4 py-2 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-600 animate-pulse" />
          <span className="font-bold">Automated Low-Stock Warning:</span>
          <span>{warningList.length} item(s) currently below defined reorder points.</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-xs font-black text-amber-800 hover:text-amber-950 underline cursor-pointer"
        >
          View Warning List
        </button>
      </div>
    );
  }

  // All inventory healthy state
  if (warningList.length === 0) {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3.5 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="font-black uppercase tracking-wider text-[11px] text-emerald-800">
              Automated Stock Status: All Inventory Healthy
            </span>
            <p className="text-emerald-700 text-[11px] font-medium mt-0.5">
              All tracked products are currently stocked above their defined reorder point thresholds (Default limit: {globalThreshold} units).
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 rounded transition flex items-center gap-1 border border-emerald-300/60 cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Check Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="automated-low-stock-notification" className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* Alert Header Notification Bar - Solid Blue with No Gradient */}
      <div className="bg-blue-600 text-white px-4 py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-700/80 border border-blue-500/50 flex items-center justify-center text-white shrink-0 shadow-xs">
            <AlertTriangle size={20} className="text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-800/80 text-blue-100 rounded text-[10px] font-black uppercase tracking-wider">
                Automated System Notification
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Low-Stock Warning Alert
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium mt-0.5">
              <strong>{warningList.length} product(s)</strong> have fallen below their defined reorder point and require restocking!
            </p>
          </div>
        </div>

        {/* Quick summary chips & collapse controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-black mr-2">
            {outOfStockItems.length > 0 && (
              <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-black shadow-xs">
                {outOfStockItems.length} Out of Stock
              </span>
            )}
            <span className="px-2 py-0.5 bg-blue-800 text-blue-100 rounded">
              {totalDeficit} Units Deficit
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-blue-700/80 hover:bg-blue-700 text-white rounded font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-blue-500/40"
          >
            <span>{isExpanded ? 'Hide Warning List' : `View Warning List (${warningList.length})`}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-7 h-7 rounded flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-700/60 transition cursor-pointer"
            title="Minimize alert notification"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expandable Warning List Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {/* Controls row: search, status filter chips, and bulk purchase order shortcut */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search warning list by product name, SKU, or category..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white p-1 rounded border border-slate-200 shadow-2xs text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    statusFilter === 'all' ? 'bg-blue-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({warningList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('out_of_stock')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    statusFilter === 'out_of_stock' ? 'bg-rose-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Out of Stock ({outOfStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('critical')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    statusFilter === 'critical' ? 'bg-amber-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Critical ≤3 ({criticalItems.length})
                </button>
              </div>

              {userRole === 'admin' && (
                <Link
                  to="/purchases"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ShoppingBag size={13} />
                  <span>Create Purchase Order</span>
                </Link>
              )}
            </div>
          </div>

          {/* Warning List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Product Details</th>
                  <th className="px-3.5 py-2.5">SKU</th>
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5 text-center">In Stock</th>
                  <th className="px-3.5 py-2.5 text-center">Reorder Point</th>
                  <th className="px-3.5 py-2.5 text-center">Deficit</th>
                  <th className="px-3.5 py-2.5 text-center">Warning Status</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWarningList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No warning items matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredWarningList.map((product) => {
                    const reorderPoint = product.min_stock_level ?? product.threshold ?? globalThreshold;
                    const isOut = product.stock_quantity <= 0;
                    const deficit = Math.max(0, reorderPoint - product.stock_quantity);

                    return (
                      <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            {product.selling_price !== undefined && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                Price: {formatGHS(product.selling_price)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-600 text-[11px] font-bold">
                          {product.sku || '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {product.category || 'General'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-black">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono ${
                            isOut ? 'bg-rose-100 text-rose-800 font-black' : 'bg-amber-100 text-amber-900 font-bold'
                          }`}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono text-slate-700 font-bold">
                          {reorderPoint}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-black text-rose-600 font-mono">
                          -{deficit} units
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-black uppercase text-[9px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                              <AlertCircle size={10} /> Out of Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded font-black uppercase text-[9px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                              <AlertTriangle size={10} /> Low Stock
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onQuickRestock && (
                              <button
                                type="button"
                                onClick={() => onQuickRestock(product)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[11px] uppercase tracking-wider transition cursor-pointer shadow-xs"
                              >
                                Restock
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const qty = Math.max(10, reorderPoint * 2 - product.stock_quantity);
                                navigate(`/purchases?reorder_product_id=${product.id}&reorder_qty=${qty}&product_name=${encodeURIComponent(product.name)}`);
                              }}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[11px] uppercase tracking-wider transition cursor-pointer"
                              title="Generate Purchase Order Draft"
                            >
                              PO
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
