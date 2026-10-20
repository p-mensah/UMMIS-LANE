import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { 
  ShoppingCart, Printer, RotateCcw, Search, X, Tag, Minus, Plus, Trash2, 
  Scan, Volume2, VolumeX, CheckCircle2, AlertCircle, FileText, Download,
  Filter, Check, ArrowRight, Store, User, Layers, TrendingUp, Calendar,
  ChevronDown, ChevronUp, BarChart3, Eye, Mail, MoreVertical, Tablet, Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { formatGHS } from '../lib/formatters';
import InvoiceModal from '../components/InvoiceModal';
import RowActionMenu from '../components/common/RowActionMenu';
import Pagination from '../components/common/Pagination';
import { getDisplayCustomerPhone } from '../lib/privacy';
import TabletPOSLayout from '../components/tablet/TabletPOSLayout';
import PrintPreviewModal from '../components/PrintPreviewModal';
import RecentTransactionsSidePanel from '../components/RecentTransactionsSidePanel';

export default function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isTabletMode, setIsTabletMode] = useState<boolean>(searchParams.get('mode') === 'tablet');
  const [sales, setSales] = useState<any[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Performance Chart View States
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders' | 'dual'>('revenue');
  const [showChart, setShowChart] = useState(true);

  // Modal & Cart States
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [invoiceSaleData, setInvoiceSaleData] = useState<any | null>(null);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [sessionSales, setSessionSales] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('pharmacy_pos_session_sales');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Cart & POS filters
  const [cart, setCart] = useState<{product_id: number, quantity: number, unit_price: number, notes?: string}[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Money'>('Cash');
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState('');
  const [posMobileTab, setPosMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Table Filters
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');

  // Barcode Scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannerDrawerOpen, setScannerDrawerOpen] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, categoryFilter, paymentFilter, statusFilter, cashierFilter]);

  const loadData = async () => {
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (categoryFilter) query.append('category', categoryFilter);
      if (paymentFilter) query.append('payment_method', paymentFilter);
      if (statusFilter) query.append('status', statusFilter);
      if (user?.role === 'admin' && cashierFilter) query.append('userId', cashierFilter);

      const [salesRes, prodRes, usersRes, customersRes, categoriesRes, trendsRes] = await Promise.all([
        fetchApi(`/sales?${query.toString()}`),
        fetchApi('/products'),
        fetchApi('/users'),
        fetchApi('/customers'),
        fetchApi('/categories'),
        fetchApi('/reports/sales-trends?timeframe=weekly').catch(() => [])
      ]);
      setSales(salesRes);
      if (Array.isArray(salesRes)) {
        setSessionSales(prev => {
          if (prev.length > 0) return prev;
          const todayStr = new Date().toDateString();
          const todaySales = salesRes.filter((s: any) => {
            const sDate = new Date(s.created_at).toDateString();
            return sDate === todayStr && (!user?.id || s.user_id === user?.id || user?.role === 'admin');
          }).map((s: any) => ({ ...s, isCurrentSession: true }));
          return todaySales;
        });
      }
      setProducts(prodRes);
      setUsers(usersRes);
      setCustomers(customersRes);
      setCategories(categoriesRes);
      if (Array.isArray(trendsRes)) {
        setWeeklyTrends(trendsRes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const playBeep = (type: 'success' | 'error' = 'success') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  const handleBarcodeScan = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    const matched = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
      (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase()) ||
      (p.id.toString() === code)
    );

    if (matched) {
      if (matched.stock_quantity <= 0) {
        playBeep('error');
        setScanFeedback({ type: 'error', message: `"${matched.name}" is OUT OF STOCK!` });
        return;
      }

      const existingInCart = cart.find(item => item.product_id === matched.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;

      if (currentQty + 1 > matched.stock_quantity) {
        playBeep('error');
        setScanFeedback({ type: 'error', message: `Stock limit reached (${matched.stock_quantity})` });
        return;
      }

      addToCart(matched.id, matched.selling_price);
      playBeep('success');
      setScanFeedback({ type: 'success', message: `Added: ${matched.name} (${formatGHS(matched.selling_price)})` });
      setBarcodeInput('');

      if (!showPOSModal) {
        setShowPOSModal(true);
      }
    } else {
      playBeep('error');
      setScanFeedback({ type: 'error', message: `No product matching SKU/Barcode "${code}"` });
      setBarcodeInput('');
    }
  };

  const addToCart = (productId: number, price: number) => {
    const p = products.find(prod => prod.id === productId);
    const existing = cart.find(i => i.product_id === productId);
    if (existing && p && existing.quantity + 1 > p.stock_quantity) {
      addToast(`Cannot exceed available stock of ${p.stock_quantity}`, 'warning');
      return;
    }
    if (p && p.stock_quantity <= 0) {
      addToast(`${p.name} is out of stock!`, 'warning');
      return;
    }

    setCart(prev => {
      const ex = prev.find(i => i.product_id === productId);
      if (ex) {
        return prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: productId, quantity: 1, unit_price: price }];
    });
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify({ 
          items: cart, 
          customer_id: selectedCustomer ? parseInt(selectedCustomer, 10) : null,
          payment_method: paymentMethod
        })
      });
      
      setShowConfirmModal(false);
      setShowPOSModal(false);

      // Fetch full sale details for print invoice modal and session tracking
      let completedSaleObj: any = null;
      try {
        const fullSale = await fetchApi(`/sales/${res.saleId}`);
        completedSaleObj = fullSale;
        setInvoiceSaleData(fullSale);
      } catch (e) {
        // Fallback invoice payload
        completedSaleObj = {
          saleId: res.saleId,
          id: res.saleId,
          items: [...cart],
          total: totalCart,
          total_amount: totalCart,
          created_at: new Date().toISOString(),
          customer_name: customers.find(c => c.id.toString() === selectedCustomer)?.name || null,
          customer_id: selectedCustomer ? parseInt(selectedCustomer, 10) : null,
          payment_method: paymentMethod,
          user_name: user?.name || 'Cashier',
          user_id: user?.id,
          status: 'completed'
        };
        setInvoiceSaleData(completedSaleObj);
      }

      if (completedSaleObj) {
        const newSessionTx = {
          ...completedSaleObj,
          id: res.saleId || completedSaleObj.id,
          total_amount: totalCart,
          isCurrentSession: true
        };
        setSessionSales(prev => {
          const updated = [newSessionTx, ...prev.filter(s => s.id !== newSessionTx.id)];
          try {
            sessionStorage.setItem('pharmacy_pos_session_sales', JSON.stringify(updated.slice(0, 100)));
          } catch (err) {}
          return updated;
        });
      }

      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('Cash');
      setPosSearchQuery('');
      loadData();
      addToast('Sale transaction completed successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to complete sale', 'error');
    }
  };

  const [invoiceInitialFormat, setInvoiceInitialFormat] = useState<'receipt' | 'a4'>('receipt');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableSearchQuery, startDate, endDate, categoryFilter, paymentFilter, statusFilter, cashierFilter]);

  const handleReprint = async (saleId: number) => {
    await handleViewReceipt(saleId, 'receipt');
  };

  const handleViewReceipt = async (saleId: number, format: 'receipt' | 'a4' = 'receipt') => {
    try {
      const sale = await fetchApi(`/sales/${saleId}`);
      setInvoiceInitialFormat(format);
      setInvoiceSaleData(sale);
    } catch (err: any) {
      addToast(err.message || 'Failed to load sale receipt', 'error');
    }
  };

  const handleSendReceipt = async (sale: any) => {
    const cust = sale.customer_name || 'Customer';
    addToast({
      title: 'Receipt Sent',
      message: `Digital receipt for #SALE-${sale.id} has been dispatched to ${cust}.`,
      type: 'success'
    });
  };

  // Filter products for POS session
  const filteredPOSProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(posSearchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(posSearchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(posSearchQuery.toLowerCase())) ||
      (p.category_name && p.category_name.toLowerCase().includes(posSearchQuery.toLowerCase()));
    
    const matchesCategory = posCategoryFilter === '' || p.category_name === posCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter sales for table view
  const filteredSalesTable = sales.filter(s => {
    const q = tableSearchQuery.toLowerCase();
    return (
      `SALE-${s.id}`.toLowerCase().includes(q) ||
      (s.user_name && s.user_name.toLowerCase().includes(q)) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.payment_method && s.payment_method.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredSalesTable.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSalesTable.slice(start, start + itemsPerPage);
  }, [filteredSalesTable, currentPage, itemsPerPage]);

  const handleExportCSV = () => {
    if (filteredSalesTable.length === 0) {
      addToast('No sales records match the current table filters to export.', 'warning');
      return;
    }
    const isAdmin = user?.role === 'admin';
    const headers = [
      'Sale ID', 
      'Date & Time', 
      'Cashier', 
      'Customer', 
      'Payment Method', 
      'Status', 
      'Total Amount (₵)', 
      ...(isAdmin ? ['Gross Profit (₵)'] : [])
    ];
    const csvRows = [headers.join(',')];

    for (const s of filteredSalesTable) {
      const dateStr = s.created_at ? new Date(s.created_at.endsWith('Z') ? s.created_at : s.created_at + 'Z').toLocaleString() : '';
      const row = [
        `"SALE-${s.id}"`,
        `"${dateStr}"`,
        `"${(s.user_name || '').replace(/"/g, '""')}"`,
        `"${(s.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
        `"${(s.payment_method || 'Cash').replace(/"/g, '""')}"`,
        `"${(s.status || 'completed').replace(/"/g, '""')}"`,
        `"${(Number(s.total_amount) || 0).toFixed(2)}"`,
        ...(isAdmin ? [`"${(Number(s.profit) || 0).toFixed(2)}"`] : [])
      ];
      csvRows.push(row.join(','));
    }

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Exported ${filteredSalesTable.length} sales records to CSV.`, 'success');
  };

  const handlePrintReport = () => {
    if (filteredSalesTable.length === 0) {
      addToast('No sales records match current filters to print or export as PDF.', 'warning');
      return;
    }
    window.print();
  };

  // Calculate past week daily performance for Recharts line graph
  const weeklyChartData = useMemo(() => {
    const days: { 
      date: string; 
      label: string; 
      shortLabel: string;
      total: number; 
      sales_count: number;
      avg_order: number;
    }[] = [];
    
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const label = `${weekday}, ${monthDay}`;
      const shortLabel = weekday;

      const daySales = sales.filter((s: any) => {
        if (!s.created_at || s.status === 'refunded') return false;
        const sDate = s.created_at.includes('T') ? s.created_at.split('T')[0] : s.created_at.split(' ')[0];
        return sDate === dateStr;
      });

      const total = daySales.reduce((acc: number, s: any) => acc + (Number(s.total_amount) || 0), 0);
      const count = daySales.length;

      days.push({
        date: dateStr,
        label,
        shortLabel,
        total,
        sales_count: count,
        avg_order: count > 0 ? total / count : 0
      });
    }

    // If active sales table filter has 0 entries but weekly trends is provided from server, use it
    const hasAnySales = days.some(d => d.total > 0 || d.sales_count > 0);
    if (!hasAnySales && weeklyTrends.length > 0) {
      return weeklyTrends.map(item => {
        const itemDate = new Date(item.date);
        const weekday = !isNaN(itemDate.getTime()) ? itemDate.toLocaleDateString('en-US', { weekday: 'short' }) : '';
        return {
          date: item.date,
          label: `${weekday ? weekday + ', ' : ''}${item.label || item.date}`,
          shortLabel: weekday || item.label,
          total: Number(item.total) || 0,
          sales_count: Number(item.sales_count) || 0,
          avg_order: (item.sales_count > 0) ? (Number(item.total) / Number(item.sales_count)) : 0
        };
      });
    }

    return days;
  }, [sales, weeklyTrends]);

  const weeklyKPIs = useMemo(() => {
    const totalRev = weeklyChartData.reduce((acc, d) => acc + d.total, 0);
    const totalOrders = weeklyChartData.reduce((acc, d) => acc + d.sales_count, 0);
    const avgDaily = totalRev / 7;
    const peakDay = weeklyChartData.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), weeklyChartData[0] || { label: 'N/A', total: 0 });
    return {
      totalRev,
      totalOrders,
      avgDaily,
      peakDay
    };
  }, [weeklyChartData]);

  if (isTabletMode) {
    return (
      <>
        <TabletPOSLayout
          products={products}
          categories={categories}
          customers={customers}
          user={user}
          onCheckout={async (items, customerId, paymentMethod) => {
            const res = await fetchApi('/sales', {
              method: 'POST',
              body: JSON.stringify({ 
                items, 
                customer_id: customerId ? parseInt(customerId, 10) : null,
                payment_method: paymentMethod
              })
            });
            addToast('Sale recorded successfully!', 'success');
            
            // Register in session transactions
            const totalAmt = items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
            const custObj = customers.find(c => c.id.toString() === customerId);
            const newSessionTx = {
              id: res?.saleId || Date.now(),
              saleId: res?.saleId || Date.now(),
              items: items.map(it => {
                const prod = products.find(p => p.id === it.product_id);
                return {
                  product_id: it.product_id,
                  product_name: prod?.name || 'Item',
                  name: prod?.name || 'Item',
                  quantity: it.quantity,
                  unit_price: it.unit_price,
                  sku: prod?.sku || ''
                };
              }),
              total: totalAmt,
              total_amount: totalAmt,
              created_at: new Date().toISOString(),
              customer_name: custObj?.name || 'Walk-in Customer',
              customer_id: customerId ? parseInt(customerId, 10) : null,
              payment_method: paymentMethod,
              user_name: user?.name || 'Cashier',
              user_id: user?.id,
              status: 'completed',
              isCurrentSession: true
            };
            setSessionSales(prev => {
              const updated = [newSessionTx, ...prev.filter(s => s.id !== newSessionTx.id)];
              try {
                sessionStorage.setItem('pharmacy_pos_session_sales', JSON.stringify(updated.slice(0, 100)));
              } catch (e) {}
              return updated;
            });

            loadData();
            return res;
          }}
          onExitTabletMode={() => setIsTabletMode(false)}
          onRefresh={loadData}
          isLoading={loading}
          onOpenRecentTransactions={() => setShowRecentPanel(true)}
          recentTransactionsCount={sessionSales.length}
        />

        {/* Recent Transactions Side Panel accessible in Tablet Mode */}
        <RecentTransactionsSidePanel
          isOpen={showRecentPanel}
          onClose={() => setShowRecentPanel(false)}
          sessionSales={sessionSales}
          allSales={sales}
          onReprintReceipt={handleReprint}
          onStartNewSale={() => setShowRecentPanel(false)}
          onRefresh={loadData}
          isLoading={loading}
          currentUserId={user?.id}
          currentUserName={user?.name}
        />

        {/* Invoice Modal for re-prints */}
        {invoiceSaleData && (
          <InvoiceModal 
            saleData={invoiceSaleData} 
            products={products}
            initialFormat={invoiceInitialFormat}
            onClose={() => setInvoiceSaleData(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleek Breadcrumb & Action Controls Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs no-print">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <span>Sales Operations</span>
            <span>/</span>
            <span className="text-slate-900 font-black">POS Terminal & Ledger</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            <Store size={20} className="text-blue-600" />
            Point of Sale (POS) & Transactions
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Toggle into Touch Tablet POS Mode (Min 48px Target) */}
          <button 
            type="button"
            onClick={() => setIsTabletMode(true)} 
            className="min-h-[48px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer border border-slate-700 active:scale-95"
            title="Switch to touch-friendly Tablet POS mode"
          >
            <Tablet size={16} className="text-blue-400" />
            <span>Tablet POS Mode</span>
          </button>

          {/* Recent Transactions Side Panel Trigger */}
          <button 
            type="button"
            id="open-recent-transactions-btn"
            onClick={() => setShowRecentPanel(true)} 
            className="min-h-[48px] px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs border border-slate-200 transition shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95 hover:border-slate-300"
            title="View recent transactions and reprint receipts from current session"
          >
            <Receipt size={16} className="text-blue-600" />
            <span>Recent Transactions</span>
            {sessionSales.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full">
                {sessionSales.length}
              </span>
            )}
          </button>

          <button 
            type="button"
            id="export-sales-header-csv-btn"
            onClick={handleExportCSV} 
            disabled={filteredSalesTable.length === 0} 
            className="min-h-[48px] px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs border border-slate-200 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            title="Export current table data to CSV"
          >
            <Download size={15} /> Export CSV ({filteredSalesTable.length})
          </button>

          <button 
            type="button"
            id="print-sales-header-report-btn"
            onClick={handlePrintReport} 
            disabled={filteredSalesTable.length === 0} 
            className="min-h-[48px] px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Print or export current sales report to PDF"
          >
            <Printer size={15} /> Print / Export PDF ({filteredSalesTable.length})
          </button>

          <button 
            type="button"
            onClick={() => setShowPOSModal(true)} 
            className="min-h-[48px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 active:scale-95 cursor-pointer"
            title="Launch standard POS Session"
          >
            <ShoppingCart size={17} /> New Sales Session
          </button>
        </div>
      </div>

      {/* Past Week Daily Sales Performance (Recharts Line Graph) */}
      <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden no-print">
        {/* Graph Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Daily Sales Performance (Past Week)
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                  7-Day Trend
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Daily sales performance and transaction volumes across the last 7 calendar days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200 text-xs font-bold">
              <button 
                id="chart-mode-revenue-btn"
                onClick={() => setChartMetric('revenue')}
                className={`px-3 py-1 rounded transition-colors ${chartMetric === 'revenue' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Revenue (₵)
              </button>
              <button 
                id="chart-mode-orders-btn"
                onClick={() => setChartMetric('orders')}
                className={`px-3 py-1 rounded transition-colors ${chartMetric === 'orders' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Orders Count
              </button>
              <button 
                id="chart-mode-dual-btn"
                onClick={() => setChartMetric('dual')}
                className={`px-3 py-1 rounded transition-colors ${chartMetric === 'dual' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Combined
              </button>
            </div>

            <button
              id="chart-toggle-collapse-btn"
              onClick={() => setShowChart(!showChart)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title={showChart ? "Collapse chart" : "Expand chart"}
            >
              {showChart ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Graph Content & KPI Stats */}
        {showChart && (
          <div className="p-4 sm:p-5 space-y-5">
            {/* KPI Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">7-Day Total</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">{formatGHS(weeklyKPIs.totalRev)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Transactions</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">{weeklyKPIs.totalOrders} sales</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Daily Average</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">{formatGHS(weeklyKPIs.avgDaily)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Peak Day</span>
                <span className="text-base font-black text-blue-600 mt-0.5 block truncate">
                  {weeklyKPIs.peakDay?.label || '-'}: {formatGHS(weeklyKPIs.peakDay?.total || 0)}
                </span>
              </div>
            </div>

            {/* Recharts Line Graph Component */}
            <div className="w-full h-64 sm:h-72 min-w-0 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} initialDimension={{ width: 500, height: 260 }}>
                <LineChart 
                  data={weeklyChartData}
                  margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="shortLabel" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `₵${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  {(chartMetric === 'orders' || chartMetric === 'dual') && (
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#10b981" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      allowDecimals={false}
                      tickFormatter={(val) => `${val}`}
                    />
                  )}
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-800 text-xs">
                            <p className="font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                              <Calendar size={12} className="text-blue-400" />
                              {item.label}
                            </p>
                            <div className="space-y-1">
                              {(chartMetric === 'revenue' || chartMetric === 'dual') && (
                                <div className="flex items-center justify-between gap-4 text-blue-400 font-black">
                                  <span>Revenue:</span>
                                  <span>{formatGHS(item.total)}</span>
                                </div>
                              )}
                              {(chartMetric === 'orders' || chartMetric === 'dual') && (
                                <div className="flex items-center justify-between gap-4 text-emerald-400 font-bold">
                                  <span>Orders Count:</span>
                                  <span>{item.sales_count}</span>
                                </div>
                              )}
                              {item.sales_count > 0 && (
                                <div className="flex items-center justify-between gap-4 text-slate-400 font-medium text-[11px] pt-1 border-t border-slate-800">
                                  <span>Average Order:</span>
                                  <span>{formatGHS(item.avg_order)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>}
                  />
                  {(chartMetric === 'revenue' || chartMetric === 'dual') && (
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="total" 
                      name="Revenue (₵)" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}
                  {(chartMetric === 'orders' || chartMetric === 'dual') && (
                    <Line 
                      yAxisId={chartMetric === 'dual' ? "right" : "left"}
                      type="monotone" 
                      dataKey="sales_count" 
                      name="Orders Volume" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3 no-print">
        <div className="flex flex-col lg:flex-row gap-3 justify-between">
          {/* Table Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text" 
              placeholder="Search sales by ID, cashier, customer, or payment..." 
              value={tableSearchQuery}
              onChange={e => setTableSearchQuery(e.target.value)}
              className="w-full border border-slate-200 rounded pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
            {tableSearchQuery && (
              <button onClick={() => setTableSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {user?.role === 'admin' ? (
              <select 
                value={cashierFilter} 
                onChange={e => setCashierFilter(e.target.value)} 
                className="border border-purple-200 bg-purple-50/50 px-2.5 py-1.5 rounded text-xs font-bold text-purple-900 focus:outline-none focus:border-purple-500"
              >
                <option value="">All Cashiers & Staff</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            ) : (
              <span className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded flex items-center gap-1.5">
                <User size={13} />
                My Sales Only ({user?.name})
              </span>
            )}

            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)} 
              className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select 
              value={paymentFilter} 
              onChange={e => setPaymentFilter(e.target.value)} 
              className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Mobile Money">Mobile Money (MoMo)</option>
            </select>

            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)} 
              className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </select>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
              <span className="text-slate-400">-</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
            </div>

            {(startDate || endDate || categoryFilter || paymentFilter || statusFilter || cashierFilter || tableSearchQuery) && (
              <button 
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('');
                  setPaymentFilter('');
                  setStatusFilter('');
                  setCashierFilter('');
                  setTableSearchQuery('');
                }}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider px-2 py-1 bg-blue-50 rounded"
              >
                Reset
              </button>
            )}

            {/* Export Current Table Data Button */}
            <button
              type="button"
              id="export-sales-table-csv-btn"
              onClick={handleExportCSV}
              disabled={filteredSalesTable.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-2xs whitespace-nowrap ml-auto"
              title="Export current table data to a CSV file for reporting"
            >
              <Download size={14} className="text-slate-600" />
              <span>Export Table CSV</span>
              <span className="ml-0.5 px-1.5 py-0.2 bg-white text-slate-700 rounded text-[10px] font-mono font-bold border border-slate-200">
                {filteredSalesTable.length}
              </span>
            </button>

            {/* Print / PDF Export Current Table Button */}
            <button
              type="button"
              id="print-sales-table-btn"
              onClick={handlePrintReport}
              disabled={filteredSalesTable.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-2xs whitespace-nowrap"
              title="Print or export filtered sales table as PDF"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sales Table Card */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
           <div className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {user?.role === 'admin' ? 'Total Sales Count (Store)' : 'My Sales Count'}
              </span>
              <span className="text-xl font-black text-slate-900">{filteredSalesTable.length}</span>
           </div>
           <div className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {user?.role === 'admin' ? 'Total Sales Revenue (Store)' : 'My Sales Revenue'}
              </span>
              <span className="text-xl font-black text-emerald-600">{formatGHS(filteredSalesTable.reduce((sum, s) => sum + s.total_amount, 0))}</span>
           </div>
           {user?.role === 'admin' ? (
             <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Gross Profit</span>
                <span className="text-xl font-black text-blue-600">{formatGHS(filteredSalesTable.reduce((sum, s) => sum + (s.profit || 0), 0))}</span>
             </div>
           ) : (
             <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Average Order Value</span>
                <span className="text-xl font-black text-blue-600">
                  {filteredSalesTable.length > 0 
                    ? formatGHS(filteredSalesTable.reduce((sum, s) => sum + s.total_amount, 0) / filteredSalesTable.length)
                    : formatGHS(0)}
                </span>
             </div>
           )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice / Sale ID</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Cashier</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Payment</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Amount</th>
                {user?.role === 'admin' && <th className="px-5 py-3 text-right text-[10px] font-black text-emerald-600 uppercase tracking-wider">Profit</th>}
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-xs">
              {paginatedSales.map(s => (
                <tr key={s.id} className={`hover:bg-slate-50/80 transition-colors ${s.status === 'refunded' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                    #SALE-{s.id}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(s.created_at + 'Z').toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                    {s.user_name}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                    {s.customer_name ? (
                      <div>
                        <div className="font-bold text-slate-900">{s.customer_name}</div>
                        {s.customer_phone && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {getDisplayCustomerPhone(s.customer_phone, user?.role)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Walk-in</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                     {s.status === 'refunded' ? (
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase">
                         Refunded
                       </span>
                     ) : (
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                         Completed
                       </span>
                     )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                    {formatGHS(s.total_amount)}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                      +{formatGHS(s.profit || 0)}
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end">
                      <RowActionMenu
                        triggerTitle={`Actions for #SALE-${s.id}`}
                        actions={[
                          {
                            label: 'View Receipt',
                            sublabel: '80mm POS Thermal Layout',
                            icon: <Eye size={14} />,
                            onClick: () => handleViewReceipt(s.id, 'receipt')
                          },
                          {
                            label: 'Print Thermal Receipt',
                            sublabel: 'Send directly to thermal printer',
                            icon: <Printer size={14} />,
                            onClick: () => handleViewReceipt(s.id, 'receipt')
                          },
                          {
                            label: 'View Official A4 Invoice',
                            sublabel: 'Standard A4 formal layout',
                            icon: <FileText size={14} />,
                            onClick: () => handleViewReceipt(s.id, 'a4')
                          },
                          {
                            label: 'Send Receipt to Customer',
                            sublabel: 'Dispatch digital copy',
                            icon: <Mail size={14} />,
                            onClick: () => handleSendReceipt(s)
                          },
                          user?.role === 'admin' && s.status !== 'refunded' ? {
                            label: 'Process Return / Refund',
                            sublabel: 'Issue credit voucher',
                            icon: <RotateCcw size={14} />,
                            destructive: true,
                            onClick: () => navigate(`/returns?saleId=${s.id}`)
                          } : null
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSalesTable.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No sales transactions match your current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sales Table Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSalesTable.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* ================= FORMAL PRINT/PDF SALES AUDIT REPORT CONTAINER ================= */}
      <div className="print-only p-4 sm:p-6 text-black bg-white">
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                Rx
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">RxIMS Pharmacy Management</h1>
            </div>
            <p className="text-xs text-slate-600 font-medium">Official Sales, Revenue & Financial Audit Ledger</p>
            <p className="text-[10px] text-slate-500">Accra, Ghana • Tel: +233 24 000 0000 • Email: info@rximspharmacy.com</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded">
              Sales Audit Report
            </span>
            <div className="text-[11px] text-slate-600 font-bold mt-1.5">
              Generated: {new Date().toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">
              Prepared by: <span className="font-bold text-slate-800">{user?.name}</span> ({user?.role})
            </div>
          </div>
        </div>

        {/* Filter Scope Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Date Scope</span>
            <span className="font-bold text-slate-800">
              {startDate || endDate ? `${startDate || 'Start'} to ${endDate || 'Today'}` : 'All Recorded Dates'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Cashier Scope</span>
            <span className="font-bold text-slate-800">
              {cashierFilter ? (users.find(u => String(u.id) === String(cashierFilter))?.name || `User #${cashierFilter}`) : (user?.role === 'admin' ? 'All Cashiers / Store' : user?.name)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Mode</span>
            <span className="font-bold text-slate-800">{paymentFilter || 'All Methods'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Scope</span>
            <span className="font-bold text-slate-800 capitalize">{statusFilter || 'All Statuses'}</span>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Total Transactions</div>
            <div className="text-base font-black text-slate-900 mt-0.5">{filteredSalesTable.length} Orders</div>
          </div>
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Gross Sales Revenue</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">
              {formatGHS(filteredSalesTable.reduce((sum, s) => sum + s.total_amount, 0))}
            </div>
          </div>
          {user?.role === 'admin' ? (
            <div className="border border-slate-300 p-2.5 rounded bg-white">
              <div className="text-[9px] font-bold uppercase text-slate-500">Gross Margin / Profit</div>
              <div className="text-base font-black text-blue-700 mt-0.5">
                {formatGHS(filteredSalesTable.reduce((sum, s) => sum + (s.profit || 0), 0))}
              </div>
            </div>
          ) : (
            <div className="border border-slate-300 p-2.5 rounded bg-white">
              <div className="text-[9px] font-bold uppercase text-slate-500">Average Order Value</div>
              <div className="text-base font-black text-blue-700 mt-0.5">
                {filteredSalesTable.length > 0 
                  ? formatGHS(filteredSalesTable.reduce((sum, s) => sum + s.total_amount, 0) / filteredSalesTable.length)
                  : formatGHS(0)}
              </div>
            </div>
          )}
          <div className="border border-slate-300 p-2.5 rounded bg-white">
            <div className="text-[9px] font-bold uppercase text-slate-500">Payment Breakdown</div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              Cash: {filteredSalesTable.filter(s => (s.payment_method || '').toLowerCase() === 'cash').length} | MoMo: {filteredSalesTable.filter(s => (s.payment_method || '').toLowerCase().includes('momo') || (s.payment_method || '').toLowerCase().includes('mobile')).length}
            </div>
          </div>
        </div>

        {/* Tabular Transaction Ledger for Print */}
        <table className="w-full text-left text-xs border border-slate-300 border-collapse mb-6">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Invoice ID</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Date & Time</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Cashier</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Customer</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Payment</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase border-r border-slate-200">Status</th>
              <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase text-right border-r border-slate-200">Amount</th>
              {user?.role === 'admin' && (
                <th className="py-2 px-2.5 font-black text-slate-800 text-[10px] uppercase text-right">Profit</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredSalesTable.map((s, idx) => (
              <tr key={s.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                <td className="py-2 px-2.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                  #SALE-{s.id}
                </td>
                <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                  {new Date(s.created_at + 'Z').toLocaleString()}
                </td>
                <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200 whitespace-nowrap">
                  {s.user_name}
                </td>
                <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200">
                  {s.customer_name || 'Walk-in'}
                  {s.customer_phone && <span className="block text-[10px] text-slate-400 font-mono">{s.customer_phone}</span>}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                  <span className="font-semibold text-[10px]">{s.payment_method}</span>
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                  <span className="font-bold uppercase text-[10px]">
                    {s.status}
                  </span>
                </td>
                <td className="py-2 px-2.5 font-black text-slate-900 text-right border-r border-slate-200 whitespace-nowrap">
                  {formatGHS(s.total_amount)}
                </td>
                {user?.role === 'admin' && (
                  <td className="py-2 px-2.5 font-bold text-slate-900 text-right whitespace-nowrap">
                    {formatGHS(s.profit || 0)}
                  </td>
                )}
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
              <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px] font-black text-slate-800">
                Grand Total ({filteredSalesTable.length} Transactions):
              </td>
              <td className="py-2.5 px-2.5 text-right font-black text-emerald-800 text-xs border-r border-slate-300 whitespace-nowrap">
                {formatGHS(filteredSalesTable.reduce((sum, s) => sum + s.total_amount, 0))}
              </td>
              {user?.role === 'admin' && (
                <td className="py-2.5 px-2.5 text-right font-black text-blue-800 text-xs whitespace-nowrap">
                  {formatGHS(filteredSalesTable.reduce((sum, s) => sum + (s.profit || 0), 0))}
                </td>
              )}
            </tr>
          </tbody>
        </table>

        {/* Verification & Sign-off Block */}
        <div className="border-t border-slate-300 pt-6 mt-6 grid grid-cols-2 gap-12 text-xs">
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-semibold text-slate-700">
              Audited & Reconciled By (Cashier / Shift Lead):
            </div>
            <div className="text-[11px] text-slate-500">Name: {user?.name} | Date: {new Date().toLocaleDateString()}</div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 font-semibold text-slate-700">
              Approved By (Supervising Pharmacist / Owner):
            </div>
            <div className="text-[11px] text-slate-500">Signature: __________________________ Date: _______________</div>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-6">
          RxIMS Automated POS & Inventory Management • Confidential Financial Document • End of Report
        </div>
      </div>

      {/* ================= COMPACT POINT OF SALE (POS MODAL) ================= */}
      {showPOSModal && (
        <div className="fixed inset-0 bg-slate-900/60 sm:backdrop-blur-xs flex sm:items-center sm:justify-center p-0 sm:p-3 z-50 overflow-hidden no-print">
          <div className="bg-white sm:rounded-md max-w-5xl w-full h-full sm:h-[88vh] sm:max-h-[750px] flex flex-col border-0 sm:border border-slate-200 shadow-2xl overflow-hidden">
            {/* POS Header */}
            <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
                   <ShoppingCart size={15} />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    Point of Sale (POS) Session
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium">Cashier: {user?.name || 'Staff'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecentPanel(true)}
                  className="px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                  title="View recent transactions & re-print receipts"
                >
                  <Receipt size={13} className="text-blue-400" />
                  <span className="hidden sm:inline">Recent Receipts</span>
                  {sessionSales.length > 0 && (
                    <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                      {sessionSales.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setScannerDrawerOpen(!scannerDrawerOpen)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                    scannerDrawerOpen 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Scan size={13} /> Barcode Scanner {scannerDrawerOpen ? 'Active' : ''}
                </button>

                <button 
                  onClick={() => setShowPOSModal(false)} 
                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Optional Collapsible Barcode Scanner Drawer */}
            {scannerDrawerOpen && (
              <div className="bg-slate-800 text-white p-2 px-3 border-b border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 animate-fadeIn shrink-0">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (barcodeInput) handleBarcodeScan(barcodeInput);
                  }}
                  className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-xl"
                >
                  <div className="relative flex-1">
                    <input 
                      ref={scannerInputRef}
                      type="text"
                      autoFocus
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Point barcode scanner or enter SKU & press Enter..."
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded pl-8 pr-16 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <Scan size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400" />
                    <button 
                      type="submit"
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                    >
                      Scan
                    </button>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded shrink-0"
                  >
                    {soundEnabled ? <Volume2 size={11} className="text-emerald-400" /> : <VolumeX size={11} className="text-slate-500" />}
                    {soundEnabled ? 'Beep On' : 'Muted'}
                  </button>
                </form>

                {/* Scan Toast */}
                {scanFeedback && (
                  <div className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border ${
                    scanFeedback.type === 'success' 
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                      : 'bg-red-950/80 text-red-300 border-red-800'
                  }`}>
                    {scanFeedback.type === 'success' ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-red-400" />}
                    <span className="truncate max-w-xs">{scanFeedback.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile & Tablet Navigation Tabs for POS Modal (< 1024px) */}
            <div className="flex lg:hidden bg-slate-100 p-1.5 border-b border-slate-200 shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setPosMobileTab('catalog')}
                className={`flex-1 py-2 px-3 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                  posMobileTab === 'catalog'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <Search size={14} />
                <span>Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => setPosMobileTab('cart')}
                className={`flex-1 py-2 px-3 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                  posMobileTab === 'cart'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <ShoppingCart size={14} />
                <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                <span className="font-mono font-black ml-1 text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">{formatGHS(totalCart)}</span>
              </button>
            </div>

            {/* POS Main View (Flex-column on Mobile & Tablets < 1024px, 2-Column Side-by-side on Desktops >= 1024px) */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
              {/* LEFT COLUMN: Product Catalog & Search (Flex-col with flex-grow on catalog, 7 Cols on Desktop) */}
              <div className={`lg:col-span-7 p-3 flex flex-col flex-1 min-h-0 bg-slate-50/50 space-y-2 overflow-hidden ${posMobileTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                {/* Search Bar & Category Chips */}
                <div className="space-y-1.5 shrink-0">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={posSearchQuery}
                      onChange={(e) => setPosSearchQuery(e.target.value)}
                      placeholder="Search product by name, SKU, barcode..."
                      className="w-full bg-white border border-slate-200 rounded pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                    {posSearchQuery && (
                      <button 
                        onClick={() => setPosSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                    <button
                      onClick={() => setPosCategoryFilter('')}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                        posCategoryFilter === '' 
                          ? 'bg-slate-900 text-white shadow-2xs' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All ({products.length})
                    </button>
                    {categories.map((c: any) => {
                      const count = products.filter(p => p.category_name === c.name).length;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setPosCategoryFilter(posCategoryFilter === c.name ? '' : c.name)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                            posCategoryFilter === c.name 
                              ? 'bg-blue-600 text-white shadow-2xs' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {c.name} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Product Catalog Table List (Flex grow on primary product grid) */}
                <div className="flex-1 grow overflow-y-auto border border-slate-200 rounded bg-white shadow-2xs min-h-0">
                  {filteredPOSProducts.length > 0 ? (
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="px-2.5 py-1.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Product</th>
                          <th className="px-2.5 py-1.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">SKU</th>
                          <th className="px-2.5 py-1.5 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Price</th>
                          <th className="px-2.5 py-1.5 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Stock</th>
                          <th className="px-2.5 py-1.5 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {filteredPOSProducts.map(p => {
                          const inCart = cart.find(i => i.product_id === p.id);
                          const isOutOfStock = p.stock_quantity <= 0;

                          return (
                            <tr
                              key={p.id}
                              onClick={() => !isOutOfStock && addToCart(p.id, p.selling_price)}
                              className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                                isOutOfStock 
                                  ? 'bg-slate-50/80 opacity-60 cursor-not-allowed' 
                                  : inCart 
                                    ? 'bg-blue-50/40' 
                                    : ''
                              }`}
                            >
                              <td className="px-2.5 py-1.5">
                                <div className="font-bold text-slate-900 line-clamp-1 text-[11px]">{p.name}</div>
                                <div className="text-[9px] text-slate-400 font-medium">{p.category_name || 'General'}</div>
                              </td>

                              <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                <div>{p.sku || `#${p.id}`}</div>
                              </td>

                              <td className="px-2.5 py-1.5 text-right font-black text-slate-900 whitespace-nowrap text-[11px]">
                                {formatGHS(p.selling_price)}
                              </td>

                              <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                                {isOutOfStock ? (
                                  <span className="text-[8px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-100">
                                    Out
                                  </span>
                                ) : (
                                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                    p.stock_quantity <= 5 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {p.stock_quantity}
                                  </span>
                                )}
                              </td>

                              <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isOutOfStock) addToCart(p.id, p.selling_price);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ml-auto ${
                                    isOutOfStock
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                      : inCart
                                        ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
                                        : 'bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200'
                                  }`}
                                >
                                  <Plus size={11} />
                                  {inCart ? `(${inCart.quantity})` : 'Add'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                      <Search size={24} className="mb-1 opacity-30" />
                      <p className="text-[11px] font-bold">No products found for "{posSearchQuery}".</p>
                      <button 
                        onClick={() => { setPosSearchQuery(''); setPosCategoryFilter(''); }}
                        className="mt-1 text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile & Tablet Sticky Charge Amount Button on Catalog View (< 1024px) */}
                <div className="lg:hidden shrink-0 sticky bottom-0 z-20 mt-auto pt-2 bg-slate-50/98 backdrop-blur-md border-t border-slate-200 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-lg transition-all ${
                    cart.length > 0 ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center justify-between sm:flex-col sm:items-start min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase truncate tracking-wider text-slate-400">
                        {cart.length > 0 ? `${cart.reduce((s, i) => s + i.quantity, 0)} Items Selected` : 'Cart is Empty'}
                      </span>
                      <span className={`text-base font-black truncate font-mono ${cart.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {formatGHS(totalCart)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setPosMobileTab('cart')}
                        className="flex-1 sm:flex-none px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-lg font-bold text-xs uppercase tracking-wider border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingCart size={13} />
                        <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                      </button>
                      <button
                        type="button"
                        disabled={cart.length === 0}
                        onClick={() => setShowConfirmModal(true)}
                        className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all cursor-pointer ring-2 ring-emerald-500/50"
                      >
                        <span>Charge {formatGHS(totalCart)}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Active Cart Ledger & Checkout (5 Cols on Desktops >= 1024px) */}
              <div className={`lg:col-span-5 p-3 flex flex-col flex-1 min-h-0 bg-white space-y-2.5 overflow-hidden ${posMobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
                {/* Customer & Payment Selectors */}
                <div className="grid grid-cols-2 gap-2 shrink-0 bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
                      Customer
                    </label>
                    <select 
                      value={selectedCustomer} 
                      onChange={e => setSelectedCustomer(e.target.value)} 
                      className="w-full border border-slate-300 rounded px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="">Walk-in Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
                      Payment Mode
                    </label>
                    <select 
                      value={paymentMethod} 
                      onChange={e => setPaymentMethod(e.target.value as any)} 
                      className="w-full border border-slate-300 rounded px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Cash">Physical Cash</option>
                      <option value="Mobile Money">MoMo (Mobile Money)</option>
                    </select>
                  </div>
                </div>

                {/* Cart Item Table */}
                <div className="flex-1 grow flex flex-col min-h-0 border border-slate-200 rounded overflow-hidden">
                  <div className="bg-slate-900 text-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider flex justify-between items-center shrink-0">
                    <span>Order Ledger</span>
                    <span className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded text-[9px]">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white min-h-0">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 p-6 text-center">
                        <ShoppingCart size={28} strokeWidth={1.5} className="mb-1 opacity-30" />
                        <p className="text-[11px] font-bold text-slate-400">Cart is empty</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Select items from the catalog.</p>
                      </div>
                    ) : (
                      cart.map((item, idx) => {
                        const p = products.find(x => x.id === item.product_id);
                        return (
                          <div key={idx} className="p-2 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-2 text-xs">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="font-bold text-slate-900 truncate text-[11px]">{p?.name}</div>
                              <div className="text-[9px] text-slate-500 flex items-center gap-1.5">
                                <span>{formatGHS(item.unit_price)}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-400">{p?.sku}</span>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Add note..." 
                                value={item.notes || ''}
                                onChange={(e) => setCart(prev => prev.map(it => it.product_id === item.product_id ? { ...it, notes: e.target.value } : it))}
                                className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => {
                                  setCart(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0));
                                }} 
                                className="w-5 h-5 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Minus size={10} />
                              </button>

                              <span className="w-5 text-center font-bold text-slate-900 text-[11px]">
                                {item.quantity}
                              </span>

                              <button 
                                onClick={() => addToCart(item.product_id, item.unit_price)} 
                                className="w-5 h-5 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Plus size={10} />
                              </button>
                            </div>

                            {/* Line Subtotal & Trash */}
                            <div className="text-right shrink-0">
                              <div className="font-black text-slate-900 text-[11px]">
                                {formatGHS(item.quantity * item.unit_price)}
                              </div>
                              <button 
                                onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))} 
                                className="text-slate-300 hover:text-red-500 mt-0.5"
                                title="Remove item"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Checkout Summary Footer (Always Pinned to Viewport Bottom) */}
                <div className="shrink-0 pt-2 border-t border-slate-200 space-y-2 sticky bottom-0 bg-white z-20 mt-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Total Due:</span>
                    <span className="text-xl font-black text-emerald-600 font-mono">{formatGHS(totalCart)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPosMobileTab('catalog')}
                      className="lg:hidden min-h-[46px] py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs uppercase tracking-wider border border-slate-200 shrink-0 cursor-pointer flex items-center gap-1.5 transition"
                    >
                      <span>← Catalog</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowConfirmModal(true)} 
                      disabled={cart.length === 0} 
                      className="flex-1 min-h-[46px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg font-black text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-slate-900 flex items-center justify-center gap-2 cursor-pointer ring-2 ring-emerald-500/50 active:scale-98"
                    >
                      <span>Charge {formatGHS(totalCart)}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] no-print">
          <div className="bg-white rounded max-w-sm w-full border border-slate-200 overflow-hidden shadow-2xl">
            <div className="p-6 text-center bg-slate-50 border-b border-slate-100">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart size={22} />
               </div>
               <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Confirm Checkout</h2>
               <p className="text-xs text-slate-500 font-medium mt-0.5">Please review items and payment total</p>
            </div>
            
            <div className="p-6 space-y-4 text-center text-xs">
              <div className="space-y-1">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Order Summary</div>
                 <p className="font-bold text-slate-800">
                   {cart.reduce((sum, i) => sum + i.quantity, 0)} total items selected
                 </p>
              </div>

              <div className="py-3 border-y border-slate-100 space-y-1">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Amount Due</div>
                 <div className="text-2xl font-black text-slate-900">{formatGHS(totalCart)}</div>
                 <div className="text-xs font-bold text-blue-600 uppercase">Payment Mode: {paymentMethod === 'Mobile Money' ? 'MOMO' : 'CASH'}</div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={handleCheckout} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-black text-xs uppercase tracking-wider transition-all shadow-sm"
                >
                  Complete & Generate Invoice
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Return to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions Side Panel */}
      <RecentTransactionsSidePanel
        isOpen={showRecentPanel}
        onClose={() => setShowRecentPanel(false)}
        sessionSales={sessionSales}
        allSales={sales}
        onReprintReceipt={handleReprint}
        onStartNewSale={() => {
          setShowRecentPanel(false);
          setShowPOSModal(true);
        }}
        onRefresh={loadData}
        isLoading={loading}
        currentUserId={user?.id}
        currentUserName={user?.name}
      />

      {/* Invoice Print Viewer Modal */}
      {invoiceSaleData && (
        <InvoiceModal 
          saleData={invoiceSaleData} 
          products={products}
          initialFormat={invoiceInitialFormat}
          onClose={() => setInvoiceSaleData(null)}
          onNewSale={() => setShowPOSModal(true)}
        />
      )}

    </div>
  );
}
