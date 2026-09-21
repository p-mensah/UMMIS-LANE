import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, 
  ShoppingBag, ArrowRight, RefreshCw, Search, X, PackageOpen, SlidersHorizontal,
  Bell, Gauge, TrendingDown, ArrowUpRight
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';

export interface ProductStockAlert {
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
  proximity_status?: 'out_of_stock' | 'breached' | 'nearing' | 'healthy';
  buffer_to_threshold?: number;
  recommended_reorder?: number;
}

interface AutomatedLowStockNotificationProps {
  products: ProductStockAlert[];
  globalThreshold: number;
  proximityData?: {
    counts?: {
      total: number;
      out_of_stock: number;
      breached: number;
      nearing: number;
      healthy: number;
      action_required: number;
    };
    products?: ProductStockAlert[];
  } | null;
  onQuickRestock?: (product: ProductStockAlert) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  userRole?: string;
}

export default function AutomatedLowStockNotification({
  products,
  globalThreshold,
  proximityData,
  onQuickRestock,
  onRefresh,
  isLoading = false,
  userRole = 'admin'
}: AutomatedLowStockNotificationProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'nearing' | 'breached' | 'out_of_stock'>('all');

  // Process products to determine proximity status and buffer values
  const analyzedProducts = useMemo(() => {
    // If backend proximityData is supplied with products, use it
    if (proximityData?.products && Array.isArray(proximityData.products) && proximityData.products.length > 0) {
      return proximityData.products;
    }

    // Otherwise compute from current inventory list
    return products.map(p => {
      const thresh = p.min_stock_level ?? p.threshold ?? globalThreshold;
      const nearThreshold = thresh <= 10 ? thresh + 5 : Math.floor(thresh * 1.5);
      
      let proximity_status: 'out_of_stock' | 'breached' | 'nearing' | 'healthy' = 'healthy';
      if (p.stock_quantity <= 0) {
        proximity_status = 'out_of_stock';
      } else if (p.stock_quantity <= thresh) {
        proximity_status = 'breached';
      } else if (p.stock_quantity <= nearThreshold) {
        proximity_status = 'nearing';
      }

      const buffer_to_threshold = p.stock_quantity - thresh;
      const recommended_reorder = Math.max(0, (thresh * 2) - p.stock_quantity);

      return {
        ...p,
        threshold: thresh,
        proximity_status,
        buffer_to_threshold,
        recommended_reorder: recommended_reorder > 0 ? recommended_reorder : thresh
      };
    });
  }, [products, proximityData, globalThreshold]);

  // Warning list includes out_of_stock, breached, AND products nearing their threshold
  const alertList = useMemo(() => {
    return analyzedProducts.filter(p => 
      p.proximity_status === 'out_of_stock' || 
      p.proximity_status === 'breached' || 
      p.proximity_status === 'nearing'
    );
  }, [analyzedProducts]);

  const outOfStockItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'out_of_stock');
  }, [alertList]);

  const breachedItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'breached');
  }, [alertList]);

  const nearingItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'nearing');
  }, [alertList]);

  const totalDeficit = useMemo(() => {
    return alertList.reduce((acc, p) => {
      const reorderPoint = p.threshold ?? p.min_stock_level ?? globalThreshold;
      const deficit = Math.max(0, reorderPoint - p.stock_quantity);
      return acc + deficit;
    }, 0);
  }, [alertList, globalThreshold]);

  const filteredAlertList = useMemo(() => {
    return alertList.filter(p => {
      // Filter by status tab
      if (statusFilter === 'out_of_stock' && p.proximity_status !== 'out_of_stock') return false;
      if (statusFilter === 'breached' && p.proximity_status !== 'breached') return false;
      if (statusFilter === 'nearing' && p.proximity_status !== 'nearing') return false;

      // Query filter
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [alertList, statusFilter, filterQuery]);

  if (isDismissed) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Bell size={15} className="text-amber-600 animate-pulse" />
          <span className="font-bold">Inventory Visual Stock Notification:</span>
          <span>
            {nearingItems.length > 0 && <strong className="text-amber-800">{nearingItems.length} nearing threshold</strong>}
            {nearingItems.length > 0 && (breachedItems.length > 0 || outOfStockItems.length > 0) && ', '}
            {breachedItems.length > 0 && <span>{breachedItems.length} low stock</span>}
            {(breachedItems.length > 0 && outOfStockItems.length > 0) && ', '}
            {outOfStockItems.length > 0 && <span className="text-rose-700 font-bold">{outOfStockItems.length} out of stock</span>}.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-xs font-black text-amber-900 hover:text-black underline cursor-pointer"
        >
          View Alert Details
        </button>
      </div>
    );
  }

  // All inventory completely healthy state
  if (alertList.length === 0) {
    return (
      <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-wider text-[11px] text-emerald-800">
                Inventory Stock Health: Optimal
              </span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-200/60 text-emerald-800">
                All Systems Safe
              </span>
            </div>
            <p className="text-emerald-700 text-xs font-normal mt-0.5">
              All tracked products are comfortably above minimum reorder thresholds. No products are currently nearing depletion.
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 rounded-xl transition flex items-center gap-1.5 border border-emerald-300/60 cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Check Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="automated-low-stock-notification" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in duration-200">
      {/* Visual Stock Notification Header */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
            <Bell size={20} className="animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                Live Inventory Proximity Monitor
              </span>
              <span className="text-xs font-bold text-slate-200">
                Early Reorder Notification System
              </span>
            </div>
            <p className="text-xs text-slate-300 font-normal mt-0.5">
              {nearingItems.length > 0 && (
                <span className="text-amber-300 font-bold mr-1.5">
                  {nearingItems.length} product(s) nearing minimum stock threshold
                </span>
              )}
              {breachedItems.length > 0 && (
                <span className="text-slate-300 mr-1.5">
                  • {breachedItems.length} low stock
                </span>
              )}
              {outOfStockItems.length > 0 && (
                <span className="text-rose-400 font-bold">
                  • {outOfStockItems.length} depleted
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick summary metric chips & collapse toggle */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold mr-2">
            {nearingItems.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {nearingItems.length} Nearing Limit
              </span>
            )}
            {breachedItems.length > 0 && (
              <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg">
                {breachedItems.length} Breached
              </span>
            )}
            {outOfStockItems.length > 0 && (
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg">
                {outOfStockItems.length} Out of Stock
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <span>{isExpanded ? 'Hide Proximity List' : `View Warning List (${alertList.length})`}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expandable Notification Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {/* Controls row: Search & Status Filter Chips */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products nearing threshold by name, SKU, or category..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Alerts ({alertList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('nearing')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'nearing' 
                      ? 'bg-amber-500 text-white font-bold shadow-xs' 
                      : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Nearing Threshold ({nearingItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('breached')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'breached' 
                      ? 'bg-orange-600 text-white font-bold shadow-xs' 
                      : 'text-orange-800 hover:text-orange-950 hover:bg-orange-50'
                  }`}
                >
                  Low Stock ({breachedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('out_of_stock')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'out_of_stock' 
                      ? 'bg-rose-600 text-white font-bold shadow-xs' 
                      : 'text-rose-800 hover:text-rose-950 hover:bg-rose-50'
                  }`}
                >
                  Out of Stock ({outOfStockItems.length})
                </button>
              </div>

              {userRole === 'admin' && (
                <Link
                  to="/purchases"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <ShoppingBag size={13} />
                  <span>New Purchase Order</span>
                </Link>
              )}
            </div>
          </div>

          {/* Visual Stock Warning Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name & SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Current Stock</th>
                  <th className="px-4 py-3 text-center">Min Threshold</th>
                  <th className="px-4 py-3 text-center">Proximity / Buffer</th>
                  <th className="px-4 py-3 text-center">Alert Status</th>
                  <th className="px-4 py-3 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlertList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No products matching selected alert category.
                    </td>
                  </tr>
                ) : (
                  filteredAlertList.map((product) => {
                    const thresh = product.threshold ?? product.min_stock_level ?? globalThreshold;
                    const isOut = product.proximity_status === 'out_of_stock' || product.stock_quantity <= 0;
                    const isBreached = product.proximity_status === 'breached';
                    const isNearing = product.proximity_status === 'nearing';
                    const buffer = product.buffer_to_threshold ?? (product.stock_quantity - thresh);

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{product.name}</span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono">{product.sku || 'No SKU'}</span>
                              {product.selling_price !== undefined && (
                                <span>• {formatGHS(product.selling_price)}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-medium">
                            {product.category || 'General'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isBreached
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            {product.stock_quantity}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center font-mono text-slate-700 font-bold text-xs">
                          {thresh}
                        </td>

                        {/* Proximity / Buffer Visual Indicator */}
                        <td className="px-4 py-3 text-center">
                          {isOut ? (
                            <span className="text-[11px] font-bold text-rose-600 font-mono">
                              0 units left (depleted)
                            </span>
                          ) : isBreached ? (
                            <span className="text-[11px] font-bold text-orange-600 font-mono">
                              {buffer} units (under min)
                            </span>
                          ) : isNearing ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>+{buffer} units to threshold</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Safe</span>
                          )}
                        </td>

                        {/* Alert Status Pill */}
                        <td className="px-4 py-3 text-center">
                          {isOut ? (
                            <span className="px-2.5 py-1 bg-rose-600 text-white rounded-full font-bold uppercase text-[10px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                              <AlertCircle size={11} /> Out of Stock
                            </span>
                          ) : isBreached ? (
                            <span className="px-2.5 py-1 bg-orange-600 text-white rounded-full font-bold uppercase text-[10px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                              <AlertTriangle size={11} /> Low Stock
                            </span>
                          ) : isNearing ? (
                            <span className="px-2.5 py-1 bg-amber-500 text-slate-900 rounded-full font-extrabold uppercase text-[10px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                              <Gauge size={11} /> Nearing Threshold
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Healthy</span>
                          )}
                        </td>

                        {/* Quick Restock / Reorder Action */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onQuickRestock && (
                              <button
                                type="button"
                                onClick={() => onQuickRestock(product)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider transition cursor-pointer shadow-2xs"
                              >
                                Restock
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const qty = product.recommended_reorder || Math.max(10, (thresh * 2) - product.stock_quantity);
                                navigate(`/purchases?reorder_product_id=${product.id}&reorder_qty=${qty}&product_name=${encodeURIComponent(product.name)}`);
                              }}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                              title="Create Purchase Order Draft"
                            >
                              <span>PO</span>
                              <ArrowUpRight size={11} />
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
