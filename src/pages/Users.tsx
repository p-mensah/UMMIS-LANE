import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import { callAdminApi, createUser as createAdminUser, suspendUser, reactivateUser, deleteUser as deleteAdminUser } from '../lib/adminApi';
import ActionMenu, { ActionMenuItemUser } from '../components/ActionMenu';
import UserManagementModal, { UserManagementData } from '../components/UserManagementModal';
import { ShieldAlert, UserPlus, Users as UsersIcon, Shield, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function Users() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserManagementData | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [isCreating, setIsCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { 
    checkAdminStatus();
    loadUsers(); 
  }, [user]);

  const checkAdminStatus = async () => {
    console.log('[UsersPage] Checking admin authorization for user:', user?.email);
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
        console.log('[UsersPage] Supabase profile role retrieved:', profile?.role);
        setIsAdmin(profile?.role === 'admin');
      }
    } catch (err) {
      console.warn('[UsersPage] Failed to retrieve Supabase profile role:', err);
      setIsAdmin(
        user.email?.toLowerCase().includes('admin') || 
        user.email?.toLowerCase().includes('rabbi') || 
        false
      );
    } finally {
      setLoadingCheck(false);
    }
  };

  const handleApiError = (err: any, fallbackMessage: string) => {
    console.error('[UsersPage] API operation error caught:', err);
    
    const isForbidden = 
      err?.status === 403 || 
      err?.message?.includes('403') || 
      err?.message?.toLowerCase().includes('forbidden') || 
      err?.message?.toLowerCase().includes('not authorized') ||
      err?.message?.toLowerCase().includes('permission');

    if (isForbidden) {
      const message = '403 Forbidden: Administrator permissions are required to perform this action. Please sign in with an authorized administrator account.';
      console.warn('[UsersPage] 403 Forbidden condition triggered:', message);
      setForbiddenError(message);
      
      // Notify via NotificationProvider
      addToast({
        title: 'Access Forbidden (403)',
        message: 'You do not have administrative clearance to manage user accounts or modify security roles.',
        type: 'danger',
        duration: 8000
      });
    } else {
      const message = err?.message || fallbackMessage;
      setFeedbackMessage({ type: 'error', text: message });
      addToast({
        title: 'Action Failed',
        message,
        type: 'danger'
      });
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setForbiddenError(null);
    console.log('[UsersPage] Loading user accounts from /api/users...');
    
    try {
      const data = await fetchApi('/users');
      console.log(`[UsersPage] Successfully fetched ${Array.isArray(data) ? data.length : 0} user records.`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      handleApiError(err, 'Failed to retrieve system user directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      handleApiError({ status: 403, message: '403 Forbidden: Admin privileges required' }, 'Unauthorized');
      return;
    }

    setIsCreating(true);
    setForbiddenError(null);
    setFeedbackMessage(null);
    console.log('[UsersPage] Registering new user:', { email: formData.email, role: formData.role, name: formData.name });

    try {
      // 1. Try creating via admin edge function if configured
      try {
        await createAdminUser(formData.email, formData.password, formData.role);
        console.log('[UsersPage] User registered via Supabase edge function.');
      } catch (edgeErr: any) {
        console.warn('[UsersPage] Edge function create_user notice:', edgeErr.message);
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) {
          throw edgeErr;
        }
      }

      // 2. Persist in database
      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      addToast({
        title: 'User Registered',
        message: `Account for ${formData.name} (${formData.email}) was created successfully.`,
        type: 'success'
      });

      setFeedbackMessage({ type: 'success', text: `Successfully registered ${formData.email}` });
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff' });
      loadUsers();
    } catch (err: any) {
      handleApiError(err, 'Failed to create new user account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (targetUser: ActionMenuItemUser) => {
    if (!isAdmin) {
      handleApiError({ status: 403, message: '403 Forbidden: Admin privileges required' }, 'Unauthorized');
      return;
    }

    const isCurrentlyActive = targetUser.is_active === 1 || targetUser.is_active === undefined;
    const actionLabel = isCurrentlyActive ? 'suspend' : 'activate';

    console.log(`[UsersPage] Toggling status for user ${targetUser.email} to ${actionLabel}`);
    setForbiddenError(null);

    try {
      // 1. Edge Function sync
      try {
        if (isCurrentlyActive) {
          await suspendUser(targetUser.id);
        } else {
          await reactivateUser(targetUser.id);
        }
        console.log(`[UsersPage] Edge function ${actionLabel}_user completed.`);
      } catch (edgeErr: any) {
        console.warn(`[UsersPage] Edge function status notice:`, edgeErr.message);
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) {
          throw edgeErr;
        }
      }

      // 2. Database update
      await fetchApi(`/users/${targetUser.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !isCurrentlyActive })
      });

      addToast({
        title: `Account ${isCurrentlyActive ? 'Suspended' : 'Activated'}`,
        message: `User ${targetUser.name} status updated to ${isCurrentlyActive ? 'Suspended' : 'Active'}.`,
        type: isCurrentlyActive ? 'warning' : 'success'
      });

      loadUsers();
    } catch (err: any) {
      handleApiError(err, `Failed to ${actionLabel} user account.`);
    }
  };

  const handleDeleteUser = async (targetUser: ActionMenuItemUser) => {
    if (!isAdmin) {
      handleApiError({ status: 403, message: '403 Forbidden: Admin privileges required' }, 'Unauthorized');
      return;
    }

    console.log(`[UsersPage] Deleting user ${targetUser.email}`);
    setForbiddenError(null);

    try {
      // 1. Edge function delete
      try {
        await deleteAdminUser(targetUser.id);
        console.log('[UsersPage] Edge function delete_user completed.');
      } catch (edgeErr: any) {
        console.warn('[UsersPage] Edge function delete notice:', edgeErr.message);
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) {
          throw edgeErr;
        }
      }

      // 2. Database delete
      await fetchApi(`/users/${targetUser.id}`, {
        method: 'DELETE'
      });

      addToast({
        title: 'User Deleted',
        message: `Account for ${targetUser.email} has been permanently deleted.`,
        type: 'info'
      });

      loadUsers();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete user account.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Staff & Access Management</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              {users.length} {users.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system accounts, assign security roles, and manage active session states.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh user list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setForbiddenError(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <UserPlus size={15} />
              <span>Add New User</span>
            </button>
          )}
        </div>
      </div>

      {/* 403 Forbidden Alert Banner */}
      {forbiddenError && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
          <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
              403 Forbidden — Administrative Privileges Required
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed font-normal">
              {forbiddenError}
            </p>
          </div>
        </div>
      )}

      {/* General Feedback Message */}
      {feedbackMessage && !forbiddenError && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Staff View Mode Info Banner */}
      {!isAdmin && !loadingCheck && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs flex items-start gap-3">
          <Shield size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Read-Only Staff View</span>
            <span>You are viewing user accounts with staff permissions. Administrative actions (adding, editing roles, suspending accounts) require an Administrator login.</span>
          </div>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">User / Staff</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Access Role</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                    <RefreshCw size={18} className="animate-spin inline mr-2 text-blue-600" />
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                    <UsersIcon size={24} className="mx-auto mb-2 text-slate-300" />
                    No user accounts found.
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const isActive = u.is_active === 1 || u.is_active === undefined;
                  const isPrimaryAdmin = u.email === 'rabbi@ummis.com' || u.email === 'admin@admin.com';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{u.name}</div>
                            {isPrimaryAdmin && (
                              <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                                <Lock size={10} /> Primary Super Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-600 font-mono">
                        {u.email}
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          u.role === 'admin' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {u.role === 'admin' ? 'Administrator' : 'Staff Member'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Suspended
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {isAdmin ? (
                          <ActionMenu
                            user={u}
                            onEdit={target => setSelectedUserForEdit(target)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDeleteUser}
                            onSuccess={loadUsers}
                            isPrimaryAdmin={isPrimaryAdmin}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UserManagementModal (Connected to assign_role and user editing) */}
      <UserManagementModal
        user={selectedUserForEdit}
        isOpen={Boolean(selectedUserForEdit)}
        onClose={() => setSelectedUserForEdit(null)}
        onSuccess={loadUsers}
      />

      {/* Add New User Modal */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Create New System User</h2>
                  <p className="text-[11px] text-slate-500">Register new staff account or administrator</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="staff@ummis.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Initial Password
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Minimum 6 characters</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Assigned Security Role
                </label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                >
                  <option value="staff">Staff Member (Standard POS & Inventory access)</option>
                  <option value="admin">Administrator (Full System & User management access)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {isCreating ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
