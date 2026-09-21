import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { supabase } from '../lib/supabase';
import { callAdminApi, createUser as createAdminUser, suspendUser, reactivateUser, deleteUser as deleteAdminUser } from '../lib/adminApi';
import ActionMenu, { ActionMenuItemUser } from '../components/ActionMenu';
import UserManagementModal, { UserManagementData } from '../components/UserManagementModal';
import { 
  ShieldAlert, UserPlus, Users as UsersIcon, Shield, RefreshCw, AlertCircle, 
  CheckCircle2, Lock, Eye, ShieldCheck, Clock, KeyRound, Globe, Camera,
  SlidersHorizontal, X, LogOut, UserCheck, UserX, ChevronRight,
  Building2, Plus, Edit2, Trash2, Tag, Search, Filter, Layers
} from 'lucide-react';

export default function Users() {
  const { user } = useAuth();
  const { addToast, confirmModal } = useNotifications();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'departments'>('users');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // User modal
  const [showAddModal, setShowAddModal] = useState(false);
  useModalDismiss(showAddModal, () => setShowAddModal(false));
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserManagementData | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'profile' | 'security'>('profile');
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'staff', 
    department: '', 
    profile_picture: '' 
  });
  const [addProfilePreview, setAddProfilePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  useModalDismiss(showRoleModal, () => setShowRoleModal(false));
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: 'indigo'
  });
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Department modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  useModalDismiss(showDeptModal, () => setShowDeptModal(false));
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    description: ''
  });
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Admin and error states
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    checkAdminStatus();
    loadAllData(); 
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setLoadingCheck(false);
      return;
    }

    const email = user.email?.toLowerCase() || '';
    const hasAdminRole = 
      user.role === 'admin' || 
      email.includes('admin') || 
      email.includes('rabbi') || 
      email.includes('mensah');

    setIsAdmin(hasAdminRole);
    setLoadingCheck(false);
  };

  const handleApiError = (err: any, fallbackMessage: string) => {
    console.error('[UsersPage] API error:', err);
    
    const isForbidden = 
      err?.status === 403 || 
      err?.message?.includes('403') || 
      err?.message?.toLowerCase().includes('forbidden') || 
      err?.message?.toLowerCase().includes('not authorized') ||
      err?.message?.toLowerCase().includes('permission');

    if (isForbidden) {
      const message = '403 Forbidden: Administrator permissions are required to perform this action.';
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

  const loadAllData = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      await Promise.all([loadUsers(), loadRoles(), loadDepartments()]);
    } catch (err: any) {
      handleApiError(err, 'Failed to load user management data.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchApi('/users');
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      if (selectedUserForEdit) {
        const updated = list.find(u => u.id === selectedUserForEdit.id);
        if (updated) setSelectedUserForEdit(updated);
      }
    } catch (err: any) {
      handleApiError(err, 'Failed to retrieve system user directory.');
    }
  };

  const loadRoles = async () => {
    try {
      const data = await fetchApi('/roles');
      if (Array.isArray(data)) setRoles(data);
    } catch (err) {
      console.warn('Could not load roles:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await fetchApi('/departments');
      if (Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.warn('Could not load departments:', err);
    }
  };

  // --- USER HANDLERS ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      handleApiError({ status: 403, message: '403 Forbidden: Admin privileges required' }, 'Unauthorized');
      return;
    }

    setIsCreating(true);
    setForbiddenError(null);
    setFeedbackMessage(null);

    try {
      try {
        await createAdminUser(formData.email, formData.password, formData.role);
      } catch (edgeErr: any) {
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) throw edgeErr;
      }

      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          department: formData.department ? formData.department.trim() : null,
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
      setFormData({ name: '', email: '', password: '', role: 'staff', department: '', profile_picture: '' });
      setAddProfilePreview(null);
      loadAllData();
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

    try {
      try {
        if (isCurrentlyActive) {
          await suspendUser(targetUser.id);
        } else {
          await reactivateUser(targetUser.id);
        }
      } catch (edgeErr: any) {
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) throw edgeErr;
      }

      await fetchApi(`/users/${targetUser.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isCurrentlyActive ? 0 : 1 })
      });

      addToast({
        title: isCurrentlyActive ? 'Account Suspended' : 'Account Activated',
        message: `User ${targetUser.email} has been ${isCurrentlyActive ? 'suspended' : 'activated'}.`,
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

    const confirmed = await confirmModal({
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete the account for ${targetUser.name || targetUser.email}? This action cannot be undone.`,
      confirmText: 'Delete Account',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      try {
        await deleteAdminUser(targetUser.id);
      } catch (edgeErr: any) {
        if (edgeErr?.status === 403 || edgeErr?.message?.includes('403')) throw edgeErr;
      }

      await fetchApi(`/users/${targetUser.id}`, { method: 'DELETE' });

      addToast({
        title: 'User Deleted',
        message: `Account for ${targetUser.email} has been permanently deleted.`,
        type: 'info'
      });

      if (selectedUserForEdit?.id === targetUser.id) setSelectedUserForEdit(null);
      loadAllData();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete user account.');
    }
  };

  // --- ROLE HANDLERS ---
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      slug: '',
      description: '',
      color: 'indigo'
    });
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (r: any) => {
    setEditingRole(r);
    setRoleFormData({
      name: r.name,
      slug: r.slug,
      description: r.description || '',
      color: r.color || 'indigo'
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!roleFormData.name.trim()) {
      addToast('Role name is required.', 'warning');
      return;
    }

    setIsSavingRole(true);
    try {
      if (editingRole) {
        await fetchApi(`/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: roleFormData.name.trim(),
            description: roleFormData.description.trim(),
            color: roleFormData.color
          })
        });
        addToast({
          title: 'Role Updated',
          message: `Role "${roleFormData.name}" was updated successfully.`,
          type: 'success'
        });
      } else {
        await fetchApi('/roles', {
          method: 'POST',
          body: JSON.stringify({
            name: roleFormData.name.trim(),
            slug: roleFormData.slug.trim(),
            description: roleFormData.description.trim(),
            color: roleFormData.color
          })
        });
        addToast({
          title: 'Role Created',
          message: `New role "${roleFormData.name}" was added successfully.`,
          type: 'success'
        });
      }

      setShowRoleModal(false);
      loadRoles();
    } catch (err: any) {
      addToast({
        title: 'Role Operation Failed',
        message: err.message || 'Could not save role.',
        type: 'danger'
      });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (r: any) => {
    if (!isAdmin) return;
    if (r.is_system === 1) {
      addToast('Built-in system roles cannot be deleted.', 'warning');
      return;
    }
    if (r.user_count > 0) {
      addToast(`Cannot delete role "${r.name}". ${r.user_count} user(s) are assigned to it.`, 'warning');
      return;
    }

    const confirmed = await confirmModal({
      title: 'Delete Security Role',
      message: `Are you sure you want to delete the role "${r.name}"? This action cannot be reversed.`,
      confirmText: 'Delete Role',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetchApi(`/roles/${r.id}`, { method: 'DELETE' });
      addToast({
        title: 'Role Deleted',
        message: `Role "${r.name}" has been removed.`,
        type: 'info'
      });
      loadRoles();
    } catch (err: any) {
      addToast({
        title: 'Failed to Delete Role',
        message: err.message || 'Could not delete role.',
        type: 'danger'
      });
    }
  };

  // --- DEPARTMENT HANDLERS ---
  const handleOpenAddDept = () => {
    setEditingDept(null);
    setDeptFormData({
      name: '',
      code: '',
      description: ''
    });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (d: any) => {
    setEditingDept(d);
    setDeptFormData({
      name: d.name,
      code: d.code || '',
      description: d.description || ''
    });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!deptFormData.name.trim()) {
      addToast('Department name is required.', 'warning');
      return;
    }

    setIsSavingDept(true);
    try {
      if (editingDept) {
        await fetchApi(`/departments/${editingDept.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: deptFormData.name.trim(),
            code: deptFormData.code.trim().toUpperCase(),
            description: deptFormData.description.trim()
          })
        });
        addToast({
          title: 'Department Updated',
          message: `Department "${deptFormData.name}" was updated successfully.`,
          type: 'success'
        });
      } else {
        await fetchApi('/departments', {
          method: 'POST',
          body: JSON.stringify({
            name: deptFormData.name.trim(),
            code: deptFormData.code.trim().toUpperCase(),
            description: deptFormData.description.trim()
          })
        });
        addToast({
          title: 'Department Created',
          message: `New department "${deptFormData.name}" was created successfully.`,
          type: 'success'
        });
      }

      setShowDeptModal(false);
      loadDepartments();
    } catch (err: any) {
      addToast({
        title: 'Department Operation Failed',
        message: err.message || 'Could not save department.',
        type: 'danger'
      });
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDept = async (d: any) => {
    if (!isAdmin) return;
    const confirmed = await confirmModal({
      title: 'Delete Department',
      message: `Are you sure you want to delete department "${d.name}"? Users assigned to this department will not be deleted.`,
      confirmText: 'Delete Department',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await fetchApi(`/departments/${d.id}`, { method: 'DELETE' });
      addToast({
        title: 'Department Deleted',
        message: `Department "${d.name}" has been removed.`,
        type: 'info'
      });
      loadDepartments();
    } catch (err: any) {
      addToast({
        title: 'Failed to Delete Department',
        message: err.message || 'Could not delete department.',
        type: 'danger'
      });
    }
  };

  const handleManageUser = (targetUser: any, tab: 'profile' | 'security' = 'profile') => {
    setSelectedUserForEdit(targetUser);
    setModalInitialTab(tab);
  };

  const handleAddAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file (PNG, JPG, or WEBP).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target?.result as string;
      setAddProfilePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const getRoleBadgeStyle = (roleSlug: string) => {
    const matched = roles.find(r => r.slug?.toLowerCase() === roleSlug?.toLowerCase());
    const color = matched?.color || (roleSlug === 'admin' ? 'indigo' : roleSlug === 'supplier' ? 'emerald' : 'blue');
    const colorClasses: Record<string, string> = {
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      rose: 'bg-rose-50 text-rose-700 border-rose-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      slate: 'bg-slate-100 text-slate-700 border-slate-300'
    };
    return colorClasses[color] || colorClasses.slate;
  };

  const getRoleDisplayName = (roleSlug: string) => {
    const matched = roles.find(r => r.slug?.toLowerCase() === roleSlug?.toLowerCase());
    if (matched) return matched.name;
    if (roleSlug === 'admin') return 'Administrator';
    if (roleSlug === 'supplier') return 'Supplier Vendor';
    if (roleSlug === 'staff') return 'Staff Member';
    return roleSlug ? (roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1)) : 'Staff';
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role?.toLowerCase() === roleFilter.toLowerCase();
    const matchesDept = deptFilter === 'all' || (u.department || '').toLowerCase() === deptFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesDept;
  });

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
            Configure system staff accounts, manage custom security roles, and assign organizational departments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {isAdmin && activeTab === 'users' && (
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

          {isAdmin && activeTab === 'roles' && (
            <button
              onClick={handleOpenAddRole}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-indigo-500/20 transition flex items-center gap-1.5"
            >
              <ShieldCheck size={15} />
              <span>Add Security Role</span>
            </button>
          )}

          {isAdmin && activeTab === 'departments' && (
            <button
              onClick={handleOpenAddDept}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-emerald-500/20 transition flex items-center gap-1.5"
            >
              <Building2 size={15} />
              <span>Add Department</span>
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
            <span>You are viewing system accounts with staff permissions. Role creation, department editing, and account suspension require Administrator clearance.</span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UsersIcon size={15} />
          <span>Users Directory</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={15} />
          <span>Security Roles</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-700">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'departments'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 size={15} />
          <span>Departments</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700">
            {departments.length}
          </span>
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, email, or department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Roles</option>
                {roles.map(r => (
                  <option key={r.id || r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id || d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">User / Staff</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Access Role</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">
                        <RefreshCw size={18} className="animate-spin inline mr-2 text-blue-600" />
                        Loading user directory...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">
                        <UsersIcon size={24} className="mx-auto mb-2 text-slate-300" />
                        No accounts match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getRoleBadgeStyle(u.role)}`}>
                              {getRoleDisplayName(u.role)}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-xs">
                            {u.department ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <Building2 size={11} className="text-slate-400" />
                                {u.department}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unassigned</span>
                            )}
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

                          {/* Action Column */}
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                user={u}
                                onManage={handleManageUser}
                                onToggleStatus={handleToggleStatus}
                                onDelete={handleDeleteUser}
                                onSuccess={loadAllData}
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
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Security Roles & Permissions</h2>
              <p className="text-xs text-slate-500">Define access tiers, permission boundaries, and color identifiers for staff accounts.</p>
            </div>
            {isAdmin && (
              <button
                onClick={handleOpenAddRole}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={14} />
                <span>Add Role</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => {
              const isSystem = r.is_system === 1;
              return (
                <div key={r.id || r.slug} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getRoleBadgeStyle(r.slug)}`}>
                          {r.name}
                        </span>
                        {isSystem ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">System</span>
                        ) : (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Custom</span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditRole(r)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                            title="Edit role details"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!isSystem && (
                            <button
                              onClick={() => handleDeleteRole(r)}
                              disabled={r.user_count > 0}
                              className={`p-1 rounded transition ${
                                r.user_count > 0 
                                  ? 'text-slate-200 cursor-not-allowed' 
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={r.user_count > 0 ? 'Cannot delete role with assigned users' : 'Delete role'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                      {r.description || 'No description specified for this security role.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">{r.slug}</span>
                    <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      {r.user_count || 0} {(r.user_count || 0) === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Organizational Departments</h2>
              <p className="text-xs text-slate-500">Group personnel by business function, warehouse terminal, or sales division.</p>
            </div>
            {isAdmin && (
              <button
                onClick={handleOpenAddDept}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={14} />
                <span>Add Department</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(d => (
              <div key={d.id || d.name} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{d.name}</h3>
                        {d.code && (
                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">
                            {d.code}
                          </span>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditDept(d)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                          title="Edit department"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteDept(d)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Delete department"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                    {d.description || 'Organizational operational division.'}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Assigned Staff</span>
                  <span className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                    {d.user_count || 0} {(d.user_count || 0) === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UserManagementModal */}
      <UserManagementModal
        user={selectedUserForEdit}
        isOpen={Boolean(selectedUserForEdit)}
        initialTab={modalInitialTab}
        onClose={() => setSelectedUserForEdit(null)}
        onSuccess={loadAllData}
      />

      {/* Add New User Modal */}
      {showAddModal && isAdmin && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Create New System User</h2>
                  <p className="text-[11px] text-slate-500">Register new staff account with role and department assignment</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  >
                    {roles.length > 0 ? (
                      roles.map(r => (
                        <option key={r.id || r.slug} value={r.slug}>{r.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="staff">Staff Member</option>
                        <option value="admin">Administrator</option>
                        <option value="supplier">Supplier Vendor</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  >
                    <option value="">-- None --</option>
                    {departments.map(d => (
                      <option key={d.id || d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
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

      {/* Add/Edit Role Modal */}
      {showRoleModal && isAdmin && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRoleModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingRole ? 'Edit Security Role' : 'Create Custom Role'}
                  </h2>
                  <p className="text-[11px] text-slate-500">Configure role name, identifier slug, and theme accent</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Role Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Inventory Supervisor"
                  value={roleFormData.name}
                  onChange={e => {
                    const val = e.target.value;
                    const autoSlug = val.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
                    setRoleFormData({
                      ...roleFormData,
                      name: val,
                      slug: editingRole ? roleFormData.slug : autoSlug
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Role Slug / Identifier
                </label>
                <input
                  disabled={Boolean(editingRole)}
                  required
                  type="text"
                  placeholder="e.g. inventory_supervisor"
                  value={roleFormData.slug}
                  onChange={e => setRoleFormData({ ...roleFormData, slug: e.target.value })}
                  className={`w-full px-3.5 py-2 border rounded-xl text-xs font-mono transition ${
                    editingRole 
                      ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-white border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Unique identifier used in backend permissions</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Badge Color Theme
                </label>
                <select
                  value={roleFormData.color}
                  onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                >
                  <option value="indigo">Indigo / Royal Blue</option>
                  <option value="blue">Cyan / Classic Blue</option>
                  <option value="emerald">Emerald / Forest Green</option>
                  <option value="amber">Amber / Warm Gold</option>
                  <option value="rose">Rose / Coral Red</option>
                  <option value="purple">Purple / Violet</option>
                  <option value="slate">Slate / Neutral Gray</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Description / Responsibilities
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe operational responsibilities and clearances..."
                  value={roleFormData.description}
                  onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  disabled={isSavingRole}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRole}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isSavingRole ? 'Saving Role...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Department Modal */}
      {showDeptModal && isAdmin && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeptModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingDept ? 'Edit Department' : 'Add Department'}
                  </h2>
                  <p className="text-[11px] text-slate-500">Define department name, short code, and purpose</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeptModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Department Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Warehouse & Logistics"
                  value={deptFormData.name}
                  onChange={e => {
                    const val = e.target.value;
                    const autoCode = val.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setDeptFormData({
                      ...deptFormData,
                      name: val,
                      code: editingDept ? deptFormData.code : autoCode
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Department Code
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  placeholder="e.g. WH"
                  value={deptFormData.code}
                  onChange={e => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Short abbreviation (up to 6 letters)</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Description / Operational Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the department's operational scope..."
                  value={deptFormData.description}
                  onChange={e => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  disabled={isSavingDept}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDept}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSavingDept ? 'Saving Department...' : editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
