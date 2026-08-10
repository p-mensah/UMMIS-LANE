import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/expenses').then(setExpenses).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/expenses', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ description: '', amount: 0 });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Expenses</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs hover:bg-blue-600 transition">
          Log Expense
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Logged By</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td className="px-5 py-3 text-[13px] text-slate-500">{new Date(exp.expense_date + 'Z').toLocaleString()}</td>
                <td className="px-5 py-3 text-[13px] font-medium text-slate-900">{exp.description}</td>
                <td className="px-5 py-3 text-[13px] font-bold text-red-500">{formatGHS(exp.amount)}</td>
                <td className="px-5 py-3 text-[13px] text-slate-500">{exp.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Log Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Amount (GH₵)</label>
                <input required type="number" step="0.01" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
              </div>
              <div className="pt-5 flex justify-end space-x-3 border-t border-slate-200 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-500 border-none rounded-sm hover:bg-blue-600">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
