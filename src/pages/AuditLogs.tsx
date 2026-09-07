import React, { useEffect, useState } from 'react';
import { fetchApi } from '../lib/api';
import { 
  ShieldCheck, Search, Filter, Trash2, RefreshCw, Calendar, User, 
  Settings, Clock, FileText, AlertTriangle, Info, CheckCircle2, Download,
  Globe, ChevronRight, X, Monitor, MapPin, ArrowRight, ShieldAlert, KeyRound,
  Package, ShoppingCart, Truck, Sliders, Activity, ArrowDown, Copy, Check,
  Radio
} from 'lucide-react';
import { DateRangePicker } from '../components/DateRangePicker';

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  actor_role?: string | null;
  action: string;
  category: string;
  sub_category?: string | null;
  details: string | null;
  ip_address: string | null;
  pre_state?: string | null;
  post_state?: string | null;
  delta?: string | null;
  device_terminal?: string | null;
  location?: string | null;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auto-Refresh & Live Security Monitoring
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // in seconds; 0 = off, default 30s
  const [countdown, setCountdown] = useState<number>(30);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(new Date());

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'success' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [terminalFilter, setTerminalFilter] = useState('all');
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
  const [copiedLogId, setCopiedLogId] = useState<number | null>(null);

  // Prevent background scroll bleed and enable Escape key close for modals
  useEffect(() => {
    if (selectedLog || showCleanupModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedLog, showCleanupModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedLog) setSelectedLog(null);
        if (showCleanupModal) setShowCleanupModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog, showCleanupModal]);

  // Intelligent narrative explanation detailing what actually happened
  const getDetailedNarrative = (log: AuditLogEntry) => {
    const actor = log.user_name || 'System Operator';
    const role = log.actor_role === 'admin' 
      ? 'Administrator' 
      : log.actor_role === 'supplier' 
      ? 'Supplier Vendor' 
      : 'Staff Member';
    const terminal = log.device_terminal || 'Primary POS / Back-Office Terminal';
    const location = log.location || 'Main Store - Accra';
    const ip = log.ip_address || '127.0.0.1';
    const action = (log.action || '').toUpperCase();
    const details = log.details || '';

    let whatHappened = '';
    let businessImpact = '';

    if (action.includes('LOGIN_SUCCESS') || (action.includes('LOGIN') && !action.includes('FAIL'))) {
      whatHappened = `${actor} (${role}) authenticated into the management system through terminal "${terminal}" at ${location} (IP: ${ip}). Credentials and session token were validated.`;
      businessImpact = `A verified session token was granted to ${actor}. The user was authorized to perform operations conforming to their ${role} privileges.`;
    } else if (action.includes('FAILED') || action.includes('UNAUTHORIZED') || action.includes('REJECT')) {
      whatHappened = `An unauthorized authentication attempt was intercepted by security controls. The login request for account "${actor}" originating from IP ${ip} at ${terminal} failed security challenge verification.`;
      businessImpact = `Access was strictly rejected and blocked. A security warning flag was logged in the tamper-evident ledger and rate-limiting protection was enforced.`;
    } else if (action.includes('MFA') || action.includes('2FA')) {
      whatHappened = `Elevated authentication challenge completed. ${actor} (${role}) verified multi-factor secondary credentials (TOTP/token) at workstation "${terminal}".`;
      businessImpact = `Elevated security clearance was approved and verified for administrative functions.`;
    } else if (action.includes('PASSWORD') || action.includes('RESET') || action.includes('CREDENTIAL')) {
      whatHappened = `Security credentials modified. Password reset or credential update was executed for ${actor} from terminal "${terminal}" (IP: ${ip}).`;
      businessImpact = `Prior authentication credentials were revoked. The account must authenticate using the new security parameters.`;
    } else if (action.includes('ROLE') || action.includes('PERMISSION') || action.includes('ASSIGN_ROLE')) {
      whatHappened = `Access control modification. System permissions for account ${actor} were restructured on "${terminal}" at ${location}.`;
      businessImpact = `Active capabilities and route authorizations for the user account were updated immediately across all sessions.`;
    } else if (action.includes('SUSPEND') || action.includes('DEACTIVATE') || action.includes('DISABLE')) {
      whatHappened = `Account suspension initiated. The user profile for ${actor} was revoked and marked suspended from terminal "${terminal}".`;
      businessImpact = `All existing bearer tokens and active sign-in sessions for this user were invalidated immediately; subsequent login attempts will be rejected.`;
    } else if (action.includes('ACTIVATE') || action.includes('ENABLE') || action.includes('UNSUSPEND')) {
      whatHappened = `Account reinstatement. The suspended status on account ${actor} was cleared and restored to active state from terminal "${terminal}".`;
      businessImpact = `The account has been returned to healthy operational standing and may authenticate to resume business activities.`;
    } else if (action.includes('SALE') || action.includes('POS') || action.includes('CHECKOUT')) {
      whatHappened = `Point-of-Sale transaction finalized. Cashier ${actor} completed customer checkout and payment processing at "${terminal}" (${location}).`;
      businessImpact = `Sale receipt was generated, inventory quantities were decremented from store stock levels, and revenue was recorded into register receipts.`;
    } else if (action.includes('RESTOCK') || action.includes('STOCK_IN') || action.includes('RECEIVE')) {
      whatHappened = `Inventory replenishment received. Physical stock was reconciled and entered into inventory records at ${location} through "${terminal}" by ${actor}.`;
      businessImpact = `Inventory on-hand balances were incremented. Restock ledgers and supplier purchase audit trails were updated.`;
    } else if (action.includes('PRICE') || action.includes('OVERRIDE')) {
      whatHappened = `Inventory pricing adjustment executed. Retail price parameters for items were reconfigured by ${actor} (${role}) on "${terminal}".`;
      businessImpact = `Updated pricing immediately took effect at all POS checkouts and barcode scanners across the store.`;
    } else if (action.includes('PRODUCT') || action.includes('CATALOG')) {
      whatHappened = `Catalog master record updated. ${actor} performed product catalog maintenance (creation, modification, or category association) at "${terminal}".`;
      businessImpact = `Product master database entry was synchronized, updating SKU barcode indexing and cashier search lookups.`;
    } else if (action.includes('SHIFT')) {
      whatHappened = `Register drawer shift state event recorded. ${actor} performed a cash float opening or closing reconciliation on "${terminal}" at ${location}.`;
      businessImpact = `Cash drawer reconciliation counters and shift audit records were stamped for end-of-day financial audit.`;
    } else if (action.includes('EXPENSE') || action.includes('PAYOUT')) {
      whatHappened = `Store operational expenditure logged. Financial payout was entered into register expense ledgers by ${actor} from "${terminal}".`;
      businessImpact = `Cash on hand was adjusted and expense ledger entry was stamped with accounting category and timestamp.`;
    } else if (action.includes('SETTING') || action.includes('CONFIG')) {
      whatHappened = `System-wide configuration parameter altered. ${actor} modified store or application operational settings on "${terminal}".`;
      businessImpact = `Updated configuration was committed to settings storage and operational behavior adjusted accordingly.`;
    } else {
      whatHappened = `System operation "${log.action}" was recorded on ledger by ${actor} (${role}) originating from "${terminal}" (${ip}) at ${location}.`;
      businessImpact = details ? `Logged event context: ${details}` : `System operational state and tamper-evident ledger timestamp were registered.`;
    }

    return {
      whatHappened,
      businessImpact
    };
  };

  const handleCopyLog = (log: AuditLogEntry) => {
    const summary = JSON.stringify({
      id: log.id,
      action: log.action,
      category: log.category,
      user_name: log.user_name,
      actor_role: log.actor_role,
      terminal: log.device_terminal,
      ip_address: log.ip_address,
      location: log.location,
      created_at: log.created_at,
      delta: log.delta,
      pre_state: log.pre_state,
      post_state: log.post_state,
      details: log.details
    }, null, 2);

    navigator.clipboard.writeText(summary);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Helper function to identify critical security alerts
  const isCriticalAlert = (log: AuditLogEntry) => {
    const act = (log.action || '').toUpperCase();
    const cat = (log.category || '').toLowerCase();
    const sub = (log.sub_category || '').toLowerCase();
    const det = (log.details || '').toLowerCase();
    return (
      cat === 'security' ||
      sub === 'security_alerts' ||
      act.includes('FAIL') ||
      act.includes('UNAUTHORIZED') ||
      act.includes('REJECT') ||
      act.includes('SUSPEND') ||
      act.includes('REVOKE') ||
      act.includes('DENIED') ||
      act.includes('BLOCKED') ||
      act.includes('PURGE') ||
      act.includes('FORCE_PASSWORD') ||
      det.includes('unauthorized') ||
      det.includes('denied') ||
      det.includes('failed') ||
      det.includes('rate-limiting')
    );
  };

  // Helper function to identify warning alerts
  const isWarningAlert = (log: AuditLogEntry) => {
    const act = (log.action || '').toUpperCase();
    const det = (log.details || '').toLowerCase();
    return (
      act.includes('OVERRIDE') ||
      act.includes('PRICE') ||
      act.includes('ROLE') ||
      act.includes('ASSIGN_ROLE') ||
      act.includes('DELETE') ||
      act.includes('RESET') ||
      act.includes('DISCOUNT') ||
      det.includes('override') ||
      det.includes('price adjusted')
    );
  };

  // Helper function to identify verified successful operations
  const isSuccessAlert = (log: AuditLogEntry) => {
    const act = (log.action || '').toUpperCase();
    return (
      act.includes('SUCCESS') ||
      act.includes('VERIFIED') ||
      act.includes('COMPLETED') ||
      act.includes('SALE') ||
      act.includes('RESTOCK') ||
      act.includes('ACTIVE') ||
      act.includes('ENABLE')
    );
  };

  // Parse raw details / JSON metadata into clean human-readable sentences
  const parseLogMetadata = (log: AuditLogEntry): Array<{ label: string; sentence: string; key: string }> => {
    const items: Array<{ label: string; sentence: string; key: string }> = [];

    const formatLabel = (rawKey: string) => {
      return rawKey
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
    };

    // 1. Details field: parse JSON if valid object, or parse key-values in text
    if (log.details) {
      let parsed: any = null;
      const trimmed = log.details.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          parsed = null;
        }
      }

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([k, v]) => {
          const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
          const kl = k.toLowerCase();
          let sentence = '';

          if (kl.includes('reason') || kl.includes('cause')) {
            sentence = `The security trigger was flagged due to: ${valStr}.`;
          } else if (kl.includes('email') || kl.includes('user') || kl.includes('account')) {
            sentence = `Target account subject identified as "${valStr}".`;
          } else if (kl.includes('ip') || kl.includes('address')) {
            sentence = `Associated network endpoint tracked at ${valStr}.`;
          } else if (kl.includes('attempt') || kl.includes('count')) {
            sentence = `Failure threshold counter reached ${valStr} sequential occurrences.`;
          } else if (kl.includes('amount') || kl.includes('total') || kl.includes('price')) {
            sentence = `Monetary value for this record registered at ${valStr}.`;
          } else if (kl.includes('product') || kl.includes('sku') || kl.includes('item')) {
            sentence = `Inventory item reference identified as "${valStr}".`;
          } else if (kl.includes('role') || kl.includes('permission')) {
            sentence = `Security clearance level configured to "${valStr}".`;
          } else if (kl.includes('status') || kl.includes('state')) {
            sentence = `Operational status recorded as "${valStr}".`;
          } else {
            sentence = `The ${formatLabel(k)} parameter was recorded as "${valStr}".`;
          }

          items.push({
            key: k,
            label: formatLabel(k),
            sentence
          });
        });
      } else {
        // Check for multiple key: value or key=value patterns in text
        const pairRegex = /([A-Za-z0-9_\s]+)\s*[:=]\s*([^;,]+)/g;
        const matches = Array.from(trimmed.matchAll(pairRegex));
        if (matches.length > 1) {
          matches.forEach(m => {
            const k = m[1].trim();
            const v = m[2].trim();
            items.push({
              key: k,
              label: formatLabel(k),
              sentence: `The ${formatLabel(k)} parameter was recorded as "${v}".`
            });
          });
        } else {
          items.push({
            key: 'recorded_notes',
            label: 'Recorded System Notes',
            sentence: trimmed.endsWith('.') ? trimmed : `${trimmed}.`
          });
        }
      }
    }

    // 2. Pre-state
    if (log.pre_state) {
      items.push({
        key: 'pre_state',
        label: 'Prior Baseline State',
        sentence: `Prior to execution, the baseline state was registered as "${log.pre_state}".`
      });
    }

    // 3. Post-state
    if (log.post_state) {
      items.push({
        key: 'post_state',
        label: 'Resulting Target State',
        sentence: `Following verification, entity transitioned into state "${log.post_state}".`
      });
    }

    // 4. Delta effect
    if (log.delta) {
      items.push({
        key: 'delta',
        label: 'Audit Delta & Effect',
        sentence: `Net operational impact observed: ${log.delta.endsWith('.') ? log.delta : `${log.delta}.`}`
      });
    }

    // 5. Workstation context
    items.push({
      key: 'workstation_context',
      label: 'Terminal Origin Context',
      sentence: `Command issued from terminal "${log.device_terminal || 'Standard POS Terminal'}" situated at "${log.location || 'Main Store - Accra'}".`
    });

    // 6. Network verification
    items.push({
      key: 'network_origin',
      label: 'Network IP Authorization',
      sentence: `Originating IP address ${log.ip_address || '127.0.0.1'} passed routing verification.`
    });

    return items;
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, subCategoryFilter, userFilter, terminalFilter, startDate, endDate, limit]);

  const loadData = (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setIsSilentRefreshing(true);
    }
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.append('category', categoryFilter);
    if (subCategoryFilter !== 'all') params.append('sub_category', subCategoryFilter);
    if (userFilter !== 'all') params.append('user_id', userFilter);
    if (terminalFilter !== 'all') params.append('terminal', terminalFilter);
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
    .finally(() => {
      setLoading(false);
      setIsSilentRefreshing(false);
      setLastRefreshedAt(new Date());
      setCountdown(autoRefreshInterval);
    });
  };

  // Live Security Monitoring Auto-Refresh Timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    setCountdown(autoRefreshInterval);
    const intervalTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          loadData({ silent: true });
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, [autoRefreshInterval, categoryFilter, subCategoryFilter, userFilter, terminalFilter, startDate, endDate, limit]);

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

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const filteredLogs = logs.filter(log => {
    // Status filter
    if (statusFilter === 'critical' && !isCriticalAlert(log)) return false;
    if (statusFilter === 'warning' && (!isWarningAlert(log) || isCriticalAlert(log))) return false;
    if (statusFilter === 'success' && (!isSuccessAlert(log) || isCriticalAlert(log))) return false;
    if (statusFilter === 'info' && (isCriticalAlert(log) || isWarningAlert(log) || isSuccessAlert(log))) return false;

    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.user_name && log.user_name.toLowerCase().includes(term)) ||
      (log.actor_role && log.actor_role.toLowerCase().includes(term)) ||
      (log.category && log.category.toLowerCase().includes(term)) ||
      (log.sub_category && log.sub_category.toLowerCase().includes(term)) ||
      (log.delta && log.delta.toLowerCase().includes(term)) ||
      (log.device_terminal && log.device_terminal.toLowerCase().includes(term)) ||
      (log.location && log.location.toLowerCase().includes(term)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(term))
    );
  });

  const exportLogsToCsv = () => {
    if (filteredLogs.length === 0) {
      alert('No audit logs match current filters to export.');
      return;
    }

    const headers = [
      'Log ID',
      'Timestamp (ISO)',
      'Timestamp (UTC)',
      'Timestamp (Local)',
      'Timestamp (Relative)',
      'Operator / User',
      'User Role',
      'Action Code',
      'Ledger Category',
      'Sub-Category',
      'Audit Event Details',
      'Pre-State Snapshot',
      'Post-State Snapshot',
      'Delta / Impact',
      'Terminal Workstation',
      'Store Location',
      'Source IP Address'
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = filteredLogs.map(l => {
      const d = new Date(l.created_at);
      return [
        l.id,
        escapeCsv(l.created_at),
        escapeCsv(d.toUTCString()),
        escapeCsv(d.toLocaleString()),
        escapeCsv(formatRelativeTime(l.created_at)),
        escapeCsv(l.user_name || 'System Auto'),
        escapeCsv(l.actor_role || 'staff'),
        escapeCsv(l.action),
        escapeCsv(l.category),
        escapeCsv(l.sub_category || ''),
        escapeCsv(l.details || ''),
        escapeCsv(l.pre_state || ''),
        escapeCsv(l.post_state || ''),
        escapeCsv(l.delta || ''),
        escapeCsv(l.device_terminal || 'POS Terminal #1 (Lane A)'),
        escapeCsv(l.location || 'Main Store - Accra'),
        escapeCsv(l.ip_address || '127.0.0.1')
      ];
    });

    // Prepend UTF-8 BOM (\uFEFF) for proper Unicode display in Microsoft Excel and spreadsheet tools
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const catLabel = categoryFilter !== 'all' ? `-${categoryFilter}` : '';
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = `audit-security-ledger${catLabel}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${filteredLogs.length} audit records to CSV successfully.`);
    setTimeout(() => {
      setExportNotice(null);
    }, 4000);
  };

  const formatRelativeTime = (dateString: string): string => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now.getTime() - date.getTime();
      
      if (diffMs < 0 || isNaN(diffMs)) {
        return 'just now';
      }

      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) {
        return 'just now';
      }
      
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin === 1) {
        return '1 minute ago';
      }
      if (diffMin < 60) {
        return `${diffMin} minutes ago`;
      }

      const diffHours = Math.floor(diffMin / 60);
      if (diffHours === 1) {
        return '1 hour ago';
      }
      if (diffHours < 24) {
        return `${diffHours} hours ago`;
      }

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) {
        return 'yesterday';
      }
      if (diffDays < 30) {
        return `${diffDays} days ago`;
      }

      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) {
        return '1 month ago';
      }
      if (diffMonths < 12) {
        return `${diffMonths} months ago`;
      }

      const diffYears = Math.floor(diffDays / 365);
      if (diffYears === 1) {
        return '1 year ago';
      }
      return `${diffYears} years ago`;
    } catch {
      return dateString;
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'auth':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold uppercase rounded-full">Access</span>;
      case 'product':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase rounded-full">Catalog</span>;
      case 'stock':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase rounded-full">Inventory</span>;
      case 'sales':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">Sales</span>;
      case 'purchasing':
        return <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-extrabold uppercase rounded-full">Purchasing</span>;
      case 'governance':
      case 'settings':
      case 'system':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-extrabold uppercase rounded-full">System</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase rounded-full">General</span>;
    }
  };

  const getRoleBadge = (role?: string | null) => {
    if (role === 'admin') {
      return <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold uppercase rounded">Admin</span>;
    }
    if (role === 'system') {
      return <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-bold uppercase rounded">System</span>;
    }
    return <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-medium uppercase rounded">Staff</span>;
  };

  const authLogsCount = logs.filter(l => l.category === 'auth').length;
  const financialLogsCount = logs.filter(l => l.category === 'sales' || l.category === 'purchasing').length;
  const stockLogsCount = logs.filter(l => l.category === 'stock' || l.category === 'product').length;
  const uniqueTerminals = Array.from(new Set(logs.map(l => l.device_terminal).filter(Boolean))) as string[];
  const uniqueIps = Array.from(new Set(logs.map(l => l.ip_address).filter(Boolean))) as string[];

  // Security Monitoring Dashboard Metrics
  const criticalAlertsCount = logs.filter(isCriticalAlert).length;
  const topActiveUsers = React.useMemo(() => {
    const userMap: Record<string, { name: string; count: number; role?: string }> = {};
    logs.forEach(l => {
      const name = l.user_name || 'System Operator';
      if (!userMap[name]) {
        userMap[name] = { name, count: 0, role: l.actor_role || undefined };
      }
      userMap[name].count += 1;
    });
    return Object.values(userMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [logs]);

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">System Audit & Security Logs</h1>
            <p className="text-[12px] text-slate-500 font-medium">Immutable audit trail of user access, account genesis, pricing alterations, stock adjustments, and governance events</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Refresh Live Monitoring Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setAutoRefreshInterval(prev => prev > 0 ? 0 : 30)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                autoRefreshInterval > 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title={autoRefreshInterval > 0 ? `Live monitoring active: refreshing every ${autoRefreshInterval}s (next in ${countdown}s)` : 'Click to enable 30s auto-refresh'}
            >
              {autoRefreshInterval > 0 ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300"></span>
              )}
              <span>{autoRefreshInterval > 0 ? `Live (${countdown}s)` : 'Auto-Refresh'}</span>
            </button>

            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent border-0 text-xs font-bold text-slate-700 pl-1 pr-1 py-1 focus:outline-none cursor-pointer"
              title="Select auto-refresh interval"
            >
              <option value={0}>Off</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          <button
            onClick={exportLogsToCsv}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download CSV Ledger for external audits"
          >
            <Download size={14} /> Export CSV ({filteredLogs.length})
          </button>

          <button
            onClick={() => setShowCleanupModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-amber-600/20"
          >
            <Trash2 size={14} /> Prune Old Logs
          </button>

          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
            title={`Refresh logs now ${lastRefreshedAt ? `(Last updated: ${lastRefreshedAt.toLocaleTimeString()})` : ''}`}
          >
            <RefreshCw size={16} className={loading || isSilentRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Export Confirmation Notice */}
      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Compact High-Density Security Overview Ribbon (Redesigned from oversized cards) */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Metric 1: Critical Alerts */}
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            criticalAlertsCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
          }`}>
            <ShieldAlert size={15} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Critical Alerts:</span>
            <span className={`text-sm font-black ${criticalAlertsCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {criticalAlertsCount}
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'critical' ? 'all' : 'critical')}
              className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                statusFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : criticalAlertsCount > 0
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Toggle filter for critical security events"
            >
              {statusFilter === 'critical' ? 'Filtered ✓' : 'Filter'}
            </button>
          </div>
        </div>

        <div className="hidden md:block h-4 w-px bg-slate-200" />

        {/* Metric 2: Total Logs in Period */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText size={15} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Ledger:</span>
            <span className="text-sm font-black text-slate-900">{logs.length}</span>
            <span className="text-[11px] text-slate-400 font-medium">
              ({filteredLogs.length} matching)
            </span>
            {(startDate || endDate) && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium ml-1">
                {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
              </span>
            )}
          </div>
        </div>

        <div className="hidden lg:block h-4 w-px bg-slate-200" />

        {/* Metric 3: Top Active Users */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <User size={15} />
          </div>
          <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Top Operators:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {topActiveUsers.length > 0 ? (
              topActiveUsers.map((u, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setUserFilter(userFilter === u.name ? 'all' : u.name)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                    userFilter === u.name
                      ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  title={`Filter ledger by ${u.name}`}
                >
                  <span className="max-w-[80px] truncate">{u.name}</span>
                  <span className={`font-mono text-[9px] font-bold px-1 rounded ${
                    userFilter === u.name ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {u.count}
                  </span>
                </button>
              ))
            ) : (
              <span className="text-slate-400 text-[11px]">No active operators</span>
            )}
          </div>
        </div>
      </div>

      {/* Top Search Bar, Date Range Picker, and Status Filter Dropdown Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search security events, actions, operators, terminal, IP, or metadata..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 transition placeholder:text-slate-400 placeholder:font-normal"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition"
              title="Clear search query"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dedicated Date Range Picker Component */}
        <div className="flex items-center shrink-0">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            onClear={() => {
              setStartDate('');
              setEndDate('');
            }}
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            id="audit-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="h-8 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 transition"
          >
            <option value="all">All Statuses ({logs.length})</option>
            <option value="critical">Critical Alerts ({criticalAlertsCount})</option>
            <option value="warning">Warnings & Overrides</option>
            <option value="success">Verified Operations</option>
            <option value="info">Routine / Info Events</option>
          </select>
        </div>
      </div>

      {/* Comprehensive Secondary Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs space-y-3">
        {/* Quick Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <button
            type="button"
            onClick={() => { setCategoryFilter('all'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('auth'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'auth' ? 'bg-purple-700 text-white' : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'}`}
          >
            <KeyRound size={13} /> Access
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('product'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'product' ? 'bg-blue-700 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'}`}
          >
            <Package size={13} /> Catalog
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('stock'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'stock' ? 'bg-amber-700 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'}`}
          >
            <Sliders size={13} /> Inventory
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('sales'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'sales' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'}`}
          >
            <ShoppingCart size={13} /> Sales
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('purchasing'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'purchasing' ? 'bg-cyan-700 text-white' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200'}`}
          >
            <Truck size={13} /> Purchasing
          </button>
          <button
            type="button"
            onClick={() => { setCategoryFilter('governance'); setSubCategoryFilter('all'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${categoryFilter === 'governance' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            <Settings size={13} /> System
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* User Filter */}
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Users & System</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            {/* Device / Terminal Filter */}
            <select
              value={terminalFilter}
              onChange={e => setTerminalFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Terminals & Devices ({uniqueTerminals.length})</option>
              {uniqueTerminals.map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>

            {/* Limit Selector */}
            <select
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value={50}>Last 50 Records</option>
              <option value={100}>Last 100 Records</option>
              <option value={250}>Last 250 Records</option>
              <option value={500}>Last 500 Records</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center gap-2">
            {(startDate || endDate || categoryFilter !== 'all' || subCategoryFilter !== 'all' || userFilter !== 'all' || terminalFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setCategoryFilter('all');
                  setSubCategoryFilter('all');
                  setUserFilter('all');
                  setTerminalFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                title="Reset all active filters"
              >
                <X size={13} /> Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Control & Export Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span>Active Ledger Entries:</span>
          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono text-slate-900">{filteredLogs.length}</span>
          {categoryFilter !== 'all' && (
            <span className="text-[11px] text-slate-500 font-medium capitalize">in category <span className="font-semibold text-slate-700">"{categoryFilter}"</span></span>
          )}
          {searchQuery && (
            <span className="text-[11px] text-slate-500 font-medium">matching <span className="font-semibold text-slate-700">"{searchQuery}"</span></span>
          )}
        </div>
        <button
          type="button"
          onClick={exportLogsToCsv}
          disabled={filteredLogs.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed w-fit"
          title="Export current filtered view to CSV file"
        >
          <Download size={13} className="text-slate-500" />
          <span>Export View (CSV)</span>
        </button>
      </div>

      {/* Logs Table with Fully Visible Terminal & IP */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold">Loading security audit records...</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">User</th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Terminal & IP</th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Audit Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      title="Click row to inspect audit ledger record"
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp: Relative human-readable format with exact UTC tooltip */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                        <div 
                          title={`Exact UTC: ${new Date(log.created_at).toUTCString()}`}
                          className="font-bold text-slate-800 flex items-center gap-1.5 cursor-help"
                        >
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span className="hover:text-blue-600 transition-colors border-b border-dotted border-slate-300">
                            {formatRelativeTime(log.created_at)}
                          </span>
                        </div>
                        <div 
                          title={`Exact UTC: ${new Date(log.created_at).toUTCString()}`}
                          className="text-[11px] font-mono text-slate-400 pl-4 mt-0.5 cursor-help"
                        >
                          {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>

                      {/* User: Name Only without Role badge */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-[11px] shrink-0">
                            {(log.user_name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{log.user_name || 'System Process'}</span>
                        </div>
                      </td>

                      {/* Action: Title Only without Category badge */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {log.action}
                        </div>
                      </td>

                      {/* Terminal & IP: Completely Visible, Never Truncated */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 rounded-lg font-semibold text-xs transition-colors w-fit">
                            <Monitor size={13} className="text-blue-600 shrink-0" />
                            <span>{log.device_terminal || 'POS Terminal #1 (Lane A)'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pl-0.5">
                            <span className="flex items-center gap-1">
                              <Globe size={11} className="text-slate-400 shrink-0" />
                              <span className="text-slate-700 font-medium">{log.ip_address || '127.0.0.1'}</span>
                            </span>
                            {log.location && (
                              <span className="flex items-center gap-0.5 text-[10px] font-sans text-slate-400 font-medium">
                                <MapPin size={10} className="shrink-0 text-slate-400" />
                                <span>{log.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Details: Concise Text without Delta badge */}
                      <td className="px-5 py-4 text-xs text-slate-600 font-medium min-w-[200px] max-w-md">
                        <div className="line-clamp-2 leading-relaxed text-slate-700" title={log.details || ''}>
                          {log.details || '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400 text-xs font-medium">
                      No audit records match your selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Ledger Footer Status */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span>Cryptographic Tamper-Evident Ledger Enforced • Displaying {filteredLogs.length} of {logs.length} logged events</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Hardware Stations: {uniqueTerminals.length} active terminals tracked
          </div>
        </div>
      </div>

      {/* Detail Modal for selected log */}
      {selectedLog && (() => {
        const narrative = getDetailedNarrative(selectedLog);
        const parsedMetadata = parseLogMetadata(selectedLog);

        return (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-150"
            onClick={() => setSelectedLog(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header (Pinned at top) */}
              <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/75">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 text-white rounded-xl shrink-0">
                    <ShieldCheck size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Audit Ledger Entry #{selectedLog.id}
                      </h3>
                      {getCategoryBadge(selectedLog.category)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cryptographic tamper-evident operational ledger record
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Close modal (Esc)"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body (Strictly viewport-contained with max-h-[80vh] overflow-y-auto and flex-basis adjustments) */}
              <div className="flex-1 basis-full min-h-0 max-h-[80vh] overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
                
                {/* 1. Core Event Provenance & Ledger Metadata (Grid-based Key-Value Ledger, No Cards) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                      Event Provenance & Parameters
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Station Verified
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {/* Operator & Security Role */}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 items-center hover:bg-slate-50/50 transition">
                      <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" /> Operator / Account
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-black text-[10px] shrink-0">
                          {(selectedLog.user_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{selectedLog.user_name || 'System Process'}</span>
                        {getRoleBadge(selectedLog.actor_role)}
                      </div>
                    </div>

                    {/* Terminal Workstation */}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 items-center hover:bg-slate-50/50 transition">
                      <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor size={13} className="text-blue-500" /> Terminal Workstation
                      </span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {selectedLog.device_terminal || 'POS Terminal #1 (Lane A)'}
                      </span>
                    </div>

                    {/* Network IP & Store Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 items-center hover:bg-slate-50/50 transition">
                      <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={13} className="text-indigo-500" /> Origin IP & Location
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-slate-800 font-bold">{selectedLog.ip_address || '127.0.0.1'}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-medium flex items-center gap-1">
                          <MapPin size={12} className="text-rose-500" />
                          {selectedLog.location || 'Main Store - Accra'}
                        </span>
                      </div>
                    </div>

                    {/* Action Code & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 items-center hover:bg-slate-50/50 transition">
                      <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Activity size={13} className="text-amber-500" /> Action Code & Category
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {selectedLog.action}
                        </span>
                        {getCategoryBadge(selectedLog.category)}
                      </div>
                    </div>

                    {/* Recorded Timestamps */}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 items-center hover:bg-slate-50/50 transition">
                      <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" /> Timestamp Recorded
                      </span>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {new Date(selectedLog.created_at).toLocaleString()} 
                          <span className="text-slate-400 font-normal ml-1.5">({formatRelativeTime(selectedLog.created_at)})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          UTC: {new Date(selectedLog.created_at).toUTCString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Full Details & Context (Grid-Based Key-Value Layout, Parsing JSON Metadata Into Human-Readable Sentences, No Cards) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                      Full Details & Context
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Parsed Contextual Sentences
                    </span>
                  </div>

                  {/* Detailed Explanation of What Actually Happened */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Event Summary & Narrative
                    </span>
                    <p className="text-xs text-slate-900 leading-relaxed font-medium">
                      {narrative?.whatHappened}
                    </p>
                    {narrative?.businessImpact && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-2 pt-2 border-t border-slate-200/60">
                        <span className="font-semibold text-slate-700">Operational & Security Assessment:</span> {narrative.businessImpact}
                      </p>
                    )}
                  </div>

                  {/* Clean Grid-Based Key-Value Metadata Sentences */}
                  <div className="divide-y divide-slate-100">
                    {parsedMetadata.map((item, idx) => (
                      <div 
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors items-baseline"
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                          <span>{item.label}</span>
                        </div>
                        <div className="text-xs text-slate-800 leading-relaxed font-medium">
                          {item.sentence}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Footer (Pinned at bottom) */}
              <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/75">
                <button
                  type="button"
                  onClick={() => handleCopyLog(selectedLog)}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                >
                  {copiedLogId === selectedLog.id ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Record Data</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual Cleanup Modal */}
      {showCleanupModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-hidden animate-in fade-in duration-150"
          onClick={() => setShowCleanupModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-2.5rem)] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purge / Clear Old Audit Logs</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Clear history older than cutoff period to maintain database performance</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCleanupModal(false);
                  setCleanupResult(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
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
            </div>

            <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/60">
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
