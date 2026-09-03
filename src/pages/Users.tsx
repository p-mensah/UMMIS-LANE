import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import { callAdminApi, createUser as createAdminUser, suspendUser, reactivateUser, deleteUser as deleteAdminUser } from '../lib/adminApi';
import ActionMenu, { ActionMenuItemUser } from '../components/ActionMenu';
import UserManagementModal, { UserManagementData } from '../components/UserManagementModal';
import { 
  ShieldAlert, UserPlus, Users as UsersIcon, Shield, RefreshCw, AlertCircle, 
  CheckCircle2, Lock, Eye, ShieldCheck, Clock, KeyRound, Globe, Camera,
  SlidersHorizontal, X, LogOut, Sparkles, UserCheck, UserX, ChevronRight
} from 'lucide-react';

export default function Users() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserManagementData | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'profile' | 'security'>('profile');
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff', profile_picture: '' });
  const [addProfilePreview, setAddProfilePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

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
        user.email?.toLowerCase().includes('mensah') ||
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
      
      // Keep inspecting user in sync if currently open in slide-over
      if (inspectingUser) {
        const updated = (Array.isArray(data) ? data : []).find(u => u.id === inspectingUser.id);
        if (updated) {
          setInspectingUser(updated);
        }
      }
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

      // 2. Persist in database including profile picture
      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          profile_picture: addProfilePreview || null
        })
      });

      addToast({
        title: 'User Registered',
        message: `Account for ${formData.name} (${formData.email}) was created successfully.`,
        type: 'success'
      });

      setFeedbackMessage({ type: 'success', text: `Successfully registered ${formData.email}` });
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff', profile_picture: '' });
      setAddProfilePreview(null);
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
      try {
        if (isCurrentlyActive) {
          await suspendUser(targetUser.id);
        } else {
          await reactivateUser(targetUser.id);
        }
      } catch (edgeErr: any) {
        console.warn(`[UsersPage] Edge function status notice:`, edgeErr.message);
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) {
          throw edgeErr;
        }
      }

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
      try {
        await deleteAdminUser(targetUser.id);
      } catch (edgeErr: any) {
        console.warn('[UsersPage] Edge function delete notice:', edgeErr.message);
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) {
          throw edgeErr;
        }
      }

      await fetchApi(`/users/${targetUser.id}`, {
        method: 'DELETE'
      });

      addToast({
        title: 'User Deleted',
        message: `Account for ${targetUser.email} has been permanently deleted.`,
        type: 'info'
      });

      if (inspectingUser?.id === targetUser.id) {
        setInspectingUser(null);
      }

      loadUsers();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete user account.');
    }
  };

  const handleToggleNavigationSlider = () => {
    // Dispatches navigation slider event to collapse or expand the desktop navigation slider
    window.dispatchEvent(new CustomEvent('toggle-nav-slider'));
  };

  const handleViewUser = (targetUser: any) => {
    setInspectingUser(targetUser);
  };

  const handleSecurityUser = (targetUser: any) => {
    setSelectedUserForEdit(targetUser);
    setModalInitialTab('security');
  };

  const handleEditUser = (targetUser: any) => {
    setSelectedUserForEdit(targetUser);
    setModalInitialTab('profile');
  };

  const handleAddAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target?.result as string;
      setAddProfilePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Staff & Access Management</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              {users.length} {users.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system accounts, assign security roles, and manage active sessions. Account genesis records and verified sign-in histories are audited under Audit Security Logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          {/* Navigation Slider Toggle Button */}
          <button
            onClick={handleToggleNavigationSlider}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            title="Toggle Navigation Slider (Sidebar)"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Toggle Nav Slider</span>
          </button>

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
                setAddProfilePreview(null);
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
                  const isPrimaryAdmin = 
                    u.email?.toLowerCase() === 'ing.mensah@gmail.com' || 
                    u.email === 'rabbi@ummis.com' || 
                    u.email === 'admin@admin.com';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* User / Staff with Profile Picture */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {u.profile_picture ? (
                            <img
                              src={u.profile_picture}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-2xs shrink-0 ${
                              u.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : u.role === 'supplier'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {u.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{u.name}</div>
                            {isPrimaryAdmin && (
                              <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                                <Lock size={10} /> Super Admin
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
                            : u.role === 'supplier'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {u.role === 'admin' ? 'Administrator' : u.role === 'supplier' ? 'Supplier Vendor' : 'Staff Member'}
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

                      {/* Action Column with Three Dots */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end">
                          <ActionMenu
                            user={u}
                            onView={handleViewUser}
                            onSecurity={handleSecurityUser}
                            onEdit={handleEditUser}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDeleteUser}
                            onSuccess={loadUsers}
                            isPrimaryAdmin={isPrimaryAdmin}
                            isAdmin={isAdmin}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Profile & Security Slide-Over Navigation Slider */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setInspectingUser(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      User Profile & Security Slider
                    </h2>
                    <p className="text-[11px] text-slate-500">Audit-backed identity and access verification</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleNavigationSlider}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                    title="Toggle main navigation slider (sidebar)"
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                  <button
                    onClick={() => setInspectingUser(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                    title="Close details slider"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Profile Card */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center text-center relative">
                  {inspectingUser.profile_picture ? (
                    <img 
                      src={inspectingUser.profile_picture} 
                      alt={inspectingUser.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md mb-3"
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl uppercase border-4 border-white shadow-md mb-3 ${
                      inspectingUser.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-700'
                        : inspectingUser.role === 'supplier'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {inspectingUser.name?.charAt(0) || 'U'}
                    </div>
                  )}

                  <h3 className="text-base font-bold text-slate-900">{inspectingUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{inspectingUser.email}</p>

                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      inspectingUser.role === 'admin' 
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                        : inspectingUser.role === 'supplier'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      {inspectingUser.role === 'admin' ? 'Administrator' : inspectingUser.role === 'supplier' ? 'Supplier Vendor' : 'Staff Member'}
                    </span>

                    {inspectingUser.is_active === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <UserX size={10} /> Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <UserCheck size={10} /> Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Audit Security Log Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Audit Security Log Records
                    </h4>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs shadow-2xs">
                    {/* Creation Record from Audit Log */}
                    <div className="p-3.5 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Account Genesis Timestamp
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {formatDateTime(inspectingUser.created_at) || 'System Origin'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <ShieldCheck size={11} className="text-emerald-600" />
                          <span>Derived from Audit Log (by: {inspectingUser.created_by || 'Store Genesis'})</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        Audit Log
                      </span>
                    </div>

                    {/* Last Login Record from Audit Log */}
                    <div className="p-3.5 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Last Successful Sign-In
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {inspectingUser.last_login_at ? formatDateTime(inspectingUser.last_login_at) : 'No Sign-In Recorded'}
                        </div>
                        {inspectingUser.last_login_ip && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Globe size={11} className="text-blue-500" />
                            <span>Client IP Address: {inspectingUser.last_login_ip}</span>
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        Verified
                      </span>
                    </div>

                    {/* Security flags */}
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Mandatory Password Reset
                        </div>
                        <div className="font-bold text-slate-800 mt-0.5">
                          {inspectingUser.force_password_reset ? (
                            <span className="text-amber-700 font-bold flex items-center gap-1">
                              <KeyRound size={12} /> Yes (Required on Next Login)
                            </span>
                          ) : (
                            <span className="text-slate-500">Not Flagged</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Session state */}
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Session Invalidation Status
                        </div>
                        <div className="font-bold text-slate-800 mt-0.5">
                          {inspectingUser.session_revoked_at ? (
                            <span className="text-rose-700 text-[11px]">
                              Revoked at {formatDateTime(inspectingUser.session_revoked_at)}
                            </span>
                          ) : (
                            <span className="text-emerald-700 text-[11px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Healthy & Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Action Controls */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Quick Security Controls
                  </h4>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectingUser(null);
                      handleSecurityUser(inspectingUser);
                    }}
                    className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-between border border-indigo-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound size={15} />
                      <span>Security & Password Reset Center</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectingUser(null);
                      handleEditUser(inspectingUser);
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-between border border-slate-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <Camera size={15} />
                      <span>Update Profile Picture & Role</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNavigationSlider}
                    className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-between border border-blue-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={15} />
                      <span>Toggle Navigation Slider (Expand/Collapse Sidebar)</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UserManagementModal (Connected to assign_role, password reset, and security audit) */}
      <UserManagementModal
        user={selectedUserForEdit}
        isOpen={Boolean(selectedUserForEdit)}
        initialTab={modalInitialTab}
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
                  <p className="text-[11px] text-slate-500">Register new staff account with profile picture and access role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {/* Profile Picture Upload Preview */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative shrink-0">
                  {addProfilePreview ? (
                    <img
                      src={addProfilePreview}
                      alt="Avatar preview"
                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center font-bold text-lg border-2 border-white shadow-xs">
                      {formData.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => addFileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition"
                    title="Upload profile photo"
                  >
                    <Camera size={12} />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">User Profile Picture</div>
                  <p className="text-[11px] text-slate-500">Optional photo avatar for staff identification</p>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAddAvatarUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => addFileInputRef.current?.click()}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                    >
                      {addProfilePreview ? 'Change Photo' : 'Select Photo'}
                    </button>
                    {addProfilePreview && (
                      <button
                        type="button"
                        onClick={() => setAddProfilePreview(null)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
                  <option value="supplier">Supplier Vendor (Supplier Portal & PO restock access)</option>
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
