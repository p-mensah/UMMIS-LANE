import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingUp, ShoppingCart, DollarSign, Package, AlertTriangle, 
  Users, Calendar, RefreshCw, ChevronRight, FileText, Settings, 
  ArrowUpRight, ArrowDownRight, Clock, Plus, ShieldAlert, Award,
  CheckCircle2, AlertCircle, Eye, Download, X, Search, RotateCcw,
  CreditCard, Truck, Layers, Filter, Check, ShieldCheck, Wallet, Store, Zap,
  Monitor, Globe, Trash2, Minus, Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import InvoiceModal from '../components/InvoiceModal';
import LowStockAlertIndicator from '../components/LowStockAlertIndicator';
import AutomatedLowStockNotification from '../components/AutomatedLowStockNotification';
import RecentActivityPanel from '../components/RecentActivityPanel';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode Selection
  const [viewMode, setViewMode] = useState<'admin' | 'staff'>(user?.role === 'admin' ? 'admin' : 'staff');

  // Loading States
  const [loading, setLoading] = useState(true);

  // Executive Data States
  const [summary, setSummary] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [trendTimeframe, setTrendTimeframe] = useState<'7days' | '30days' | 'monthly' | 'yearly'>('30days');
  const [trendChartType, setTrendChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [recentSalesList, setRecentSalesList] = useState<any[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);

  // Quick Sale Modal State
  const [showQuickSaleModal, setShowQuickSaleModal] = useState(false);
  const [quickSaleCart, setQuickSaleCart] = useState<Array<{ product_id: number; name: string; quantity: number; unit_price: number; max_stock: number }>>([]);
  const [quickSaleSearch, setQuickSaleSearch] = useState('');
  const [quickSaleCustomerName, setQuickSaleCustomerName] = useState('');
  const [quickSalePaymentMethod, setQuickSalePaymentMethod] = useState('Cash');
  const [isProcessingQuickSale, setIsProcessingQuickSale] = useState(false);

  // Staff Permissions and Alert Display Settings
  const [allowStaffAdjustments, setAllowStaffAdjustments] = useState<boolean>(false);
  const [showStaffAlerts, setShowStaffAlerts] = useState<boolean>(true);

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

  // Low Stock Table Filters
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState<'all' | 'out_of_stock' | 'critical'>('all');

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

  // Initial Load
  useEffect(() => {
    loadDashboardData();
    loadStaffSummary();
  }, [user]);

  useEffect(() => {
    fetchApi(`/reports/sales-trends?timeframe=${trendTimeframe}`)
      .then(data => setSalesTrends(data))
      .catch(console.error);
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
    Promise.all([
      fetchApi('/reports/summary'),
      fetchApi('/reports/low-stock'),
      fetchApi('/reports/best-sellers'),
      fetchApi('/sales').catch(() => []),
      fetchApi('/settings').catch(() => ({})),
      fetchApi('/products').catch(() => []),
      fetchApi('/audit-logs?limit=5').catch(() => [])
    ])
      .then(([summaryData, lowStockData, top, sales, settingsData, prods, audits]) => {
         setSummary(summaryData);
         setLowStockProducts(lowStockData);
         setBestSellers(top);
         if (Array.isArray(sales)) {
           setRecentSalesList(sales.slice(0, 6));
         }
         if (Array.isArray(prods)) {
           setAllProducts(prods);
         }
         if (Array.isArray(audits)) {
           setRecentAuditLogs(audits);
         }
         if (settingsData) {
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
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadMonthlySummary = (monthStr: string) => {
    setMonthlyLoading(true);
    fetchApi(`/reports/monthly-summary?month=${monthStr}`)
      .then(data => setMonthlySummaryData(data))
      .catch(console.error)
      .finally(() => setMonthlyLoading(false));
  };

  const loadStaffSummary = () => {
    setStaffLoading(true);
    fetchApi('/reports/staff-my-summary')
      .then(data => setStaffSummary(data))
      .catch(console.error)
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
      alert('Failed to load invoice: ' + err.message);
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
    } catch (err: any) {
      alert('Failed to update staff stock adjustment setting: ' + err.message);
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
    } catch (err: any) {
      alert('Failed to update staff alert visibility setting: ' + err.message);
      loadDashboardData();
    }
  };

  const handleQuickRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRestock || restockQty <= 0) return;
    if (user?.role !== 'admin' && !allowStaffAdjustments) {
      alert('Permission Denied: Staff stock adjustments are disabled by administrator.');
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
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update stock');
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
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSavingThreshold(false);
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

  // Low Stock Table Filter Math
  const filteredLowStock = lowStockProducts.filter(p => {
    const matchSearch = !lowStockSearch || 
      p.name.toLowerCase().includes(lowStockSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(lowStockSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(lowStockSearch.toLowerCase());

    if (lowStockFilter === 'out_of_stock') return matchSearch && p.stock_quantity === 0;
    if (lowStockFilter === 'critical') return matchSearch && p.stock_quantity > 0 && p.stock_quantity <= Math.ceil((p.threshold || 10) / 2);
    return matchSearch;
  });

  // Background Scroll Locking when any modal is active
  const isAnyModalOpen = Boolean(
    showQuickSaleModal || 
    showRestockModal || 
    showThresholdModal || 
    showDailySummaryModal || 
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

  // Quick Sale Handlers
  const handleOpenQuickSale = () => {
    setQuickSaleCart([]);
    setQuickSaleSearch('');
    setQuickSaleCustomerName('');
    setQuickSalePaymentMethod('Cash');
    setShowQuickSaleModal(true);
  };

  const handleAddProductToQuickSale = (prod: any) => {
    const maxStock = prod.stock_quantity ?? 0;
    if (maxStock <= 0) {
      alert(`"${prod.name}" is out of stock.`);
      return;
    }
    const existing = quickSaleCart.find(item => item.product_id === prod.id);
    if (existing) {
      if (existing.quantity >= maxStock) {
        alert(`Cannot exceed available stock (${maxStock} units).`);
        return;
      }
      setQuickSaleCart(prev => prev.map(item => 
        item.product_id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setQuickSaleCart(prev => [...prev, {
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        unit_price: Number(prod.selling_price || 0),
        max_stock: maxStock
      }]);
    }
  };

  const handleUpdateQuickSaleQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setQuickSaleCart(prev => prev.filter(item => item.product_id !== productId));
      return;
    }
    setQuickSaleCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity: Math.min(qty, item.max_stock) };
      }
      return item;
    }));
  };

  const handleRemoveQuickSaleItem = (productId: number) => {
    setQuickSaleCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const handleProcessQuickSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSaleCart.length === 0) {
      alert('Please select at least one item for the sale.');
      return;
    }
    setIsProcessingQuickSale(true);
    try {
      const totalAmount = quickSaleCart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const salePayload = {
        customer_name: quickSaleCustomerName.trim() || 'Walk-in Customer',
        payment_method: quickSalePaymentMethod,
        total_amount: totalAmount,
        items: quickSaleCart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };
      const createdSale = await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify(salePayload)
      });
      setShowQuickSaleModal(false);
      setQuickSaleCart([]);
      loadDashboardData();
      if (createdSale?.id) {
        handleViewInvoice(createdSale.id);
      }
    } catch (err: any) {
      alert('Quick Sale error: ' + (err.message || 'Could not complete transaction.'));
    } finally {
      setIsProcessingQuickSale(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Retail OS Overview
          </h1>
          <p className="text-xs text-slate-500 font-medium">Real-time revenue monitoring, POS sales trends, stock alerts, and financial ledgers.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin vs Staff View Toggle */}
          {user?.role === 'admin' && (
            <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
              <button
                onClick={() => setViewMode('admin')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all ${
                  viewMode === 'admin' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Executive Admin
              </button>
              <button
                onClick={() => setViewMode('staff')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all ${
                  viewMode === 'staff' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cashier Terminal
              </button>
            </div>
          )}

          <button
            onClick={handleOpenDailySummary}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs uppercase tracking-wider transition border border-slate-200 flex items-center gap-1.5"
          >
            <FileText size={15} /> EOD Summary
          </button>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition border border-slate-200"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* QUICK SHORTCUT TOOLBAR (Mobile horizontal snap slider, desktop fluid grid) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between sm:hidden px-1 text-[11px] font-bold text-slate-500">
          <span>Quick Actions</span>
          <span className="text-[10px] text-blue-600">Slide ↔</span>
        </div>
        <div className="flex sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(100%,130px),1fr))] overflow-x-auto snap-x snap-mandatory gap-2.5 pb-2 sm:pb-0 custom-scrollbar">
          {/* Quick Sale Direct Modal Button */}
          <button
            type="button"
            onClick={handleOpenQuickSale}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[130px] sm:min-w-0 snap-start"
          >
            <Zap size={20} className="group-hover:scale-110 transition-transform text-amber-300" />
            <span className="text-xs font-black uppercase tracking-wider">Quick POS Sale</span>
          </button>

          <Link
            to="/sales"
            className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <ShoppingCart size={20} className="text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Full POS Terminal</span>
          </Link>

          <Link
            to="/returns"
            className="p-3 bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <RotateCcw size={20} className="text-rose-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Process Return</span>
          </Link>

          <Link
            to="/products"
            className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <Package size={20} className="text-slate-700 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Products Catalog</span>
          </Link>

          <Link
            to="/expenses"
            className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <CreditCard size={20} className="text-slate-700 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Record Expense</span>
          </Link>

          <Link
            to="/shifts"
            className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <Clock size={20} className="text-slate-700 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Shift Register</span>
          </Link>

          <Link
            to="/customers"
            className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg shadow-2xs transition flex flex-col items-center text-center gap-1.5 group shrink-0 min-w-[125px] sm:min-w-0 snap-start"
          >
            <Users size={20} className="text-slate-700 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider">Customers</span>
          </Link>
        </div>
      </div>

      {/* AUTOMATED LOW-STOCK WARNING NOTIFICATION & REORDER POINT WARNING LIST */}
      <AutomatedLowStockNotification
        products={allProducts.length > 0 ? allProducts : lowStockProducts}
        globalThreshold={globalThreshold}
        userRole={user?.role}
        onQuickRestock={user?.role === 'admin' || allowStaffAdjustments ? (prod) => {
          setSelectedProductForRestock(prod);
          setRestockQty(Math.max(10, ((prod.min_stock_level || globalThreshold) * 2) - prod.stock_quantity));
          setShowRestockModal(true);
        } : undefined}
        onRefresh={loadDashboardData}
        isLoading={loading}
      />

      {/* ADMIN OVERVIEW VIEW */}
      {viewMode === 'admin' ? (
        <>
          {/* REORDER POINT & LOW STOCK REPLENISHMENT WIDGET (ADMIN ONLY) */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" /> Inventory Reorder Points & Low Stock Replenishment
                </h2>
                <p className="text-xs text-slate-500">Products currently at or below their reorder point threshold requiring purchase or replenishment.</p>
              </div>
              <div className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                {lowStockProducts.length} Item(s) Need Restocking
              </div>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                All inventory levels are currently above reorder point thresholds.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">SKU / Barcode</th>
                      <th className="p-2.5 text-right">In Stock</th>
                      <th className="p-2.5 text-right">Reorder Level</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockProducts.map((p) => {
                      const isOut = p.stock_quantity === 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                          <td className="p-2.5 text-slate-500 font-mono text-[11px]">{p.sku || p.barcode || 'N/A'}</td>
                          <td className="p-2.5 text-right font-black text-slate-900">
                            <span className={`px-2 py-0.5 rounded ${isOut ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-slate-600">{p.min_stock_level || globalThreshold}</td>
                          <td className="p-2.5 text-center">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isOut ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                              {isOut ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedProductForRestock(p);
                                setRestockQty(Math.max(10, (p.min_stock_level || 10) * 2 - p.stock_quantity));
                                setShowRestockModal(true);
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[11px] uppercase tracking-wider transition"
                            >
                              Restock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* REAL-TIME AUTOMATED LOW-STOCK ALERT INDICATOR & GOVERNANCE WIDGET */}
          <LowStockAlertIndicator
            products={allProducts.length > 0 ? allProducts : lowStockProducts}
            globalThreshold={globalThreshold}
            userRole="admin"
            allowStaffAdjustments={allowStaffAdjustments}
            showStaffAlerts={showStaffAlerts}
            onToggleStaffAdjustments={handleToggleStaffAdjustments}
            onToggleStaffAlerts={handleToggleStaffAlerts}
            onOpenThresholdModal={() => setShowThresholdModal(true)}
            onQuickRestock={(prod) => {
              setSelectedProductForRestock(prod);
              setRestockQty(10);
              setShowRestockModal(true);
            }}
            onRefresh={loadDashboardData}
            isLoading={loading}
          />

          {/* PRIMARY BUSINESS KPI CARDS (Mobile snap-slider, desktop auto-fit grid) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between sm:hidden px-1 text-[11px] font-bold text-slate-500">
              <span>Performance Snapshot</span>
              <span className="text-[10px] text-blue-600">Swipe Cards ↔</span>
            </div>
            <div className="flex sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-4 pb-2 sm:pb-0 custom-scrollbar">
              {/* Card 1: Today's Gross Sales */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-2 shrink-0 w-[84vw] max-w-[310px] sm:w-auto snap-start">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider">
                  <span>Today's Gross Sales</span>
                  <DollarSign size={18} className="text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {formatGHS(summary?.todaySales || 0)}
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span>{summary?.todayCount || 0} order(s) completed</span>
                  {summary?.percentChange !== undefined && (
                    <span className={`flex items-center font-bold text-[11px] ${summary.percentChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {summary.percentChange >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {Math.abs(summary.percentChange)}% vs Ytd
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Month Net Profit */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-2 shrink-0 w-[84vw] max-w-[310px] sm:w-auto snap-start">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider">
                  <span>Monthly Net Profit</span>
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {formatGHS(summary?.monthProfit || 0)}
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span>Revenue: {formatGHS(summary?.monthSales || 0)}</span>
                  <span className="font-bold text-slate-900">
                    {summary?.monthSales > 0 ? ((summary.monthProfit / summary.monthSales) * 100).toFixed(1) : 0}% Margin
                  </span>
                </div>
              </div>

              {/* Card 3: Active Shift Drawer Status */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-2 shrink-0 w-[84vw] max-w-[310px] sm:w-auto snap-start">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider">
                  <span>Shift Cash Status</span>
                  <Clock size={18} className="text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {summary?.activeShiftCount || 0} Open Shift(s)
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span>Expected Cash: {formatGHS(summary?.openShiftsCashTotal || 0)}</span>
                  <span className="font-bold text-indigo-600">Live Counter</span>
                </div>
              </div>

              {/* Card 4: Low Stock Alert */}
              <div className="bg-white p-5 rounded-lg border border-amber-200 bg-amber-50/30 shadow-2xs space-y-2 shrink-0 w-[84vw] max-w-[310px] sm:w-auto snap-start">
                <div className="flex items-center justify-between text-amber-800 text-[11px] font-black uppercase tracking-wider">
                  <span>Low Stock Urgency</span>
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900">
                  {lowStockProducts.length} Product(s)
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-amber-800 pt-1 border-t border-amber-200/60">
                  <span>{lowStockProducts.filter(p => p.stock_quantity === 0).length} completely out of stock</span>
                  <a href="#low-stock-section" className="font-bold underline hover:text-amber-900">
                    Restock
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* REVENUE & SALES VELOCITY ANALYTICS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Velocity Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    Sales & Revenue Velocity
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">Historical transaction volume and revenue trends.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    {[
                      { id: '7days', label: '7 Days' },
                      { id: '30days', label: '30 Days' },
                      { id: 'monthly', label: 'Monthly' },
                      { id: 'yearly', label: 'Yearly' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTrendTimeframe(t.id as any)}
                        className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded transition-all ${
                          trendTimeframe === t.id ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                    {[
                      { id: 'line', label: 'Line' },
                      { id: 'area', label: 'Area' },
                      { id: 'bar', label: 'Bar' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setTrendChartType(type.id as any)}
                        className={`px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded transition-all ${
                          trendChartType === type.id ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title={`${type.label} Chart`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart Stats Bar */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded border border-slate-100 text-center text-xs">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Period Revenue</div>
                  <div className="font-black text-slate-900">{formatGHS(totalTrendRevenue)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Daily Average</div>
                  <div className="font-black text-slate-900">{formatGHS(avgTrendRevenue)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Peak Sales Day</div>
                  <div className="font-black text-blue-600">{peakTrendDay ? formatGHS(peakTrendDay.total) : 'N/A'}</div>
                </div>
              </div>

              {/* Recharts Container */}
              <div className="h-[280px] w-full min-w-0 pt-2 relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250} initialDimension={{ width: 500, height: 260 }}>
                  {trendChartType === 'line' ? (
                    <LineChart data={salesTrends} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `GHS ${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        formatter={(value: any) => [formatGHS(Number(value)), 'Revenue']}
                        labelFormatter={(label: any) => `Timeline: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#2563eb" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, fill: '#2563eb', strokeWidth: 1.5, stroke: '#ffffff' }}
                        activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#bfdbfe', strokeWidth: 2 }} 
                      />
                    </LineChart>
                  ) : trendChartType === 'area' ? (
                    <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `GHS ${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: any) => [formatGHS(Number(value)), 'Revenue']} 
                      />
                      <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={salesTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `GHS ${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: any) => [formatGHS(Number(value)), 'Revenue']} 
                      />
                      <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Selling Products Leaderboard */}
            <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Award size={16} className="text-amber-500" />
                    Top Selling Products
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">Highest volume items by units sold.</p>
                </div>
                <Link to="/products" className="text-xs font-bold text-blue-600 hover:underline">
                  Catalog
                </Link>
              </div>

              <div className="space-y-3">
                {bestSellers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium">
                    No sales data available yet.
                  </div>
                ) : (
                  bestSellers.slice(0, 5).map((item: any, idx: number) => {
                    const maxQty = Math.max(...bestSellers.map((b: any) => b.total_qty || 1));
                    const percent = Math.round(((item.total_qty || 0) / maxQty) * 100);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 truncate max-w-[180px]">
                            {idx + 1}. {item.name}
                          </span>
                          <span className="font-black text-slate-900">
                            {item.total_qty} units
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
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
          </div>

          {/* RECENT ACTIVITY PANEL (LAST 5 TRANSACTIONS & INVENTORY CHANGES) */}
          <RecentActivityPanel
            sales={recentSalesList}
            auditLogs={recentAuditLogs}
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
              <Link to="/sales" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                All Transactions <ChevronRight size={14} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Receipt</th>
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
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded uppercase text-[10px]">
                            {sale.payment_method || 'Cash'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {formatGHS(sale.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewInvoice(sale.id)}
                            disabled={loadingInvoiceId === sale.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] uppercase tracking-wider transition border border-slate-200"
                          >
                            {loadingInvoiceId === sale.id ? 'Loading...' : 'View Receipt'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOW STOCK CONTROL CENTER */}
          <div id="low-stock-section" className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden space-y-3">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-600" />
                  Inventory Low Stock Alert Center ({filteredLowStock.length})
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Restock items running below threshold to prevent stockouts.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportLowStockCSV}
                  disabled={lowStockProducts.length === 0}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-200 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <Download size={13} /> Export CSV
                </button>

                <button
                  onClick={() => setShowThresholdModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded transition flex items-center gap-1"
                >
                  <Settings size={13} /> Set Alert Threshold ({globalThreshold})
                </button>
              </div>
            </div>

            {/* Low stock search and filters */}
            <div className="px-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search low stock items by name, SKU, or category..."
                  value={lowStockSearch}
                  onChange={(e) => setLowStockSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
                {[
                  { id: 'all', label: 'All Low Stock' },
                  { id: 'out_of_stock', label: 'Out of Stock' },
                  { id: 'critical', label: 'Critical' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setLowStockFilter(f.id as any)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                      lowStockFilter === f.id ? 'bg-white text-amber-800 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Low stock table */}
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Product Name</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-center">Current Stock</th>
                    <th className="px-4 py-2.5 text-center">Alert Limit</th>
                    <th className="px-4 py-2.5 text-right">Selling Price</th>
                    <th className="px-4 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLowStock.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-500 opacity-60" />
                        No low stock alerts matching filter. All inventory healthy!
                      </td>
                    </tr>
                  ) : (
                    filteredLowStock.map((prod: any) => (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-600">
                          {prod.sku}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {prod.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {prod.category}
                        </td>
                        <td className="px-4 py-2.5 text-center font-black">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            prod.stock_quantity === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 font-black'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {prod.stock_quantity} units
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-500">
                          {prod.threshold || globalThreshold}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">
                          {formatGHS(prod.selling_price)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedProductForRestock(prod);
                              setRestockQty(10);
                              setShowRestockModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] uppercase tracking-wider transition shadow-2xs"
                          >
                            + Quick Restock
                          </button>
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
                  <DollarSign size={16} className="text-emerald-600" />
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
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                      Ledger Live
                    </span>
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
                    <th className="px-4 py-2.5 text-right whitespace-nowrap"><span className="sr-only">Inspect</span></th>
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
                        onClick={() => navigate('/audit-logs')}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Inspect <ChevronRight size={13} />
                          </span>
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
          {/* STAFF LOW-STOCK REAL-TIME ALERT INDICATOR (READ-ONLY FOR STAFF) */}
          {showStaffAlerts && (
            <LowStockAlertIndicator
              products={allProducts.length > 0 ? allProducts : lowStockProducts}
              globalThreshold={globalThreshold}
              userRole="staff"
              allowStaffAdjustments={false}
              showStaffAlerts={showStaffAlerts}
              onQuickRestock={undefined}
              onRefresh={loadDashboardData}
              isLoading={loading}
            />
          )}

          {/* Staff Counter KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">My Counter Sales Today</div>
              <div className="text-2xl font-black text-blue-700">{formatGHS(staffSummary?.myTodaySales || 0)}</div>
              <div className="text-xs text-slate-500 mt-1">{staffSummary?.myTodayCount || 0} transactions processed</div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">My Month Volume</div>
              <div className="text-2xl font-black text-slate-900">{formatGHS(staffSummary?.myMonthSales || 0)}</div>
              <div className="text-xs text-slate-500 mt-1">{staffSummary?.myMonthCount || 0} total sales order(s)</div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">Sales Goal Progress</div>
              <div className="text-2xl font-black text-emerald-700">{staffSummary?.targetPercent || 0}%</div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, staffSummary?.targetPercent || 0)}%` }} />
              </div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">Estimated Sales Commission</div>
              <div className="text-2xl font-black text-indigo-700">{formatGHS(staffSummary?.myCommission || 0)}</div>
              <div className="text-xs text-slate-500 mt-1">Based on monthly performance</div>
            </div>
          </div>

          {/* Staff Sales Ledger */}
          <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Receipt</th>
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
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded uppercase text-[10px]">{st.payment_method}</span></td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{formatGHS(st.total_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewInvoice(st.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] uppercase tracking-wider transition"
                          >
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-8 custom-scrollbar">
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
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-bold uppercase">Cash</div>
                          <div className="font-black text-slate-900">{formatGHS(dailySummary.paymentBreakdown.Cash || 0)}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-bold uppercase">Mobile Money</div>
                          <div className="font-black text-slate-900">{formatGHS(dailySummary.paymentBreakdown['Mobile Money'] || 0)}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-bold uppercase">Card</div>
                          <div className="font-black text-slate-900">{formatGHS(dailySummary.paymentBreakdown.Card || 0)}</div>
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

      {/* QUICK SALE MODAL (Direct Dashboard POS) */}
      {showQuickSaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto py-6 sm:py-8 custom-scrollbar">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Zap size={18} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Quick POS Terminal Sale
                  </h3>
                  <p className="text-[10px] text-slate-400">Rapid counter checkout directly from dashboard</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuickSaleModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Customer & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Walk-in Customer"
                    value={quickSaleCustomerName}
                    onChange={(e) => setQuickSaleCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={quickSalePaymentMethod}
                    onChange={(e) => setQuickSalePaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money (MoMo)</option>
                    <option value="Card">Bank Card</option>
                  </select>
                </div>
              </div>

              {/* Product Search & Quick Add */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Search Inventory to Add
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU, or category..."
                    value={quickSaleSearch}
                    onChange={(e) => setQuickSaleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>

                {quickSaleSearch.trim() && (
                  <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 custom-scrollbar bg-slate-50">
                    {allProducts
                      .filter(p => 
                        p.name?.toLowerCase().includes(quickSaleSearch.toLowerCase()) ||
                        p.sku?.toLowerCase().includes(quickSaleSearch.toLowerCase()) ||
                        p.category?.toLowerCase().includes(quickSaleSearch.toLowerCase())
                      )
                      .slice(0, 8)
                      .map(prod => (
                        <div 
                          key={prod.id}
                          className="p-2.5 flex items-center justify-between hover:bg-white transition text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{prod.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              SKU: {prod.sku} | Stock: <span className={prod.stock_quantity <= 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>{prod.stock_quantity}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-900">{formatGHS(prod.selling_price)}</span>
                            <button
                              type="button"
                              onClick={() => handleAddProductToQuickSale(prod)}
                              disabled={prod.stock_quantity <= 0}
                              className={`px-3 py-1 rounded text-xs font-black uppercase transition ${
                                prod.stock_quantity <= 0
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                              }`}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Selected Items / Cart */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                  <span>Sale Cart Items ({quickSaleCart.reduce((sum, i) => sum + i.quantity, 0)})</span>
                  <span>Subtotal</span>
                </div>

                {quickSaleCart.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    <ShoppingCart size={24} className="mx-auto mb-1.5 opacity-40" />
                    No items in quick sale cart yet. Search above to add items.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
                    {quickSaleCart.map(item => (
                      <div key={item.product_id} className="py-2 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{formatGHS(item.unit_price)} each</div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center border border-slate-300 rounded bg-white">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuickSaleQty(item.product_id, item.quantity - 1)}
                              className="p-1 text-slate-500 hover:bg-slate-100"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-2 font-bold text-xs">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuickSaleQty(item.product_id, item.quantity + 1)}
                              className="p-1 text-slate-500 hover:bg-slate-100"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span className="font-black text-slate-900 w-20 text-right">
                            {formatGHS(item.quantity * item.unit_price)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuickSaleItem(item.product_id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700">Total Payable:</span>
                  <span className="text-lg font-black text-blue-700">
                    {formatGHS(quickSaleCart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setShowQuickSaleModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessingQuickSale || quickSaleCart.length === 0}
                onClick={handleProcessQuickSale}
                className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider text-white transition flex items-center gap-2 ${
                  isProcessingQuickSale || quickSaleCart.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
                }`}
              >
                <Receipt size={15} />
                {isProcessingQuickSale ? 'Processing...' : 'Complete & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
