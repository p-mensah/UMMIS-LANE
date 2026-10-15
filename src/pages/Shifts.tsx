import React, { useEffect, useState, useMemo } from 'react';
import { fetchApi } from '../lib/api';
import { formatGHS } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  Clock, CheckCircle2, AlertCircle, PlayCircle, StopCircle, RefreshCw, 
  Search, Filter, Edit3, User, DollarSign, ArrowUpRight, ArrowDownRight, 
  ShieldCheck, AlertTriangle, Check, X, Calendar, Layers, SlidersHorizontal, Lock
} from 'lucide-react';

interface ShiftItem {
  id: number;
  user_id: number;
  cashier_name: string;
  cashier_email: string;
  cashier_role?: string;
  start_time: string;
  end_time: string | null;
  starting_cash: number;
  ending_cash: number | null;
  expected_cash: number | null;
  discrepancy: number | null;
  status: 'open' | 'closed';
  notes?: string | null;
  total_sales?: number;
  sales_count?: number;
}

export default function Shifts() {
  const { user } = useAuth();
  const { addToast, confirmModal } = useNotifications();

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = 
    user?.email?.toLowerCase() === 'ing.mensah@gmail.com' || 
    user?.email === 'rabbi@ummis.com' || 
    user?.email === 'admin@admin.com';

  // Navigation tab for admin/superadmin: tracker vs my terminal register
  const [activeTab, setActiveTab] = useState<'tracker' | 'terminal'>(isAdmin ? 'tracker' : 'terminal');

  // Single terminal shift state (for current cashier / operator terminal)
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loadingTerminal, setLoadingTerminal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startingCash, setStartingCash] = useState<number | string>(0);
  const [endingCash, setEndingCash] = useState<number | string>(0);
  const [now, setNow] = useState(Date.now());

  // Shift Register Tracker (Admin & Super Admin tracking all cashier / staff shifts)
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loadingTracker, setLoadingTracker] = useState(false);
  const [cashierFilter, setCashierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Update Shift Register Modal state
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [updateStartingCash, setUpdateStartingCash] = useState<number | string>('');
  const [updateEndingCash, setUpdateEndingCash] = useState<number | string>('');
  const [updateStatus, setUpdateStatus] = useState<'open' | 'closed'>('open');
  const [updateNotes, setUpdateNotes] = useState('');
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);

  useEffect(() => {
    loadTerminalData();
    if (isAdmin) {
      loadTrackerData();
      fetchApi('/users').then(setStaffUsers).catch(() => {});
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const loadTerminalData = () => {
    setLoadingTerminal(true);
    fetchApi('/shifts/current')
      .then(setCurrentShift)
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Shift Error',
          message: err.message || 'Failed to retrieve current shift status.'
        });
      })
      .finally(() => setLoadingTerminal(false));
  };

  const loadTrackerData = () => {
    setLoadingTracker(true);
    const params = new URLSearchParams();
    if (cashierFilter !== 'all') params.append('user_id', cashierFilter);
    if (statusFilter !== 'all') params.append('status', statusFilter);

    fetchApi(`/shifts?${params.toString()}`)
      .then((data) => {
        if (Array.isArray(data)) {
          setShifts(data);
        }
      })
      .catch((err) => {
        addToast({
          type: 'danger',
          title: 'Error Loading Shifts',
          message: err.message || 'Failed to load cashier shift records.'
        });
      })
      .finally(() => setLoadingTracker(false));
  };

  useEffect(() => {
    if (isAdmin) {
      loadTrackerData();
    }
  }, [cashierFilter, statusFilter]);

  // Handle Opening terminal shift
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
      loadTerminalData();
      if (isAdmin) loadTrackerData();
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

  // Handle Closing terminal shift
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
      loadTerminalData();
      if (isAdmin) loadTrackerData();
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

  // Open Manage & Update Shift Modal (Admin & Super Admin)
  const openEditShiftModal = (shift: ShiftItem) => {
    setEditingShift(shift);
    setUpdateStartingCash(shift.starting_cash ?? 0);
    setUpdateEndingCash(shift.ending_cash ?? '');
    setUpdateStatus(shift.status || 'open');
    setUpdateNotes(shift.notes || '');
  };

  // Handle Saving Updated Shift Register
  const handleSaveShiftUpdate = async () => {
    if (!editingShift) return;

    const startVal = typeof updateStartingCash === 'string' ? parseFloat(updateStartingCash) : updateStartingCash;
    const endVal = updateEndingCash === '' || updateEndingCash === null 
      ? null 
      : typeof updateEndingCash === 'string' ? parseFloat(updateEndingCash) : updateEndingCash;

    if (startVal !== undefined && (isNaN(startVal) || startVal < 0)) {
      addToast({
        type: 'warning',
        title: 'Invalid Float',
        message: 'Starting cash float must be a non-negative number.'
      });
      return;
    }

    if (endVal !== null && endVal !== undefined && (isNaN(endVal) || endVal < 0)) {
      addToast({
        type: 'warning',
        title: 'Invalid Ending Cash',
        message: 'Ending cash float must be a non-negative number.'
      });
      return;
    }

    setIsUpdatingShift(true);
    try {
      const res = await fetchApi(`/shifts/${editingShift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          starting_cash: startVal,
          ending_cash: endVal,
          status: updateStatus,
          notes: updateNotes
        })
      });

      addToast({
        type: 'success',
        title: 'Shift Register Updated',
        message: `Shift #${editingShift.id} for ${editingShift.cashier_name} updated successfully.`
      });

      setEditingShift(null);
      loadTrackerData();
      if (currentShift?.id === editingShift.id) {
        loadTerminalData();
      }
    } catch (err: any) {
      addToast({
        type: 'danger',
        title: 'Failed to Update Shift',
        message: err.message || 'Could not save shift register changes.'
      });
    } finally {
      setIsUpdatingShift(false);
    }
  };

  const formatDuration = (startTimeStr: string, endTimeStr?: string | null) => {
    if (!startTimeStr) return '00:00:00';
    const start = new Date(startTimeStr.endsWith('Z') ? startTimeStr : startTimeStr + 'Z').getTime();
    const end = endTimeStr 
      ? new Date(endTimeStr.endsWith('Z') ? endTimeStr : endTimeStr + 'Z').getTime()
      : now;
    const diff = Math.max(0, Math.floor((end - start) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Filtered shifts in tracker
  const filteredShifts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return shifts.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (cashierFilter !== 'all' && s.user_id.toString() !== cashierFilter) return false;
      if (!q) return true;
      return (
        s.cashier_name?.toLowerCase().includes(q) ||
        s.cashier_email?.toLowerCase().includes(q) ||
        s.id.toString().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    });
  }, [shifts, statusFilter, cashierFilter, searchQuery]);

  // Summary Metrics for Admin/Super Admin
  const trackerMetrics = useMemo(() => {
    const totalRecorded = shifts.length;
    const activeCount = shifts.filter((s) => s.status === 'open').length;
    const totalStartingFloat = shifts.reduce((acc, s) => acc + (Number(s.starting_cash) || 0), 0);
    const totalEndingFloat = shifts.reduce((acc, s) => acc + (s.ending_cash !== null ? Number(s.ending_cash) : 0), 0);
    const discrepancyCount = shifts.filter((s) => s.discrepancy !== null && Math.abs(s.discrepancy) > 0.05).length;

    return {
      totalRecorded,
      activeCount,
      totalStartingFloat,
      totalEndingFloat,
      discrepancyCount
    };
  }, [shifts]);

  // Live discrepancy preview inside update modal
  const modalLiveDiscrepancy = useMemo(() => {
    if (!editingShift) return null;
    const start = typeof updateStartingCash === 'string' ? parseFloat(updateStartingCash) || 0 : (updateStartingCash || 0);
    const end = updateEndingCash === '' || updateEndingCash === null 
      ? null 
      : typeof updateEndingCash === 'string' ? parseFloat(updateEndingCash) || 0 : updateEndingCash;
    
    if (end === null) return null;

    // Estimate expected = starting float + total_sales (approximated for real-time visual feedback)
    const salesTotal = Number(editingShift.total_sales || 0);
    const estimatedExpected = start + salesTotal;
    return Math.round((end - estimatedExpected) * 100) / 100;
  }, [editingShift, updateStartingCash, updateEndingCash]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Page Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-xs">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Shift Register & Cash Float Management
                </h1>
                {isAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    {isSuperAdmin ? 'Super Admin Oversight' : 'Administrator Clearance'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Real-time tracking of cashier shifts, opening cash floats, sales reconciliation, and drawer balancing
              </p>
            </div>
          </div>

          {/* Quick Actions / Tab Toggles */}
          {isAdmin && (
            <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('tracker')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'tracker'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Layers size={14} />
                <span>All Staff Shifts ({shifts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('terminal')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'terminal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Clock size={14} />
                <span>My Counter Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TRACKER VIEW (For Super Admin and Admin) */}
      {isAdmin && activeTab === 'tracker' && (
        <div className="space-y-6">
          {/* Summary KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Total Shifts</span>
                <Clock size={14} className="text-blue-600" />
              </div>
              <div className="text-xl font-black text-slate-900">{trackerMetrics.totalRecorded}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Recorded shift sessions</p>
            </div>

            <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Active Open</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xl font-black text-emerald-700">{trackerMetrics.activeCount}</div>
              <p className="text-[10px] text-emerald-600 mt-0.5">Live register terminals</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Total Starting Float</span>
                <ArrowUpRight size={14} className="text-indigo-600" />
              </div>
              <div className="text-xl font-black text-indigo-700">{formatGHS(trackerMetrics.totalStartingFloat)}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Opening cash issued</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Reconciled Ending Cash</span>
                <ArrowDownRight size={14} className="text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700">{formatGHS(trackerMetrics.totalEndingFloat)}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Counted drawer receipts</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Discrepancy Alerts</span>
                <AlertTriangle size={14} className={trackerMetrics.discrepancyCount > 0 ? "text-amber-500" : "text-slate-400"} />
              </div>
              <div className={`text-xl font-black ${trackerMetrics.discrepancyCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {trackerMetrics.discrepancyCount}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Over / Short flagged</p>
            </div>
          </div>

          {/* Filtering & Search Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shifts by cashier name, email, or Shift ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-200 focus:border-blue-600 rounded-lg pl-10 pr-10 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Cashier / Staff selector */}
              <div className="relative min-w-[200px]">
                <select
                  value={cashierFilter}
                  onChange={(e) => setCashierFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-8 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">All Cashiers & Staff ({staffUsers.length})</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id.toString()}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded transition text-xs font-black cursor-pointer ${
                    statusFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('open')}
                  className={`px-2.5 py-1 rounded transition text-xs font-black cursor-pointer ${
                    statusFilter === 'open' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active Open
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('closed')}
                  className={`px-2.5 py-1 rounded transition text-xs font-black cursor-pointer ${
                    statusFilter === 'closed' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Closed & Reconciled
                </button>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={loadTrackerData}
                disabled={loadingTracker}
                className="p-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition shrink-0"
                title="Refresh shifts tracker"
              >
                <RefreshCw size={15} className={loadingTracker ? "animate-spin text-blue-600" : ""} />
              </button>
            </div>
          </div>

          {/* Master Shifts Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-blue-600" />
                  Staff Shift Registers Ledger
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Tracking cashier opening float, drawer count at close, and variances</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                {filteredShifts.length} Shift Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Shift ID & Status</th>
                    <th className="py-3 px-4">Cashier / Staff Operator</th>
                    <th className="py-3 px-4">Starting Cash Float</th>
                    <th className="py-3 px-4">Ending Drawer Cash</th>
                    <th className="py-3 px-4">Discrepancy / Variance</th>
                    <th className="py-3 px-4">Sales Activity</th>
                    <th className="py-3 px-4">Shift Timestamps & Duration</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Clock size={28} className="mx-auto mb-2 opacity-30 text-blue-600" />
                        <p className="font-bold text-slate-600 text-sm">No shift register records found</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting the filter criteria or search query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((s) => {
                      const isOpen = s.status === 'open';
                      const disc = s.discrepancy;

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Shift ID & Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-black font-mono text-slate-900 text-xs">
                              #SHIFT-{s.id}
                            </div>
                            <div className="mt-1">
                              {isOpen ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active Open
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                                  <Check size={11} className="text-slate-500" />
                                  Closed & Reconciled
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cashier / Staff Operator */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase border border-blue-200 shrink-0">
                                {s.cashier_name?.charAt(0) || 'C'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{s.cashier_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{s.cashier_email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Starting Cash Float */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 font-black text-indigo-700 text-sm bg-indigo-50/60 px-2.5 py-1 rounded-md border border-indigo-200/80">
                              <ArrowUpRight size={13} className="text-indigo-500" />
                              <span>{formatGHS(s.starting_cash || 0)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 pl-0.5">Opening Float</div>
                          </td>

                          {/* Ending Drawer Cash */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {s.ending_cash !== null ? (
                              <div>
                                <div className="inline-flex items-center gap-1 font-black text-emerald-700 text-sm bg-emerald-50/60 px-2.5 py-1 rounded-md border border-emerald-200/80">
                                  <ArrowDownRight size={13} className="text-emerald-500" />
                                  <span>{formatGHS(s.ending_cash)}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5 pl-0.5">Counted at Close</div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                <Clock size={12} className="text-amber-500 animate-spin" />
                                <span>Pending Count</span>
                              </div>
                            )}
                          </td>

                          {/* Discrepancy / Variance */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isOpen ? (
                              <span className="text-slate-400 text-[11px] font-medium">— Shift Active —</span>
                            ) : disc === null ? (
                              <span className="text-slate-400 text-[11px]">Not calculated</span>
                            ) : Math.abs(disc) <= 0.05 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                Balanced (₵0.00)
                              </span>
                            ) : disc > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                <ArrowUpRight size={12} className="text-blue-600" />
                                +{formatGHS(disc)} Over
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle size={12} className="text-rose-600" />
                                -{formatGHS(Math.abs(disc))} Short
                              </span>
                            )}
                          </td>

                          {/* Sales Activity */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {formatGHS(s.total_sales || 0)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.sales_count || 0} transactions
                            </div>
                          </td>

                          {/* Shift Timestamps & Duration */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-slate-700 font-mono text-[11px] font-medium">
                              Started: {new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Duration: <span className="font-bold text-slate-800">{formatDuration(s.start_time, s.end_time)}</span>
                            </div>
                            {s.notes && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate" title={s.notes}>
                                Note: "{s.notes}"
                              </div>
                            )}
                          </td>

                          {/* Management Action Button */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => openEditShiftModal(s)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 shadow-2xs"
                              title="Update starting or ending cash float, notes, or reconcile shift"
                            >
                              <Edit3 size={13} />
                              <span>Manage Shift</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE TERMINAL VIEW (For Cashier or Staff counter register) */}
      {(!isAdmin || activeTab === 'terminal') && (
        <div className="max-w-xl mx-auto py-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Counter Register & Cash Float</h2>
                  <p className="text-xs text-slate-500">Drawer float balancing for counter checkout</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border">
                {loadingTerminal ? (
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
            {loadingTerminal ? (
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
                    Starting Cash Float (₵) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₵</span>
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
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition w-full max-w-sm mx-auto shadow-2xs min-h-[44px] cursor-pointer"
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
                    <span className="font-bold text-slate-900 font-mono text-sm text-indigo-700">
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
                    Ending Drawer Cash Count (₵) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₵</span>
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
                    Count all cash physically present in the register drawer before closing.
                  </p>
                </div>

                <button 
                  onClick={handleClose} 
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition w-full max-w-sm mx-auto shadow-2xs min-h-[44px] cursor-pointer"
                >
                  <StopCircle size={16} /> {isSubmitting ? 'Reconciling...' : 'Close & Reconcile Register'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN & SUPER ADMIN "UPDATE SHIFT REGISTER" MODAL */}
      {editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-tight">
                    Update Shift Register — #SHIFT-{editingShift.id}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                    {editingShift.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Staff Operator: <strong className="text-white">{editingShift.cashier_name}</strong> ({editingShift.cashier_email})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              {/* Cashier Metadata Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-medium">Session Started:</span>
                  <div className="font-bold text-slate-900 font-mono">
                    {new Date(editingShift.start_time).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Recorded Sales:</span>
                  <div className="font-bold text-emerald-700 font-mono text-sm">
                    {formatGHS(editingShift.total_sales || 0)}
                  </div>
                </div>
              </div>

              {/* 1. Starting Cash Float */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Starting Cash Float (₵) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={updateStartingCash}
                    onChange={(e) => setUpdateStartingCash(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 pl-10 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Modify the initial drawer float allocated to this cashier counter.
                </p>
              </div>

              {/* 2. Ending Drawer Cash Count */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Ending Drawer Cash Count (₵)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={updateEndingCash}
                    onChange={(e) => setUpdateEndingCash(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2 pl-10 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00 (Leave empty if currently active / unclosed)"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Physical cash counted upon shift closing or drawer balancing audit.
                </p>
              </div>

              {/* 3. Shift Status */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Shift Register Status *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateStatus('open')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      updateStatus === 'open'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Open / Active Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateStatus('closed')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      updateStatus === 'closed'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Check size={13} />
                    Closed & Reconciled
                  </button>
                </div>
              </div>

              {/* Live Variance Calculation Alert Box */}
              {modalLiveDiscrepancy !== null && (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  Math.abs(modalLiveDiscrepancy) <= 0.05
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : modalLiveDiscrepancy > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {Math.abs(modalLiveDiscrepancy) <= 0.05 ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600" />
                    )}
                    <span>Calculated Variance:</span>
                  </span>
                  <span className="font-black font-mono">
                    {modalLiveDiscrepancy === 0
                      ? 'Balanced (₵0.00)'
                      : modalLiveDiscrepancy > 0
                      ? `+${formatGHS(modalLiveDiscrepancy)} Over`
                      : `-${formatGHS(Math.abs(modalLiveDiscrepancy))} Short`}
                  </span>
                </div>
              )}

              {/* 4. Manager Reconciliation Notes */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Management Reconciliation Notes
                </label>
                <textarea
                  rows={3}
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="Record supervisor audit notes, explanation for cash variance, or shift handover adjustments..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShiftUpdate}
                disabled={isUpdatingShift}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {isUpdatingShift ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save & Update Shift Register</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
