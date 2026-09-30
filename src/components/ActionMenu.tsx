import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, UserX, UserCheck, Trash2, Loader2, Eye, ShieldCheck, Sliders, User } from 'lucide-react';
import { suspendUser, reactivateUser, deleteUser as deleteAdminUser } from '../lib/adminApi';
import { fetchApi, ApiError } from '../lib/api';
import { useNotifications } from '../context/NotificationContext';

export interface ActionMenuItemUser {
  id: number | string;
  name: string;
  email: string;
  role: string;
  is_active?: number;
  profile_picture?: string | null;
  created_at?: string;
  created_by?: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  force_password_reset?: number;
  session_revoked_at?: string | null;
}

interface ActionMenuProps {
  user: ActionMenuItemUser;
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  onManage?: (user: ActionMenuItemUser) => void;
  onView?: (user: ActionMenuItemUser) => void;
  onSecurity?: (user: ActionMenuItemUser) => void;
  onEdit?: (user: ActionMenuItemUser) => void;
  onSuccess?: () => void;
  onToggleStatus?: (user: ActionMenuItemUser) => Promise<void> | void;
  onDelete?: (user: ActionMenuItemUser) => Promise<void> | void;
  isPrimaryAdmin?: boolean;
  isAdmin?: boolean;
  disabled?: boolean;
}

export default function ActionMenu({
  user,
  isOpen: controlledIsOpen,
  onToggleOpen,
  onManage,
  onView,
  onSecurity,
  onEdit,
  onSuccess,
  onToggleStatus,
  onDelete,
  isPrimaryAdmin = false,
  isAdmin = true,
  disabled = false
}: ActionMenuProps) {
  const { addToast } = useNotifications();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isMenuOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [isProcessing, setIsProcessing] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; bottom: number; right: number; openUpward: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isActive = user.is_active === 1 || user.is_active === undefined;

  const setOpenState = (open: boolean) => {
    if (onToggleOpen) {
      onToggleOpen(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 155;

    const top = rect.bottom + 4;
    const bottom = window.innerHeight - rect.top + 4;
    const right = Math.max(10, window.innerWidth - rect.right);

    setMenuCoords({ top, bottom, right, openUpward });
  };

  useEffect(() => {
    if (isMenuOpen) {
      updateMenuPosition();
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpenState(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenState(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isMenuOpen) {
        updateMenuPosition();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isMenuOpen]);

  if (disabled) {
    return null;
  }

  const handleThreeDotsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMenuOpen) {
      updateMenuPosition();
      setOpenState(true);
    } else {
      setOpenState(false);
    }
  };

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenState(false);
    if (onManage) {
      onManage(user);
    } else if (onEdit) {
      onEdit(user);
    } else if (onView) {
      onView(user);
    }
  };

  const handleToggleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenState(false); // Hide the three dots menu
    const actionLabel = isActive ? 'suspend' : 'activate';
    
    if (!confirm(`Are you sure you want to ${actionLabel} user "${user.name}" (${user.email})?`)) {
      return;
    }

    setIsProcessing(true);

    try {
      if (onToggleStatus) {
        await onToggleStatus(user);
      } else {
        try {
          if (isActive) {
            await suspendUser(user.id);
          } else {
            await reactivateUser(user.id);
          }
        } catch (edgeErr: any) {
          console.warn('[ActionMenu] adminApi status edge function note:', edgeErr.message);
          if (edgeErr instanceof ApiError && edgeErr.status === 403) {
            throw edgeErr;
          }
        }

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

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenState(false); // Hide the three dots menu
    if (isPrimaryAdmin || user.email === 'rabbi@ummis.com' || user.email === 'admin@admin.com') {
      alert('Security Policy: The primary administrator account cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email})? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);

    try {
      if (onDelete) {
        await onDelete(user);
      } else {
        try {
          await deleteAdminUser(user.id);
        } catch (edgeErr: any) {
          console.warn('[ActionMenu] adminApi delete edge function note:', edgeErr.message);
          if (edgeErr instanceof ApiError && edgeErr.status === 403) {
            throw edgeErr;
          }
        }

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
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleThreeDotsClick}
        disabled={isProcessing}
        className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 cursor-pointer ${
          isMenuOpen ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title={`Actions for ${user.name}`}
        aria-expanded={isMenuOpen}
      >
        {isProcessing ? (
          <Loader2 size={16} className="animate-spin text-blue-600" />
        ) : (
          <MoreVertical size={16} />
        )}
      </button>

      {isMenuOpen && menuCoords && (
        <div 
          ref={menuRef}
          style={menuCoords.openUpward 
            ? { bottom: `${menuCoords.bottom}px`, right: `${menuCoords.right}px` }
            : { top: `${menuCoords.top}px`, right: `${menuCoords.right}px` }
          }
          className={`fixed w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-[9999] divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100 ${
            menuCoords.openUpward ? 'origin-bottom-right' : 'origin-top-right'
          }`}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Active Target User Header Card */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
            <div className="text-xs font-black text-slate-900 truncate">{user.name}</div>
            <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
          </div>

          {/* View Profile Action */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleManageClick}
              className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
              role="menuitem"
            >
              <User size={15} className="text-blue-600 shrink-0" />
              <div>
                <span className="block font-bold">View Profile</span>
                <span className="block text-[10px] text-slate-400 font-normal">
                  Account details, role & security
                </span>
              </div>
            </button>
          </div>

          {isAdmin && (
            <div className="py-1">
              <button
                type="button"
                onClick={handleToggleStatusClick}
                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                role="menuitem"
              >
                {isActive ? (
                  <>
                    <UserX size={14} className="text-amber-600 shrink-0" />
                    <span className="text-amber-700 font-bold">Suspend Account</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-bold">Reactivate Account</span>
                  </>
                )}
              </button>
            </div>
          )}

          {isAdmin && !isPrimaryAdmin && (
            <div className="py-1">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                role="menuitem"
              >
                <Trash2 size={14} className="shrink-0 text-rose-600" />
                <span className="font-bold">Delete Account</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
