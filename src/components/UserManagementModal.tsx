import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Shield, User, Mail, AlertCircle, Loader2, KeyRound, Eye, EyeOff, 
  Camera, Upload, Sparkles, RefreshCw, CheckCircle2, ShieldAlert,
  Clock, Globe, LogOut, History, Lock, ShieldCheck, Copy, Check
} from 'lucide-react';
import { assignRole } from '../lib/adminApi';
import { fetchApi, ApiError } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';

export interface UserManagementData {
  id: number | string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'supplier' | string;
  is_active?: number;
  profile_picture?: string | null;
  created_at?: string;
  created_by?: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  force_password_reset?: number;
  session_revoked_at?: string | null;
}

interface UserManagementModalProps {
  user: UserManagementData | null;
  isOpen: boolean;
  initialTab?: 'profile' | 'security';
  onClose: () => void;
  onSuccess: () => void;
}

interface SecurityDetailsData {
  user: any;
  loginHistory: any[];
  securityAuditHistory: any[];
  totalLogins: number;
}

export default function UserManagementModal({
  user,
  isOpen,
  initialTab = 'profile',
  onClose,
  onSuccess
}: UserManagementModalProps) {
  const { addToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile tab fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | 'supplier'>('staff');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Security tab fields
  const [forcePassword, setForcePassword] = useState('');
  const [showForcePassword, setShowForcePassword] = useState(false);
  const [requireChangeOnLogin, setRequireChangeOnLogin] = useState(false);
  const [revokeSessionsOnReset, setRevokeSessionsOnReset] = useState(true);
  const [isForcingReset, setIsForcingReset] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Live security audit details
  const [securityDetails, setSecurityDetails] = useState<SecurityDetailsData | null>(null);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      const validRole = (user.role === 'admin' || user.role === 'supplier' ? user.role : 'staff') as 'admin' | 'staff' | 'supplier';
      setRole(validRole);
      setProfilePicture(user.profile_picture || null);
      setActiveTab(initialTab);
      setForcePassword('');
      setShowForcePassword(false);
      setRequireChangeOnLogin(Boolean(user.force_password_reset));
      setErrorMessage(null);
      setSuccessMessage(null);

      // Load live audit security details
      loadSecurityDetails(user.id);
    }
  }, [user, isOpen, initialTab]);

  const loadSecurityDetails = async (userId: string | number) => {
    setIsLoadingSecurity(true);
    try {
      const data = await fetchApi(`/users/${userId}/security-details`);
      setSecurityDetails(data);
    } catch (err: any) {
      console.warn('Could not fetch security details:', err);
    } finally {
      setIsLoadingSecurity(false);
    }
  };

  if (!isOpen || !user) return null;

  // Handle image upload from file picker
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 2MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setProfilePicture(result);
    };
    reader.readAsDataURL(file);
  };

  // Generate strong random password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForcePassword(pwd);
    setShowForcePassword(true);
    navigator.clipboard.writeText(pwd);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 3000);
    addToast({
      title: 'Strong Password Generated',
      message: 'Password copied to clipboard automatically.',
      type: 'info'
    });
  };

  // Handle general profile submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      // 1. Connect 'Save' action to the 'assign_role' admin edge function if configured
      try {
        await assignRole(user.id, role, { name: name.trim() });
      } catch (edgeErr: any) {
        console.warn('[UserManagementModal] assign_role edge function notice:', edgeErr.message);
        if (edgeErr instanceof ApiError && edgeErr.status === 403) {
          throw edgeErr;
        }
      }

      // 2. Synchronize SQLite backend database
      const payload: any = {
        name: name.trim(),
        role,
        profile_picture: profilePicture
      };

      await fetchApi(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      addToast({
        title: 'Profile Updated',
        message: `Updated profile details and assigned role "${role.toUpperCase()}" for ${user.email}.`,
        type: 'success'
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[UserManagementModal] Error updating user:', err);
      const is403 = 
        err?.status === 403 || 
        err?.message?.includes('403') || 
        err?.message?.toLowerCase().includes('forbidden') || 
        err?.message?.toLowerCase().includes('not authorized') ||
        err?.message?.toLowerCase().includes('permission');

      const message = is403
        ? '403 Forbidden: Administrator permissions are required to assign roles or edit users.'
        : (err?.message || 'Failed to update user details.');

      setErrorMessage(message);

      addToast({
        title: is403 ? 'Access Forbidden (403)' : 'Update Failed',
        message,
        type: 'danger',
        duration: is403 ? 8000 : 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Admin Forced Password Reset
  const handleForcePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forcePassword.trim()) {
      setErrorMessage('Please provide a new password or click Generate to create one.');
      return;
    }
    if (forcePassword.trim().length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsForcingReset(true);

    try {
      await fetchApi(`/users/${user.id}/force-password-reset`, {
        method: 'POST',
        body: JSON.stringify({
          new_password: forcePassword.trim(),
          require_change_on_login: requireChangeOnLogin,
          revoke_existing_sessions: revokeSessionsOnReset
        })
      });

      setSuccessMessage(`Password reset successfully enforced for ${user.name} (${user.email}).`);
      addToast({
        title: 'Password Reset Enforced',
        message: `User must use the new password. All prior sessions were terminated.`,
        type: 'success'
      });

      setForcePassword('');
      loadSecurityDetails(user.id);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to force password reset.');
      addToast({
        title: 'Reset Failed',
        message: err.message || 'Failed to force password reset.',
        type: 'danger'
      });
    } finally {
      setIsForcingReset(false);
    }
  };

  // Handle Revoke Active Sessions
  const handleRevokeSessions = async () => {
    if (!confirm(`Revoke all active login sessions and access tokens for ${user.name} (${user.email})? They will be immediately signed out from all devices.`)) {
      return;
    }

    setIsRevokingSessions(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await fetchApi(`/users/${user.id}/revoke-sessions`, {
        method: 'POST'
      });

      setSuccessMessage(`All active sessions for ${user.name} have been revoked and logged in the Security Audit Trail.`);
      addToast({
        title: 'Sessions Revoked',
        message: `User ${user.email} was terminated from all active sessions.`,
        type: 'warning'
      });

      loadSecurityDetails(user.id);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke active sessions.');
      addToast({
        title: 'Revocation Failed',
        message: err.message || 'Failed to revoke active sessions.',
        type: 'danger'
      });
    } finally {
      setIsRevokingSessions(false);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never recorded';
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="relative">
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt={user.name} 
                  className="w-10 h-10 rounded-full object-cover border border-slate-300 shadow-xs"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase ${
                  user.role === 'admin'
                    ? 'bg-indigo-100 text-indigo-700'
                    : user.role === 'supplier'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">{user.name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  user.role === 'admin' 
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                    : user.role === 'supplier'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {user.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher Header */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={15} />
            <span>Profile & Account</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Security & Sessions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Audit
            </span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <span className="font-medium leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Scrollable Tab Body */}
        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
          {activeTab === 'profile' ? (
            /* TAB 1: Profile & Roles */
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Profile Picture Upload Section */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  User Profile Picture
                </label>
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="relative group shrink-0">
                    {profilePicture ? (
                      <img 
                        src={profilePicture} 
                        alt="Profile Preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg border-2 border-white shadow-xs uppercase">
                        {name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-slate-900/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      title="Upload new picture"
                    >
                      <Camera size={18} />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Upload size={13} />
                        <span>Upload Photo</span>
                      </button>

                      {profilePicture && (
                        <button
                          type="button"
                          onClick={() => setProfilePicture(null)}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-medium transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Supported formats: JPG, PNG, WebP (Max 2MB).
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="User display name"
                    className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Email Address (Account ID)
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    disabled
                    type="email"
                    value={user.email}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Account emails are immutable identifiers.</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Assigned Security Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label 
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition ${
                      role === 'staff' 
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900 ring-1 ring-blue-600' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Staff</span>
                      <input
                        type="radio"
                        name="modal_role"
                        value="staff"
                        checked={role === 'staff'}
                        onChange={() => setRole('staff')}
                        className="text-blue-600 focus:ring-0"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">POS sales & inventory</span>
                  </label>

                  <label 
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition ${
                      role === 'admin' 
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 ring-1 ring-indigo-600' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Admin</span>
                      <input
                        type="radio"
                        name="modal_role"
                        value="admin"
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                        className="text-indigo-600 focus:ring-0"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">Full store control</span>
                  </label>

                  <label 
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition ${
                      role === 'supplier' 
                        ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 ring-1 ring-emerald-600' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Supplier</span>
                      <input
                        type="radio"
                        name="modal_role"
                        value="supplier"
                        checked={role === 'supplier'}
                        onChange={() => setRole('supplier')}
                        className="text-emerald-600 focus:ring-0"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">Vendor PO portal</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: Security, Forced Password Reset, Active Sessions, and Audit Log */
            <div className="space-y-6">
              {/* Force Password Reset Section */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <KeyRound size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Force Password Reset</h3>
                      <p className="text-[10px] text-slate-500">Overrule credentials and establish mandatory password</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Sparkles size={13} />
                    <span>Generate Strong</span>
                  </button>
                </div>

                <form onSubmit={handleForcePasswordReset} className="space-y-3 pt-1">
                  <div className="relative">
                    <input
                      type={showForcePassword ? 'text' : 'password'}
                      placeholder="Enter new forced password"
                      value={forcePassword}
                      onChange={e => setForcePassword(e.target.value)}
                      className="w-full pl-3.5 pr-20 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      {forcePassword && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(forcePassword);
                            setPasswordCopied(true);
                            setTimeout(() => setPasswordCopied(false), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          title="Copy to clipboard"
                        >
                          {passwordCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowForcePassword(!showForcePassword)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded"
                      >
                        {showForcePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={requireChangeOnLogin}
                        onChange={e => setRequireChangeOnLogin(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Require user to change password at next login</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={revokeSessionsOnReset}
                        onChange={e => setRevokeSessionsOnReset(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Revoke all existing sessions immediately</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isForcingReset || !forcePassword}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isForcingReset ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Applying Reset & Logging...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={13} />
                        <span>Enforce Password Reset</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Revoke Active Sessions Section */}
              <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                      <LogOut size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-rose-900">Active Session Revocation</h3>
                      <p className="text-[10px] text-rose-700">Invalidate active JWT tokens and force immediate sign-out</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRevokeSessions}
                    disabled={isRevokingSessions}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-500/20 disabled:opacity-50 shrink-0"
                  >
                    {isRevokingSessions ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ShieldAlert size={13} />
                    )}
                    <span>Revoke All Sessions</span>
                  </button>
                </div>

                <div className="text-[11px] text-rose-800 bg-white/70 p-2.5 rounded-xl border border-rose-100 flex items-center justify-between">
                  <span>Last Session Invalidation:</span>
                  <span className="font-mono font-bold">
                    {formatDateTime(securityDetails?.user?.session_revoked_at || user.session_revoked_at || null)}
                  </span>
                </div>
              </div>

              {/* Audit Log Handled Login & Origin Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <History size={15} className="text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-900">Audit Security Log Trail</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSecurityDetails(user.id)}
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={isLoadingSecurity ? 'animate-spin' : ''} />
                    <span>Refresh Logs</span>
                  </button>
                </div>

                {/* Grid of Verified Audit Stats */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Clock size={11} /> Last Login (Audit Verified)
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      {formatDateTime(securityDetails?.user?.last_login_at || user.last_login_at || null)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      IP: <span className="font-mono">{securityDetails?.user?.last_login_ip || user.last_login_ip || 'Local Network'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <ShieldCheck size={11} /> Created Date (Audit Genesis)
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      {formatDateTime(securityDetails?.user?.created_at || user.created_at || null)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      By: <span className="font-semibold text-slate-700">{securityDetails?.user?.created_by || user.created_by || 'Store Admin'}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Login Audit Records */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Recent Security Audit Events ({securityDetails?.securityAuditHistory?.length || 0})</span>
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-extrabold border border-emerald-200">Live Sync</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {isLoadingSecurity ? (
                      <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                        <span>Querying audit security log...</span>
                      </div>
                    ) : securityDetails?.securityAuditHistory?.length ? (
                      securityDetails.securityAuditHistory.map((item: any) => (
                        <div key={item.id} className="p-2.5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 text-[11px] truncate flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.action.toLowerCase().includes('failed') || item.action.toLowerCase().includes('blocked')
                                  ? 'bg-rose-500'
                                  : item.action.toLowerCase().includes('revoked') || item.action.toLowerCase().includes('reset')
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                              }`} />
                              <span>{item.action}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.details}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 block">{formatDateTime(item.created_at)}</span>
                            {item.ip_address && (
                              <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                {item.ip_address}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs italic">
                        No security audit logs recorded yet for this account.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
