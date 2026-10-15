import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Printer, 
  X, 
  Search, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Banknote, 
  CreditCard, 
  User, 
  Calendar, 
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Filter,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { formatGHS } from '../lib/formatters';
import { fetchApi } from '../lib/api';

export interface RecentTransactionItem {
  id: number;
  saleId?: number;
  total?: number;
  total_amount?: number;
  created_at: string;
  payment_method: string;
  customer_name?: string | null;
  customer_id?: number | null;
  user_name?: string | null;
  user_id?: number | null;
  status?: string;
  items?: Array<{
    product_id?: number;
    product_name?: string;
    name?: string;
    quantity: number;
    unit_price: number;
    sku?: string;
  }>;
  [key: string]: any;
}

interface RecentTransactionsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionSales: RecentTransactionItem[];
  allSales: RecentTransactionItem[];
  onReprintReceipt: (saleId: number, format?: 'receipt' | 'a4') => void | Promise<void>;
  onStartNewSale?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  currentUserId?: number;
  currentUserName?: string;
}

export default function RecentTransactionsSidePanel({
  isOpen,
  onClose,
  sessionSales = [],
  allSales = [],
  onReprintReceipt,
  onStartNewSale,
  onRefresh,
  isLoading = false,
  currentUserId,
  currentUserName
}: RecentTransactionsSidePanelProps) {
  const [activeTab, setActiveTab] = useState<'session' | 'today' | 'all'>('session');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Cash' | 'Mobile Money'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  
  // Expanded items state to show line items inside cards
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<number, boolean>>({});
  const [loadedSaleItems, setLoadedSaleItems] = useState<Record<number, any[]>>({});
  const [loadingItemsId, setLoadingItemsId] = useState<number | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when side panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Format relative timestamp helper
  const formatTimeAgo = (dateStr: string): string => {
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

  // Format precise time
  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Today filter helper
  const isToday = (dateStr: string): boolean => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    } catch {
      return false;
    }
  };

  // Merge session transactions with all sales so session sales take priority with full items
  const combinedSales = useMemo(() => {
    const map = new Map<number, RecentTransactionItem>();
    // First insert session sales
    sessionSales.forEach(s => map.set(s.id, { ...s, isCurrentSession: true }));
    // Then merge all sales if not already present
    allSales.forEach(s => {
      if (!map.has(s.id)) {
        map.set(s.id, { ...s, isCurrentSession: false });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.created_at).getTime() || 0;
      const timeB = new Date(b.created_at).getTime() || 0;
      return timeB - timeA;
    });
  }, [sessionSales, allSales]);

  // Filter based on active tab
  const tabFilteredSales = useMemo(() => {
    if (activeTab === 'session') {
      // If sessionSales has items, prioritize those; if not or in addition, include today's sales by current user
      const currentIds = new Set(sessionSales.map(s => s.id));
      const todayUserSales = combinedSales.filter(s => {
        if (currentIds.has(s.id)) return true;
        if (isToday(s.created_at)) {
          if (currentUserId && s.user_id) {
            return s.user_id === currentUserId;
          }
          return true;
        }
        return false;
      });
      return todayUserSales.length > 0 ? todayUserSales : sessionSales;
    } else if (activeTab === 'today') {
      return combinedSales.filter(s => isToday(s.created_at));
    }
    return combinedSales.slice(0, 50); // limit to 50 for quick responsiveness
  }, [activeTab, combinedSales, sessionSales, currentUserId]);

  // Filter by search query and payment method
  const filteredTransactions = useMemo(() => {
    return tabFilteredSales.filter(sale => {
      // Payment filter
      if (paymentFilter !== 'all') {
        const pMethod = (sale.payment_method || '').toLowerCase();
        if (paymentFilter === 'Cash' && !pMethod.includes('cash')) return false;
        if (paymentFilter === 'Mobile Money' && (!pMethod.includes('mobile') && !pMethod.includes('momo'))) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const idStr = String(sale.id);
      const formattedSaleId = `#sale-${sale.id}`.toLowerCase();
      const customer = (sale.customer_name || 'Walk-in Customer').toLowerCase();
      const cashier = (sale.user_name || '').toLowerCase();
      const payment = (sale.payment_method || '').toLowerCase();

      return (
        idStr.includes(q) ||
        formattedSaleId.includes(q) ||
        customer.includes(q) ||
        cashier.includes(q) ||
        payment.includes(q)
      );
    });
  }, [tabFilteredSales, searchQuery, paymentFilter]);

  // Session Statistics
  const sessionStats = useMemo(() => {
    const list = tabFilteredSales;
    const totalRevenue = list.reduce((sum, s) => sum + (Number(s.total_amount ?? s.total) || 0), 0);
    const count = list.length;
    let cashTotal = 0;
    let momoTotal = 0;
    list.forEach(s => {
      const amt = Number(s.total_amount ?? s.total) || 0;
      const pm = (s.payment_method || '').toLowerCase();
      if (pm.includes('cash')) {
        cashTotal += amt;
      } else {
        momoTotal += amt;
      }
    });
    const avgTicket = count > 0 ? totalRevenue / count : 0;
    return { totalRevenue, count, cashTotal, momoTotal, avgTicket };
  }, [tabFilteredSales]);

  // Copy sale ID handler
  const handleCopyId = (id: number) => {
    navigator.clipboard.writeText(`#SALE-${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Re-print wrapper with loading state
  const handleReprint = async (saleId: number, format: 'receipt' | 'a4' = 'receipt') => {
    setReprintingId(saleId);
    try {
      await onReprintReceipt(saleId, format);
    } finally {
      setReprintingId(null);
    }
  };

  // Toggle line items accordion and lazy-load items if not yet loaded
  const toggleItemsAccordion = async (sale: RecentTransactionItem) => {
    const isCurrentlyExpanded = !!expandedSaleIds[sale.id];
    if (isCurrentlyExpanded) {
      setExpandedSaleIds(prev => ({ ...prev, [sale.id]: false }));
      return;
    }

    setExpandedSaleIds(prev => ({ ...prev, [sale.id]: true }));

    // If items already present or cached, nothing more to fetch
    if (sale.items && sale.items.length > 0) return;
    if (loadedSaleItems[sale.id]) return;

    try {
      setLoadingItemsId(sale.id);
      const fullSale = await fetchApi(`/sales/${sale.id}`);
      if (fullSale && fullSale.items) {
        setLoadedSaleItems(prev => ({ ...prev, [sale.id]: fullSale.items }));
      }
    } catch (err) {
      console.error('Failed to lazy load sale items', err);
    } finally {
      setLoadingItemsId(null);
    }
  };

  // Print session summary / X-Report on thermal printer
  const handlePrintSessionSummary = () => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shift Summary X-Report</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0; padding: 12px; font-size: 11px; line-height: 1.4; color: #000;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .flex { display: flex; justify-content: space-between; }
          .title { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .badge { display: inline-block; padding: 2px 6px; border: 1px solid #000; font-size: 9px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { text-align: left; font-size: 9px; border-bottom: 1px solid #000; padding: 2px 0; }
          td { padding: 3px 0; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">POS SESSION SUMMARY</div>
          <div>CURRENT SHIFT X-REPORT</div>
          <div style="font-size: 10px; margin-top: 4px;">Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
          <div style="font-size: 10px;">Cashier: ${currentUserName || 'Staff'}</div>
        </div>
        <div class="divider"></div>
        <div class="flex"><span>Total Transactions:</span><span class="bold">${sessionStats.count}</span></div>
        <div class="flex"><span>Cash Sales:</span><span class="bold">${formatGHS(sessionStats.cashTotal)}</span></div>
        <div class="flex"><span>Mobile Money:</span><span class="bold">${formatGHS(sessionStats.momoTotal)}</span></div>
        <div class="divider"></div>
        <div class="flex" style="font-size: 13px;"><span>TOTAL SALES:</span><span class="bold">${formatGHS(sessionStats.totalRevenue)}</span></div>
        <div class="flex" style="font-size: 10px; margin-top: 4px;"><span>Avg Basket:</span><span>${formatGHS(sessionStats.avgTicket)}</span></div>
        <div class="divider"></div>
        <div class="bold" style="font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">Recent Session Receipts:</div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Method</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.slice(0, 20).map(s => `
              <tr>
                <td>#${s.id}</td>
                <td>${formatTime(s.created_at)}</td>
                <td>${(s.payment_method || 'Cash').substring(0, 4)}</td>
                <td style="text-align: right; font-weight: bold;">${formatGHS(Number(s.total_amount ?? s.total) || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="text-center" style="font-size: 9px; margin-top: 8px;">
          --- END OF REPORT ---
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel Drawer */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Recent Transactions"
        className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 focus:outline-none"
      >
        <div className="w-screen max-w-md sm:max-w-lg lg:max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-250">
          
          {/* ================= 1. HEADER ================= */}
          <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Receipt size={17} />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black tracking-tight uppercase text-white flex items-center gap-1.5">
                    Recent Transactions
                  </h2>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Current Shift
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  View, track & re-print receipts from active sales session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
                  title="Refresh transactions"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-400' : ''} />
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintSessionSummary}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
                title="Print Shift Summary / X-Report"
              >
                <FileSpreadsheet size={13} className="text-blue-400" />
                <span>X-Report</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close panel (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ================= 2. SESSION KPI HIGHLIGHTS STRIP ================= */}
          <div className="bg-slate-950 px-4 sm:px-5 py-3 border-b border-slate-800 text-white shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Session Total</span>
                <span className="text-sm font-black text-white tracking-tight block mt-0.5">
                  {formatGHS(sessionStats.totalRevenue)}
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receipts</span>
                <span className="text-sm font-black text-blue-400 tracking-tight block mt-0.5">
                  {sessionStats.count} <span className="text-[10px] font-normal text-slate-400">sales</span>
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cash Tendered</span>
                <span className="text-xs font-black text-emerald-400 tracking-tight block mt-0.5 truncate">
                  {formatGHS(sessionStats.cashTotal)}
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Money</span>
                <span className="text-xs font-black text-amber-400 tracking-tight block mt-0.5 truncate">
                  {formatGHS(sessionStats.momoTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* ================= 3. FILTER TABS & SEARCH ================= */}
          <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
            {/* View Scope Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('session')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'session'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>This Session</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'session' ? 'bg-blue-100 text-blue-800' : 'bg-slate-300 text-slate-700'
                }`}>
                  {sessionSales.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'today'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Today's Sales</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All Recent</span>
              </button>
            </div>

            {/* Search Input & Payment Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by receipt #, customer, or cashier..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Payment Method Pills */}
              <div className="flex items-center gap-1 shrink-0">
                {(['all', 'Cash', 'Mobile Money'] as const).map(pm => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentFilter(pm)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      paymentFilter === pm 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pm === 'all' ? 'All' : pm === 'Mobile Money' ? 'MoMo' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================= 4. TRANSACTION LIST ================= */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar bg-slate-100/60">
            {filteredTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 mb-3">
                  <Receipt size={28} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Transactions Found</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  {searchQuery 
                    ? `No transactions match "${searchQuery}". Try adjusting your search term.` 
                    : activeTab === 'session'
                      ? 'No sales recorded in the active session yet. Ring up a customer to see instant receipt re-prints here!'
                      : 'No sales matching the selected filters.'}
                </p>
                {onStartNewSale && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartNewSale();
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <ShoppingBag size={14} />
                    <span>Open POS & Ring Up Sale</span>
                  </button>
                )}
              </div>
            ) : (
              filteredTransactions.map((sale) => {
                const isExpanded = !!expandedSaleIds[sale.id];
                const itemsToDisplay = sale.items || loadedSaleItems[sale.id] || [];
                const itemCount = itemsToDisplay.length || (sale as any).item_count || 1;
                const isCash = (sale.payment_method || '').toLowerCase().includes('cash');
                const isCopied = copiedId === sale.id;
                const isReprinting = reprintingId === sale.id;
                const totalAmount = Number(sale.total_amount ?? sale.total) || 0;

                return (
                  <div 
                    key={sale.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-3 sm:p-3.5 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        {/* Receipt Reference with Copy */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #SALE-{sale.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(sale.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                            title="Copy Sale ID to clipboard"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                          {sale.isCurrentSession && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                              Current Shift
                            </span>
                          )}
                        </div>

                        {/* Payment & Status Badges */}
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isCash 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {isCash ? <Banknote size={11} /> : <CreditCard size={11} />}
                            <span>{sale.payment_method || 'Cash'}</span>
                          </span>

                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            sale.status === 'refunded'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {sale.status || 'Paid'}
                          </span>
                        </div>
                      </div>

                      {/* Customer & Timestamp row */}
                      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-[240px]">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-700 truncate">
                            {sale.customer_name || 'Walk-in Customer'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0" title={new Date(sale.created_at).toLocaleString()}>
                          <Clock size={11} />
                          <span>{formatTimeAgo(sale.created_at)}</span>
                          <span className="text-slate-300">•</span>
                          <span>{formatTime(sale.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body: Items Preview & Grand Total */}
                    <div className="px-3 sm:px-3.5 py-2.5 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleItemsAccordion(sale)}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          <ShoppingBag size={12} />
                          <span>{itemCount} {itemCount === 1 ? 'item' : 'items'} in sale</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Cashier: {sale.user_name || 'Staff'}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount</span>
                        <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
                          {formatGHS(totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Items List */}
                    {isExpanded && (
                      <div className="px-3 sm:px-3.5 py-2 bg-slate-50 border-t border-slate-200/80 text-xs animate-in fade-in duration-150">
                        {loadingItemsId === sale.id ? (
                          <div className="py-2 text-center text-slate-400 text-xs flex items-center justify-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin text-blue-500" />
                            <span>Loading receipt items...</span>
                          </div>
                        ) : itemsToDisplay.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {itemsToDisplay.map((item, idx) => {
                              const itemName = item.product_name || item.name || `Item #${item.product_id || idx + 1}`;
                              const itemTotal = (item.quantity || 1) * (Number(item.unit_price) || 0);
                              return (
                                <div key={idx} className="flex items-center justify-between text-[11px] text-slate-600">
                                  <div className="truncate pr-2">
                                    <span className="font-bold text-slate-800">{item.quantity}x</span>{' '}
                                    <span className="truncate">{itemName}</span>
                                    {item.sku && <span className="text-[9px] text-slate-400 font-mono ml-1">({item.sku})</span>}
                                  </div>
                                  <span className="font-mono font-bold text-slate-700 shrink-0">
                                    {formatGHS(itemTotal)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic py-1">Item details archived in system ledger.</p>
                        )}
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div className="p-2 sm:p-2.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleReprint(sale.id, 'a4')}
                        disabled={isReprinting}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition flex items-center justify-center gap-1.5 shadow-2xs hover:border-slate-400 disabled:opacity-50 cursor-pointer active:scale-95"
                        title="View official A4 invoice / receipt details"
                      >
                        <Receipt size={13} className="text-slate-500" />
                        <span>View Receipt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReprint(sale.id, 'receipt')}
                        disabled={isReprinting}
                        className="flex-1 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
                        title="Direct re-print on 80mm thermal receipt printer"
                      >
                        <Printer size={13} className={isReprinting ? 'animate-spin' : ''} />
                        <span>{isReprinting ? 'Printing...' : 'Re-print Thermal'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ================= 5. FOOTER ================= */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">
              Showing <strong className="text-slate-800">{filteredTransactions.length}</strong> transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition"
              >
                Close (Esc)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
