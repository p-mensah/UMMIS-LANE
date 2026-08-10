import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';

export default function Shifts() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState(0);
  const [endingCash, setEndingCash] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    setLoading(true);
    fetchApi('/shifts/current')
      .then(setCurrentShift)
      .finally(() => setLoading(false));
  };

  const handleOpen = async () => {
    try {
      await fetchApi('/shifts/open', { method: 'POST', body: JSON.stringify({ starting_cash: startingCash }) });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleClose = async () => {
    try {
      await fetchApi('/shifts/close', { method: 'POST', body: JSON.stringify({ ending_cash: endingCash }) });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div>Loading shift data...</div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto mt-10">
      <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm text-center">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight mb-6">Register Shift</h1>
        
        {!currentShift ? (
           <div className="space-y-4">
             <p className="text-[13px] text-slate-500 mb-4">You do not have an open shift. Please open the register to start logging sales.</p>
             <div className="text-left max-w-xs mx-auto">
               <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Starting Cash Float (GH₵)</label>
               <input type="number" step="0.01" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 text-center" value={startingCash} onChange={e => setStartingCash(parseFloat(e.target.value) || 0)} />
             </div>
             <button onClick={handleOpen} className="px-6 py-2 bg-emerald-500 text-white rounded-sm font-semibold text-sm hover:bg-emerald-600 transition w-full max-w-xs mx-auto">Open Register</button>
           </div>
        ) : (
           <div className="space-y-4">
             <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
               <p className="font-bold text-blue-900">Shift Open</p>
               <p className="text-[12px] text-blue-700 font-mono mt-1">Started: {new Date(currentShift.start_time + 'Z').toLocaleString()}</p>
             </div>
             <p className="text-[13px] text-slate-500 mb-4">Count the cash in the drawer and record the ending amount to close out.</p>
             <div className="text-left max-w-xs mx-auto">
               <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Ending Cash (GH₵)</label>
               <input type="number" step="0.01" className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 text-center" value={endingCash} onChange={e => setEndingCash(parseFloat(e.target.value) || 0)} />
             </div>
             <button onClick={handleClose} className="px-6 py-2 bg-red-500 text-white rounded-sm font-semibold text-sm hover:bg-red-600 transition w-full max-w-xs mx-auto">Close Register</button>
           </div>
        )}
      </div>
    </div>
  );
}
