import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { Clock, ShieldCheck, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Shifts() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState<number | string>(0);
  const [endingCash, setEndingCash] = useState<number | string>(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/shifts/current')
      .then(setCurrentShift)
      .finally(() => setLoading(false));
  };

  const handleOpen = async () => {
    try {
      const val = typeof startingCash === 'string' ? parseFloat(startingCash) || 0 : startingCash;
      await fetchApi('/shifts/open', { method: 'POST', body: JSON.stringify({ starting_cash: val }) });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleClose = async () => {
    try {
      const val = typeof endingCash === 'string' ? parseFloat(endingCash) || 0 : endingCash;
      await fetchApi('/shifts/close', { method: 'POST', body: JSON.stringify({ ending_cash: val }) });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const formatDuration = (startTimeStr: string) => {
    const start = new Date(startTimeStr.endsWith('Z') ? startTimeStr : startTimeStr + 'Z').getTime();
    const diff = Math.max(0, Math.floor((now - start) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm font-medium">
        Loading register shift status...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto mt-4">
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Shift Register</h1>
              <p className="text-xs text-slate-500">Cash drawer management & reconciliation</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border">
            {currentShift ? (
              <span className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 border-slate-200">
                Register Closed
              </span>
            )}
          </div>
        </div>
        
        {!currentShift ? (
          <div className="space-y-5 text-center">
            <p className="text-xs text-slate-600">
              No shift is currently active for your user account. Please open the register and record the starting cash float to begin logging sales.
            </p>

            <div className="text-left max-w-xs mx-auto space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Starting Cash Float (GH₵)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">GH₵</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full border border-slate-300 rounded px-3 py-2 pl-12 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500" 
                  value={startingCash} 
                  onChange={e => setStartingCash(e.target.value)} 
                />
              </div>
            </div>

            <button 
              onClick={handleOpen} 
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition w-full max-w-xs mx-auto shadow-sm"
            >
              Open Register Shift
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Shift Started At:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {new Date(currentShift.start_time.endsWith('Z') ? currentShift.start_time : currentShift.start_time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Starting Float:</span>
                <span className="font-bold text-slate-900">
                  {formatGHS(currentShift.starting_cash || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time Duration:
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatDuration(currentShift.start_time)}
                </span>
              </div>
            </div>

            <div className="text-left max-w-xs mx-auto space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Ending Drawer Cash (GH₵)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">GH₵</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full border border-slate-300 rounded px-3 py-2 pl-12 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500" 
                  value={endingCash} 
                  onChange={e => setEndingCash(e.target.value)} 
                />
              </div>
            </div>

            <button 
              onClick={handleClose} 
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs transition w-full max-w-xs mx-auto block shadow-sm"
            >
              Close & Reconcile Register
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
