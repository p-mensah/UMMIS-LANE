import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useNotifications } from '../context/NotificationContext';
import { Clock, DollarSign, CheckCircle2, AlertCircle, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';

export default function Shifts() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startingCash, setStartingCash] = useState<number | string>(0);
  const [endingCash, setEndingCash] = useState<number | string>(0);
  const [now, setNow] = useState(Date.now());

  const { addToast, confirmModal } = useNotifications();

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/shifts/current')
      .then(setCurrentShift)
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Shift Error',
          message: err.message || 'Failed to retrieve current shift status.'
        });
      })
      .finally(() => setLoading(false));
  };

  const handleOpen = async () => {
    const val = typeof startingCash === 'string' ? parseFloat(startingCash) || 0 : startingCash;
    if (val < 0) {
      addToast({
        type: 'warning',
        title: 'Invalid Float',
        message: 'Starting cash float cannot be negative.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi('/shifts/open', { method: 'POST', body: JSON.stringify({ starting_cash: val }) });
      addToast({
        type: 'success',
        title: 'Shift Opened',
        message: `Register opened with ${formatGHS(val)} starting float.`
      });
      loadData();
    } catch (e: any) { 
      addToast({
        type: 'danger',
        title: 'Failed to Open Shift',
        message: e.message || 'Could not open register shift.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    const val = typeof endingCash === 'string' ? parseFloat(endingCash) || 0 : endingCash;
    
    const confirmed = await confirmModal({
      title: 'Close Register Shift?',
      message: `Are you sure you want to reconcile and close this shift with ending drawer cash of ${formatGHS(val)}?`,
      confirmText: 'Confirm & Close Shift',
      type: 'warning'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await fetchApi('/shifts/close', { method: 'POST', body: JSON.stringify({ ending_cash: val }) });
      addToast({
        type: 'success',
        title: 'Shift Reconciled & Closed',
        message: `Shift ended successfully. Drawer reconciled at ${formatGHS(val)}.`
      });
      setEndingCash(0);
      loadData();
    } catch (e: any) { 
      addToast({
        type: 'danger',
        title: 'Failed to Close Shift',
        message: e.message || 'Could not close register shift.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (startTimeStr: string) => {
    const start = new Date(startTimeStr.endsWith('Z') ? startTimeStr : startTimeStr + 'Z').getTime();
    const diff = Math.max(0, Math.floor((now - start) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto py-4 px-2 sm:px-0">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Shift Register & Float</h1>
              <p className="text-xs text-slate-500">Cash drawer balancing and staff shift reconciliation</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border">
            {loading ? (
              <span className="text-slate-400 text-[11px]">Checking...</span>
            ) : currentShift ? (
              <span className="text-emerald-700 bg-emerald-50 border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift
              </span>
            ) : (
              <span className="text-slate-600 bg-slate-100 border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                Register Closed
              </span>
            )}
          </div>
        </div>

        {/* Body content */}
        {loading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
            <div className="h-10 bg-slate-100 rounded max-w-xs mx-auto"></div>
            <div className="h-10 bg-slate-100 rounded max-w-xs mx-auto"></div>
          </div>
        ) : !currentShift ? (
          <div className="space-y-6 text-center py-2">
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 leading-relaxed text-left">
              No shift is currently active for this counter terminal. Enter your opening cash float to initialize drawer balancing and enable POS checkout.
            </div>

            <div className="text-left max-w-sm mx-auto space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Starting Cash Float (GH₵) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">GH₵</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pl-12 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]" 
                  value={startingCash} 
                  onChange={e => setStartingCash(e.target.value)} 
                  placeholder="0.00"
                />
              </div>
            </div>

            <button 
              onClick={handleOpen} 
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition w-full max-w-sm mx-auto shadow-2xs min-h-[44px]"
            >
              <PlayCircle size={16} /> {isSubmitting ? 'Opening Shift...' : 'Open Register Shift'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Shift Started At:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {new Date(currentShift.start_time.endsWith('Z') ? currentShift.start_time : currentShift.start_time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Starting Drawer Float:</span>
                <span className="font-bold text-slate-900">
                  {formatGHS(currentShift.starting_cash || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/80">
                <span className="text-slate-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Elapsed Time:
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatDuration(currentShift.start_time)}
                </span>
              </div>
            </div>

            <div className="text-left max-w-sm mx-auto space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Ending Drawer Cash Count (GH₵) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">GH₵</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pl-12 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]" 
                  value={endingCash} 
                  onChange={e => setEndingCash(e.target.value)} 
                  placeholder="0.00"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Count all cash in the register drawer before closing.
              </p>
            </div>

            <button 
              onClick={handleClose} 
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition w-full max-w-sm mx-auto shadow-2xs min-h-[44px]"
            >
              <StopCircle size={16} /> {isSubmitting ? 'Reconciling...' : 'Close & Reconcile Register'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
