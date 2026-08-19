import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { MoreVertical, Edit2, UserX, UserCheck, Trash2, X } from 'lucide-react';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [editData, setEditData] = useState({ id: null as any, name: '', email: '', role: 'staff' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    checkAdminStatus();
    loadData(); 
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setLoadingCheck(false);
      return;
    }
    if (user.role === 'admin') {
      setIsAdmin(true);
      setLoadingCheck(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
    } catch {
      setIsAdmin(user.email?.toLowerCase().includes('admin') || user.email?.toLowerCase().includes('rabbi') || false);
    } finally {
      setLoadingCheck(false);
    }
  };

  const loadData = () => {
    fetchApi('/users').then(setUsers).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Not authorized. Admin privileges required.');
      return;
    }
    try {
      await fetchApi('/users', { method: 'POST', body: JSON.stringify(formData) });
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff' });
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Not authorized. Admin privileges required.');
      return;
    }
    try {
      await fetchApi(`/users/${editData.id}/role`, { method: 'PUT', body: JSON.stringify({ role: editData.role }) });
      setShowEditModal(false);
      setActiveMenuId(null);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const toggleStatus = async (id: number, currentStatus: number) => {
    if (!isAdmin) {
      alert('Not authorized. Admin privileges required.');
      return;
    }
    const actionName = currentStatus ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${actionName} this user?`)) return;
    try {
      await fetchApi(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active: !currentStatus }) });
      setActiveMenuId(null);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const deleteUser = async (id: number, email: string) => {
    if (!isAdmin) {
      alert('Not authorized. Admin privileges required.');
      return;
    }
    if (email === 'rabbi@ummis.com') {
      alert('Cannot delete primary administrator account.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete user ${email}? This action cannot be undone.`)) return;
    try {
      await fetchApi(`/users/${id}`, { method: 'DELETE' });
      setActiveMenuId(null);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-xs text-slate-500">Manage system staff and administrator access controls</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-xs hover:bg-blue-700 transition">
            + Add New User
          </button>
        )}
      </div>

      {!isAdmin && !loadingCheck && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded text-xs">
          Note: You are viewing in read-only staff mode. Administrator privileges are required to create new users or alter access.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {users.map(u => {
              const isActive = u.is_active || u.is_active === undefined ? 1 : 0;
              return (
                <tr key={u.id} className="hover:bg-slate-50/50 relative">
                  <td className="px-5 py-3.5 text-[13px] font-bold text-slate-900">{u.name}</td>
                  <td className="px-5 py-3.5 text-[13px] text-slate-600 font-mono text-xs">{u.email}</td>
                  <td className="px-5 py-3.5 text-[13px]">
                    <span className={`px-2.5 py-1 rounded-full uppercase text-[10px] font-black ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px]">
                     {isActive === 1 ? <span className="text-emerald-600 font-bold">Active</span> : <span className="text-rose-600 font-bold">Suspended</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right relative">
                     {isAdmin && (
                       <div className="flex items-center justify-end">
                         <button
                           onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                           className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition"
                         >
                           <MoreVertical size={16} />
                         </button>

                         {activeMenuId === u.id && (
                           <div ref={menuRef} className="absolute right-8 top-10 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left">
                             <button
                               onClick={() => {
                                 setEditData({ id: u.id, name: u.name, email: u.email, role: u.role });
                                 setShowEditModal(true);
                                 setActiveMenuId(null);
                               }}
                               className="w-full px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                             >
                               <Edit2 size={13} className="text-blue-600" /> Edit Role / Details
                             </button>
                             <button
                               onClick={() => toggleStatus(u.id, isActive)}
                               className="w-full px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                             >
                               {isActive === 1 ? (
                                 <>
                                   <UserX size={13} className="text-amber-600" /> Suspend User
                                 </>
                               ) : (
                                 <>
                                   <UserCheck size={13} className="text-emerald-600" /> Activate User
                                 </>
                               )}
                             </button>
                             {u.email !== 'rabbi@ummis.com' && (
                               <button
                                 onClick={() => deleteUser(u.id, u.email)}
                                 className="w-full px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                               >
                                 <Trash2 size={13} /> Delete User
                               </button>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-3 mb-4">Create New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Full Name</label>
                <input required type="text" placeholder="e.g. John Doe" className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Email Address</label>
                <input required type="email" placeholder="user@ummis.com" className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Password</label>
                <input required type="password" placeholder="••••••••" minLength={6} className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Assigned Role</label>
                <select className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500 font-medium" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="staff">Staff Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 uppercase tracking-wider">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded hover:bg-blue-700 uppercase tracking-wider">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Edit User: {editData.name}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Email (Read-only)</label>
                <input disabled type="email" className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-500 font-medium" value={editData.email} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Assigned Role</label>
                <select className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500 font-medium uppercase" value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 mt-5">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 uppercase tracking-wider">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-black text-white bg-blue-600 rounded hover:bg-blue-700 uppercase tracking-wider">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
