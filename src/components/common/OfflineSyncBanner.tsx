import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Cloud, CloudOff, X } from 'lucide-react';
import { getOfflineSalesQueue, removeSyncedSale, OfflineSalePayload } from '../../lib/offlineStore';

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingQueue, setPendingQueue] = useState<OfflineSalePayload[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Refresh queue count
  const refreshQueue = useCallback(async () => {
    try {
      const queue = await getOfflineSalesQueue();
      setPendingQueue(queue);
    } catch {
      setPendingQueue([]);
    }
  }, []);

  // Sync pending transactions to server
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    try {
      setIsSyncing(true);
      const queue = await getOfflineSalesQueue();
      if (queue.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      for (const sale of queue) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: sale.items,
              customer_id: sale.customer_id,
              payment_method: sale.payment_method,
              shift_id: sale.shift_id,
              offline_id: sale.id,
              created_at: sale.created_at
            })
          });

          if (res.ok) {
            await removeSyncedSale(sale.id!);
            successCount++;
          }
        } catch (postErr) {
          console.warn('[OfflineSync] Failed to post offline sale:', sale.id, postErr);
          // Stop sequential sync if network drops again
          break;
        }
      }

      await refreshQueue();

      if (successCount > 0) {
        setSyncSuccessMsg(`Successfully synchronized ${successCount} offline ${successCount === 1 ? 'sale' : 'sales'} to store server.`);
        setTimeout(() => setSyncSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('[OfflineSync] Error during synchronization:', err);
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

    // Initial check
    refreshQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-queue-updated', handleQueueUpdated);
    };
  }, [refreshQueue, triggerSync]);

  // Don't show anything if online and no pending sales and no success message
  if (isOnline && pendingQueue.length === 0 && !syncSuccessMsg) {
    return null;
  }

  // If dismissed during offline mode, show a small unobtrusive status pill
  if (isDismissed && !isOnline) {
    return (
      <div className="mb-4 flex items-center justify-between px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 text-xs">
        <div className="flex items-center gap-2">
          <CloudOff size={14} className="text-amber-600 animate-pulse" />
          <span className="font-bold">Offline Resilience Active</span>
          {pendingQueue.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-black text-[10px]">
              {pendingQueue.length} queued
            </span>
          )}
        </div>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-amber-800 underline font-semibold text-[11px] cursor-pointer"
        >
          Expand Details
        </button>
      </div>
    );
  }

  // Success message after sync
  if (isOnline && syncSuccessMsg && pendingQueue.length === 0) {
    return (
      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{syncSuccessMsg}</span>
        </div>
        <button 
          onClick={() => setSyncSuccessMsg(null)}
          className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`mb-4 rounded-xl border p-3 sm:p-4 text-xs shadow-2xs transition-all ${
      !isOnline 
        ? 'bg-amber-50 border-amber-300 text-amber-950' 
        : 'bg-blue-50 border-blue-200 text-blue-950'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            !isOnline ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {!isOnline ? <WifiOff size={18} /> : <Cloud size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm tracking-tight">
                {!isOnline ? 'Intermittent Network / Offline Mode' : 'Offline Sales Pending Auto-Sync'}
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                !isOnline ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
              }`}>
                {!isOnline ? 'IndexedDB Local Cache' : `${pendingQueue.length} Queued`}
              </span>
            </div>
            <p className="mt-1 text-slate-700 text-[11px] leading-relaxed max-w-2xl">
              {!isOnline 
                ? 'Your internet or Wi-Fi connection is currently interrupted. Retail OS is operating in standalone offline mode: product search, barcode scanning, cash checkout, and local receipt printing continue without disruption.'
                : 'Connection restored! You have sales created while disconnected that are stored locally in your browser storage.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {pendingQueue.length > 0 && isOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : `Sync ${pendingQueue.length} Sale${pendingQueue.length > 1 ? 's' : ''}`}</span>
            </button>
          )}

          {!isOnline && (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
              {pendingQueue.length} sale{pendingQueue.length === 1 ? '' : 's'} waiting to sync
            </span>
          )}

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition cursor-pointer"
            title="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
