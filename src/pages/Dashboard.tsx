import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingUp, ShoppingCart, Package, AlertTriangle, 
  Users, Calendar, RefreshCw, ChevronRight, FileText, Settings, 
  ArrowUpRight, ArrowDownRight, Clock, Plus, ShieldAlert, Award,
  CheckCircle2, AlertCircle, Eye, Download, X, Search, RotateCcw,
  CreditCard, Truck, Layers, Filter, Check, ShieldCheck, Wallet, Store,
  Monitor, Globe, Trash2, Minus, Receipt, MessageSquare, Scale, Printer,
  Upload, FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import InvoiceModal from '../components/InvoiceModal';
import AutomatedLowStockNotification from '../components/AutomatedLowStockNotification';
import RecentActivityPanel from '../components/RecentActivityPanel';
import AdminReportsModal from '../components/AdminReportsModal';
import CreatePOModal from '../components/CreatePOModal';
import ProductImportModal from '../components/ProductImportModal';
import RowActionMenu from '../components/common/RowActionMenu';
import StatusBadge from '../components/common/StatusBadge';
import MiniPerformanceOverviewWidget from '../components/dashboard/MiniPerformanceOverviewWidget';
import WeeklySalesTrendChart from '../components/dashboard/WeeklySalesTrendChart';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { channels, totalUnread, onlineUsers, teamMembers, setActiveChannelId } = useChat();

  // Mode Selection
  const [viewMode, setViewMode] = useState<'admin' | 'staff'>(user?.role === 'admin' || user?.role === 'manager' ? 'admin' : 'staff');

  // Loading States
  const [loading, setLoading] = useState(true);

  // Executive Data States
  const [summary, setSummary] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [stockProximityData, setStockProximityData] = useState<any | null>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [trendTimeframe, setTrendTimeframe] = useState<'7days' | '14days' | '30days' | 'monthly'>('7days');
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendChartType, setTrendChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [recentSalesList, setRecentSalesList] = useState<any[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);
  const [recentAdjustments, setRecentAdjustments] = useState<any[]>([]);

  // Admin Comprehensive Reports Modal State
  const [showAdminReportsModal, setShowAdminReportsModal] = useState(false);

  // Staff Permissions and Alert Display Settings
  const [allowStaffAdjustments, setAllowStaffAdjustments] = useState<boolean>(false);
  const [showStaffAlerts, setShowStaffAlerts] = useState<boolean>(true);

  const { addToast } = useNotifications();

  const formatRelativeTime = (dateString: string): string => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0 || isNaN(diffMs)) return 'just now';
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Monthly Financial Breakdown
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthlySummaryData, setMonthlySummaryData] = useState<any>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Staff Personal Data
  const [staffSummary, setStaffSummary] = useState<any>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffReportPeriod, setStaffReportPeriod] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [staffReportPaymentMethod, setStaffReportPaymentMethod] = useState<string>('all');
  const [staffReportStartDate, setStaffReportStartDate] = useState<string>('');
  const [staffReportEndDate, setStaffReportEndDate] = useState<string>('');
  const [staffReportData, setStaffReportData] = useState<any>(null);
  const [staffReportLoading, setStaffReportLoading] = useState(false);

  // Modals State
  const [selectedInvoiceSale, setSelectedInvoiceSale] = useState<any | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<number | null>(null);

  // Quick Restock Modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedProductForRestock, setSelectedProductForRestock] = useState<any>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockReason, setRestockReason] = useState<string>('Restock Shipment');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Global Threshold Modal
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  // Daily EOD Summary Modal
  const [showDailySummaryModal, setShowDailySummaryModal] = useState(false);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);

  // Create Purchase Order Modal
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [poPreselectedProduct, setPoPreselectedProduct] = useState<any>(null);

  // Automated Bulk CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useModalDismiss(showAdminReportsModal, () => setShowAdminReportsModal(false));
  useModalDismiss(showRestockModal, () => setShowRestockModal(false));
  useModalDismiss(showThresholdModal, () => setShowThresholdModal(false));
  useModalDismiss(showDailySummaryModal, () => setShowDailySummaryModal(false));
  useModalDismiss(showImportModal, () => setShowImportModal(false));
  useModalDismiss(showCreatePoModal, () => {
    setShowCreatePoModal(false);
    setPoPreselectedProduct(null);
  });

  // Initial Load
  useEffect(() => {
    loadDashboardData();
    loadStaffSummary();
  }, [user]);

  useEffect(() => {
    setTrendsLoading(true);
    fetchApi(`/reports/sales-trends?timeframe=${trendTimeframe}`)
      .then(data => setSalesTrends(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setTrendsLoading(false));
  }, [trendTimeframe]);

  useEffect(() => {
    loadMonthlySummary(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (viewMode === 'staff') {
      loadStaffTransactionsReport();
    }
  }, [viewMode, staffReportPeriod, staffReportPaymentMethod, staffReportStartDate, staffReportEndDate]);

  const loadDashboardData = () => {
    setLoading(true);
    const isAdmin = user?.role === 'admin';
    Promise.all([
      fetchApi('/reports/summary').catch(() => ({})),
      fetchApi('/reports/low-stock').catch(() => []),
      fetchApi('/reports/best-sellers').catch(() => []),
      fetchApi('/reports/stock-threshold-proximity').catch(() => null),
      fetchApi('/sales').catch(() => []),
      fetchApi('/settings').catch(() => ({})),
      fetchApi('/products').catch(() => []),
      fetchApi('/audit-logs?limit=5').catch(() => []),
      isAdmin ? fetchApi('/inventory/adjustments').catch(() => []) : Promise.resolve([]),
      fetchApi('/categories').catch(() => [])
    ])
      .then(([summaryData, lowStockData, top, proximityData, sales, settingsData, prods, audits, adjs, cats]) => {
         setSummary(summaryData && typeof summaryData === 'object' ? summaryData : {});
         setLowStockProducts(Array.isArray(lowStockData) ? lowStockData : []);
         setBestSellers(Array.isArray(top) ? top : []);
         if (proximityData) {
           setStockProximityData(proximityData);
         }
         if (Array.isArray(sales)) {
           setRecentSalesList(sales.slice(0, 6));
         }
         if (Array.isArray(prods)) {
           setAllProducts(prods);
         }
         if (Array.isArray(audits)) {
           setRecentAuditLogs(audits);
         }
         if (Array.isArray(adjs)) {
           setRecentAdjustments(adjs.slice(0, 6));
         }
         if (Array.isArray(cats)) {
           setCategories(cats);
         }
         if (settingsData && typeof settingsData === 'object') {
           if (settingsData.low_stock_threshold) {
             setGlobalThreshold(parseInt(settingsData.low_stock_threshold, 10));
           }
           if (settingsData.allow_staff_stock_adjustments !== undefined) {
             setAllowStaffAdjustments(settingsData.allow_staff_stock_adjustments === 'true');
           }
           if (settingsData.show_staff_stock_alerts !== undefined) {
             setShowStaffAlerts(settingsData.show_staff_stock_alerts === 'true');
           }
         }
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
      })
      .finally(() => setLoading(false));
  };

  const loadMonthlySummary = (monthStr: string) => {
    setMonthlyLoading(true);
    fetchApi(`/reports/monthly-summary?month=${monthStr}`)
      .then(data => {
        if (data && typeof data === 'object') {
          setMonthlySummaryData({
            totalSales: data.revenue ?? data.totalSales ?? 0,
            totalExpenses: data.expenses ?? data.totalExpenses ?? 0,
            expenseCount: data.expensesCount ?? data.expenseCount ?? 0,
            netProfit: data.netProfit ?? 0,
            ...data
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load monthly summary:', err);
      })
      .finally(() => setMonthlyLoading(false));
  };

  const loadStaffSummary = () => {
    setStaffLoading(true);
    fetchApi('/reports/staff-my-summary')
      .then(data => {
        if (data && typeof data === 'object') {
          setStaffSummary({
            myTodaySales: data.todayRevenue ?? data.myTodaySales ?? 0,
            myTodayCount: data.todaySalesCount ?? data.myTodayCount ?? 0,
            myMonthSales: data.monthRevenue ?? data.myMonthSales ?? 0,
            myMonthCount: data.monthSalesCount ?? data.myMonthCount ?? 0,
            targetPercent: data.targetPercentage ?? data.targetPercent ?? 0,
            myCommission: data.commissionEst ?? data.myCommission ?? 0,
            ...data
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load staff summary:', err);
      })
      .finally(() => setStaffLoading(false));
  };

  const loadStaffTransactionsReport = () => {
    setStaffReportLoading(true);
    const query = new URLSearchParams();
    query.append('period', staffReportPeriod);
    if (staffReportPaymentMethod !== 'all') query.append('payment_method', staffReportPaymentMethod);
    if (staffReportPeriod === 'custom' && staffReportStartDate && staffReportEndDate) {
      query.append('startDate', staffReportStartDate);
      query.append('endDate', staffReportEndDate);
    }
    fetchApi(`/reports/staff-transactions-report?${query.toString()}`)
      .then(data => setStaffReportData(data))
      .catch(console.error)
      .finally(() => setStaffReportLoading(false));
  };

  const handleViewInvoice = async (saleId: number) => {
    setLoadingInvoiceId(saleId);
    try {
      const sale = await fetchApi(`/sales/${saleId}`);
      setSelectedInvoiceSale(sale);
    } catch (err: any) {
      addToast('Failed to load invoice: ' + err.message, 'error');
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
      console.error(err);
    } finally {
      setDailySummaryLoading(false);
    }
  };

  const handleToggleStaffAdjustments = async (newValue: boolean) => {
    try {
      setAllowStaffAdjustments(newValue);
      await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ allow_staff_stock_adjustments: newValue })
      });
      addToast(`Staff stock adjustments ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch (err: any) {
      addToast('Failed to update staff stock adjustment setting: ' + err.message, 'error');
      loadDashboardData();
    }
  };

  const handleToggleStaffAlerts = async (newValue: boolean) => {
    try {
      setShowStaffAlerts(newValue);
      await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ show_staff_stock_alerts: newValue })
      });
      addToast(`Staff stock alerts ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch (err: any) {
      addToast('Failed to update staff alert visibility setting: ' + err.message, 'error');
      loadDashboardData();
    }
  };

  const handleQuickRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRestock || restockQty <= 0) return;
    if (user?.role !== 'admin' && user?.role !== 'manager' && !allowStaffAdjustments) {
      addToast('Permission Denied: Staff stock adjustments are disabled by administrator.', 'warning');
      return;
    }
    setIsSubmittingRestock(true);
    try {
      await fetchApi('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProductForRestock.id,
          quantity_change: Number(restockQty),
          reason: restockReason || 'Restock via Dashboard'
        })
      });
      setShowRestockModal(false);
      setSelectedProductForRestock(null);
      addToast(`Restocked ${restockQty} units of ${selectedProductForRestock.name}`, 'success');
      loadDashboardData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update stock', 'error');
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
        body: JSON.stringify({ low_stock_threshold: globalThreshold })
      });
      setShowThresholdModal(false);
      addToast(`Global low stock threshold set to ${globalThreshold} units`, 'success');
      loadDashboardData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleTriggerVelocityAudit = async () => {
    try {
      const res = await fetchApi('/reports/check-velocity-alerts', { method: 'POST' });
      if (res?.breachedCount > 0) {
        addToast({
          title: 'Dynamic Velocity Stock Alert',
          message: `${res.breachedCount} product(s) fell below dynamic sales velocity threshold. Alert notifications generated for administration.`,
          type: 'warning'
        });
      } else {
        addToast({
          title: 'Sales Velocity Normal',
          message: 'All inventory items have adequate stock runway covering dynamic sales velocity buffers.',
          type: 'success'
        });
      }
      loadDashboardData();
    } catch (err: any) {
      addToast('Failed to evaluate velocity: ' + (err.message || 'Error'), 'error');
    }
  };

  const handleExportLowStockCSV = () => {
    if (lowStockProducts.length === 0) return;
    const headers = ['ID', 'SKU', 'Product Name', 'Category', 'Current Stock', 'Threshold', 'Selling Price (GHS)'];
    const rows = lowStockProducts.map(p => [
      p.id,
      `"${p.sku || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      p.stock_quantity,
      p.threshold || 10,
      p.selling_price || 0
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Low_Stock_Alert_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
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

  // Trend Analytics Math
  const totalTrendRevenue = salesTrends.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const avgTrendRevenue = salesTrends.length > 0 ? totalTrendRevenue / salesTrends.length : 0;
  const peakTrendDay = salesTrends.length > 0 ? [...salesTrends].sort((a, b) => (b.total || 0) - (a.total || 0))[0] : null;

  // Background Scroll Locking when any modal is active
  const isAnyModalOpen = Boolean(
    showAdminReportsModal || 
    showRestockModal || 
    showThresholdModal || 
    showDailySummaryModal || 
    showImportModal ||
    selectedInvoiceSale
  );

  useEffect(() => {
    const scrollContainer = document.getElementById('main-content-scroll');
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      if (scrollContainer) scrollContainer.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (scrollContainer) scrollContainer.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = '';
      if (scrollContainer) scrollContainer.style.overflow = 'auto';
    };
  }, [isAnyModalOpen]);

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header - Mobile & Tablet Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Retail OS Overview
            </h1>
            <StatusBadge 
              status={viewMode === 'admin' ? 'admin' : 'cashier'} 
              variant={viewMode === 'admin' ? 'admin' : 'cashier'}
              label={(user?.role === 'admin' || user?.role === 'manager') ? (viewMode === 'admin' ? 'Executive Mode' : 'Cashier Mode') : `${user?.role || 'Staff'} Mode`} 
              size="xs" 
            />
          </div>
          <p className="text-xs text-slate-500 font-medium">Real-time revenue monitoring, POS sales trends, stock alerts, and financial ledgers.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Admin / Manager vs Staff View Toggle */}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('admin')}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all min-h-[36px] sm:min-h-0 ${
                  viewMode === 'admin' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Executive View
              </button>
              <button
                onClick={() => setViewMode('staff')}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all min-h-[36px] sm:min-h-0 ${
                  viewMode === 'staff' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cashier Terminal
              </button>
            </div>
          )}

          {/* Automated Bulk CSV Product & Inventory Import */}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-2xs cursor-pointer min-h-[38px]"
              title="Bulk upload and automated CSV parser for inventory & products"
            >
              <Upload size={14} className="text-indigo-600" />
              <span>Import CSV</span>
            </button>
          )}

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setShowCreatePoModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-2xs cursor-pointer min-h-[38px]"
              title="Create and issue a Purchase Order to supplier"
            >
              <Plus size={15} /> <span>Create PO</span>
            </button>
          )}

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setShowAdminReportsModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-2xs cursor-pointer min-h-[38px]"
            >
              <FileText size={15} /> <span className="hidden sm:inline">Reports & Audits</span><span className="sm:hidden">Reports</span>
            </button>
          )}

          <button
            onClick={handleOpenDailySummary}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs uppercase tracking-wider transition border border-slate-200 flex items-center gap-1.5 min-h-[38px]"
          >
            <Receipt size={14} /> <span>EOD Summary</span>
          </button>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition border border-slate-200 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ADMIN OVERVIEW VIEW */}
      {viewMode === 'admin' ? (
        <>
          {/* 'LOW STOCK' NOTIFICATION SYSTEM (MONITORS QUANTITIES & FLAGS ITEMS NEARING REORDER POINTS) */}
          <AutomatedLowStockNotification
            products={stockProximityData?.products || (allProducts.length > 0 ? allProducts : lowStockProducts)}
            globalThreshold={globalThreshold}
            proximityData={stockProximityData}
            userRole={user?.role}
            onQuickRestock={user?.role === 'admin' || user?.role === 'manager' || allowStaffAdjustments ? (prod) => {
              setSelectedProductForRestock(prod);
              setRestockQty(Math.max(10, ((prod.min_stock_level || globalThreshold) * 2) - prod.stock_quantity));
              setShowRestockModal(true);
            } : undefined}
            onCreatePO={(prod) => {
              setPoPreselectedProduct(prod);
              setShowCreatePoModal(true);
            }}
            onOpenThresholdModal={() => setShowThresholdModal(true)}
            onExportCSV={handleExportLowStockCSV}
            onRefresh={loadDashboardData}
            onTriggerVelocityAudit={handleTriggerVelocityAudit}
            isLoading={loading}
          />

          {/* PRIMARY BUSINESS KPI CARDS (2-col mobile, 2-col tablet, 4-col desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Today's Gross Sales */}
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                <span className="truncate">Today's Gross Sales</span>
                <ShoppingCart size={15} className="text-blue-600 hidden sm:block shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                {formatGHS(summary?.todaySales ?? summary?.todaySalesValue ?? 0)}
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                <span className="truncate">{summary?.todayCount || 0} order(s)</span>
                {summary?.percentChange !== undefined && (
                  <span className={`flex items-center font-bold text-[10px] sm:text-[11px] shrink-0 ${summary.percentChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {summary.percentChange >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(summary.percentChange)}%
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Month Net Profit */}
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                <span className="truncate">Monthly Net Profit</span>
                <TrendingUp size={15} className="text-emerald-600 hidden sm:block shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-700 truncate">
                {formatGHS(summary?.monthProfit ?? 0)}
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                <span className="truncate">{formatGHS(summary?.monthSales ?? 0)}</span>
                <span className="font-bold text-slate-900 shrink-0 text-[10px] sm:text-xs">
                  {(summary?.monthSales || 0) > 0 ? (((summary?.monthProfit || 0) / summary.monthSales) * 100).toFixed(1) : '0.0'}% Margin
                </span>
              </div>
            </div>

            {/* Card 3: Active Shift Drawer Status */}
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                <span className="truncate">Shift Cash Status</span>
                <Clock size={15} className="text-indigo-600 hidden sm:block shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                {summary?.activeShiftCount || 0} Open Shift(s)
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                <span className="truncate">Expected: {formatGHS(summary?.openShiftsCashTotal || 0)}</span>
                <StatusBadge status="open" variant="open" label="Live" size="xs" pulseDot />
              </div>
            </div>

            {/* Card 4: Low Stock Alert */}
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between text-amber-800 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                <span className="truncate">Low Stock Urgency</span>
                <AlertTriangle size={15} className="text-amber-600 hidden sm:block shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-amber-900 truncate">
                {(lowStockProducts || []).length} Product(s)
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-amber-800 pt-1 border-t border-amber-200/60">
                <span className="truncate">{(lowStockProducts || []).filter(p => p.stock_quantity === 0).length} out of stock</span>
                <a 
                  href="#low-stock-notification-system" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('low-stock-notification-system')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="font-bold underline hover:text-amber-900 cursor-pointer shrink-0 text-[10px] sm:text-xs"
                >
                  Restock
                </a>
              </div>
            </div>
          </div>

          {/* Quick Action Hub for Tablet & Mobile (Fast Navigation) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => navigate('/sales')}
              className="p-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 transition text-left cursor-pointer shadow-2xs"
            >
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                <ShoppingCart size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">POS Checkout</div>
                <div className="text-[10px] text-slate-500 truncate">Open Cash Register</div>
              </div>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="p-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 transition text-left cursor-pointer shadow-2xs"
            >
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                <Upload size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">Bulk CSV Import</div>
                <div className="text-[10px] text-slate-500 truncate">Upload Items / Stock</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/shifts')}
              className="p-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 transition text-left cursor-pointer shadow-2xs"
            >
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">Shift Register</div>
                <div className="text-[10px] text-slate-500 truncate">Cash Till Reconciliation</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/customers')}
              className="p-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 transition text-left cursor-pointer shadow-2xs"
            >
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">Customer Accounts</div>
                <div className="text-[10px] text-slate-500 truncate">Debtors & Loyalty</div>
              </div>
            </button>
          </div>

          {/* MINI-PERFORMANCE OVERVIEW WIDGET (SALES INFLOW VS PROCUREMENT OUTFLOW METRICS) */}
          <MiniPerformanceOverviewWidget />

          {/* WEEKLY SALES TREND (RECHARTS 7-DAY REVENUE VELOCITY LINE CHART) */}
          <WeeklySalesTrendChart onRefreshParent={loadDashboardData} />

          {/* TOP SELLING PRODUCTS LEADERBOARD */}
          <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  Top Selling Products
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Highest volume items by units sold across counter and catalog checkouts.</p>
              </div>
              <Link to="/products" className="text-xs font-bold text-blue-600 hover:underline">
                View Full Catalog →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {bestSellers.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-medium">
                  No sales data available yet.
                </div>
              ) : (
                bestSellers.slice(0, 5).map((item: any, idx: number) => {
                  const maxQty = Math.max(...bestSellers.map((b: any) => b.total_qty || 1));
                  const percent = Math.round(((item.total_qty || 0) / maxQty) * 100);

                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800 truncate" title={item.name}>
                          #{idx + 1} {item.name}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 font-medium">Units Sold</span>
                        <span className="text-sm font-black text-slate-900">
                          {item.total_qty} units
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY PANEL (LAST 5 TRANSACTIONS & INVENTORY CHANGES) */}
          <RecentActivityPanel
            sales={recentSalesList}
            auditLogs={recentAuditLogs}
            stockAdjustments={recentAdjustments}
            onViewSaleReceipt={handleViewInvoice}
            onRefresh={loadDashboardData}
            isLoading={loading}
          />

          {/* RECENT SALES ACTIVITY FEED & INVOICE VIEWER */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart size={15} className="text-blue-600" />
                  Recent Sales Transactions
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Live transaction activity log across all register counters.</p>
              </div>
              <Link 
                to={user?.role === 'admin' ? "/transactions" : "/sales"} 
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                All Transactions <ChevronRight size={14} />
              </Link>
            </div>

            {/* Mobile Card List View (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {recentSalesList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No recent sales recorded today.
                </div>
              ) : (
                recentSalesList.map((sale: any) => (
                  <div key={`m-sale-${sale.id}`} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-600">#SALE-{sale.id}</span>
                        <StatusBadge status={sale.payment_method || 'Cash'} size="xs" />
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                        {sale.customer_name || 'Walk-in Customer'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(sale.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • Cashier: {sale.user_name || 'Staff'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-xs sm:text-sm">
                          {formatGHS(sale.total_amount)}
                        </div>
                      </div>
                      <RowActionMenu
                        triggerTitle={`Actions for #SALE-${sale.id}`}
                        actions={[
                          {
                            label: 'View Receipt',
                            sublabel: 'Print or review ticket',
                            icon: <Receipt size={14} className="text-blue-600" />,
                            onClick: () => handleViewInvoice(sale.id),
                          },
                          {
                            label: 'Inspect in Ledger',
                            sublabel: 'View in Cash Transactions',
                            icon: <Eye size={14} />,
                            onClick: () => navigate(user?.role === 'admin' ? '/transactions' : '/sales'),
                          },
                          {
                            label: 'Process Return',
                            sublabel: 'Refund customer items',
                            icon: <RotateCcw size={14} className="text-rose-600" />,
                            onClick: () => navigate('/returns'),
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop & Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSalesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No recent sales recorded today.
                      </td>
                    </tr>
                  ) : (
                    recentSalesList.map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">
                          #SALE-{sale.id}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {new Date(sale.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sale.user_name || 'Cashier'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {sale.customer_name || 'Walk-in Customer'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sale.payment_method || 'Cash'} size="xs" />
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {formatGHS(sale.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <RowActionMenu
                              triggerTitle={`Actions for #SALE-${sale.id}`}
                              actions={[
                                {
                                  label: 'View Receipt',
                                  sublabel: 'Print or review ticket',
                                  icon: <Receipt size={14} className="text-blue-600" />,
                                  onClick: () => handleViewInvoice(sale.id),
                                },
                                {
                                  label: 'Inspect in Ledger',
                                  sublabel: 'View in Cash Transactions',
                                  icon: <Eye size={14} />,
                                  onClick: () => navigate(user?.role === 'admin' ? '/transactions' : '/sales'),
                                },
                                {
                                  label: 'Process Return',
                                  sublabel: 'Refund customer items',
                                  icon: <RotateCcw size={14} className="text-rose-600" />,
                                  onClick: () => navigate('/returns'),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MONTHLY P&L FINANCIAL PERFORMANCE LEDGER */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  Monthly Financial P&L Statement
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Income statement breakdown of revenues, COGS, operating expenses, and net margins.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Select Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  {getMonthOptions().map(m => (
                    <option key={m.val} value={m.val}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {monthlyLoading ? (
              <div className="py-8 text-center text-slate-400">Loading P&L breakdown...</div>
            ) : monthlySummaryData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-400">Gross Sales Revenue</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{formatGHS(monthlySummaryData.totalSales || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{monthlySummaryData.salesCount || 0} sales orders</div>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-400">Cost of Goods Sold (COGS)</div>
                  <div className="text-lg font-black text-rose-700 mt-1">{formatGHS(monthlySummaryData.cogs || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Inventory cost value</div>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-400">Gross Profit</div>
                  <div className="text-lg font-black text-emerald-700 mt-1">{formatGHS(monthlySummaryData.grossProfit || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sales minus COGS</div>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-400">Operating Expenses</div>
                  <div className="text-lg font-black text-amber-700 mt-1">{formatGHS(monthlySummaryData.totalExpenses || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{monthlySummaryData.expenseCount || 0} expense voucher(s)</div>
                </div>

                <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
                  <div className="text-[10px] font-black uppercase text-emerald-800">Net Profit Margin</div>
                  <div className="text-lg font-black text-emerald-900 mt-1">{formatGHS(monthlySummaryData.netProfit || 0)}</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    {monthlySummaryData.totalSales > 0 ? ((monthlySummaryData.netProfit / monthlySummaryData.totalSales) * 100).toFixed(1) : 0}% Net Margin
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* SYSTEM SECURITY & TERMINAL AUDIT ACTIVITY WIDGET */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-white rounded-lg shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    System Security & Terminal Activity
                    <StatusBadge status="live" variant="live" label="Ledger Live" size="xs" pulseDot />
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">Real-time audit trail of staff activities, terminal workstations, pricing edits, and stock movements.</p>
                </div>
              </div>

              <Link
                to="/audit-logs"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-colors w-fit"
              >
                <span>View Full Audit Logs</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">User</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Action</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Terminal & IP</th>
                    <th className="px-4 py-2.5">Audit Details</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                        No recent security events recorded.
                      </td>
                    </tr>
                  ) : (
                    recentAuditLogs.map((log: any) => (
                      <tr 
                        key={log.id} 
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-medium">
                          <div 
                            title={`Exact UTC: ${new Date(log.created_at).toUTCString()}`}
                            className="font-bold text-slate-800 flex items-center gap-1 cursor-help"
                          >
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span className="hover:text-blue-600 transition-colors border-b border-dotted border-slate-300">
                              {formatRelativeTime(log.created_at)}
                            </span>
                          </div>
                          <div 
                            title={`Exact UTC: ${new Date(log.created_at).toUTCString()}`}
                            className="text-[10px] text-slate-400 pl-3.5 font-mono cursor-help"
                          >
                            {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-[10px] shrink-0">
                              {(log.user_name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900">{log.user_name || 'System Process'}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {log.action}
                        </td>

                        {/* Terminal & IP: Completely visible without truncation */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded font-semibold text-[11px] w-fit">
                              <Monitor size={12} className="text-blue-600 shrink-0" />
                              <span>{log.device_terminal || 'POS Terminal #1 (Lane A)'}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 pl-0.5">
                              <Globe size={10} className="text-slate-400 shrink-0" />
                              <span>{log.ip_address || '127.0.0.1'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600 font-medium max-w-sm truncate">
                          {log.details || '—'}
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                            <RowActionMenu
                              triggerTitle={`Actions for audit #${log.id}`}
                              actions={[
                                {
                                  label: 'View Security Ledger',
                                  sublabel: 'Open full audit logs page',
                                  icon: <Eye size={14} />,
                                  onClick: () => navigate('/audit-logs'),
                                },
                                {
                                  label: 'Copy JSON Summary',
                                  sublabel: 'Copy event payload',
                                  icon: <FileText size={14} />,
                                  onClick: () => {
                                    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                                    addToast('Audit log record copied to clipboard', 'info');
                                  },
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* STAFF TERMINAL VIEW */
        <div className="space-y-6">
          {/* Staff Counter KPI Strip (2-col mobile, 4-col desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1">My Sales Today</div>
              <div className="text-lg sm:text-2xl font-black text-blue-700 truncate">{formatGHS(staffSummary?.myTodaySales || 0)}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">{staffSummary?.myTodayCount || 0} transaction(s)</div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1">My Month Volume</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">{formatGHS(staffSummary?.myMonthSales || 0)}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">{staffSummary?.myMonthCount || 0} order(s)</div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1">Goal Progress</div>
              <div className="text-lg sm:text-2xl font-black text-emerald-700">{staffSummary?.targetPercent || 0}%</div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, staffSummary?.targetPercent || 0)}%` }} />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1">Estimated Commission</div>
              <div className="text-lg sm:text-2xl font-black text-indigo-700 truncate">{formatGHS(staffSummary?.myCommission || 0)}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">Performance bonus</div>
            </div>
          </div>

          {/* Staff Sales Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  My Counter Transactions Ledger
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Reconcile cash and digital payments processed during your shift.</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={staffReportPeriod}
                  onChange={(e) => setStaffReportPeriod(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800"
                >
                  <option value="today">Today</option>
                  <option value="7days">Past 7 Days</option>
                  <option value="30days">Past 30 Days</option>
                </select>
              </div>
            </div>

            {/* Mobile Card List View for Staff (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {staffReportLoading ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">Loading staff ledger...</div>
              ) : !staffReportData?.transactions || staffReportData.transactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No sales recorded for selected timeframe.</div>
              ) : (
                staffReportData.transactions.map((st: any) => (
                  <div key={`m-staff-${st.id}`} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-600">#SALE-{st.id}</span>
                        <StatusBadge status={st.payment_method || 'Cash'} size="xs" />
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                        {st.customer_name || 'Walk-in Customer'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(st.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-xs sm:text-sm">
                          {formatGHS(st.total_amount)}
                        </div>
                      </div>
                      <RowActionMenu
                        triggerTitle={`Actions for #SALE-${st.id}`}
                        actions={[
                          {
                            label: 'View Receipt',
                            sublabel: 'Print or export invoice',
                            icon: <Receipt size={14} className="text-blue-600" />,
                            onClick: () => handleViewInvoice(st.id),
                          },
                          {
                            label: 'Re-issue to Customer',
                            sublabel: 'Print thermal receipt',
                            icon: <Printer size={14} />,
                            onClick: () => handleViewInvoice(st.id),
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop & Tablet Table View for Staff (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffReportLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">Loading staff ledger...</td>
                    </tr>
                  ) : !staffReportData?.transactions || staffReportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">No sales recorded for selected timeframe.</td>
                    </tr>
                  ) : (
                    staffReportData.transactions.map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">#SALE-{st.id}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{new Date(st.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{st.customer_name || 'Walk-in Customer'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={st.payment_method || 'Cash'} size="xs" />
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{formatGHS(st.total_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <RowActionMenu
                              triggerTitle={`Actions for #SALE-${st.id}`}
                              actions={[
                                {
                                  label: 'View Receipt',
                                  sublabel: 'Print or export invoice',
                                  icon: <Receipt size={14} className="text-blue-600" />,
                                  onClick: () => handleViewInvoice(st.id),
                                },
                                {
                                  label: 'Re-issue to Customer',
                                  sublabel: 'Print thermal receipt',
                                  icon: <Printer size={14} />,
                                  onClick: () => handleViewInvoice(st.id),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REORGANIZED STAFF COMMUNICATION & SHIFT NOTICE BOARD (Positioned down below transactions ledger) */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Shift Communication & Team Broadcasts
                    {totalUnread > 0 && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black animate-pulse">
                        {totalUnread} New
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">Internal announcements, shift handovers, and real-time team coordination.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/communication"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-2xs"
                >
                  <MessageSquare size={14} /> Open Communication Hub
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Active Channels */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Active Channels</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{channels?.length || 0} Channels</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Team & shift broadcast topics</div>
                </div>
                <div className="p-2.5 bg-white text-slate-700 rounded-lg border border-slate-200">
                  <Layers size={18} />
                </div>
              </div>

              {/* Staff On-Duty / Online */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Staff On-Duty / Online</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                    {onlineUsers?.length || teamMembers?.length || 1} Active
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Connected across shifts</div>
                </div>
                <div className="p-2.5 bg-white text-slate-700 rounded-lg border border-slate-200">
                  <Users size={18} />
                </div>
              </div>

              {/* Unread / Status Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unread Messages</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {totalUnread > 0 ? `${totalUnread} Unread` : 'All Caught Up'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {totalUnread > 0 ? 'Urgent notifications pending' : 'Zero unread messages'}
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg border ${totalUnread > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-emerald-600 border-slate-200'}`}>
                  {totalUnread > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                </div>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* --- ALL MODALS --- */}

      {/* Invoice Viewer Modal */}
      {selectedInvoiceSale && (
        <InvoiceModal
          saleData={selectedInvoiceSale}
          onClose={() => setSelectedInvoiceSale(null)}
        />
      )}

      {/* Quick Restock Modal */}
      {showRestockModal && selectedProductForRestock && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRestockModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Package size={16} /> Quick Restock Stock Entry
              </h3>
              <button onClick={() => setShowRestockModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickRestockSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="font-bold text-slate-900">{selectedProductForRestock.name}</div>
                <div className="text-slate-500 font-mono text-[11px]">SKU: {selectedProductForRestock.sku}</div>
                <div className="mt-1 flex items-center justify-between font-bold text-slate-700">
                  <span>Current Stock: <strong className="text-rose-600">{selectedProductForRestock.stock_quantity} units</strong></span>
                  <span>Alert Limit: <strong>{selectedProductForRestock.threshold || globalThreshold}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity to Add:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-sm focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Restock Reason / Shipment Ref:
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition"
                >
                  {isSubmittingRestock ? 'Submitting...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Alert Threshold Settings Modal */}
      {showThresholdModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowThresholdModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Settings size={16} /> Low Stock Alert Threshold
              </h3>
              <button onClick={() => setShowThresholdModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveThreshold} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Global Minimum Stock Level Limit:
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={globalThreshold}
                  onChange={(e) => setGlobalThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-sm focus:outline-none focus:border-blue-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Products with stock falling at or below this value will trigger low stock alert notifications.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingThreshold}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition"
                >
                  {isSavingThreshold ? 'Saving...' : 'Save Setting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EOD Daily Summary Modal */}
      {showDailySummaryModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDailySummaryModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} /> End-of-Day (EOD) Executive Report
              </h3>
              <button onClick={() => setShowDailySummaryModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              {dailySummaryLoading ? (
                <div className="py-12 text-center text-slate-400">Loading daily executive breakdown...</div>
              ) : dailySummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="text-[10px] font-black uppercase text-blue-700">Gross Sales</div>
                      <div className="text-lg font-black text-blue-900 mt-1">{formatGHS(dailySummary.totalSales || 0)}</div>
                      <div className="text-[10px] text-blue-700 mt-0.5">{dailySummary.salesCount || 0} transaction(s)</div>
                    </div>

                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <div className="text-[10px] font-black uppercase text-emerald-700">Gross Profit</div>
                      <div className="text-lg font-black text-emerald-900 mt-1">{formatGHS(dailySummary.grossProfit || 0)}</div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">Estimated gross gain</div>
                    </div>

                    <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
                      <div className="text-[10px] font-black uppercase text-rose-700">Expenses Logged</div>
                      <div className="text-lg font-black text-rose-900 mt-1">{formatGHS(dailySummary.totalExpenses || 0)}</div>
                      <div className="text-[10px] text-rose-700 mt-0.5">{dailySummary.expenseCount || 0} payout(s)</div>
                    </div>

                    <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black uppercase text-slate-700">Net Cash Collection</div>
                      <div className="text-lg font-black text-slate-900 mt-1">{formatGHS(dailySummary.netCash || 0)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Physical cash in till</div>
                    </div>
                  </div>

                  {/* Payment Methods Breakdown */}
                  {dailySummary.paymentBreakdown && (
                    <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payment Method Channels</h4>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-bold uppercase">Cash</div>
                          <div className="font-black text-slate-900">{formatGHS(dailySummary.paymentBreakdown.Cash || 0)}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-md border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-bold uppercase">Mobile Money (MoMo)</div>
                          <div className="font-black text-slate-900">{formatGHS((dailySummary.paymentBreakdown['Mobile Money'] || 0) + (dailySummary.paymentBreakdown.MoMo || 0) + (dailySummary.paymentBreakdown.Card || 0))}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowDailySummaryModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN COMPREHENSIVE REPORTS MODAL */}
      <AdminReportsModal
        isOpen={showAdminReportsModal}
        onClose={() => setShowAdminReportsModal(false)}
        defaultTab="daily"
      />

      {/* CREATE PURCHASE ORDER MODAL */}
      <CreatePOModal
        isOpen={showCreatePoModal}
        onClose={() => {
          setShowCreatePoModal(false);
          setPoPreselectedProduct(null);
        }}
        onSuccess={() => {
          loadDashboardData();
        }}
        preselectedProduct={poPreselectedProduct}
      />

      {/* AUTOMATED BULK CSV PRODUCT & INVENTORY IMPORT MODAL */}
      {showImportModal && (
        <ProductImportModal
          existingProducts={allProducts}
          categories={categories}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            addToast('Bulk catalog & inventory import completed successfully!', 'success');
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
}
