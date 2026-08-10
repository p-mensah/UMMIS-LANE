import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { Users, Search, Plus, CreditCard, Mail, Phone, Award } from 'lucide-react';
import { formatGHS } from '../lib/formatters';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/customers').then(setCustomers).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/customers', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ name: '', phone: '', email: '' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
           <h1 className="text-[20px] font-bold text-slate-900 tracking-tight text-left">Customer Database</h1>
           <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">Loyalty & Spending History</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-sm pl-10 pr-4 py-2 text-[13px] focus:outline-none focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-sm font-bold text-[12px] uppercase tracking-widest hover:bg-slate-800 transition shadow-sm w-full sm:w-auto"
          >
            <Plus size={16} className="mr-2" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact Details</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Points</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest text-emerald-600">Total Spent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredCustomers.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-[13px] font-black text-slate-900 uppercase">{c.name}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Registration ID: #{c.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <div className="flex flex-col gap-1">
                      {c.phone && <div className="flex items-center text-[11px] text-slate-500 font-mono"><Phone size={12} className="mr-1.5 opacity-50" /> {c.phone}</div>}
                      {c.email && <div className="flex items-center text-[11px] text-slate-500 font-mono"><Mail size={12} className="mr-1.5 opacity-50" /> {c.email}</div>}
                   </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-600 rounded-sm text-[11px] font-black uppercase tracking-tighter border border-amber-100">
                     <Award size={12} className="mr-1" /> {c.loyalty_points}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-[13px] font-black text-emerald-600">
                  {formatGHS(c.total_spent || 0)}
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-[13px] font-medium italic">No matching customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">New Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Name</label>
                <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
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
