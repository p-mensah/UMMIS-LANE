import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { 
  Store, ShieldCheck, Database, Receipt, CheckCircle2, 
  Trash2, RefreshCw, SlidersHorizontal, Eye, Lock,
  Save, Download, DollarSign, Building2, Phone, Mail, FileText
} from 'lucide-react';

export default function Settings() {
  // Store Identity
  const [storeName, setStoreName] = useState('UMMIS Retail & Wholesale POS');
  const [storeTagline, setStoreTagline] = useState('Premium Inventory & Point of Sale System');
  const [storeAddress, setStoreAddress] = useState('124 Market Square, Commercial District');
  const [storePhone, setStorePhone] = useState('+233 24 000 1122');
  const [storeEmail, setStoreEmail] = useState('Ing.mensah@gmail.com');
  const [storeTin, setStoreTin] = useState('TIN-9842104-X');

  // Currency & Tax
  const [currencySymbol, setCurrencySymbol] = useState('GH₵');
  const [currencyCode, setCurrencyCode] = useState('GHS');
  const [taxPercentage, setTaxPercentage] = useState('15.0');
  const [enableTaxByDefault, setEnableTaxByDefault] = useState(false);

  // Receipt Details
  const [receiptHeader, setReceiptHeader] = useState('UMMIS RETAIL STORE');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for your business! Goods returned within 7 days in good condition.');

  // Inventory & Staff Permissions
  const [threshold, setThreshold] = useState<number>(10);
  const [allowStaffAdjustments, setAllowStaffAdjustments] = useState<boolean>(false);
  const [showStaffStockAlerts, setShowStaffStockAlerts] = useState<boolean>(true);

  // Audit Logs & Retention
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [autoClear, setAutoClear] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Cleanup State
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Backup State
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  useEffect(() => {
    fetchApi('/settings')
      .then(data => {
        if (data.store_name) setStoreName(data.store_name);
        if (data.store_tagline) setStoreTagline(data.store_tagline);
        if (data.store_address) setStoreAddress(data.store_address);
        if (data.store_phone) setStorePhone(data.store_phone);
        if (data.store_email) setStoreEmail(data.store_email);
        if (data.store_tin) setStoreTin(data.store_tin);

        if (data.currency_symbol) setCurrencySymbol(data.currency_symbol);
        if (data.currency_code) setCurrencyCode(data.currency_code);
        if (data.tax_percentage) setTaxPercentage(data.tax_percentage);
        if (data.enable_tax_by_default !== undefined) setEnableTaxByDefault(data.enable_tax_by_default === 'true');

        if (data.receipt_header) setReceiptHeader(data.receipt_header);
        if (data.receipt_footer) setReceiptFooter(data.receipt_footer);

        if (data.low_stock_threshold) setThreshold(parseInt(data.low_stock_threshold, 10));
        if (data.audit_log_retention_days) setRetentionDays(parseInt(data.audit_log_retention_days, 10));
        if (data.auto_clear_audit_logs !== undefined) setAutoClear(data.auto_clear_audit_logs === 'true');
        if (data.allow_staff_stock_adjustments !== undefined) setAllowStaffAdjustments(data.allow_staff_stock_adjustments === 'true');
        if (data.show_staff_stock_alerts !== undefined) setShowStaffStockAlerts(data.show_staff_stock_alerts === 'true');
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
          store_name: storeName,
          store_tagline: storeTagline,
          store_address: storeAddress,
          store_phone: storePhone,
          store_email: storeEmail,
          store_tin: storeTin,
          currency_symbol: currencySymbol,
          currency_code: currencyCode,
          tax_percentage: taxPercentage,
          enable_tax_by_default: enableTaxByDefault,
          receipt_header: receiptHeader,
          receipt_footer: receiptFooter,
          low_stock_threshold: threshold,
          audit_log_retention_days: retentionDays,
          auto_clear_audit_logs: autoClear,
          allow_staff_stock_adjustments: allowStaffAdjustments,
          show_staff_stock_alerts: showStaffStockAlerts
        })
      });
      setMessage('Store profile, financial parameters, and security settings saved successfully.');
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

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token');
      const authHeader = token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '';
      const response = await fetch('/api/settings/backup', {
        headers: {
          ...(authHeader ? { 'Authorization': authHeader } : {})
        }
      });
      if (!response.ok) {
        throw new Error('Failed to generate backup file');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `pos-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to download backup snapshot.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <RefreshCw className="animate-spin text-blue-600 mr-2" size={20} />
      <span className="text-sm font-bold text-slate-500">Loading store settings...</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Store Settings & Configuration</h1>
            <p className="text-[12px] text-slate-500 font-medium">Manage store profile, tax/currency, POS receipt customization, and system backups</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadBackup}
          disabled={downloadingBackup}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-300 self-start sm:self-auto"
        >
          {downloadingBackup ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          <span>{downloadingBackup ? 'Exporting...' : 'Export Database Backup'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Profile & Identity Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Store Identity & Contact Details</h2>
            </div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded border border-blue-200">
              Identity Profile
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Store / Company Name
              </label>
              <input 
                type="text" 
                required 
                value={storeName} 
                onChange={e => setStoreName(e.target.value)}
                placeholder="e.g. UMMIS Retail & Wholesale POS"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Tagline / Slogan
              </label>
              <input 
                type="text" 
                value={storeTagline} 
                onChange={e => setStoreTagline(e.target.value)}
                placeholder="e.g. Quality Goods & Everyday Wholesale"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Store Location / Physical Address
              </label>
              <input 
                type="text" 
                value={storeAddress} 
                onChange={e => setStoreAddress(e.target.value)}
                placeholder="e.g. 124 Market Square, Commercial District"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Contact Phone Number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  value={storePhone} 
                  onChange={e => setStorePhone(e.target.value)}
                  placeholder="e.g. +233 24 000 1122"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Official Business Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="email" 
                  value={storeEmail} 
                  onChange={e => setStoreEmail(e.target.value)}
                  placeholder="e.g. Ing.mensah@gmail.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Taxpayer Identification Number (TIN / VAT)
              </label>
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  value={storeTin} 
                  onChange={e => setStoreTin(e.target.value)}
                  placeholder="e.g. TIN-9842104-X"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Currency & Financial Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Currency & Financial Parameters</h2>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase rounded border border-emerald-200">
              Financial Standard
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Currency Symbol
              </label>
              <input 
                type="text" 
                required 
                value={currencySymbol} 
                onChange={e => setCurrencySymbol(e.target.value)}
                placeholder="e.g. GH₵, $, €, £"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                ISO Currency Code
              </label>
              <input 
                type="text" 
                required 
                value={currencyCode} 
                onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
                placeholder="e.g. GHS, USD, EUR"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Default Sales Tax / VAT (%)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="100"
                  value={taxPercentage} 
                  onChange={e => setTaxPercentage(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div className="md:col-span-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={enableTaxByDefault}
                  onChange={e => setEnableTaxByDefault(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900">Automatically Apply VAT / Tax on New POS Checkout Sales</span>
                  <p className="text-[10px] text-slate-500 font-medium">When enabled, new sales in the POS terminal will have tax enabled by default with the percentage above.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Receipt & Thermal Print Setup Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-purple-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">POS Receipt Header & Footer Setup</h2>
            </div>
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-extrabold uppercase rounded border border-purple-200">
              Print Customization
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Receipt Header Note (Appears under Store Name)
              </label>
              <input 
                type="text" 
                value={receiptHeader} 
                onChange={e => setReceiptHeader(e.target.value)}
                placeholder="e.g. Official Customer Sales Receipt"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Receipt Footer Notice & Return Policy
              </label>
              <textarea 
                rows={2}
                value={receiptFooter} 
                onChange={e => setReceiptFooter(e.target.value)}
                placeholder="e.g. Thank you for your business! Goods returned within 7 days in original condition."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Inventory Thresholds Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
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
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Products with stock quantities equal to or below this threshold trigger automated visual alerts on the dashboard and system notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Staff Dashboard & Role Permissions Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
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
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <Lock size={15} className={allowStaffAdjustments ? 'text-indigo-600' : 'text-amber-600'} />
                  <span className="text-xs font-bold text-slate-900">Allow Staff to Record Stock Adjustments</span>
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
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <Eye size={15} className={showStaffStockAlerts ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-xs font-bold text-slate-900">Show Real-Time Low Stock Alerts in Staff Dashboard</span>
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
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
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
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
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoClear}
                    onChange={e => setAutoClear(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Enable Automated Log Maintenance</span>
                    <p className="text-[10px] text-slate-500 font-medium">Automatically purge audit logs older than {retentionDays} days on server startup and scheduled sweeps.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Manual Maintenance Action Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Immediate Database Sweep</h4>
                <p className="text-[11px] text-slate-500">Run a manual cleanup immediately to purge logs older than {retentionDays} days.</p>
              </div>

              <button
                type="button"
                onClick={handleManualCleanup}
                disabled={cleaning}
                className="px-4 py-2 bg-slate-900 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {cleaning ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {cleaning ? 'Cleaning Logs...' : 'Execute Log Cleanup Now'}
              </button>
            </div>

            {cleanupMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                <span>{cleanupMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Save Button */}
        <div className="flex items-center justify-between pt-2">
          {message ? (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 size={16} /> {message}
            </div>
          ) : <div />}

          <button 
            type="submit" 
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-blue-500/20"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
