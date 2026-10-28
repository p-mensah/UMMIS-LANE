import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { ArrowUpRight, ArrowDownLeft, FileText, Filter, Printer, ExternalLink } from 'lucide-react';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { useNotifications } from '../context/NotificationContext';

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const { addToast } = useNotifications();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || searchParams.get('id') || '');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [selectedSaleData, setSelectedSaleData] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const highlightedId = searchParams.get('id');
  const hasAutoOpenedReceipt = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      fetchApi('/reports/transactions'),
      fetchApi('/users')
    ])
    .then(([transRes, usersRes]) => {
      setTransactions(transRes);
      setUsers(usersRes);

      // Deep-link auto-receipt trigger
      const targetId = searchParams.get('id');
      if (targetId && !hasAutoOpenedReceipt.current) {
        hasAutoOpenedReceipt.current = true;
        handlePrintReceipt(parseInt(targetId, 10));
      }
    })
    .catch((err: any) => {
      addToast(err.message || 'Failed to load transactions', 'error');
    })
    .finally(() => setLoading(false));
  };

  const handlePrintReceipt = async (saleId: number) => {
    setLoadingReceipt(true);
    try {
      const sale = await fetchApi(`/sales/${saleId}`);
      setSelectedSaleData(sale);
    } catch (err: any) {
      addToast('Error fetching receipt: ' + err.message, 'error');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.user_name && t.user_name.toLowerCase().includes(q));
    const matchesUser = userIdFilter === '' || t.user_name === users.find(u => u.id.toString() === userIdFilter)?.name;
    return matchesSearch && matchesUser;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Transaction History</h1>
          <p className="text-[13px] text-slate-500">Chronological ledger of all business activities</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto text-[13px]">
          <select 
            value={userIdFilter} 
            onChange={e => setUserIdFilter(e.target.value)}
            className="border border-slate-300 rounded-sm px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">All Staff</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="relative w-full sm:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-slate-300 rounded-sm pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Staff</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reference</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredTransactions.map((t, idx) => {
              const isIncome = t.amount > 0;
              const isHighlighted = highlightedId && String(t.id) === highlightedId;
              return (
                <tr 
                  key={`${t.type}-${t.id}-${idx}`} 
                  className={`transition-colors ${
                    isHighlighted ? 'bg-blue-50/90 ring-2 ring-blue-500/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-900 font-medium lowercase">
                    {t.user_name || 'System'}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-[13px] font-mono text-slate-400 uppercase">
                    #{t.type.substring(0, 1)}-{t.id}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-slate-900 font-medium whitespace-nowrap">
                    {t.description}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      t.type === 'sale' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                      t.type === 'return' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      t.type === 'purchase' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-red-50 text-red-600 border border-red-200'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-5 py-3 whitespace-nowrap text-right text-[13px] font-bold ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>
                    <span className="flex items-center justify-end">
                      {isIncome ? <ArrowDownLeft size={12} className="mr-1" /> : <ArrowUpRight size={12} className="mr-1" />}
                      {formatGHS(Math.abs(t.amount))}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right text-[12px]">
                    {t.type === 'sale' ? (
                      <button
                        onClick={() => handlePrintReceipt(t.id)}
                        disabled={loadingReceipt}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-[11px] rounded border border-slate-200 transition-colors cursor-pointer"
                        title="Print Official Sales Receipt"
                      >
                        <Printer size={12} />
                        <span>Print Receipt</span>
                      </button>
                    ) : (
                      <span className="text-slate-300 font-mono text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-[13px]">
                  <FileText className="mx-auto mb-2 opacity-30" size={32} />
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sales Receipt Print Preview Modal */}
      {selectedSaleData && (
        <PrintPreviewModal
          isOpen={Boolean(selectedSaleData)}
          receiptData={selectedSaleData}
          initialFormat="receipt"
          onClose={() => setSelectedSaleData(null)}
        />
      )}
    </div>
  );
}
