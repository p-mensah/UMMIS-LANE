import React, { useState } from 'react';
import { WifiOff, RefreshCw, HardDrive, CloudOff, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function GlobalOfflineAlert() {
  const { isOnline, pendingSalesCount, cachedProductsCount, checkConnection } = useNetworkStatus();
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If online, do not render the offline indicator
  if (isOnline) {
    return null;
  }

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      await checkConnection();
    } finally {
      setIsChecking(false);
    }
  };

  // If dismissed temporarily, display a persistent compact floating badge in bottom-left
  if (isDismissed) {
    return (
      <div 
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xl border border-amber-400 text-xs font-bold cursor-pointer transition animate-bounce select-none"
        title="Click to view offline register details and synchronization queue"
      >
        <WifiOff size={14} className="animate-pulse" />
        <span>You are Offline</span>
        {pendingSalesCount > 0 && (
          <span className="px-1.5 py-0.2 bg-amber-900 text-amber-100 rounded-full text-[10px] font-black">
            {pendingSalesCount} queued
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      role="status"
      aria-live="polite"
      className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-3 sm:px-5 py-2.5 shadow-md border-b border-amber-600/50 flex flex-col sm:flex-row items-center justify-between gap-2 z-40 transition-all select-none print:hidden"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
          <WifiOff size={16} className="text-amber-100 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-xs tracking-wide uppercase bg-black/25 px-2 py-0.5 rounded text-amber-100">
              You Are Offline
            </span>
            <span className="font-semibold text-xs text-white">
              Retail OS is operating in Offline Mode with cached data.
            </span>
          </div>
          <p className="text-[11px] text-amber-100/95 leading-tight truncate sm:whitespace-normal">
            Product search, barcode scanning, cash register sales, and receipt printing remain 100% operational.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {/* Cached status pills */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold bg-black/20 px-2.5 py-1 rounded-lg">
          <HardDrive size={12} className="text-amber-200" />
          <span>{cachedProductsCount} items cached</span>
        </div>

        {pendingSalesCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-900/80 px-2.5 py-1 rounded-lg text-amber-200 border border-amber-400/30">
            <CloudOff size={12} />
            <span>{pendingSalesCount} {pendingSalesCount === 1 ? 'sale' : 'sales'} pending sync</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleCheck}
          disabled={isChecking}
          className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-amber-50 text-amber-900 rounded-lg text-xs font-black shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70"
          title="Test network connectivity"
        >
          <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
          <span>{isChecking ? 'Testing...' : 'Check Connection'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-black/20 rounded text-amber-200 hover:text-white transition cursor-pointer"
          title="Minimize banner"
          aria-label="Dismiss banner"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
