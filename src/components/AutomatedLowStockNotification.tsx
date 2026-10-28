import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ChevronDown, ChevronUp, 
  ShoppingBag, Search, X, ArrowUpRight,
  AlertTriangle, Settings, Download, Plus,
  CheckCircle2, ShieldAlert, Package, RefreshCw,
  SlidersHorizontal, Boxes, Eye, Truck, ShoppingCart,
  TrendingUp, Zap
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import RowActionMenu from './common/RowActionMenu';

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
  daily_velocity?: number;
  dynamic_threshold?: number;
  runway_days?: number | null;
  is_velocity_breached?: boolean;
  velocity_status?: 'velocity_critical' | 'velocity_warning' | 'normal';
  effective_threshold?: number;
  lead_days?: number;
  total_qty_sold?: number;
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
      velocity_breached?: number;
      action_required: number;
    };
    products?: ProductStockAlert[];
    leadDays?: number;
    lookbackDays?: number;
    velocityAlertsEnabled?: boolean;
  } | null;
  onQuickRestock?: (product: ProductStockAlert) => void;
  onCreatePO?: (product: ProductStockAlert) => void;
  onOpenThresholdModal?: () => void;
  onExportCSV?: () => void;
  onRefresh?: () => void;
  onTriggerVelocityAudit?: () => void;
  isLoading?: boolean;
  userRole?: string;
}

