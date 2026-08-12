import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import ReturnModal from '../components/ReturnModal';
import ReturnInvoiceModal from '../components/ReturnInvoiceModal';
import { formatGHS } from '../lib/formatters';
import { 
  RotateCcw, Search, Calendar, Download, RefreshCw, FileText, 
  DollarSign, Package, AlertCircle, ShieldAlert, CheckCircle2, Filter
} from 'lucide-react';

export default function Returns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [returnsSummary, setReturnsSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Modal States
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [selectedReturnSaleId, setSelectedReturnSaleId] = useState<number | null>(null);
  const [creditNoteData, setCreditNoteData] = useState<any | null>(null);
  const [loadingCreditNoteId, setLoadingCreditNoteId] = useState<number | null>(null);

  useEffect(() => {
    loadReturnsData();
    loadSummaryData();
  }, [startDate, endDate, timeframe]);

  const loadSummaryData = () => {
    fetchApi('/returns/summary')
      .then(data => setReturnsSummary(data))
      .catch(console.error);
  };

  const loadReturnsData = () => {
    setLoading(true);
    const query = new URLSearchParams();

    let start = startDate;
    let end = endDate;

    if (timeframe === 'today') {
      const today = new Date().toISOString().split('T')[0];
      start = today;
      end = today;
    } else if (timeframe === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (timeframe === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    }

    if (start) query.append('startDate', start);
    if (end) query.append('endDate', end);
    if (searchTerm) query.append('search', searchTerm);

    fetchApi(`/returns?${query.toString()}`)
      .then(data => {
        if (Array.isArray(data)) setReturns(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReturnsData();
  };

  const handleOpenNewReturnModal = (saleId?: number) => {
    setSelectedReturnSaleId(saleId || null);
    setShowReturnModal(true);
  };

  const handleReturnProcessed = (returnData: any) => {
    setShowReturnModal(false);
    setCreditNoteData(returnData);
    loadReturnsData();
    loadSummaryData();
  };

  const handleViewCreditNote = async (returnId: number) => {
    setLoadingCreditNoteId(returnId);
    try {
      const data = await fetchApi(`/returns/${returnId}`);
      setCreditNoteData(data);
    } catch (err: any) {
      alert('Failed to load return credit note details: ' + err.message);
    } finally {
      setLoadingCreditNoteId(null);
    }
  };

  const handleExportCSV = () => {
    if (!returns || returns.length === 0) return;
    const headers = ['Return ID', 'Original Sale ID', 'Customer', 'Date & Time', 'Items Returned', 'Total Units', 'Refund Amount (GHS)', 'Payment Method', 'Processed By', 'Reason'];
    const rows = returns.map((r: any) => [
      `"#RET-${r.id}"`,
      `"#SALE-${r.sale_id}"`,
      `"${(r.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${new Date(r.created_at).toLocaleString()}"`,
      r.item_count || 1,
      r.total_units_returned || 1,
      r.refund_amount,
      `"${r.refund_method || 'Cash'}"`,
      `"${(r.user_name || 'Staff').replace(/"/g, '""')}"`,
      `"${(r.return_reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Returns_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filteredReturns = returns.filter((r: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.id.toString().includes(term) ||
      r.sale_id.toString().includes(term) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(term)) ||
      (r.return_reason && r.return_reason.toLowerCase().includes(term)) ||
      (r.user_name && r.user_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-600 text-white rounded-md shadow-xs">
              <RotateCcw size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Product Returns & Credit Notes</h1>
              <p className="text-xs text-slate-500 font-medium">Issue itemized sales returns, restock inventory, generate official credit notes, and audit refund ledgers.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredReturns.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold uppercase tracking-wider transition border border-slate-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => handleOpenNewReturnModal()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2"
          >
            <RotateCcw size={16} /> Process New Return
          </button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Today's Refunds</span>
            <DollarSign size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">
            {formatGHS(returnsSummary?.todayRefundValue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {returnsSummary?.todayReturnCount || 0} return receipt(s) issued today
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>This Month Refunds</span>
            <RotateCcw size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800">
            {formatGHS(returnsSummary?.monthRefundValue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Total refunded volume this month
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-amber-200 bg-amber-50/40 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Damaged Stock Loss</span>
            <ShieldAlert size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900">
            {formatGHS(returnsSummary?.damagedStockLoss || 0)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Non-restocked inventory written off
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-1">
            <span>Primary Return Reason</span>
            <AlertCircle size={16} className="text-slate-400" />
          </div>
          <div className="text-base font-black text-slate-900 truncate">
            {returnsSummary?.reasonsBreakdown?.[0]?.reason || 'None Recorded'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {returnsSummary?.reasonsBreakdown?.[0]?.count || 0} occurrence(s) logged
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Return ID, Sale ID, Customer name, or Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-rose-500"
            />
          </form>

          {/* Timeframe Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTimeframe(t.id as any);
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-all ${
                  timeframe === t.id ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 flex items-center gap-1">
            <Calendar size={14} /> Filter Dates:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setTimeframe('all');
            }}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-rose-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setTimeframe('all');
            }}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-rose-500"
          />
          {(startDate || endDate || searchTerm) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
                setTimeframe('all');
              }}
              className="text-xs font-bold text-rose-600 hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Returns History Table */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText size={15} className="text-rose-600" />
            Product Returns & Refunds Audit Ledger ({filteredReturns.length})
          </h2>
          <button
            onClick={() => {
              loadReturnsData();
              loadSummaryData();
            }}
            className="p-1 text-slate-400 hover:text-slate-700 transition"
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200 text-[10px]">
              <tr>
                <th className="px-4 py-3">Return ID</th>
                <th className="px-4 py-3">Original Sale</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3 text-center">Items Returned</th>
                <th className="px-4 py-3 text-right">Refund Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Processed By</th>
                <th className="px-4 py-3 text-center">Credit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-rose-600" />
                    Loading product returns log...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <RotateCcw size={32} className="mx-auto mb-2 text-slate-300" />
                    <div className="font-bold text-slate-700">No Product Returns Logged</div>
                    <p className="text-slate-400 text-xs mt-1">
                      {searchTerm || startDate ? 'No returns match your search filter criteria.' : 'Click "Process New Return" above to log a customer product return.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret: any) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-black text-rose-700">
                      #RET-{ret.id}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">
                      #SALE-{ret.sale_id}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {ret.customer_name || 'Walk-in Customer'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(ret.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded font-black text-[11px]">
                        {ret.total_units_returned || ret.item_count || 1} unit(s)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">
                      {formatGHS(ret.refund_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded uppercase text-[10px]">
                        {ret.refund_method || 'Cash'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate" title={ret.return_reason}>
                      {ret.return_reason || 'General Return'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {ret.user_name || 'Staff'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleViewCreditNote(ret.id)}
                        disabled={loadingCreditNoteId === ret.id}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-600 text-white rounded font-bold text-[10px] uppercase tracking-wider transition shadow-2xs flex items-center gap-1 mx-auto"
                      >
                        {loadingCreditNoteId === ret.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <FileText size={12} />
                        )}
                        Credit Note
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showReturnModal && (
        <ReturnModal
          initialSaleId={selectedReturnSaleId}
          onClose={() => setShowReturnModal(false)}
          onReturnProcessed={handleReturnProcessed}
        />
      )}

      {creditNoteData && (
        <ReturnInvoiceModal
          returnData={creditNoteData}
          onClose={() => setCreditNoteData(null)}
        />
      )}
    </div>
  );
}
