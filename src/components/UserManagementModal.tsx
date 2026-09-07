import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Mail, AlertCircle, Loader2, KeyRound, Eye, EyeOff, 
  Camera, Upload, Sparkles, CheckCircle2, ShieldAlert,
  Clock, LogOut, ShieldCheck, Copy, Check, Calendar, Globe
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

export default function UserManagementModal({
  user,
  isOpen,
  initialTab = 'profile',
  onClose,
  onSuccess
}: UserManagementModalProps) {
  const { addToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | 'supplier'>('staff');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  // Security fields
  const [forcePassword, setForcePassword] = useState('');
  const [showForcePassword, setShowForcePassword] = useState(false);
  const [requireChangeOnLogin, setRequireChangeOnLogin] = useState(false);
  const [revokeSessionsOnReset, setRevokeSessionsOnReset] = useState(true);
  const [isForcingReset, setIsForcingReset] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll lock & Escape key dismissal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

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
      setEmailCopied(false);
      setPasswordCopied(false);
    }
  }, [user, isOpen, initialTab]);

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
    setTimeout(() => setPasswordCopied(false), 2500);
    addToast({
      title: 'Strong Password Generated',
      message: 'Generated password copied to clipboard.',
      type: 'info'
    });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user.email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  // Handle general profile submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      try {
        await assignRole(user.id, role, { name: name.trim() });
      } catch (edgeErr: any) {
        if (edgeErr instanceof ApiError && edgeErr.status === 403) {
          throw edgeErr;
        }
      }

      const payload = {
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
        message: `Profile changes saved for ${user.email}.`,
        type: 'success'
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const is403 = 
        err?.status === 403 || 
        err?.message?.includes('403') || 
        err?.message?.toLowerCase().includes('forbidden') || 
        err?.message?.toLowerCase().includes('permission');

      const message = is403
        ? '403 Forbidden: Administrator clearance required to modify user profiles.'
        : (err?.message || 'Failed to update user profile.');

      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Password Reset
  const handleForcePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forcePassword.trim()) {
      setErrorMessage('Please enter a new password or click Generate to create one.');
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

      setSuccessMessage(`Password successfully updated for ${user.name}.`);
      addToast({
        title: 'Password Updated',
        message: `New password applied for ${user.email}.`,
        type: 'success'
      });

      setForcePassword('');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setIsForcingReset(false);
    }
  };

  // Handle Revoke Sessions
  const handleRevokeSessions = async () => {
    if (!confirm(`Revoke all active sessions for ${user.name} (${user.email})? They will be signed out from all devices immediately.`)) {
      return;
    }

    setIsRevokingSessions(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await fetchApi(`/users/${user.id}/revoke-sessions`, {
        method: 'POST'
      });

      setSuccessMessage(`All active sessions for ${user.name} have been revoked.`);
      addToast({
        title: 'Sessions Revoked',
        message: `User ${user.email} signed out from all active sessions.`,
        type: 'warning'
      });

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke sessions.');
    } finally {
      setIsRevokingSessions(false);
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
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

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            Administrator
          </span>
        );
      case 'supplier':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Supplier Vendor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            Staff Member
          </span>
        );
    }
  };

  const isActive = user.is_active !== 0;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[999] overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-2.5rem)] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900">View Profile</h2>
            <p className="text-[11px] text-slate-500">Account overview, system role, and access credentials</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            title="Close view (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (Flat, card-free text tabs) */}
        <div className="shrink-0 flex border-b border-slate-200 bg-white px-6">
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
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound size={15} />
            <span>Security & Access</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="shrink-0 mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="shrink-0 mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
            <span className="font-medium leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Modal Body (Scrollable and Card-Free) */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
          {activeTab === 'profile' ? (
            /* TAB 1: Profile Details (No Cards) */
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              
              {/* Identity & Avatar Section */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                <div className="relative group shrink-0">
                  {profilePicture ? (
                    <img 
                      src={profilePicture} 
                      alt={user.name} 
                      className="w-16 h-16 rounded-full object-cover border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xl uppercase">
                      {name?.charAt(0) || user.name?.charAt(0) || 'U'}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Change profile photo"
                  >
                    <Camera size={16} />
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {name || user.name}
                    </h3>
                    {getRoleBadge(role)}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isActive ? 'Active' : 'Suspended'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-mono text-xs">{user.email}</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition"
                      title="Copy email"
                    >
                      {emailCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* Photo Actions */}
                  <div className="flex items-center gap-2 pt-0.5">
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
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Change Photo
                    </button>
                    {profilePicture && (
                      <>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setProfilePicture(null)}
                          className="text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          Remove Photo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Editable Fields (Flat Layout) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="User full display name"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    disabled
                    type="email"
                    value={user.email}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Assigned Security Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  >
                    <option value="staff">Staff Member (POS transactions & inventory access)</option>
                    <option value="admin">Administrator (Full system controls & user management)</option>
                    <option value="supplier">Supplier Vendor (Vendor portal & purchase order access)</option>
                  </select>
                </div>
              </div>

              {/* Account Provenance Metadata (Card-Free list) */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-slate-600 py-1">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Calendar size={13} className="text-slate-400" /> Member Since:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatDateTime(user.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 py-1">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock size={13} className="text-slate-400" /> Last Sign In:
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(user.last_login_at)}
                    </span>
                    {user.last_login_ip && (
                      <span className="font-mono text-[10px] text-slate-400 ml-1.5">
                        ({user.last_login_ip})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Button for Profile */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: Security & Credentials (No Cards) */
            <div className="space-y-6">
              
              {/* Password Reset Section */}
              <div className="space-y-3 pb-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Password Management
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assign a new password or generate a secure credential
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="px-2.5 py-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sparkles size={13} />
                    <span>Generate Strong</span>
                  </button>
                </div>

                <form onSubmit={handleForcePasswordReset} className="space-y-3 pt-1">
                  <div className="relative">
                    <input
                      type={showForcePassword ? 'text' : 'password'}
                      placeholder="Enter new password (minimum 6 characters)"
                      value={forcePassword}
                      onChange={e => setForcePassword(e.target.value)}
                      className="w-full pl-3.5 pr-20 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
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
                          title="Copy password"
                        >
                          {passwordCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowForcePassword(!showForcePassword)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded"
                        title={showForcePassword ? 'Hide password' : 'Show password'}
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
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Require user to change password at next sign in</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={revokeSessionsOnReset}
                        onChange={e => setRevokeSessionsOnReset(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Revoke all existing sessions immediately</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isForcingReset || !forcePassword}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isForcingReset ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Apply New Password</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Active Sessions Revocation Section (Card-Free) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Active Device Sessions
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Invalidate access tokens and force sign-out across all devices
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRevokeSessions}
                    disabled={isRevokingSessions}
                    className="px-3.5 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {isRevokingSessions ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <LogOut size={13} />
                    )}
                    <span>Revoke All Sessions</span>
                  </button>
                </div>

                {user.session_revoked_at && (
                  <div className="text-[11px] text-slate-500 pt-1">
                    Last session invalidation: <span className="font-semibold text-slate-700">{formatDateTime(user.session_revoked_at)}</span>
                  </div>
                )}
              </div>

              {/* Close Button for Security Tab */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Close View
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