export default function AutomatedLowStockNotification({
  products,
  globalThreshold,
  proximityData,
  onQuickRestock,
  onCreatePO,
  onOpenThresholdModal,
  onExportCSV,
  onRefresh,
  onTriggerVelocityAudit,
  isLoading = false,
  userRole = 'admin'
}: AutomatedLowStockNotificationProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'velocity' | 'nearing' | 'breached' | 'out_of_stock'>('all');

  // Process products to determine proximity status and buffer values
  const analyzedProducts = useMemo(() => {
    if (proximityData?.products && Array.isArray(proximityData.products) && proximityData.products.length > 0) {
      return proximityData.products;
    }

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
      const dailyVelocity = p.daily_velocity || 0;
      const dynamicThreshold = p.dynamic_threshold || Math.ceil(dailyVelocity * (p.lead_days || 7));
      const is_velocity_breached = p.is_velocity_breached || (dailyVelocity > 0 && p.stock_quantity <= dynamicThreshold);
      const runway_days = dailyVelocity > 0 ? parseFloat((p.stock_quantity / dailyVelocity).toFixed(1)) : null;

      const effectiveThreshold = Math.max(thresh, dynamicThreshold);
      const recommended_reorder = Math.max(10, (effectiveThreshold * 2) - Math.max(0, p.stock_quantity));

      return {
        ...p,
        threshold: thresh,
        proximity_status,
        buffer_to_threshold,
        daily_velocity: dailyVelocity,
        dynamic_threshold: dynamicThreshold,
        runway_days,
        is_velocity_breached,
        effective_threshold: effectiveThreshold,
        recommended_reorder
      };
    });
  }, [products, proximityData, globalThreshold]);

  // Warning list includes out_of_stock, breached, products nearing threshold, AND products breaching velocity runway
  const alertList = useMemo(() => {
    return analyzedProducts.filter(p => 
      p.proximity_status === 'out_of_stock' || 
      p.proximity_status === 'breached' || 
      p.proximity_status === 'nearing' ||
      p.is_velocity_breached
    );
  }, [analyzedProducts]);

  const velocityItems = useMemo(() => {
    return alertList.filter(p => p.is_velocity_breached);
  }, [alertList]);

  const outOfStockItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'out_of_stock');
  }, [alertList]);

  const breachedItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'breached');
  }, [alertList]);

  const nearingItems = useMemo(() => {
    return alertList.filter(p => p.proximity_status === 'nearing');
  }, [alertList]);

  const filteredAlertList = useMemo(() => {
    return alertList.filter(p => {
      if (statusFilter === 'velocity' && !p.is_velocity_breached) return false;
      if (statusFilter === 'out_of_stock' && p.proximity_status !== 'out_of_stock') return false;
      if (statusFilter === 'breached' && p.proximity_status !== 'breached') return false;
      if (statusFilter === 'nearing' && p.proximity_status !== 'nearing') return false;

      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [alertList, statusFilter, filterQuery]);

  // Collapsed / Mini strip state
  if (isDismissed) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-amber-950 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center font-bold">
            <AlertTriangle size={15} />
          </div>
          <div>
            <span className="font-black text-amber-900">Low Stock Proximity Monitor: </span>
            <span className="text-amber-800">
              {nearingItems.length > 0 && <strong className="text-amber-900 font-bold">{nearingItems.length} nearing reorder point</strong>}
              {nearingItems.length > 0 && (breachedItems.length > 0 || outOfStockItems.length > 0) && ', '}
              {breachedItems.length > 0 && <span className="text-orange-900 font-bold">{breachedItems.length} below reorder point</span>}
              {(breachedItems.length > 0 && outOfStockItems.length > 0) && ', '}
              {outOfStockItems.length > 0 && <span className="text-rose-900 font-black">{outOfStockItems.length} out of stock</span>}.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
        >
          Open Alert Center
        </button>
      </div>
    );
  }

  // All inventory completely safe
  if (alertList.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black uppercase tracking-wider text-xs text-emerald-900">
                Low Stock Notification System: Healthy
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-200/80 text-emerald-900">
                No Stockouts Imminent
              </span>
            </div>
            <p className="text-emerald-800 text-xs font-medium mt-0.5">
              Continuous monitoring active. All product quantities are comfortably above reorder points with healthy replenishment buffers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          {onOpenThresholdModal && userRole === 'admin' && (
            <button
              type="button"
              onClick={onOpenThresholdModal}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition border border-slate-300 bg-slate-50 cursor-pointer flex items-center gap-1"
            >
              <Settings size={12} />
              <span>Threshold: {globalThreshold}</span>
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 rounded-lg transition border border-emerald-300 bg-white cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>Verify Stock</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="low-stock-notification-system" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Visual Stock Notification Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-white tracking-tight">
                Low Stock Notification System
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Monitor
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Default Point: {globalThreshold} units
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Continuously monitoring inventory quantities and flagging items nearing or below reorder points.
            </p>
          </div>
        </div>

        {/* Real-time counters & Collapse controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            {velocityItems.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/25 text-amber-200 border border-amber-400/50 rounded-lg flex items-center gap-1 shadow-2xs font-black animate-pulse">
                <Zap size={12} className="text-amber-300" />
                <span>{velocityItems.length} Dynamic Velocity Alerts</span>
              </span>
            )}
            {nearingItems.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>{nearingItems.length} Nearing Reorder</span>
              </span>
            )}
            {breachedItems.length > 0 && (
              <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded-lg">
                {breachedItems.length} Low Stock
              </span>
            )}
            {outOfStockItems.length > 0 && (
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg">
                {outOfStockItems.length} Depleted
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {onTriggerVelocityAudit && userRole === 'admin' && (
              <button
                type="button"
                onClick={onTriggerVelocityAudit}
                disabled={isLoading}
                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-amber-500/40 cursor-pointer"
                title="Run dynamic sales velocity evaluation"
              >
                <Zap size={12} className="text-amber-400" />
                <span className="hidden sm:inline">Velocity Audit</span>
              </button>
            )}

            {onOpenThresholdModal && userRole === 'admin' && (
              <button
                type="button"
                onClick={onOpenThresholdModal}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                title="Configure global threshold"
              >
                <Settings size={12} />
                <span className="hidden sm:inline">Threshold</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <span>{isExpanded ? 'Minimize' : `View Flagged (${alertList.length})`}</span>
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Minimize notification bar"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Notification Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60">
          {/* Controls row: Search, Filter Tabs, and PO Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search flagged items by name, SKU, or category..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium shadow-2xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Flagged ({alertList.length})
                </button>
                {velocityItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('velocity')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'velocity' 
                        ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                        : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                    }`}
                  >
                    <Zap size={12} className="text-amber-600" />
                    Dynamic Velocity Alerts ({velocityItems.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatusFilter('nearing')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'nearing' 
                      ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                      : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Nearing Reorder Point ({nearingItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('breached')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'breached' 
                      ? 'bg-orange-600 text-white font-bold shadow-2xs' 
                      : 'text-orange-800 hover:text-orange-950 hover:bg-orange-50'
                  }`}
                >
                  Below Reorder Point ({breachedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('out_of_stock')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'out_of_stock' 
                      ? 'bg-rose-600 text-white font-bold shadow-2xs' 
                      : 'text-rose-800 hover:text-rose-950 hover:bg-rose-50'
                  }`}
                >
                  Out of Stock ({outOfStockItems.length})
                </button>
              </div>

              {onExportCSV && (
                <button
                  type="button"
                  onClick={onExportCSV}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export flagged items to CSV"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              )}

              {userRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    if (onCreatePO && filteredAlertList.length > 0) {
                      onCreatePO(filteredAlertList[0]);
                    } else {
                      navigate('/purchases');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                >
                  <ShoppingBag size={13} />
                  <span>Create Purchase Order</span>
                </button>
              )}
            </div>
          </div>

          {/* Low Stock Flagged Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name & SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Current Stock</th>
                  <th className="px-4 py-3 text-center">Baseline & Dynamic Reorder Point</th>
                  <th className="px-4 py-3 text-center">Buffer & Velocity Runway</th>
                  <th className="px-4 py-3 text-center">Alert Classification</th>
                  <th className="px-4 py-3 text-right">Replenishment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlertList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-500 opacity-60" />
                      No products currently matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredAlertList.map((product) => {
                    const thresh = product.threshold ?? product.min_stock_level ?? globalThreshold;
                    const isOut = product.proximity_status === 'out_of_stock' || product.stock_quantity <= 0;
                    const isBreached = product.proximity_status === 'breached';
                    const isNearing = product.proximity_status === 'nearing';
                    const buffer = product.buffer_to_threshold ?? (product.stock_quantity - thresh);
                    const recommendedQty = product.recommended_reorder || Math.max(10, (thresh * 2) - Math.max(0, product.stock_quantity));

                    // Ratio of current stock to effective reorder point
                    const compThreshold = Math.max(thresh, product.dynamic_threshold || 0);
                    const stockRatio = compThreshold > 0 ? Math.min(100, Math.round((product.stock_quantity / compThreshold) * 100)) : 100;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs">{product.name}</span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="font-mono">{product.sku || 'No SKU'}</span>
                              {product.selling_price !== undefined && (
                                <span>• Sell: {formatGHS(product.selling_price)}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-medium">
                            {product.category || 'General'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
                              isOut
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : isBreached || product.is_velocity_breached
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}>
                              {product.stock_quantity} units
                            </span>
                            {/* Stock progress bar relative to reorder point */}
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isOut ? 'bg-rose-500' : (isBreached || product.is_velocity_breached) ? 'bg-orange-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${stockRatio}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Baseline & Dynamic Reorder Point */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono text-slate-700 font-bold text-xs">{thresh} units</span>
                            {product.daily_velocity !== undefined && product.daily_velocity > 0 && (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-bold"
                                title={`Dynamic threshold based on ${product.lead_days || 7}-day lead buffer at ${product.daily_velocity} units/day`}
                              >
                                <Zap size={10} className="text-amber-600" />
                                <span>Dynamic: {product.dynamic_threshold} units</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Proximity / Buffer Visual Indicator & Velocity Runway */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
                                0 units left (depleted)
                              </span>
                            ) : isBreached ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-800 font-bold text-[11px]">
                                {Math.abs(buffer)} units deficit
                              </span>
                            ) : isNearing ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[11px]">
                                +{buffer} units buffer
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Healthy</span>
                            )}

                            {product.daily_velocity !== undefined && product.daily_velocity > 0 ? (
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-slate-500 font-medium">⚡ {product.daily_velocity}/day</span>
                                {product.runway_days !== null && product.runway_days !== undefined && (
                                  <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                                    product.runway_days <= 2 
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                      : product.runway_days <= (product.lead_days || 7) 
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    ~{product.runway_days}d runway
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No recent sales</span>
                            )}
                          </div>
                        </td>

                        {/* Alert Status Pill */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {product.is_velocity_breached && (
                              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-black uppercase text-[10px] tracking-wider inline-flex items-center gap-1 shadow-2xs">
                                <Zap size={10} className="fill-slate-950" />
                                Velocity Alert
                              </span>
                            )}
                            {isOut ? (
                              <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded font-bold uppercase text-[10px] tracking-wider inline-block shadow-2xs">
                                Out of Stock
                              </span>
                            ) : isBreached ? (
                              <span className="px-2.5 py-0.5 bg-orange-600 text-white rounded font-bold uppercase text-[10px] tracking-wider inline-block shadow-2xs">
                                Below Reorder Point
                              </span>
                            ) : isNearing ? (
                              <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded font-black uppercase text-[10px] tracking-wider inline-block shadow-2xs">
                                Nearing Reorder Point
                              </span>
                            ) : !product.is_velocity_breached ? (
                              <span className="text-slate-400 text-xs">Safe</span>
                            ) : null}
                          </div>
                        </td>

                        {/* Kebab Action Menu */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <RowActionMenu
                              triggerTitle={`Actions for ${product.name}`}
                              actions={[
                                onQuickRestock ? {
                                  label: 'Quick Restock',
                                  sublabel: `Add stock buffer (+${recommendedQty} units)`,
                                  icon: <RefreshCw size={14} className="text-amber-600" />,
                                  onClick: () => onQuickRestock(product),
                                } : null,
                                userRole === 'admin' && product.is_velocity_breached ? {
                                  label: `Reorder Velocity Buffer (+${product.recommended_reorder || product.dynamic_threshold} units)`,
                                  sublabel: `Cover ${product.lead_days || 7}-day sales runway`,
                                  icon: <Zap size={14} className="text-amber-500" />,
                                  onClick: () => {
                                    navigate(`/purchases?reorder_product_id=${product.id}&reorder_qty=${product.recommended_reorder || product.dynamic_threshold}&product_name=${encodeURIComponent(product.name)}&reason=velocity`);
                                  },
                                } : null,
                                userRole === 'admin' ? {
                                  label: `Create Purchase Order (${recommendedQty} units)`,
                                  sublabel: 'Issue PO to supplier',
                                  icon: <Truck size={14} className="text-blue-600" />,
                                  onClick: () => {
                                    if (onCreatePO) {
                                      onCreatePO(product);
                                    } else {
                                      navigate(`/purchases?reorder_product_id=${product.id}&reorder_qty=${recommendedQty}&product_name=${encodeURIComponent(product.name)}`);
                                    }
                                  },
                                } : null,
                                {
                                  label: 'View Product Details',
                                  sublabel: 'Specs, pricing & stock',
                                  icon: <Eye size={14} />,
                                  onClick: () => navigate(`/products/${product.id}`),
                                },
                                {
                                  label: 'Open in POS Terminal',
                                  sublabel: 'Sell remaining stock',
                                  icon: <ShoppingCart size={14} className="text-emerald-600" />,
                                  onClick: () => navigate('/sales'),
                                },
                              ]}
                            />
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
