import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { 
  ShieldCheck, Search, Filter, Trash2, RefreshCw, Calendar, User, 
  Settings, Clock, FileText, AlertTriangle, Info, CheckCircle2, Download
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cleanup Modal state
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [categoryFilter, userFilter]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchApi(`/audit-logs?category=${categoryFilter}&user_id=${userFilter}`),
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

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.user_name && log.user_name.toLowerCase().includes(term))
    );
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'auth':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase rounded">Auth</span>;
      case 'product':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase rounded">Product</span>;
      case 'stock':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase rounded">Stock</span>;
      case 'sales':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded">Sales</span>;
      case 'settings':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-extrabold uppercase rounded">Settings</span>;
      case 'system':
        return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-extrabold uppercase rounded">System</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase rounded">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Audit & Action Logs</h1>
              <p className="text-[12px] text-slate-500 font-medium">Complete security ledger of all user operations and automated system maintenance</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCleanupModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-2 shadow-2xs"
          >
            <Trash2 size={14} /> Clear / Archive Old Logs
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Audit Records</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{logs.length}</div>
          </div>
          <FileText size={24} className="text-blue-500 opacity-80" />
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Retention Policy</span>
            <div className="text-sm font-black text-slate-900 mt-1 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              Auto Purge &gt; 90 Days
            </div>
          </div>
          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded border border-emerald-200">
            Active
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Security Level</span>
            <div className="text-sm font-black text-slate-900 mt-1 flex items-center gap-1">
              <ShieldCheck size={14} className="text-blue-600" /> High Accountability
            </div>
          </div>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded border border-blue-200">
            Enforced
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="auth">Auth & Sign-in</option>
            <option value="product">Product Catalog</option>
            <option value="stock">Stock Adjustments</option>
            <option value="sales">Sales & Refunds</option>
            <option value="settings">System Settings</option>
            <option value="system">System Maintenance</option>
          </select>

          {/* User Filter */}
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Users & System</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search action or details..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold">Loading audit logs...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">User / Agent</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        {log.user_name || 'System Auto'}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs font-black text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {getCategoryBadge(log.category)}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 font-medium max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 text-xs font-medium">
                    No audit records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purge / Clear Old Audit Logs</h3>
                <p className="text-[11px] text-slate-500 font-medium">Clear history older than cutoff period to boost server performance</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Log Retention Cutoff Threshold
              </label>
              <select
                value={cleanupDays}
                onChange={e => setCleanupDays(parseInt(e.target.value, 10))}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-900"
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
              <div className={`p-3 rounded border text-xs font-bold ${cleanupResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCleanupNow}
                disabled={cleaning}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-2 disabled:opacity-50"
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
