import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { 
  Settings as SettingsIcon, ShieldCheck, Database, Bell, CheckCircle2, 
  Trash2, RefreshCw, AlertTriangle, Clock, Save, Lock, SlidersHorizontal, Eye
} from 'lucide-react';

export default function Settings() {
  const [threshold, setThreshold] = useState<number>(10);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [autoClear, setAutoClear] = useState<boolean>(true);
  const [allowStaffAdjustments, setAllowStaffAdjustments] = useState<boolean>(false);
  const [showStaffStockAlerts, setShowStaffStockAlerts] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Cleanup State
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/settings')
      .then(data => {
        if (data.low_stock_threshold) {
          setThreshold(parseInt(data.low_stock_threshold, 10));
        }
        if (data.audit_log_retention_days) {
          setRetentionDays(parseInt(data.audit_log_retention_days, 10));
        }
        if (data.auto_clear_audit_logs !== undefined) {
          setAutoClear(data.auto_clear_audit_logs === 'true');
        }
        if (data.allow_staff_stock_adjustments !== undefined) {
          setAllowStaffAdjustments(data.allow_staff_stock_adjustments === 'true');
        }
        if (data.show_staff_stock_alerts !== undefined) {
          setShowStaffStockAlerts(data.show_staff_stock_alerts === 'true');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ 
          low_stock_threshold: threshold,
          audit_log_retention_days: retentionDays,
          auto_clear_audit_logs: autoClear,
          allow_staff_stock_adjustments: allowStaffAdjustments,
          show_staff_stock_alerts: showStaffStockAlerts
        })
      });
      setMessage('System configuration and staff permission settings saved successfully.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManualCleanup = async () => {
    if (!window.confirm(`Are you sure you want to clear/archive all audit logs older than ${retentionDays} days?`)) {
      return;
    }
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await fetchApi('/audit-logs/cleanup', {
        method: 'POST',
        body: JSON.stringify({ retention_days: retentionDays })
      });
      if (res.success) {
        setCleanupMessage(`Success: Purged ${res.clearedCount} audit log records older than ${res.retentionDays} days (before ${new Date(res.cutoffDate).toLocaleDateString()}).`);
      } else {
        setCleanupMessage(`Cleanup notice: ${res.message || 'No records needed purging.'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to perform cleanup');
    } finally {
      setCleaning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <RefreshCw className="animate-spin text-blue-600 mr-2" size={20} />
      <span className="text-sm font-bold text-slate-500">Loading system settings...</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-900 text-white rounded shrink-0">
          <SettingsIcon size={22} />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Configuration & Governance</h1>
          <p className="text-[12px] text-slate-500 font-medium">Manage global business thresholds, staff dashboard permissions, and database maintenance</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Inventory Thresholds Card */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Database size={16} className="text-blue-600" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Inventory & Alert Thresholds</h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Low Stock Threshold (Global Standard)
              </label>
              <div className="max-w-xs">
                <input 
                  type="number" 
                  min={1}
                  required 
                  value={threshold} 
                  onChange={e => setThreshold(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Products with stock quantities equal to or below this threshold trigger automated visual alerts on the dashboard and system notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Staff Dashboard & Role Permissions Card */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-indigo-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Staff Role Permissions & Dashboard Display</h2>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase rounded border border-indigo-200">
              Access Control
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* Toggle 1: Staff Stock Adjustments */}
            <div className="flex items-start justify-between p-4 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <Lock size={15} className={allowStaffAdjustments ? 'text-indigo-600' : 'text-amber-600'} />
                  <span className="text-xs font-black text-slate-900">Allow Staff to Record Stock Adjustments</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  When disabled (recommended), cashiers and staff users cannot manually add, deduct, or adjust inventory. Only Administrators can adjust stock counts.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={allowStaffAdjustments}
                  onChange={e => setAllowStaffAdjustments(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Toggle 2: Show Low Stock Alerts on Staff Dashboard */}
            <div className="flex items-start justify-between p-4 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <Eye size={15} className={showStaffStockAlerts ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-xs font-black text-slate-900">Show Real-Time Low Stock Alerts in Staff Dashboard</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Controls whether cashiers and staff see the automated real-time visual low-stock indicator banner on their terminal dashboard.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={showStaffStockAlerts}
                  onChange={e => setShowStaffStockAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Audit Log Retention & Performance Card */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Audit Log Retention & Performance Maintenance</h2>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded border border-amber-200">
              System Performance
            </span>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                  Audit Log Retention Window
                </label>
                <select
                  value={retentionDays}
                  onChange={e => setRetentionDays(parseInt(e.target.value, 10))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value={30}>30 Days (Aggressive cleanup)</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days (Recommended standard)</option>
                  <option value={180}>180 Days (6 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Log entries older than this specified timeframe are eligible for automated cleanup or archival to maintain database responsiveness.
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoClear}
                    onChange={e => setAutoClear(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900">Enable Automated Log Maintenance</span>
                    <p className="text-[10px] text-slate-500 font-medium">Automatically purge audit logs older than {retentionDays} days on server startup and scheduled sweeps.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Manual Maintenance Action Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-900">Immediate Database Sweep</h4>
                <p className="text-[11px] text-slate-500">Run a manual cleanup immediately to purge logs older than {retentionDays} days.</p>
              </div>

              <button
                type="button"
                onClick={handleManualCleanup}
                disabled={cleaning}
                className="px-4 py-2 bg-slate-900 hover:bg-amber-600 text-white text-xs font-bold rounded transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {cleaning ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {cleaning ? 'Cleaning Logs...' : 'Execute Log Cleanup Now'}
              </button>
            </div>

            {cleanupMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                <span>{cleanupMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Save Button */}
        <div className="flex items-center justify-between pt-2">
          {message ? (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded flex items-center gap-2">
              <CheckCircle2 size={16} /> {message}
            </div>
          ) : <div />}

          <button 
            type="submit" 
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center gap-2 shadow-2xs"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
