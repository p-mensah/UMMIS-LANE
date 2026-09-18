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

interface NotificationContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
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

  const addToast = (toastData: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toastData, id };
    setToasts(prev => [newToast, ...prev.slice(0, 4)]); // Max 5 active toasts
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const data = await fetchApi('/notifications');
      const items: NotificationItem[] = data.notifications || [];
      const unread = data.unread_count || 0;

      setNotifications(items);
      setUnreadCount(unread);

      if (items.length > 0) {
        const highestId = Math.max(...items.map(n => n.id));

        if (lastSeenIdRef.current === null) {
          // Initial baseline load - don't trigger toasts for historical entries
          lastSeenIdRef.current = highestId;
        } else if (highestId > lastSeenIdRef.current) {
          // Detect brand new notifications since last check!
          const newItems = items.filter(n => n.id > (lastSeenIdRef.current || 0) && n.is_read === 0);
          
          for (const item of newItems) {
            addToast({
              title: item.title,
              message: item.message,
              type: item.type,
              link: item.link || undefined,
              duration: 6000
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
    const interval = setInterval(refreshNotifications, 6000); // Poll every 6s for real-time alerts
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
