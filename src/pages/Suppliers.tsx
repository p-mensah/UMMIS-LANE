import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/suppliers').then(setSuppliers).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/suppliers', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Suppliers Directory</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs border-none hover:bg-blue-600 transition">
          Add Supplier
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {suppliers.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[13px] font-medium text-slate-900">{s.name}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{s.contact_person || '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{s.email || '-'}</td>
                <td className="px-5 py-3 whitespace-nowrap text-[13px] text-slate-500">{s.phone || '-'}</td>
              </tr>
            ))}
            {suppliers.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-[13px]">No suppliers listed.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">New Supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Company Name</label>
                <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Contact Person</label>
                   <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                   <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Address</label>
                <input type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
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
