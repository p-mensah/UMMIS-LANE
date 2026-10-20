import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Truck, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  DollarSign, 
  Scale, 
  ChevronRight,
  Package,
  Layers,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { fetchApi } from '../../lib/api';
import { formatGHS } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';

export interface MiniPerformanceOverviewWidgetProps {
  initialSales?: any[];
  initialPurchases?: any[];
  className?: string;
}

export default function MiniPerformanceOverviewWidget({
  initialSales,
  initialPurchases,
  className = ''
}: MiniPerformanceOverviewWidgetProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [sales, setSales] = useState<any[]>(initialSales || []);
  const [purchases, setPurchases] = useState<any[]>(initialPurchases || []);
  const [loading, setLoading] = useState<boolean>(!initialSales || !initialPurchases);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('30d');

  const loadData = async () => {
    setLoading(true);
    try {
      const promises: [Promise<any>, Promise<any>] = [
        fetchApi('/sales').catch(() => []),
        isAdmin ? fetchApi('/purchases').catch(() => []) : Promise.resolve([])
      ];
      const [salesData, purchasesData] = await Promise.all(promises);
      if (Array.isArray(salesData)) setSales(salesData);
      if (Array.isArray(purchasesData)) setPurchases(purchasesData);
    } catch (err) {
      console.error('Failed to load performance metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSales || !initialPurchases) {
      loadData();
    }
  }, [user]);

  // Filter records by selected timeframe
  const filteredMetrics = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (timeframe === '7d') cutoff.setDate(now.getDate() - 7);
    if (timeframe === '30d') cutoff.setDate(now.getDate() - 30);

    const relevantSales = sales.filter(s => {
      if (timeframe === 'all') return true;
      const sDate = new Date(s.created_at || s.date);
      return !isNaN(sDate.getTime()) && sDate >= cutoff;
    });

    const relevantPurchases = purchases.filter(p => {
      if (timeframe === 'all') return true;
      const pDate = new Date(p.created_at || p.expected_date);
      return !isNaN(pDate.getTime()) && pDate >= cutoff;
    });

    // 1. Sales Calculations
    const completedSales = relevantSales.filter(s => s.status !== 'refunded');
    const totalSalesRevenue = completedSales.reduce((acc, s) => acc + (Number(s.total_amount ?? s.total) || 0), 0);
    const totalProfit = completedSales.reduce((acc, s) => acc + (Number(s.profit) || 0), 0);
    const salesCount = completedSales.length;
    const avgTicket = salesCount > 0 ? totalSalesRevenue / salesCount : 0;

    // Payment method distribution
    let cashSalesTotal = 0;
    let momoSalesTotal = 0;
    completedSales.forEach(s => {
      const amt = Number(s.total_amount ?? s.total) || 0;
      const method = (s.payment_method || '').toLowerCase();
      if (method.includes('cash')) {
        cashSalesTotal += amt;
      } else {
        momoSalesTotal += amt;
      }
    });

    // 2. Purchases Calculations
    const totalPurchasesCost = relevantPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0);
    const purchasesCount = relevantPurchases.length;
    const receivedPurchases = relevantPurchases.filter(p => p.status === 'received' || p.status === 'completed');
    const receivedPurchasesCost = receivedPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0);
    const pendingPurchasesCount = relevantPurchases.filter(p => p.status === 'pending' || p.status === 'ordered').length;
    const totalUnitsProcured = relevantPurchases.reduce((acc, p) => acc + (Number(p.total_units) || 0), 0);

    // 3. Cross-Comparative Performance Ratios
    const netCommercialDelta = totalSalesRevenue - totalPurchasesCost;
    const isSurplus = netCommercialDelta >= 0;
    
    // Coverage ratio: how much sales revenue covers purchase outlay
    const coverageRatio = totalPurchasesCost > 0 ? (totalSalesRevenue / totalPurchasesCost) : (totalSalesRevenue > 0 ? 99 : 1);
    
    // Split percentage for visual inflow vs outflow balance bar
    const totalTurnover = totalSalesRevenue + totalPurchasesCost;
    const salesPercent = totalTurnover > 0 ? Math.round((totalSalesRevenue / totalTurnover) * 100) : 50;
    const purchasePercent = 100 - salesPercent;

    return {
      totalSalesRevenue,
      salesCount,
      avgTicket,
      totalProfit,
      cashSalesTotal,
      momoSalesTotal,
      totalPurchasesCost,
      purchasesCount,
      receivedPurchasesCost,
      pendingPurchasesCount,
      totalUnitsProcured,
      netCommercialDelta,
      isSurplus,
      coverageRatio,
      salesPercent,
      purchasePercent
    };
  }, [sales, purchases, timeframe]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Scale size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Sales & Procurement Overview
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">·</span>
              <span className="text-[11px] font-bold text-slate-500">Commercial Balance</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live commercial delta between customer sales inflow and supplier restock outlays.
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Refresh Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimeframe('7d')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeframe === '7d' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('30d')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeframe === '30d' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeframe === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
            title="Refresh metrics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* Top 3-Column Comparative Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          
          {/* Column 1: Sales Inflow */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700">
                <ShoppingCart size={14} className="text-blue-600" />
                Customer Sales Inflow
              </span>
              <span className="text-[11px] font-mono text-slate-400">{filteredMetrics.salesCount} orders</span>
            </div>
            
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatGHS(filteredMetrics.totalSalesRevenue)}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200/60">
              <span>Avg Ticket: <strong className="text-slate-700">{formatGHS(filteredMetrics.avgTicket)}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Profit: <strong className="text-emerald-600">{formatGHS(filteredMetrics.totalProfit)}</strong></span>
            </div>
          </div>

          {/* Column 2: Procurement Outflow */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Truck size={14} className="text-indigo-600" />
                Restock Procurement Outflow
              </span>
              <span className="text-[11px] font-mono text-slate-400">{filteredMetrics.purchasesCount} POs</span>
            </div>

            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {isAdmin ? formatGHS(filteredMetrics.totalPurchasesCost) : 'Restricted'}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200/60">
              {isAdmin ? (
                <>
                  <span>Received: <strong className="text-slate-700">{formatGHS(filteredMetrics.receivedPurchasesCost)}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Pending: <strong className="text-amber-600">{filteredMetrics.pendingPurchasesCount} orders</strong></span>
                </>
              ) : (
                <span className="text-slate-400">Restock procurement data visible to managers</span>
              )}
            </div>
          </div>

          {/* Column 3: Net Commercial Delta (Inflow minus Outflow) */}
          <div className={`rounded-xl p-4 border space-y-2 ${
            filteredMetrics.isSurplus 
              ? 'bg-emerald-50/50 border-emerald-200/80' 
              : 'bg-amber-50/50 border-amber-200/80'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={`flex items-center gap-1.5 ${filteredMetrics.isSurplus ? 'text-emerald-800' : 'text-amber-800'}`}>
                {filteredMetrics.isSurplus ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                Net Operational Surplus
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                filteredMetrics.isSurplus ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {filteredMetrics.isSurplus ? 'Surplus' : 'Reinvestment'}
              </span>
            </div>

            <div className={`text-2xl font-black font-mono tracking-tight ${
              filteredMetrics.isSurplus ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {isAdmin ? (
                `${filteredMetrics.isSurplus ? '+' : ''}${formatGHS(filteredMetrics.netCommercialDelta)}`
              ) : (
                formatGHS(filteredMetrics.totalSalesRevenue)
              )}
            </div>

            <div className={`flex items-center gap-2 text-[11px] font-medium pt-1 border-t ${
              filteredMetrics.isSurplus ? 'border-emerald-200/60 text-emerald-700' : 'border-amber-200/60 text-amber-700'
            }`}>
              {isAdmin ? (
                <>
                  <span>Coverage: <strong>{filteredMetrics.coverageRatio.toFixed(1)}x</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>{filteredMetrics.isSurplus ? 'Revenue exceeds restock spend' : 'Inventory expansion phase'}</span>
                </>
              ) : (
                <span>Sales volume healthy</span>
              )}
            </div>
          </div>

        </div>

        {/* Comparative Dual Distribution Bar */}
        {isAdmin && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                <span>Sales Inflow ({filteredMetrics.salesPercent}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Procurement Outflow ({filteredMetrics.purchasePercent}%)</span>
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />
              </div>
            </div>

            {/* Visual Balance Bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="bg-blue-600 h-full transition-all duration-500 rounded-l-full"
                style={{ width: `${Math.max(5, Math.min(95, filteredMetrics.salesPercent))}%` }}
                title={`Sales Revenue: ${formatGHS(filteredMetrics.totalSalesRevenue)} (${filteredMetrics.salesPercent}%)`}
              />
              <div 
                className="bg-slate-800 h-full transition-all duration-500 rounded-r-full"
                style={{ width: `${Math.max(5, Math.min(95, filteredMetrics.purchasePercent))}%` }}
                title={`Procurement Cost: ${formatGHS(filteredMetrics.totalPurchasesCost)} (${filteredMetrics.purchasePercent}%)`}
              />
            </div>
          </div>
        )}

        {/* Footer Quick Links & Metadata */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Cash Tendered: <strong className="text-slate-700">{formatGHS(filteredMetrics.cashSalesTotal)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Mobile Money: <strong className="text-slate-700">{formatGHS(filteredMetrics.momoSalesTotal)}</strong></span>
            {isAdmin && filteredMetrics.totalUnitsProcured > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Restocked Units: <strong className="text-slate-700">{filteredMetrics.totalUnitsProcured}</strong></span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/sales"
              className="px-2.5 py-1 text-slate-700 hover:text-blue-600 hover:bg-slate-50 font-bold transition rounded-lg border border-slate-200 flex items-center gap-1"
            >
              <span>Sales Ledger</span>
              <ChevronRight size={13} />
            </Link>

            {isAdmin && (
              <Link
                to="/purchases"
                className="px-2.5 py-1 text-slate-700 hover:text-blue-600 hover:bg-slate-50 font-bold transition rounded-lg border border-slate-200 flex items-center gap-1"
              >
                <span>Purchase Orders</span>
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
