import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import InvoiceModal from '../components/InvoiceModal';
import { 
  Package, AlertCircle, AlertTriangle, DollarSign, TrendingUp, Info, 
  Search, Download, Settings, PlusCircle, ArrowRight, RefreshCw, CheckCircle2,
  Calendar, FileText, Printer, ArrowUpRight, ArrowDownRight, Wallet, Receipt,
  UserCheck, Shield, Award, Target, Clock, ShoppingCart, UserPlus, BarChart3, Users, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, ReferenceLine, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie } from 'recharts';
import { formatGHS } from '../lib/formatters';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'admin' | 'staff'>(user?.role === 'admin' ? 'admin' : 'staff');

  const [summary, setSummary] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [trendTimeframe, setTrendTimeframe] = useState<'30days' | 'weekly' | 'monthly' | 'yearly'>('30days');
  const [chartType, setChartType] = useState<'area' | 'line' | 'bar'>('area');
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [recentSalesList, setRecentSalesList] = useState<any[]>([]);
  const [selectedInvoiceSale, setSelectedInvoiceSale] = useState<any>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Staff specific states
  const [staffSummary, setStaffSummary] = useState<any>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  // Monthly breakdown states
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthlySummaryData, setMonthlySummaryData] = useState<any>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Low stock alert section states
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState<'all' | 'out_of_stock' | 'critical'>('all');
  
  // Quick Restock Modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProductForRestock, setSelectedProductForRestock] = useState<any>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockReason, setRestockReason] = useState<string>('Restock / New Shipment');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Global Threshold Modal
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  // Daily Summary Modal
  const [showDailySummaryModal, setShowDailySummaryModal] = useState(false);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [dailySummaryTab, setDailySummaryTab] = useState<'all' | 'sales' | 'expenses'>('all');

  // Trend derived analytics
  const totalTrendRevenue = salesTrends.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const avgTrendRevenue = salesTrends.length > 0 ? totalTrendRevenue / salesTrends.length : 0;
  const peakTrendDay = salesTrends.length > 0 ? [...salesTrends].sort((a, b) => (b.total || 0) - (a.total || 0))[0] : null;
  const activeSalesDaysCount = salesTrends.filter(d => (d.total || 0) > 0).length;

  useEffect(() => {
    loadDashboardData();
    loadStaffSummary();
  }, [user]);

  useEffect(() => {
    loadMonthlySummary(selectedMonth);
  }, [selectedMonth]);

  const loadStaffSummary = () => {
    setStaffLoading(true);
    fetchApi('/reports/staff-my-summary')
      .then(data => setStaffSummary(data))
      .catch(console.error)
      .finally(() => setStaffLoading(false));
  };

  const loadMonthlySummary = (monthStr: string) => {
    setMonthlyLoading(true);
    fetchApi(`/reports/monthly-summary?month=${monthStr}`)
      .then(data => setMonthlySummaryData(data))
      .catch(console.error)
      .finally(() => setMonthlyLoading(false));
  };

  const getMonthOptions = () => {
    const options = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const val = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ val, label });
    }
    return options;
  };

  const loadDashboardData = () => {
    setLoading(true);
    Promise.all([
      fetchApi('/reports/summary'),
      fetchApi('/reports/low-stock'),
      fetchApi('/reports/chart'),
      fetchApi('/reports/monthly-trends'),
      fetchApi('/reports/best-sellers'),
      fetchApi('/sales').catch(() => []),
      fetchApi('/settings').catch(() => ({}))
    ])
      .then(([summaryData, lowStockData, weekly, monthly, top, sales, settingsData]) => {
         setSummary(summaryData);
         setLowStockProducts(lowStockData);
         setWeeklyData(weekly.map((d: any) => ({ ...d, total: d.total || 0 })));
         setMonthlyTrends(monthly.map((d: any) => ({ ...d, total: d.total || 0 })));
         setBestSellers(top);
         if (Array.isArray(sales)) {
           setRecentSalesList(sales.slice(0, 5));
         }
         if (settingsData && settingsData.low_stock_threshold) {
           setGlobalThreshold(parseInt(settingsData.low_stock_threshold, 10));
         }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleViewInvoice = async (saleId: number) => {
    setLoadingInvoiceId(saleId);
    try {
      const sale = await fetchApi(`/sales/${saleId}`);
      setSelectedInvoiceSale(sale);
    } catch (err) {
      console.error('Failed to fetch invoice details', err);
      alert('Failed to load invoice details');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleOpenDailySummary = async () => {
    setShowDailySummaryModal(true);
    setDailySummaryLoading(true);
    try {
      const data = await fetchApi('/reports/daily-summary');
      setDailySummary(data);
    } catch (err: any) {
      console.error('Failed to fetch daily summary', err);
    } finally {
      setDailySummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchApi(`/reports/sales-trends?timeframe=${trendTimeframe}`)
      .then(data => setSalesTrends(data))
      .catch(console.error);
  }, [trendTimeframe]);

  const handleQuickRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRestock || restockQty <= 0) return;
    setIsSubmittingRestock(true);
    try {
      await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProductForRestock.id,
          quantity_change: Number(restockQty),
          reason: restockReason || 'Restock via Dashboard Alert'
        })
      });
      setShowRestockModal(false);
      setSelectedProductForRestock(null);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingThreshold(true);
    try {
      await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          low_stock_threshold: globalThreshold
        })
      });
      setShowThresholdModal(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update threshold setting');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleExportLowStockCSV = () => {
    if (lowStockProducts.length === 0) return;
    const headers = ['ID', 'SKU', 'Product Name', 'Category', 'Current Stock', 'Min Threshold', 'Shortage Gap', 'Selling Price (GHS)'];
    const rows = lowStockProducts.map(p => {
      const threshold = p.threshold || 10;
      const shortage = Math.max(0, threshold - p.stock_quantity);
      return [
        p.id,
        `"${p.sku || ''}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.category || ''}"`,
        p.stock_quantity,
        threshold,
        shortage,
        p.selling_price || 0
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Low_Stock_Alert_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter low stock list
  const filteredLowStock = lowStockProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(lowStockSearch.toLowerCase()) || 
                          p.sku.toLowerCase().includes(lowStockSearch.toLowerCase()) ||
                          (p.category && p.category.toLowerCase().includes(lowStockSearch.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    if (lowStockFilter === 'out_of_stock') return p.stock_quantity === 0;
    if (lowStockFilter === 'critical') return p.stock_quantity > 0 && p.stock_quantity <= (p.threshold / 2);
    return true;
  });

  const outOfStockCount = lowStockProducts.filter(p => p.stock_quantity === 0).length;
  const criticalCount = lowStockProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= ((p.threshold || 10) / 2)).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
           {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-sm"></div>)}
        </div>
        <div className="grid grid-cols-2 gap-8">
           <div className="h-80 bg-slate-200 rounded-sm"></div>
           <div className="h-80 bg-slate-200 rounded-sm"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-sm border border-slate-200 shadow-2xs">
        <div>
           <div className="flex items-center gap-3">
             <h1 className="text-[22px] font-black text-slate-900 tracking-tight">
               {viewMode === 'admin' ? 'Executive Business Intelligence' : 'Staff Sales Terminal'}
             </h1>
             {user?.role === 'admin' && (
               <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase rounded-full">
                 Admin Active
               </span>
             )}
           </div>
           <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">
             Ummis Lane Enterprise / {viewMode === 'admin' ? 'Monthly Operational & Financial Analytics' : 'Cashier Counter & Performance Hub'}
           </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
           {/* Role Switcher Toggle for Admin */}
           {user?.role === 'admin' && (
             <div className="flex items-center bg-slate-100 p-1 rounded-sm border border-slate-200">
               <button
                 onClick={() => setViewMode('admin')}
                 className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 ${
                   viewMode === 'admin' 
                     ? 'bg-blue-600 text-white shadow-xs' 
                     : 'text-slate-600 hover:text-slate-900'
                 }`}
               >
                 <BarChart3 size={14} /> Admin View
               </button>
               <button
                 onClick={() => setViewMode('staff')}
                 className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 ${
                   viewMode === 'staff' 
                     ? 'bg-blue-600 text-white shadow-xs' 
                     : 'text-slate-600 hover:text-slate-900'
                 }`}
               >
                 <UserCheck size={14} /> Staff View
               </button>
             </div>
           )}

           <button 
             onClick={handleOpenDailySummary}
             className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-sm transition-colors shadow-2xs"
             id="daily-summary-btn"
           >
             <Calendar size={14} />
             Daily Summary
           </button>

           {user?.role === 'admin' && viewMode === 'admin' && (
             <button 
               onClick={() => setShowThresholdModal(true)}
               className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-colors shadow-2xs"
               id="threshold-config-btn"
             >
               <Settings size={14} className="text-slate-500" />
               Threshold Config
             </button>
           )}
        </div>
      </div>

      {/* STAFF TERMINAL VIEW */}
      {viewMode === 'staff' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Staff Header & Shift Action Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-sm p-6 shadow-md border border-slate-800">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
                  <UserCheck size={24} className="text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight">{user?.name}</h2>
                    <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-widest rounded-full">
                      {user?.role || 'Staff Attendant'}
                    </span>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Terminal Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {staffSummary?.activeShift 
                      ? `Shift #${staffSummary.activeShift.id} OPEN since ${new Date(staffSummary.activeShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Start Cash: ${formatGHS(staffSummary.activeShift.starting_cash)})`
                      : 'No active shift currently open. Please start a shift to begin recording counter sales.'}
                  </p>
                </div>
              </div>

              {/* Quick Staff Controls */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <Link
                  to="/sales"
                  className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShoppingCart size={16} /> New Sale / POS
                </Link>
                <Link
                  to="/shifts"
                  className={`flex-1 md:flex-none px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                    staffSummary?.activeShift 
                      ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Clock size={16} /> {staffSummary?.activeShift ? 'Manage / Close Shift' : 'Start New Shift'}
                </Link>
                <Link
                  to="/customers"
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={16} /> Register Customer
                </Link>
              </div>
            </div>
          </div>

          {/* Staff Personal KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
                <span>Today's Sales Revenue</span>
                <DollarSign size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{formatGHS(staffSummary?.todayRevenue || 0)}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                {staffSummary?.todaySalesCount || 0} completed transactions today
              </div>
            </div>

            <div className="bg-white p-5 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
                <span>Month-to-Date Volume</span>
                <TrendingUp size={16} className="text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{formatGHS(staffSummary?.monthRevenue || 0)}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                {staffSummary?.monthSalesCount || 0} total sales logged this month
              </div>
            </div>

            <div className="bg-white p-5 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
                <span>Monthly Target Progress</span>
                <Target size={16} className="text-amber-500" />
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xl font-black text-slate-900">{staffSummary?.targetPercentage || 0}%</span>
                <span className="text-[10px] font-bold text-slate-400">Target: {formatGHS(staffSummary?.monthlyTarget || 15000)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, staffSummary?.targetPercentage || 0)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-sm border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
                <span>Incentive & Store Rank</span>
                <Award size={16} className="text-purple-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xl font-black text-purple-700">{formatGHS(staffSummary?.commissionEst || 0)}</div>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase rounded-full">
                  Rank #{staffSummary?.myRank || 1}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">
                Est. 2% sales commission reward accrued
              </div>
            </div>
          </div>

          {/* Staff Recent Sales Transactions Feed */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">My Recent Completed Sales Today</h3>
              </div>
              <Link to="/sales" className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                View All Sales History <ChevronRight size={14} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {staffSummary?.recentSales && staffSummary.recentSales.length > 0 ? (
                staffSummary.recentSales.map((sale: any) => (
                  <div key={sale.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                        #{sale.id}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900">{formatGHS(sale.total_amount)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Payment: {sale.payment_method.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-sm text-[10px] font-bold uppercase tracking-wider">
                        Completed
                      </span>
                      <button
                        onClick={() => handleViewInvoice(sale.id)}
                        disabled={loadingInvoiceId === sale.id}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        {loadingInvoiceId === sale.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <FileText size={12} />
                        )}
                        Invoice
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No sales completed by you yet today. Click "New Sale / POS" above to record your first transaction!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN INTELLIGENCE VIEW */}
      {viewMode === 'admin' && (
        <>
          {/* Low Stock High Priority Banner */}
          {lowStockProducts.length > 0 && (
            <div className="bg-red-500 text-white rounded-sm p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-red-700 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/10 rounded-sm shrink-0">
                  <AlertTriangle size={24} className="text-amber-200 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-black uppercase tracking-widest">Low Stock Inventory Alert</h3>
                    <span className="px-2 py-0.5 bg-white text-red-700 text-[10px] font-extrabold uppercase rounded-full">
                      {lowStockProducts.length} Items Affected
                    </span>
                  </div>
                  <p className="text-[12px] text-red-100 mt-1 font-medium">
                    {outOfStockCount > 0 ? `${outOfStockCount} items completely out of stock.` : ''} {criticalCount > 0 ? `${criticalCount} items critically near depletion.` : ''} Immediate replenishment recommended to avoid lost sales.
                  </p>
                </div>
              </div>
              <a 
                href="#low-stock-section" 
                className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 rounded-sm font-black text-[11px] uppercase tracking-widest transition-colors shadow-sm shrink-0 flex items-center gap-2"
              >
                Manage Reorders <ArrowRight size={14} />
              </a>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Inventory Depth" value={summary?.totalProducts || 0} icon={<Package size={18} className="text-blue-500" />} subtitle="Total Unique SKUs" />
            <a href="#low-stock-section" className="block transition-transform hover:-translate-y-0.5">
              <StatCard 
                title="Low Stock Alerts" 
                value={summary?.lowStockProducts || 0} 
                icon={<AlertCircle size={18} className="text-red-500" />} 
                subtitle={`${outOfStockCount} Out of stock`} 
                color={summary?.lowStockProducts > 0 ? "text-red-600" : "text-emerald-600"} 
              />
            </a>
            <StatCard title="Lifetime Revenue" value={formatGHS(summary?.totalSalesValue || 0)} icon={<DollarSign size={18} className="text-emerald-500" />} subtitle="Across all transactions" />
            <StatCard title="Today's Velocity" value={formatGHS(summary?.todaySalesValue || 0)} icon={<TrendingUp size={18} className="text-blue-600" />} subtitle="Daily performance" />
          </div>

          {/* Recent Sales Widget */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Recent Sales Transactions</h3>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded-full border border-blue-100">
                  Last 5 Completed
                </span>
              </div>
              <Link to="/sales" className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                View All Transactions <ChevronRight size={14} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentSalesList.length > 0 ? (
                recentSalesList.map((sale: any) => (
                  <div key={sale.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-black uppercase">INV</span>
                        <span className="text-xs font-black">#{sale.id}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{formatGHS(sale.total_amount)}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            {sale.payment_method?.toUpperCase() || 'CASH'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>{new Date(sale.created_at).toLocaleDateString()} {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>Customer: <strong className="text-slate-600">{sale.customer_name || 'Walk-in Customer'}</strong></span>
                          {sale.user_name && (
                            <>
                              <span>•</span>
                              <span>Staff: <strong className="text-slate-600">{sale.user_name}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewInvoice(sale.id)}
                      disabled={loadingInvoiceId === sale.id}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs disabled:opacity-50"
                    >
                      {loadingInvoiceId === sale.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <FileText size={13} />
                      )}
                      View Invoice
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No sales recorded in the system yet.
                </div>
              )}
            </div>
          </div>

          {/* DEDICATED MONTHLY FINANCIAL & STAFF PERFORMANCE CENTER */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden space-y-6 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-[16px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="text-blue-600" size={20} />
                  Monthly Financial & Staff Intelligence Center
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Detailed month-over-month performance analysis, expense tracking, and cashier sales metrics.
                </p>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-sm px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {getMonthOptions().map(opt => (
                    <option key={opt.val} value={opt.val}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monthly KPI Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Gross Revenue</div>
                <div className="text-xl font-black text-slate-900">{formatGHS(monthlySummaryData?.revenue || 0)}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    parseFloat(monthlySummaryData?.revenueGrowthMoM || '0') >= 0 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {parseFloat(monthlySummaryData?.revenueGrowthMoM || '0') >= 0 ? '+' : ''}{monthlySummaryData?.revenueGrowthMoM}% MoM
                  </span>
                  <span className="text-[10px] text-slate-400">vs prev month</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Operating Expenses</div>
                <div className="text-xl font-black text-slate-900">{formatGHS(monthlySummaryData?.expenses || 0)}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-1.5">
                  {monthlySummaryData?.expensesCount || 0} recorded expense vouchers
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Net Profit</div>
                <div className={`text-xl font-black ${(monthlySummaryData?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatGHS(monthlySummaryData?.netProfit || 0)}
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-1.5">
                  Gross Margin: {formatGHS(monthlySummaryData?.grossProfit || 0)}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-sm border border-slate-200">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaction Volume</div>
                <div className="text-xl font-black text-slate-900">{monthlySummaryData?.salesCount || 0} Sales</div>
                <div className="text-[10px] text-slate-500 font-medium mt-1.5">
                  Avg Order: {monthlySummaryData?.salesCount > 0 ? formatGHS((monthlySummaryData?.revenue || 0) / monthlySummaryData.salesCount) : 'GHS 0.00'}
                </div>
              </div>
            </div>

            {/* Monthly Daily Revenue vs Expense Chart */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Daily Revenue vs Expenses ({selectedMonth})</span>
                <span className="text-[10px] font-normal text-slate-400 uppercase">Blue = Revenue | Red = Expense</span>
              </h3>
              <div className="h-64 bg-slate-50/50 p-4 rounded-sm border border-slate-100">
                {monthlySummaryData?.dailySeries && monthlySummaryData.dailySeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySummaryData.dailySeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontStyle: 'bold', fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontStyle: 'bold', fill: '#64748b' }} tickFormatter={(val) => `₵${val}`} />
                      <Tooltip contentStyle={{ borderRadius: '2px', border: '1px solid #e2e8f0', fontSize: '11px' }} formatter={(val: number) => [formatGHS(val)]} />
                      <Bar dataKey="sales_total" name="Sales Revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="expense_total" name="Operating Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                    No transaction data recorded for {selectedMonth} yet.
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Staff Performance Leaderboard Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  Staff Monthly Sales Performance Leaderboard ({selectedMonth})
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">2% Est. Incentive Commission</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-sm">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-wider">Staff Member</th>
                      <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-wider">Sales Count</th>
                      <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-wider">Total Revenue</th>
                      <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-wider">Avg Order</th>
                      <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-wider">Est. Commission (2%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {monthlySummaryData?.staffLeaderboard && monthlySummaryData.staffLeaderboard.length > 0 ? (
                      monthlySummaryData.staffLeaderboard.map((staff: any, idx: number) => (
                        <tr key={staff.user_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div>{staff.user_name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{staff.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-600">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold uppercase">
                              {staff.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800">{staff.total_sales_count}</td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600">{formatGHS(staff.total_revenue)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">{formatGHS(staff.avg_order_value)}</td>
                          <td className="px-4 py-3 text-right font-black text-purple-700">{formatGHS(staff.estimated_commission)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">
                          No staff sales activity recorded for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

      {/* Dedicated Low Stock Alert Center */}
      <div id="low-stock-section" className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-sm">
              <AlertCircle size={20} />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                Low Stock Alert Center
                <span className="text-[11px] font-bold px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full">
                  {lowStockProducts.length} Items Below Threshold
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Monitors products whose current quantity is at or below defined minimum reorder thresholds.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportLowStockCSV}
              disabled={lowStockProducts.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Download size={14} /> Export Reorder Sheet
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => setShowThresholdModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
              >
                <Settings size={14} /> Global Threshold ({globalThreshold})
              </button>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search low stock items by name, SKU, or category..." 
              value={lowStockSearch}
              onChange={e => setLowStockSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-sm text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-sm text-xs font-bold uppercase tracking-wider">
            <button 
              onClick={() => setLowStockFilter('all')}
              className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${lowStockFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
            >
              All Low ({lowStockProducts.length})
            </button>
            <button 
              onClick={() => setLowStockFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${lowStockFilter === 'out_of_stock' ? 'bg-red-600 text-white shadow-sm font-black' : 'text-red-600 hover:bg-red-50'}`}
            >
              Out of Stock ({outOfStockCount})
            </button>
            <button 
              onClick={() => setLowStockFilter('critical')}
              className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${lowStockFilter === 'critical' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-amber-700 hover:bg-amber-50'}`}
            >
              Critical ({criticalCount})
            </button>
          </div>
        </div>

        {/* Low Stock Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Stock / Threshold</th>
                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Shortage Gap</th>
                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Health</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLowStock.map((p) => {
                const threshold = p.threshold || globalThreshold || 10;
                const gap = Math.max(0, threshold - p.stock_quantity);
                const isZero = p.stock_quantity === 0;
                const isCritical = p.stock_quantity > 0 && p.stock_quantity <= Math.ceil(threshold / 2);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 object-cover rounded-sm border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 bg-slate-100 text-slate-400 rounded-sm flex items-center justify-center font-black text-[11px] shrink-0">
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link to={`/products/${p.id}`} className="font-bold text-slate-900 text-xs hover:text-blue-600 transition-colors flex items-center gap-1">
                            {p.name}
                          </Link>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {p.sku}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-sm text-[10px] font-bold uppercase tracking-wider">
                        {p.category || 'General'}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-black ${isZero ? 'text-red-600' : isCritical ? 'text-amber-600' : 'text-orange-600'}`}>
                            {p.stock_quantity}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">/ {threshold} {p.unit_of_measure || 'pcs'}</span>
                        </div>
                        {/* Stock visual meter */}
                        <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className={`h-full transition-all duration-300 ${isZero ? 'bg-red-600 w-0' : isCritical ? 'bg-amber-500' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(100, Math.max(5, (p.stock_quantity / threshold) * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-sm border border-red-100">
                        +{gap} needed
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-red-200 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> Out Of Stock
                        </span>
                      ) : isCritical ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Critical Low
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-orange-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Low Stock
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedProductForRestock(p);
                            setRestockQty(gap > 0 ? gap : 10);
                            setShowRestockModal(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors shadow-sm"
                          title="Quick restock item"
                        >
                          <PlusCircle size={12} /> Restock
                        </button>
                        <Link 
                          to={`/products/${p.id}`}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLowStock.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">No Low Stock Items Found</p>
                      <p className="text-[11px] text-slate-400">
                        {lowStockSearch ? `No products match "${lowStockSearch}".` : 'All product inventory levels are currently above reorder thresholds.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Performance Trends */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <div>
                <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600" />
                  Daily Revenue Trends ({trendTimeframe === '30days' ? 'Last 30 Days' : trendTimeframe === 'weekly' ? 'Last 7 Days' : trendTimeframe === 'monthly' ? 'Last 12 Months' : 'Last 5 Years'})
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Daily sales trajectory & financial trend analysis powered by Recharts</p>
             </div>
             
             <div className="flex flex-wrap items-center gap-2">
                {/* Chart Type Toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-sm gap-0.5 border border-slate-200">
                  <button
                    onClick={() => setChartType('area')}
                    className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-xs transition-all ${chartType === 'area' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Area Chart View"
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-xs transition-all ${chartType === 'line' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Line Chart View"
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-xs transition-all ${chartType === 'bar' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Bar Chart View"
                  >
                    Bar
                  </button>
                </div>

                {/* Timeframe Selector */}
                <div className="flex bg-slate-100 p-0.5 rounded-sm gap-0.5 border border-slate-200">
                   {[
                     { id: '30days', label: '30 Days' },
                     { id: 'weekly', label: '7 Days' },
                     { id: 'monthly', label: 'Monthly' },
                     { id: 'yearly', label: 'Yearly' }
                   ].map(tf => (
                     <button 
                       key={tf.id}
                       onClick={() => setTrendTimeframe(tf.id as any)}
                       className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-xs transition-all ${trendTimeframe === tf.id ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       {tf.label}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-sm min-w-0 space-y-4">
            {/* Metric Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-sm border border-slate-100">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {trendTimeframe === '30days' ? '30-Day Revenue' : trendTimeframe === 'weekly' ? '7-Day Revenue' : 'Total Revenue'}
                </div>
                <div className="text-sm font-black text-slate-900">{formatGHS(totalTrendRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Daily Average</div>
                <div className="text-sm font-black text-blue-600">{formatGHS(avgTrendRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peak Sales Day</div>
                <div className="text-sm font-black text-emerald-600 truncate">
                  {peakTrendDay && peakTrendDay.total > 0 ? `${peakTrendDay.label} (${formatGHS(peakTrendDay.total)})` : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Days</div>
                <div className="text-sm font-black text-purple-600">
                  {activeSalesDaysCount} / {salesTrends.length} Days
                </div>
              </div>
            </div>

            {/* Recharts Canvas */}
            <div className="h-[280px]">
              {salesTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTrendRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} tickFormatter={(val) => `₵${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#0f172a', color: '#fff', fontSize: '11px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}
                        formatter={(val: number, name: string, item: any) => [
                          formatGHS(val), 
                          item?.payload?.sales_count !== undefined ? `Revenue (${item.payload.sales_count} sales)` : 'Revenue'
                        ]}
                      />
                      {avgTrendRevenue > 0 && (
                        <ReferenceLine y={avgTrendRevenue} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Avg: ₵${avgTrendRevenue.toFixed(0)}`, fill: '#64748b', fontSize: 9, position: 'insideTopRight' }} />
                      )}
                      <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTrendRevenue)" dot={{ fill: '#2563eb', r: 3 }} activeDot={{ r: 6, stroke: '#1d4ed8', strokeWidth: 2 }} />
                    </AreaChart>
                  ) : chartType === 'bar' ? (
                    <BarChart data={salesTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} tickFormatter={(val) => `₵${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#0f172a', color: '#fff', fontSize: '11px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}
                        formatter={(val: number, name: string, item: any) => [
                          formatGHS(val), 
                          item?.payload?.sales_count !== undefined ? `Revenue (${item.payload.sales_count} sales)` : 'Revenue'
                        ]}
                      />
                      <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={salesTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} tickFormatter={(val) => `₵${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#0f172a', color: '#fff', fontSize: '11px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}
                        formatter={(val: number, name: string, item: any) => [
                          formatGHS(val), 
                          item?.payload?.sales_count !== undefined ? `Revenue (${item.payload.sales_count} sales)` : 'Revenue'
                        ]}
                      />
                      {avgTrendRevenue > 0 && (
                        <ReferenceLine y={avgTrendRevenue} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Avg: ₵${avgTrendRevenue.toFixed(0)}`, fill: '#64748b', fontSize: 9, position: 'insideTopRight' }} />
                      )}
                      <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                 <EmptyState />
              )}
            </div>
          </div>
        </div>

        {/* Best Sellers */}
        <div className="space-y-4">
           <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Velocity Leaders</h2>
           <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm h-[320px] min-w-0 flex flex-col justify-center">
              {bestSellers.length > 0 ? (
                <>
                   <div className="h-48 mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={bestSellers} dataKey="total_sold" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}>
                               {bestSellers.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`${value} units`, 'Sales']} />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="space-y-2">
                      {bestSellers.map((p, index) => (
                        <div key={p.name} className="flex items-center justify-between text-[11px]">
                           <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                              <span className="font-bold text-slate-600 truncate max-w-[120px]">{p.name}</span>
                           </div>
                           <span className="font-black text-slate-900">{p.total_sold} Sold</span>
                        </div>
                      ))}
                   </div>
                </>
              ) : <EmptyState />}
           </div>
        </div>
      </div>

      {/* Weekly Sales Volume Chart */}
      <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
         <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-widest mb-4">Weekly Sales Volume</h2>
         <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748B' }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '2px', border: '1px solid #E2E8F0', fontSize: '11px' }} formatter={(val: number) => [formatGHS(val), 'Volume']} />
                  <Bar dataKey="total" fill="#94a3b8" radius={[2, 2, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>
      </>
      )}

      {/* Quick Restock Modal */}
      {showRestockModal && selectedProductForRestock && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                Quick Restock
              </h2>
              <button 
                onClick={() => setShowRestockModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickRestockSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-sm border border-slate-200">
                <div className="text-[11px] font-black text-slate-900 uppercase">{selectedProductForRestock.name}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">SKU: {selectedProductForRestock.sku}</div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Current Stock:</span>
                  <span className="font-bold text-red-600">{selectedProductForRestock.stock_quantity}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Add Quantity</label>
                <input 
                  type="number" 
                  min="1" 
                  required
                  value={restockQty}
                  onChange={e => setRestockQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason / Note</label>
                <select 
                  value={restockReason} 
                  onChange={e => setRestockReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Restock / New Shipment">Restock / New Shipment</option>
                  <option value="Supplier Delivery">Supplier Delivery</option>
                  <option value="Inventory Discrepancy Correction">Inventory Discrepancy Correction</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingRestock}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-sm disabled:opacity-50"
                >
                  {isSubmittingRestock ? 'Updating...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Threshold Modal */}
      {showThresholdModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Settings size={16} /> Global Low Stock Threshold
              </h2>
              <button 
                onClick={() => setShowThresholdModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveThreshold} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Set the default minimum inventory level. Products with stock levels at or below this number will trigger low stock alerts across the system.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Global Minimum Threshold</label>
                <input 
                  type="number" 
                  min="1" 
                  required
                  value={globalThreshold}
                  onChange={e => setGlobalThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowThresholdModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingThreshold}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-sm disabled:opacity-50"
                >
                  {isSavingThreshold ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Summary Modal */}
      {showDailySummaryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-sm max-w-4xl w-full p-6 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-sm">
                  <Calendar size={22} />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    Daily Financial Summary
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      {dailySummary?.date || new Date().toISOString().split('T')[0]}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Comprehensive ledger of total revenue, operating expenses, and net profit performance for today.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1 transition-colors"
                  title="Print Summary"
                >
                  <Printer size={14} /> Print
                </button>
                <button 
                  onClick={() => setShowDailySummaryModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {dailySummaryLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Calculating today's financial metrics...</p>
              </div>
            ) : dailySummary ? (
              <div className="space-y-6">
                {/* 3 Core Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Revenue Card */}
                  <div className="bg-emerald-50/60 border border-emerald-200 p-5 rounded-sm relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                        <ArrowUpRight size={14} className="text-emerald-600" /> Total Revenue
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {dailySummary.salesCount} Sales
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900 tracking-tight">
                      {formatGHS(dailySummary.totalRevenue)}
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium mt-1">
                      Gross revenue generated from today's completed transactions.
                    </p>
                  </div>

                  {/* Expenses Card */}
                  <div className="bg-red-50/60 border border-red-200 p-5 rounded-sm relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-red-800 uppercase tracking-widest flex items-center gap-1">
                        <ArrowDownRight size={14} className="text-red-600" /> Total Expenses
                      </span>
                      <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                        {dailySummary.expensesCount} Entries
                      </span>
                    </div>
                    <div className="text-2xl font-black text-red-900 tracking-tight">
                      {formatGHS(dailySummary.totalExpenses)}
                    </div>
                    <p className="text-[10px] text-red-700 font-medium mt-1">
                      Operational & store expense costs logged today.
                    </p>
                  </div>

                  {/* Net Profit Card */}
                  <div className={`border p-5 rounded-sm relative ${
                    dailySummary.netProfit >= 0 ? 'bg-blue-50/60 border-blue-200' : 'bg-amber-50/60 border-amber-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${
                        dailySummary.netProfit >= 0 ? 'text-blue-800' : 'text-amber-800'
                      }`}>
                        <Wallet size={14} className={dailySummary.netProfit >= 0 ? 'text-blue-600' : 'text-amber-600'} /> Net Profit
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        dailySummary.netProfit >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {dailySummary.netProfit >= 0 ? 'Profitable' : 'Deficit'}
                      </span>
                    </div>
                    <div className={`text-2xl font-black tracking-tight ${
                      dailySummary.netProfit >= 0 ? 'text-blue-900' : 'text-amber-900'
                    }`}>
                      {formatGHS(dailySummary.netProfit)}
                    </div>
                    <p className={`text-[10px] font-medium mt-1 ${
                      dailySummary.netProfit >= 0 ? 'text-blue-700' : 'text-amber-700'
                    }`}>
                      Net cash position (Revenue minus Expenses).
                    </p>
                  </div>
                </div>

                {/* Gross Sales Margin & COGS Breakdown */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Receipt size={20} className="text-slate-500 shrink-0" />
                    <div>
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                        Sales Cost & Operating Profit Breakdown
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Gross Profit from product sales margin before operational expenses: <strong className="text-slate-800">{formatGHS(dailySummary.grossProfit)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Net Operating Profit</span>
                    <span className={`text-sm font-black ${dailySummary.operatingNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatGHS(dailySummary.operatingNetProfit)}
                    </span>
                  </div>
                </div>

                {/* Tabbed Breakdown Tables */}
                <div className="border border-slate-200 rounded-sm overflow-hidden">
                  <div className="bg-slate-100 p-2 flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                      <button 
                        onClick={() => setDailySummaryTab('all')}
                        className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${
                          dailySummaryTab === 'all' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        All Transactions
                      </button>
                      <button 
                        onClick={() => setDailySummaryTab('sales')}
                        className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${
                          dailySummaryTab === 'sales' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        Today's Revenue ({dailySummary.salesCount})
                      </button>
                      <button 
                        onClick={() => setDailySummaryTab('expenses')}
                        className={`px-3 py-1.5 rounded-sm transition-all text-[10px] ${
                          dailySummaryTab === 'expenses' ? 'bg-red-600 text-white shadow-sm font-black' : 'text-red-700 hover:bg-red-50'
                        }`}
                      >
                        Today's Expenses ({dailySummary.expensesCount})
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {(dailySummaryTab === 'all' || dailySummaryTab === 'sales') && (
                      <div className="p-4 border-b border-slate-100 last:border-b-0">
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center justify-between">
                          <span>Sales Transactions Today</span>
                          <span className="text-emerald-600">{formatGHS(dailySummary.totalRevenue)}</span>
                        </h4>
                        {dailySummary.salesList.length > 0 ? (
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Sale ID</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Cashier</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Payment</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Time</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {dailySummary.salesList.map((s: any) => (
                                <tr key={s.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono font-bold text-slate-800">#SALE-{s.id}</td>
                                  <td className="px-3 py-2 text-slate-600">{s.cashier_name}</td>
                                  <td className="px-3 py-2 text-slate-500 font-medium">{s.payment_method}</td>
                                  <td className="px-3 py-2 text-slate-400">{new Date(s.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="px-3 py-2 text-right font-black text-emerald-600">+{formatGHS(s.total_amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">No sales transactions logged today yet.</p>
                        )}
                      </div>
                    )}

                    {(dailySummaryTab === 'all' || dailySummaryTab === 'expenses') && (
                      <div className="p-4">
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center justify-between">
                          <span>Expenses Logged Today</span>
                          <span className="text-red-600">{formatGHS(dailySummary.totalExpenses)}</span>
                        </h4>
                        {dailySummary.expensesList.length > 0 ? (
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Description</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Logged By</th>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Time</th>
                                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {dailySummary.expensesList.map((e: any) => (
                                <tr key={e.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-bold text-slate-800">{e.description}</td>
                                  <td className="px-3 py-2 text-slate-600">{e.user_name || 'System'}</td>
                                  <td className="px-3 py-2 text-slate-400">{new Date(e.expense_date + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">-{formatGHS(e.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-2">No operational expenses logged today.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-4 mt-6 flex justify-end border-t border-slate-100">
              <button 
                onClick={() => setShowDailySummaryModal(false)}
                className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-900 rounded-sm shadow-sm"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoiceSale && (
        <InvoiceModal
          saleData={selectedInvoiceSale}
          onClose={() => setSelectedInvoiceSale(null)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon, subtitle, color = 'text-slate-900' }: { title: string, value: string | number, icon: any, subtitle: string, color?: string }) {
  return (
    <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm relative overflow-hidden group">
      <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">{icon}</div>
      <div className="space-y-4">
         <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</div>
         <div>
            <div className={`text-2xl font-black tracking-tight ${color}`}>{value}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{subtitle}</div>
         </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-slate-300 text-[11px] font-black uppercase tracking-widest">
       No Data Detected
    </div>
  );
}
