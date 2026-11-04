import { useState, useEffect, useCallback } from 'react';
import { getOfflineMetrics, syncAllOfflineData } from '../lib/offlineStore';

export interface NetworkStatus {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  pendingSalesCount: number;
  pendingAdjustmentsCount: number;
  totalPendingCount: number;
  cachedProductsCount: number;
  lastChecked: Date;
  checkConnection: () => Promise<boolean>;
  triggerSync: () => Promise<any>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState<boolean>(false);
  const [pendingSalesCount, setPendingSalesCount] = useState<number>(0);
  const [pendingAdjustmentsCount, setPendingAdjustmentsCount] = useState<number>(0);
  const [totalPendingCount, setTotalPendingCount] = useState<number>(0);
  const [cachedProductsCount, setCachedProductsCount] = useState<number>(0);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const refreshMetrics = useCallback(async () => {
    try {
      const metrics = await getOfflineMetrics();
      setPendingSalesCount(metrics.pendingSalesCount);
      setPendingAdjustmentsCount(metrics.pendingAdjustmentsCount);
      setTotalPendingCount(metrics.totalPendingCount);
      setCachedProductsCount(metrics.cachedProductsCount);
    } catch {
      // Non-fatal if IndexedDB is warming up
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      setIsServiceWorkerReady(Boolean(navigator.serviceWorker.controller));
    }
    setLastChecked(new Date());
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined') return true;
    if (!navigator.onLine) {
      setIsOnline(false);
      await refreshMetrics();
      return false;
    }

    try {
      // Ping lightweight health endpoint with cache-busting timestamp
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`/api/health?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(async () => {
        // Fallback ping to root manifest
        return await fetch(`/manifest.json?t=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });
      });
      clearTimeout(timeoutId);

      const online = res.ok || res.status < 500;
      setIsOnline(online);
      await refreshMetrics();
      return online;
    } catch {
      setIsOnline(false);
      await refreshMetrics();
      return false;
    }
  }, [refreshMetrics]);

  const triggerSync = useCallback(async () => {
    const result = await syncAllOfflineData();
    await refreshMetrics();
    return result;
  }, [refreshMetrics]);

  useEffect(() => {
    refreshMetrics();

    const handleOnline = () => {
      setIsOnline(true);
      refreshMetrics();
      window.dispatchEvent(new CustomEvent('app-connectivity-changed', { detail: { online: true } }));
      // Automatically trigger sync upon network reconnection
      setTimeout(() => {
        triggerSync().catch(() => {});
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshMetrics();
      window.dispatchEvent(new CustomEvent('app-connectivity-changed', { detail: { online: false } }));
    };

    const handleQueueUpdate = () => {
      refreshMetrics();
    };

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'OFFLINE_QUEUE_UPDATED' || event.data.type === 'OFFLINE_SYNC_COMPLETED')) {
        refreshMetrics();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-queue-updated', handleQueueUpdate);
    window.addEventListener('offline-adjustments-queue-updated', handleQueueUpdate);
    window.addEventListener('offline-sync-queue-updated', handleQueueUpdate);
    window.addEventListener('offline-sync-completed', handleQueueUpdate);

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshMetrics();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-queue-updated', handleQueueUpdate);
      window.removeEventListener('offline-adjustments-queue-updated', handleQueueUpdate);
      window.removeEventListener('offline-sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('offline-sync-completed', handleQueueUpdate);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      clearInterval(interval);
    };
  }, [refreshMetrics, triggerSync]);

  return {
    isOnline,
    isServiceWorkerReady,
    pendingSalesCount,
    pendingAdjustmentsCount,
    totalPendingCount,
    cachedProductsCount,
    lastChecked,
    checkConnection,
    triggerSync,
  };
}
