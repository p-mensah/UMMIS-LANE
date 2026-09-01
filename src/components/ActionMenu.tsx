import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, UserX, UserCheck, Trash2, Loader2 } from 'lucide-react';
import { suspendUser, reactivateUser, deleteUser as deleteAdminUser } from '../lib/adminApi';
import { fetchApi, ApiError } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';

export interface ActionMenuItemUser {
  id: number | string;
  name: string;
  email: string;
  role: string;
  is_active?: number;
}

interface ActionMenuProps {
  user: ActionMenuItemUser;
  onEdit?: (user: ActionMenuItemUser) => void;
  onSuccess?: () => void;
  onToggleStatus?: (user: ActionMenuItemUser) => Promise<void> | void;
  onDelete?: (user: ActionMenuItemUser) => Promise<void> | void;
  isPrimaryAdmin?: boolean;
  disabled?: boolean;
}

export default function ActionMenu({
  user,
  onEdit,
  onSuccess,
  onToggleStatus,
  onDelete,
  isPrimaryAdmin = false,
  disabled = false
}: ActionMenuProps) {
  const { addToast } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isActive = user.is_active === 1 || user.is_active === undefined;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (disabled) {
    return null;
  }

  const handleEditClick = () => {
    console.log('[ActionMenu] Triggering Edit for user:', user.email);
    setIsOpen(false);
    if (onEdit) {
      onEdit(user);
    }
  };

  const handleToggleStatusClick = async () => {
    setIsOpen(false);
    const actionLabel = isActive ? 'suspend' : 'activate';
    
    if (!confirm(`Are you sure you want to ${actionLabel} user "${user.name}" (${user.email})?`)) {
      return;
    }

    console.log(`[ActionMenu] Attempting to ${actionLabel} user:`, { id: user.id, email: user.email });
    setIsProcessing(true);

    try {
      if (onToggleStatus) {
        await onToggleStatus(user);
      } else {
        // Direct execution of adminApi functions
        try {
          if (isActive) {
            console.log('[ActionMenu] Calling suspendUser adminApi...');
            await suspendUser(user.id);
          } else {
            console.log('[ActionMenu] Calling reactivateUser adminApi...');
            await reactivateUser(user.id);
          }
        } catch (edgeErr: any) {
          console.warn('[ActionMenu] adminApi status edge function note:', edgeErr.message);
          if (edgeErr instanceof ApiError && edgeErr.status === 403) {
            throw edgeErr;
          }
        }

        // Update backend database
        await fetchApi(`/users/${user.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !isActive })
        });

        addToast({
          title: `Account ${isActive ? 'Suspended' : 'Activated'}`,
          message: `User ${user.name} is now ${isActive ? 'suspended' : 'active'}.`,
          type: isActive ? 'warning' : 'success'
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      console.error(`[ActionMenu] Error during ${actionLabel} user:`, err);
      const is403 = 
        err?.status === 403 || 
        err?.message?.includes('403') || 
        err?.message?.toLowerCase().includes('forbidden') || 
        err?.message?.toLowerCase().includes('not authorized');

      const message = is403
        ? `403 Forbidden: Administrator permissions are required to ${actionLabel} users.`
        : (err?.message || `Failed to ${actionLabel} user.`);

      addToast({
        title: is403 ? 'Access Forbidden (403)' : 'Action Failed',
        message,
        type: 'danger',
        duration: is403 ? 8000 : 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = async () => {
    setIsOpen(false);
    if (isPrimaryAdmin || user.email === 'rabbi@ummis.com' || user.email === 'admin@admin.com') {
      alert('Security Policy: The primary administrator account cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email})? This action cannot be undone.`)) {
      return;
    }

    console.log('[ActionMenu] Attempting to delete user:', { id: user.id, email: user.email });
    setIsProcessing(true);

    try {
      if (onDelete) {
        await onDelete(user);
      } else {
        // Direct execution of adminApi deleteUser function
        try {
          console.log('[ActionMenu] Calling deleteUser adminApi...');
          await deleteAdminUser(user.id);
        } catch (edgeErr: any) {
          console.warn('[ActionMenu] adminApi delete edge function note:', edgeErr.message);
          if (edgeErr instanceof ApiError && edgeErr.status === 403) {
            throw edgeErr;
          }
        }

        // Delete from backend database
        await fetchApi(`/users/${user.id}`, {
          method: 'DELETE'
        });

        addToast({
          title: 'User Deleted',
          message: `Account for ${user.email} was removed permanently.`,
          type: 'info'
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      console.error('[ActionMenu] Error deleting user:', err);
      const is403 = 
        err?.status === 403 || 
        err?.message?.includes('403') || 
        err?.message?.toLowerCase().includes('forbidden') || 
        err?.message?.toLowerCase().includes('not authorized');

      const message = is403
        ? '403 Forbidden: Administrator permissions are required to delete user accounts.'
        : (err?.message || 'Failed to delete user.');

      addToast({
        title: is403 ? 'Access Forbidden (403)' : 'Delete Failed',
        message,
        type: 'danger',
        duration: is403 ? 8000 : 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isProcessing}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        title="More user actions"
        aria-expanded={isOpen}
      >
        {isProcessing ? (
          <Loader2 size={16} className="animate-spin text-blue-600" />
        ) : (
          <MoreVertical size={16} />
        )}
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
          role="menu"
        >
          <div className="py-1">
            <button
              type="button"
              onClick={handleEditClick}
              className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
              role="menuitem"
            >
              <Edit2 size={14} className="text-blue-600 shrink-0" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={handleToggleStatusClick}
              className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              role="menuitem"
            >
              {isActive ? (
                <>
                  <UserX size={14} className="text-amber-600 shrink-0" />
                  <span className="text-amber-700">Suspend</span>
                </>
              ) : (
                <>
                  <UserCheck size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-emerald-700">Activate</span>
                </>
              )}
            </button>
          </div>

          {!isPrimaryAdmin && (
            <div className="py-1">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                role="menuitem"
              >
                <Trash2 size={14} className="shrink-0" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
