import React, { useState, useEffect } from 'react';
import { X, Shield, User, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { assignRole } from '../lib/adminApi';
import { fetchApi, ApiError } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';

export interface UserManagementData {
  id: number | string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | string;
  is_active?: number;
}

interface UserManagementModalProps {
  user: UserManagementData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserManagementModal({
  user,
  isOpen,
  onClose,
  onSuccess
}: UserManagementModalProps) {
  const { addToast } = useNotifications();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setRole((user.role === 'admin' ? 'admin' : 'staff') as 'admin' | 'staff');
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    console.log('[UserManagementModal] Saving user changes...', {
      userId: user.id,
      email: user.email,
      name: name.trim(),
      role
    });

    try {
      // 1. Connect 'Save' action to the 'assign_role' admin edge function
      try {
        console.log('[UserManagementModal] Executing assign_role edge function action...');
        await assignRole(user.id, role, { name: name.trim() });
        console.log('[UserManagementModal] assign_role edge function completed successfully.');
      } catch (edgeErr: any) {
        console.warn('[UserManagementModal] assign_role edge function response notice:', edgeErr.message);
        if (edgeErr instanceof ApiError && edgeErr.status === 403) {
          throw edgeErr;
        }
        if (edgeErr.message?.includes('403') || edgeErr.message?.toLowerCase().includes('authorized')) {
          throw edgeErr;
        }
      }

      // 2. Synchronize SQLite backend database
      console.log(`[UserManagementModal] Synchronizing /api/users/${user.id} backend record...`);
      await fetchApi(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), role })
      });
      console.log(`[UserManagementModal] User ${user.id} updated successfully.`);

      addToast({
        title: 'User Updated',
        message: `Assigned role "${role.toUpperCase()}" and updated profile for ${user.email}.`,
        type: 'success'
      });

      // 3. Trigger refresh of the user list upon success
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Management & Role Assignment</h2>
              <p className="text-[11px] text-slate-500">Edit user profile details and access privileges</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              Assign Role (Permissions)
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

          {/* Actions */}
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
