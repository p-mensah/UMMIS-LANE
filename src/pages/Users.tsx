import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff' });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    fetchApi('/users').then(setUsers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/users', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const toggleStatus = async (id: number, currentStatus: number) => {
    try {
      await fetchApi(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active: !currentStatus }) });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">User Management</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-sm font-semibold text-xs hover:bg-blue-600 transition">
          Add User
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-5 py-3 text-[13px] font-medium text-slate-900">{u.name}</td>
                <td className="px-5 py-3 text-[13px] text-slate-500">{u.email}</td>
                <td className="px-5 py-3 text-[13px] text-slate-500">
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm uppercase text-[10px] font-bold">{u.role}</span>
                </td>
                <td className="px-5 py-3 text-[13px]">
                   {u.is_active || u.is_active === undefined ? <span className="text-emerald-500 font-bold">Active</span> : <span className="text-red-500 font-bold">Inactive</span>}
                </td>
                <td className="px-5 py-3 text-right">
                   <button onClick={() => toggleStatus(u.id, u.is_active === undefined ? 1 : u.is_active)} className="text-[12px] text-blue-500 hover:underline">Toggle Access</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 border border-slate-200">
            <h2 className="text-[14px] font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Name</label>
                <input required type="text" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input required type="email" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                <input required type="password" minLength={6} className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Role</label>
                <select className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
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
