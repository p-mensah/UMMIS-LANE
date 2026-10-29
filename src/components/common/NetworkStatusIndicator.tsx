import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Database, ShieldCheck, Cloud, HardDrive, Info, X } from 'lucide-react';
import { getOfflineSalesQueue, removeSyncedSale, getOfflineMetrics } from '../../lib/offlineStore';

export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swActive, setSwActive] = useState<boolean>(false);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [cachedProductsCount, setCachedProductsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const checkStatus = async () => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
      setSwActive(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller));
    }
    try {
      const metrics = await getOfflineMetrics();
      setPendingQueueCount(metrics.pendingSalesCount);
      setCachedProductsCount(metrics.cachedProductsCount);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkStatus();

    const handleOnline = () => {
      setIsOnline(true);
      checkStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      checkStatus();
    };

    const handleQueueUpdated = () => {
      checkStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-queue-updated', handleQueueUpdated);

    // Close popover on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-queue-updated', handleQueueUpdated);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const queue = await getOfflineSalesQueue();
      if (queue.length === 0) {
        setSyncFeedback('No pending sales in queue.');
        setIsSyncing(false);
        return;
      }

      let synced = 0;
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
            synced++;
          }
        } catch {
          break;
        }
      }
      await checkStatus();
      setSyncFeedback(`Successfully synchronized ${synced} offline ${synced === 1 ? 'sale' : 'sales'}.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback('Sync failed: ' + (err.message || 'Network error'));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Top Nav Status Trigger Button */}
      <button
        type="button"
        onClick={() => setShowPopover(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border cursor-pointer select-none active:scale-95 ${
          isOnline
            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
        }`}
        title={
          isOnline
            ? 'System Online • Connected to Store Server. Service Worker cache ready.'
            : 'System Offline • Working with local cached data in IndexedDB.'
        }
        aria-label="Network and Cache Status"
      >
        <span className="relative flex h-2 w-2">
          {isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </>
          )}
        </span>

        {isOnline ? (
          <Wifi size={13} className="text-emerald-600 hidden xs:inline" />
        ) : (
          <WifiOff size={13} className="text-amber-700" />
        )}

        <span className="hidden sm:inline font-bold">
          {isOnline ? 'Online' : 'Offline'}
        </span>

        {!isOnline && (
          <span className="hidden md:inline text-[10px] text-amber-800 font-medium">
            (Cached)
          </span>
        )}

        {pendingQueueCount > 0 && (
          <span className={`px-1.5 py-0.2 rounded-full font-black text-[10px] ${
            isOnline ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-950'
          }`}>
            {pendingQueueCount}
          </span>
        )}
      </button>

      {/* Floating Detailed Status Popover */}
      {showPopover && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150">
          <div className={`p-4 border-b flex items-center justify-between ${
            isOnline ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">
                  {isOnline ? 'Network Connected' : 'Offline / Intermittent Connection'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isOnline ? 'Direct server connection established' : 'Operating with local browser cache'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-3.5">
            {/* Real-time Status Badges */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Source</div>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <Database size={13} className="text-blue-600" />
                  <span>{isOnline ? 'Live Database' : 'IndexedDB Cache'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Worker</div>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-teal-600" />
                  <span>{swActive ? 'Active & Caching' : 'Registered'}</span>
                </div>
              </div>
            </div>

            {/* Offline Explanation Notice */}
            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
              isOnline
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-amber-50/50 border-amber-200 text-amber-950 font-medium'
            }`}>
              {isOnline ? (
                <span>
                  <strong>Full Online Mode:</strong> All retail operations (transactions, product updates, analytics, and stock adjustments) synchronize instantly with the backend.
                </span>
              ) : (
                <span>
                  <strong>Cached Data Active:</strong> You are currently working with cached catalog data. Product lookup, barcode scanning, cash tender, and receipt issuance remain 100% operational.
                </span>
              )}
            </div>

            {/* Cache & Queue Statistics */}
            <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <HardDrive size={13} className="text-slate-400" />
                  Locally Cached Products
                </span>
                <span className="font-black text-slate-800">{cachedProductsCount} items</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Cloud size={13} className="text-slate-400" />
                  Unsynced Offline Sales
                </span>
                <span className={`font-black ${pendingQueueCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                  {pendingQueueCount} {pendingQueueCount === 1 ? 'sale' : 'sales'}
                </span>
              </div>
            </div>

            {syncFeedback && (
              <div className="p-2.5 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 flex items-center justify-between gap-2">
              {pendingQueueCount > 0 && isOnline && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Synchronizing...' : `Sync ${pendingQueueCount} Sales Now`}</span>
                </button>
              )}

              {(!isOnline || pendingQueueCount === 0) && (
                <div className="w-full text-center text-[10px] text-slate-400 font-medium py-1">
                  {isOnline ? 'All transactions are synchronized.' : 'Sales will auto-sync when connection returns.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
