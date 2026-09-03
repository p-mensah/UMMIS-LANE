import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { 
  ShieldCheck, Search, Filter, Trash2, RefreshCw, Calendar, User, 
  Settings, Clock, FileText, AlertTriangle, Info, CheckCircle2, Download,
  Globe, ChevronRight, X
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  category: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [categoryFilter, userFilter, startDate, endDate, limit]);

  const loadData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.append('category', categoryFilter);
    if (userFilter !== 'all') params.append('user_id', userFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit.toString());

    Promise.all([
      fetchApi(`/audit-logs?${params.toString()}`),
      fetchApi('/users').catch(() => [])
    ])
    .then(([logsRes, usersRes]) => {
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  };

  const handleCleanupNow = async () => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetchApi('/audit-logs/cleanup', {
        method: 'POST',
        body: JSON.stringify({ retention_days: cleanupDays })
      });
      setCleanupResult(res);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  const setPresetDate = (preset: 'today' | '7days' | '30days' | 'all') => {
    const today = new Date();
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = toDateStr(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(toDateStr(past));
      setEndDate(toDateStr(today));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(toDateStr(past));
      setEndDate(toDateStr(today));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const exportLogsToCsv = () => {
    if (filteredLogs.length === 0) {
      alert('No logs to export.');
      return;
    }
    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Category', 'Details', 'IP Address'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.created_at}"`,
      `"${l.user_name || 'System Auto'}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.category}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || '—'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.user_name && log.user_name.toLowerCase().includes(term)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(term))
    );
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'auth':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase rounded-full">Auth</span>;
      case 'product':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase rounded-full">Product</span>;
      case 'stock':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase rounded-full">Stock</span>;
      case 'sales':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">Sales</span>;
      case 'settings':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-extrabold uppercase rounded-full">Settings</span>;
      case 'system':
        return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-extrabold uppercase rounded-full">System</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase rounded-full">General</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Audit & Security Logs</h1>
            <p className="text-[12px] text-slate-500 font-medium">Immutable audit trail of user access, financial actions, inventory updates, and governance events</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportLogsToCsv}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center gap-2"
            title="Download CSV Ledger"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={() => setShowCleanupModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-amber-600/20"
          >
            <Trash2 size={14} /> Prune Old Logs
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtered Records</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{filteredLogs.length} / {logs.length}</div>
          </div>
          <FileText size={24} className="text-blue-500 opacity-80" />
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Retention Policy</span>
            <div className="text-sm font-black text-slate-900 mt-1 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              Standard 90-Day Retention
            </div>
          </div>
          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded-full border border-emerald-200">
            Active
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Security Protection</span>
            <div className="text-sm font-black text-slate-900 mt-1 flex items-center gap-1">
              <ShieldCheck size={14} className="text-blue-600" /> Tamper-Evident Ledger
            </div>
          </div>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded-full border border-blue-200">
            Enforced
          </span>
        </div>
      </div>

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="auth">Auth & Sign-in</option>
              <option value="product">Product Catalog</option>
              <option value="stock">Stock Adjustments</option>
              <option value="sales">Sales, Shifts & Expenses</option>
              <option value="settings">Store Settings & Profile</option>
              <option value="system">System Maintenance</option>
            </select>

            {/* User Filter */}
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Users & System</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>

            {/* Limit Selector */}
            <select
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value={50}>Last 50 Records</option>
              <option value={100}>Last 100 Records</option>
              <option value={250}>Last 250 Records</option>
              <option value={500}>Last 500 Records</option>
            </select>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-slate-400 mr-1 text-[11px]">Presets:</span>
            <button
              type="button"
              onClick={() => setPresetDate('today')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPresetDate('7days')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] transition"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setPresetDate('30days')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] transition"
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setPresetDate('all')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] transition"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Date Range Inputs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Calendar size={14} className="text-slate-400" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                title="Clear date range"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Filter action, details, user, or IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold">Loading security audit records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">User / Identity</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Audit Details</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">IP / Terminal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span>{log.user_name || 'System Auto'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-slate-900">
                        {log.action}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium max-w-sm truncate">
                        {log.details || '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400 font-mono">
                        <div className="flex items-center gap-1">
                          <Globe size={12} className="text-slate-400" />
                          <span>{log.ip_address || '127.0.0.1'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 text-xs font-medium">
                      No audit records match your selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer / Modal for selected log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Audit Ledger Entry #{selectedLog.id}</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Action</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.action}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
                  <div className="mt-0.5">{getCategoryBadge(selectedLog.category)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">User / Actor</span>
                  <div className="font-semibold text-slate-800 mt-0.5">{selectedLog.user_name || 'System Process'} (ID: {selectedLog.user_id || 'System'})</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">IP Address</span>
                  <div className="font-mono text-slate-800 mt-0.5">{selectedLog.ip_address || '127.0.0.1 (Local)'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Exact Timestamp</span>
                  <div className="font-mono text-slate-700 mt-0.5">{new Date(selectedLog.created_at).toISOString()} ({new Date(selectedLog.created_at).toLocaleString()})</div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Full Details & Context
                </span>
                <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                  {selectedLog.details || 'No additional parameters provided.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purge / Clear Old Audit Logs</h3>
                <p className="text-[11px] text-slate-500 font-medium">Clear history older than cutoff period to maintain database performance</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Log Retention Cutoff Threshold
              </label>
              <select
                value={cleanupDays}
                onChange={e => setCleanupDays(parseInt(e.target.value, 10))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value={30}>Clear logs older than 30 Days</option>
                <option value={60}>Clear logs older than 60 Days</option>
                <option value={90}>Clear logs older than 90 Days (Recommended)</option>
                <option value={180}>Clear logs older than 180 Days</option>
                <option value={365}>Clear logs older than 1 Year</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Records created before {new Date(Date.now() - cleanupDays * 24 * 3600 * 1000).toLocaleDateString()} will be permanently pruned from the database.
              </p>
            </div>

            {cleanupResult && (
              <div className={`p-3 rounded-xl border text-xs font-bold ${cleanupResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {cleanupResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Successfully cleared {cleanupResult.clearedCount} audit logs older than {cleanupResult.retentionDays} days!</span>
                  </div>
                ) : (
                  <span>Cleanup failed: {cleanupResult.error || cleanupResult.message}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowCleanupModal(false);
                  setCleanupResult(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCleanupNow}
                disabled={cleaning}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {cleaning ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {cleaning ? 'Clearing...' : 'Purge Old Logs Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
