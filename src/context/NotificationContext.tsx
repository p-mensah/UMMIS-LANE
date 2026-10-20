import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { fetchApi } from '../lib/api';
import ToastContainer, { Toast } from '../components/ToastContainer';
import ConfirmModal, { ConfirmDialogOptions } from '../components/ConfirmModal';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  link?: string;
  is_read: number;
  created_at: string;
}

export type ToastInput = 
  | string 
  | {
      title?: string;
      message?: string;
      type?: 'info' | 'warning' | 'danger' | 'error' | 'success';
      link?: string;
      duration?: number;
      [key: string]: any;
    };

interface NotificationContextType {
  toasts: Toast[];
  addToast: (
    toastOrMessage: ToastInput, 
    typeOrOptions?: 'info' | 'warning' | 'danger' | 'error' | 'success' | { duration?: number; link?: string; title?: string }
  ) => void;
  removeToast: (id: string) => void;
  confirmModal: (options: ConfirmDialogOptions) => Promise<boolean>;
  notifications: NotificationItem[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenIdRef = useRef<number | null>(null);
  const toastedNotificationIdsRef = useRef<Set<number>>(new Set());
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  // Modal confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    options: ConfirmDialogOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirmModal = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ options, resolve });
    });
  };

  const handleConfirmAction = () => {
    if (confirmDialog) {
      confirmDialog.resolve(true);
      setConfirmDialog(null);
    }
  };

  const handleCancelAction = () => {
    if (confirmDialog) {
      confirmDialog.resolve(false);
      setConfirmDialog(null);
    }
  };

  /**
   * Professional, deduplicated toast dispatcher.
   * Defers state update outside synchronous render frame (preventing React setState in render warning).
   */
  const addToast = (
    toastOrMessage: ToastInput, 
    typeOrOptions?: 'info' | 'warning' | 'danger' | 'error' | 'success' | { duration?: number; link?: string; title?: string }
  ) => {
    let title: string | undefined;
    let message = '';
    let type: 'info' | 'warning' | 'danger' | 'success' = 'info';
    let link: string | undefined;
    let duration = 4000;

    if (typeof toastOrMessage === 'string') {
      message = toastOrMessage;
      if (typeof typeOrOptions === 'string') {
        type = typeOrOptions === 'error' ? 'danger' : typeOrOptions;
      } else if (typeOrOptions && typeof typeOrOptions === 'object') {
        duration = typeOrOptions.duration || 4000;
        link = typeOrOptions.link;
        title = typeOrOptions.title;
      }
    } else if (toastOrMessage && typeof toastOrMessage === 'object') {
      message = toastOrMessage.message || toastOrMessage.title || '';
      title = toastOrMessage.title;
      const rawType = toastOrMessage.type || (typeof typeOrOptions === 'string' ? typeOrOptions : 'info');
      type = rawType === 'error' ? 'danger' : (rawType as any);
      link = toastOrMessage.link;
      duration = toastOrMessage.duration || 4000;
    }

    if (!message && !title) return;

    // Deduplicate identical toasts within a 3.5-second window
    const dedupKey = `${type}:${title || ''}:${message.trim().toLowerCase()}`;
    const now = Date.now();
    const lastSeen = recentToastsRef.current.get(dedupKey);
    if (lastSeen && (now - lastSeen) < 3500) {
      return;
    }
    recentToastsRef.current.set(dedupKey, now);

    // Prune stale cache entries
    if (recentToastsRef.current.size > 20) {
      recentToastsRef.current.forEach((time, key) => {
        if (now - time > 10000) recentToastsRef.current.delete(key);
      });
    }

    // Set clean, professional fallback titles if omitted
    if (!title) {
      if (type === 'success') title = 'Success';
      else if (type === 'danger') title = 'Attention';
      else if (type === 'warning') title = 'Notice';
      else title = 'Information';
    }

    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      id,
      title,
      message,
      type,
      link,
      duration
    };

    // Scheduled via setTimeout(0) to strictly avoid React "Cannot update a component while rendering a different component"
    setTimeout(() => {
      // Keep maximum 2 toasts at a time so it never clutters or overwhelms the screen
      setToasts(prev => [newToast, ...prev.slice(0, 1)]);
    }, 0);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const data = await fetchApi('/notifications', { silent: true, sourceHook: 'notifications' });
      const items: NotificationItem[] = data?.notifications || [];
      const unread = data?.unread_count || 0;

      setNotifications(items);
      setUnreadCount(unread);

      if (items.length > 0) {
        const highestId = Math.max(...items.map(n => n.id));

        if (lastSeenIdRef.current === null) {
          // Initial baseline load - mark baseline without popping up historical toast spam
          lastSeenIdRef.current = highestId;
          items.forEach(n => toastedNotificationIdsRef.current.add(n.id));
        } else if (highestId > lastSeenIdRef.current) {
          // Detect genuinely new items since baseline
          const newItems = items.filter(n => n.id > (lastSeenIdRef.current || 0) && n.is_read === 0 && !toastedNotificationIdsRef.current.has(n.id));
          
          for (const item of newItems) {
            toastedNotificationIdsRef.current.add(item.id);
            addToast({
              title: item.title,
              message: item.message,
              type: item.type,
              link: item.link || undefined,
              duration: 5000
            });
          }

          lastSeenIdRef.current = highestId;
        }
      }
    } catch (err) {
      // Silently handle if unauthenticated
    }
  };

  useEffect(() => {
    refreshNotifications();
    // Conservative 30s background poll so users aren't interrupted by constant network toasts
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        confirmModal,
        notifications,
        unreadCount,
        refreshNotifications
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <ConfirmModal
        isOpen={!!confirmDialog}
        options={confirmDialog?.options || null}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
