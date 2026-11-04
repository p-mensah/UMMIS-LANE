import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Cloud, CloudOff, X, SlidersHorizontal, ShoppingCart } from 'lucide-react';
import { getOfflineMetrics, syncAllOfflineData } from '../../lib/offlineStore';

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSalesCount, setPendingSalesCount] = useState<number>(0);
  const [pendingAdjustmentsCount, setPendingAdjustmentsCount] = useState<number>(0);
  const [totalPendingCount, setTotalPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Refresh queue count
  const refreshQueue = useCallback(async () => {
    try {
      const metrics = await getOfflineMetrics();
      setPendingSalesCount(metrics.pendingSalesCount);
      setPendingAdjustmentsCount(metrics.pendingAdjustmentsCount);
      setTotalPendingCount(metrics.totalPendingCount);
    } catch {
      setPendingSalesCount(0);
      setPendingAdjustmentsCount(0);
      setTotalPendingCount(0);
    }
  }, []);

  // Sync pending transactions & adjustments to server
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    try {
      setIsSyncing(true);
      const res = await syncAllOfflineData();
      await refreshQueue();

      if (res.salesSynced > 0 || res.adjustmentsSynced > 0) {
        const parts = [];
        if (res.salesSynced > 0) parts.push(`${res.salesSynced} offline ${res.salesSynced === 1 ? 'sale' : 'sales'}`);
        if (res.adjustmentsSynced > 0) parts.push(`${res.adjustmentsSynced} stock ${res.adjustmentsSynced === 1 ? 'adjustment' : 'adjustments'}`);
        setSyncSuccessMsg(`Successfully synchronized ${parts.join(' and ')} to store server.`);
        setTimeout(() => setSyncSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('[OfflineSyncBanner] Error during synchronization:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false);
      // Auto-sync when internet connectivity is re-established
      setTimeout(() => {
        triggerSync();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
      refreshQueue();
    };

    const handleQueueUpdated = () => {
      refreshQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-queue-updated', handleQueueUpdated);
    window.addEventListener('offline-adjustments-queue-updated', handleQueueUpdated);
    window.addEventListener('offline-sync-queue-updated', handleQueueUpdated);
    window.addEventListener('offline-sync-completed', handleQueueUpdated);

    // Initial check
    refreshQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-queue-updated', handleQueueUpdated);
      window.removeEventListener('offline-adjustments-queue-updated', handleQueueUpdated);
      window.removeEventListener('offline-sync-queue-updated', handleQueueUpdated);
      window.removeEventListener('offline-sync-completed', handleQueueUpdated);
    };
  }, [refreshQueue, triggerSync]);

  // Don't show anything if online and no pending items and no success message
  if (isOnline && totalPendingCount === 0 && !syncSuccessMsg) {
    return null;
  }

  // If dismissed during offline mode, show a small unobtrusive status pill
  if (isDismissed && !isOnline) {
    return (
      <div className="mb-4 flex items-center justify-between px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <CloudOff size={14} className="text-amber-600 animate-pulse" />
          <span className="font-bold">Offline POS & Inventory Active</span>
          {totalPendingCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-black text-[10px]">
              {totalPendingCount} queued
            </span>
          )}
        </div>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-amber-900 underline font-semibold text-[11px] cursor-pointer"
        >
          Expand Details
        </button>
      </div>
    );
  }

  // Success message after sync
  if (isOnline && syncSuccessMsg && totalPendingCount === 0) {
    return (
      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-bold">{syncSuccessMsg}</span>
        </div>
        <button
          onClick={() => setSyncSuccessMsg(null)}
          className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-100 transition cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`mb-4 p-3.5 sm:p-4 rounded-xl border shadow-2xs transition-all ${
      !isOnline 
        ? 'bg-amber-50/90 border-amber-200 text-amber-950' 
        : 'bg-blue-50/90 border-blue-200 text-blue-950'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${
            !isOnline ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {!isOnline ? <WifiOff size={18} /> : <Cloud size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-sm">
                {!isOnline ? 'Intermittent Network / Offline Mode' : 'Offline Transactions Pending Auto-Sync'}
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                !isOnline ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
              }`}>
                {!isOnline ? 'IndexedDB Local Cache' : `${totalPendingCount} Queued`}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              {!isOnline 
                ? 'Store internet disconnected. Sales and inventory adjustments continue without interruption and will auto-sync upon reconnection.' 
                : 'Connection restored. Service Worker is synchronizing queued offline sales and stock adjustments with the store database.'
              }
            </p>
            {totalPendingCount > 0 && (
              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold text-slate-700">
                <span className="flex items-center gap-1">
                  <ShoppingCart size={12} className="text-blue-600" />
                  <span>Pending Sales: <strong>{pendingSalesCount}</strong></span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <SlidersHorizontal size={12} className="text-amber-600" />
                  <span>Pending Adjustments: <strong>{pendingAdjustmentsCount}</strong></span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {totalPendingCount > 0 && isOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Now'}</span>
            </button>
          )}

          {!isOnline && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
              title="Dismiss banner"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
