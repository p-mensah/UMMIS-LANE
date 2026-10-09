import React, { useEffect, useState, useMemo } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { 
  Receipt, Plus, Search, Calendar, User, ArrowDownRight,
  TrendingDown, FileText, X, AlertCircle
} from 'lucide-react';
import { CediSign } from '../components/common/CediSign';

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: '', category: 'General' });

  const { addToast } = useNotifications();

  useModalDismiss(showModal, () => setShowModal(false));

  useEffect(() => { 
    loadData(); 
  }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/expenses')
      .then(setExpenses)
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Failed to Load Expenses',
          message: err.message || 'Could not retrieve expense logs.'
        });
      })
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast({
        type: 'warning',
        title: 'Invalid Amount',
        message: 'Please enter a valid expense amount greater than 0.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi('/expenses', { 
        method: 'POST', 
        body: JSON.stringify({
          description: formData.description.trim(),
          amount: amountNum,
          category: formData.category
        }) 
      });
      addToast({
        type: 'success',
        title: 'Expense Logged',
        message: `Successfully recorded ${formatGHS(amountNum)} for "${formData.description.trim()}".`
      });
      setShowModal(false);
      setFormData({ description: '', amount: '', category: 'General' });
      loadData();
    } catch (err: any) { 
      addToast({
        type: 'danger',
        title: 'Submission Failed',
        message: err.message || 'Failed to save expense.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const q = searchQuery.toLowerCase();
      return (
        exp.description?.toLowerCase().includes(q) ||
        exp.user_name?.toLowerCase().includes(q) ||
        exp.category?.toLowerCase().includes(q)
      );
    });
  }, [expenses, searchQuery]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  const todayExpenseAmount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return expenses
      .filter(exp => exp.expense_date?.startsWith(todayStr))
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header with Title and Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-blue-600" size={22} /> Business Operating Expenses
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log and audit daily store utilities, petty cash expenditures, and overhead costs.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition shadow-2xs min-h-[40px] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        >
          <Plus size={16} /> Log Expense
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Recorded Expenses</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">{formatGHS(totalExpenseAmount)}</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Today's Expenditures</span>
            <span className="text-xl font-extrabold text-rose-600 mt-1 block">{formatGHS(todayExpenseAmount)}</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <CediSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Entries</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">{expenses.length} Records</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses or staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredExpenses.length}</strong> of {expenses.length} records
          </span>
        </div>

        {/* Table / Skeleton / Empty State */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Logged By</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-48"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                  </tr>
                ))
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                        <Receipt size={24} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No Expenses Found</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                        {searchQuery ? `No expenses match "${searchQuery}".` : 'No store expenditures have been recorded yet.'}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={() => setShowModal(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                        >
                          Log First Expense
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(exp.expense_date + (exp.expense_date.includes('Z') ? '' : 'Z')).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                      {formatGHS(exp.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                        <User size={12} className="text-slate-400" /> {exp.user_name || 'System Staff'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="text-blue-600" size={18} />
                <h2 className="text-base font-bold text-slate-900">Log Operating Expense</h2>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Expense Description *
                </label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Electricity bill, Generator diesel, Cleaner supplies"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Amount (₵) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₵</span>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    placeholder="0.00"
                    className="w-full pl-12 pr-3.5 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]" 
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition min-h-[40px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-2xs transition min-h-[40px]"
                >
                  {isSubmitting ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
