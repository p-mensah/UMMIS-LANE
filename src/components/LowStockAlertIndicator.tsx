import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck, 
  ArrowRight, RefreshCw, ShoppingBag, Truck, SlidersHorizontal, 
  Lock, Unlock, Eye, EyeOff, Settings, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  threshold?: number;
  min_stock_level?: number;
}

interface LowStockAlertIndicatorProps {
  products: Product[];
  globalThreshold: number;
  userRole?: string;
  allowStaffAdjustments: boolean;
  showStaffAlerts: boolean;
  onToggleStaffAdjustments?: (newValue: boolean) => Promise<void>;
  onToggleStaffAlerts?: (newValue: boolean) => Promise<void>;
  onOpenThresholdModal?: () => void;
  onQuickRestock?: (product: Product) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function LowStockAlertIndicator({
  products,
  globalThreshold,
  userRole = 'admin',
  allowStaffAdjustments,
  showStaffAlerts,
  onToggleStaffAdjustments,
  onToggleStaffAlerts,
  onOpenThresholdModal,
  onQuickRestock,
  onRefresh,
  isLoading = false
}: LowStockAlertIndicatorProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'out_of_stock' | 'critical'>('all');

  const isAdmin = userRole === 'admin';

  // Calculate live inventory health metrics based on individual threshold or global threshold
  const lowStockItems = products.filter(p => {
    const thresh = p.min_stock_level || p.threshold || globalThreshold;
    return p.stock_quantity <= thresh;
  });

  const outOfStockItems = lowStockItems.filter(p => p.stock_quantity === 0);
  const warningItems = lowStockItems.filter(p => p.stock_quantity > 0);

  const totalProductsCount = products.length;
  const healthyCount = Math.max(0, totalProductsCount - lowStockItems.length);
  const healthPercentage = totalProductsCount > 0 
    ? Math.round((healthyCount / totalProductsCount) * 100) 
    : 100;

  // Filtered list for display
  const displayedItems = lowStockItems.filter(p => {
    if (selectedFilter === 'out_of_stock') return p.stock_quantity === 0;
    if (selectedFilter === 'critical') return p.stock_quantity > 0 && p.stock_quantity <= 3;
    return true;
  });

  // Track live timer ticker for real-time indicator
  useEffect(() => {
    setLastUpdated(new Date());
    setSecondsAgo(0);
    const interval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [products, globalThreshold]);

  // Navigate to purchase orders with quick reorder parameters
  const handleQuickReorderDraft = (product: Product) => {
    const thresh = product.min_stock_level || product.threshold || globalThreshold;
    const reorderQty = Math.max(10, thresh * 2 - product.stock_quantity);
    navigate(`/purchases?reorder_product_id=${product.id}&reorder_qty=${reorderQty}&product_name=${encodeURIComponent(product.name)}`);
  };

  // Determine overall inventory status archetype
  const statusType: 'critical' | 'warning' | 'healthy' = 
    outOfStockItems.length > 0 ? 'critical' :
    warningItems.length > 0 ? 'warning' : 'healthy';

  return (
    <div className={`rounded-xl border transition-all shadow-sm overflow-hidden ${
      statusType === 'critical'
        ? 'bg-gradient-to-b from-rose-50/90 to-white border-rose-200'
        : statusType === 'warning'
        ? 'bg-gradient-to-b from-amber-50/90 to-white border-amber-200'
        : 'bg-gradient-to-b from-emerald-50/90 to-white border-emerald-200'
    }`}>
      {/* Top Real-Time Status Header */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Title and Beacon */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="relative shrink-0 mt-0.5 sm:mt-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                statusType === 'critical'
                  ? 'bg-rose-600 text-white shadow-rose-200'
                  : statusType === 'warning'
                  ? 'bg-amber-500 text-white shadow-amber-200'
                  : 'bg-emerald-600 text-white shadow-emerald-200'
              }`}>
                {statusType === 'critical' && <AlertCircle size={22} className="animate-pulse" />}
                {statusType === 'warning' && <AlertTriangle size={22} />}
                {statusType === 'healthy' && <ShieldCheck size={22} />}
              </div>

              {/* Pulsing beacon ping when critical or warning */}
              {statusType !== 'healthy' && (
                <span className={`absolute -top-1 -right-1 flex h-3.5 w-3.5`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    statusType === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    statusType === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {statusType === 'critical' && 'Real-Time Low Stock Alert: Critical Stockouts Detected'}
                  {statusType === 'warning' && `Real-Time Low Stock Warning: ${lowStockItems.length} Items Below Threshold`}
                  {statusType === 'healthy' && 'Real-Time Inventory Status: Optimal Stock Levels'}
                </h2>

                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${
                  statusType === 'critical'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : statusType === 'warning'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  {statusType === 'critical' ? `${outOfStockItems.length} Out of Stock` :
                   statusType === 'warning' ? `${warningItems.length} Low Stock` : 'Healthy (100%)'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium mt-1">
                <span>Alert threshold: <strong className="text-slate-900 font-bold">≤ {globalThreshold} units</strong></span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync: {secondsAgo < 5 ? 'Just now' : `${secondsAgo}s ago`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Tools and Indicator Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition shadow-xs disabled:opacity-50"
                title="Refresh Live Inventory Status"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
              </button>
            )}

            {isAdmin && onOpenThresholdModal && (
              <button
                onClick={onOpenThresholdModal}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-bold text-xs transition shadow-xs flex items-center gap-1.5"
              >
                <Settings size={13} className="text-slate-500" />
                <span>Threshold: {globalThreshold}</span>
              </button>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <span>{isExpanded ? 'Hide Details' : `View ${lowStockItems.length} Alerts`}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Live Inventory Health Progress Gauge */}
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>Overall Catalog Stock Health</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                healthPercentage >= 90 ? 'text-emerald-700 bg-emerald-100' :
                healthPercentage >= 70 ? 'text-amber-700 bg-amber-100' :
                'text-rose-700 bg-rose-100'
              }`}>
                {healthPercentage}% Healthy
              </span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {healthyCount} healthy of {totalProductsCount} SKUs
            </span>
          </div>

          {/* Multi-segment progress bar */}
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
            {healthyCount > 0 && (
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${(healthyCount / Math.max(1, totalProductsCount)) * 100}%` }}
                title={`${healthyCount} healthy items`}
              />
            )}
            {warningItems.length > 0 && (
              <div 
                className="bg-amber-400 h-full transition-all duration-500"
                style={{ width: `${(warningItems.length / Math.max(1, totalProductsCount)) * 100}%` }}
                title={`${warningItems.length} warning items`}
              />
            )}
            {outOfStockItems.length > 0 && (
              <div 
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${(outOfStockItems.length / Math.max(1, totalProductsCount)) * 100}%` }}
                title={`${outOfStockItems.length} out of stock items`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Admin Governance Quick-Control Strip */}
      {isAdmin && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-indigo-400 shrink-0" />
            <span className="font-black uppercase tracking-wider text-[10px] text-slate-300">
              Admin Governance & Staff Dashboard Toggles:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Staff Stock Adjustments Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                {allowStaffAdjustments ? (
                  <Unlock size={12} className="text-emerald-400" />
                ) : (
                  <Lock size={12} className="text-amber-400" />
                )}
                Staff Stock Adjustments:
              </span>
              <button
                type="button"
                onClick={() => onToggleStaffAdjustments && onToggleStaffAdjustments(!allowStaffAdjustments)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition border ${
                  allowStaffAdjustments
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                }`}
              >
                {allowStaffAdjustments ? 'Enabled' : 'Disabled (Protected)'}
              </button>
            </div>

            {/* Staff Alert Visibility Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                {showStaffAlerts ? (
                  <Eye size={12} className="text-blue-400" />
                ) : (
                  <EyeOff size={12} className="text-slate-400" />
                )}
                Staff Dashboard Alerts:
              </span>
              <button
                type="button"
                onClick={() => onToggleStaffAlerts && onToggleStaffAlerts(!showStaffAlerts)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition border ${
                  showStaffAlerts
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                    : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
                }`}
              >
                {showStaffAlerts ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Real-Time Low Stock Items Grid & Fast Reorder */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 space-y-4">
          {/* Sub-filters bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/70">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition ${
                  selectedFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Alerts ({lowStockItems.length})
              </button>

              <button
                onClick={() => setSelectedFilter('out_of_stock')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition ${
                  selectedFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                Out of Stock ({outOfStockItems.length})
              </button>

              <button
                onClick={() => setSelectedFilter('critical')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition ${
                  selectedFilter === 'critical'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                Critical (≤3)
              </button>
            </div>

            {isAdmin && lowStockItems.length > 0 && (
              <button
                onClick={() => navigate('/purchases')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition self-start sm:self-auto"
              >
                <span>Go to Purchase Orders Module</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Cards or Empty State */}
          {displayedItems.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-500 space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-80" />
              <div className="text-xs font-bold text-slate-800">
                {selectedFilter === 'all' 
                  ? 'All inventory items are currently above safety thresholds!' 
                  : 'No items matching the selected alert category.'}
              </div>
              <p className="text-[11px] text-slate-400">
                Automated threshold monitoring checks sales in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedItems.slice(0, 6).map((prod) => {
                const thresh = prod.min_stock_level || prod.threshold || globalThreshold;
                const isOut = prod.stock_quantity === 0;

                return (
                  <div
                    key={prod.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isOut
                        ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                        : 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-slate-900 truncate" title={prod.name}>
                            {prod.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">
                            {prod.sku} • {prod.category || 'General'}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 border ${
                          isOut
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}>
                          {isOut ? '0 Left' : `${prod.stock_quantity} Left`}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 font-medium flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                        <span>Threshold: <strong>{thresh} units</strong></span>
                        <span className="font-bold text-slate-900">{formatGHS(prod.selling_price)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => handleQuickReorderDraft(prod)}
                            className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition shadow-2xs flex items-center justify-center gap-1"
                            title="Auto-populate Purchase Order draft for this product"
                          >
                            <Truck size={12} />
                            <span>Quick Reorder</span>
                          </button>

                          {onQuickRestock && (
                            <button
                              onClick={() => onQuickRestock(prod)}
                              className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold uppercase transition"
                              title="Direct stock adjustment / restock"
                            >
                              + Restock
                            </button>
                          )}
                        </>
                      ) : (
                        /* Staff view */
                        allowStaffAdjustments && onQuickRestock ? (
                          <button
                            onClick={() => onQuickRestock(prod)}
                            className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1"
                          >
                            + Record Restock
                          </button>
                        ) : (
                          <div className="w-full py-1 text-center text-[10px] font-bold text-slate-500 bg-slate-100 rounded border border-slate-200">
                            Notify Manager to Reorder
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {displayedItems.length > 6 && (
            <div className="pt-2 text-center">
              <span className="text-xs text-slate-500 font-medium">
                Showing top 6 items. See the full table below for all {lowStockItems.length} alerts.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
