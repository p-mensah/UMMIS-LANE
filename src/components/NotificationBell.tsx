import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Bell, RefreshCw, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'warnings'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, unreadCount, refreshNotifications } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetchApi(`/notifications/${id}/read`, { method: 'PUT' });
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetchApi('/notifications/read-all', { method: 'PUT' });
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetchApi(`/notifications/${id}`, { method: 'DELETE' });
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearRead = async () => {
    try {
      await fetchApi('/notifications/clear-all', { method: 'DELETE' });
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (item: any) => {
    if (item.is_read === 0) {
      handleMarkAsRead(item.id);
    }
    setIsOpen(false);

    // Direct navigation to the target page
    let target = item.link;
    if (!target || target.trim() === '') {
      const text = ((item.title || '') + ' ' + (item.message || '')).toLowerCase();
      if (text.includes('stock') || text.includes('inventory') || text.includes('catalog') || text.includes('product')) {
        target = '/products';
      } else if (text.includes('purchase') || text.includes('restock') || text.includes('supplier') || text.includes('reorder')) {
        target = user?.role === 'admin' ? '/purchases' : '/products';
      } else if (text.includes('sale') || text.includes('pos') || text.includes('terminal') || text.includes('receipt')) {
        target = '/sales';
      } else if (text.includes('shift') || text.includes('register') || text.includes('cash drawer')) {
        target = '/shifts';
      } else if (text.includes('return') || text.includes('refund') || text.includes('credit note')) {
        target = '/returns';
      } else if (text.includes('expense') || text.includes('payout')) {
        target = '/expenses';
      } else if (text.includes('user') || text.includes('staff') || text.includes('role')) {
        target = '/users';
      } else if (text.includes('audit') || text.includes('security') || text.includes('override')) {
        target = '/audit-logs';
      } else {
        target = '/';
      }
    }

    if (target) {
      navigate(target);
    }
  };

  const isWarningOrCritical = (item: any) => {
    const text = ((item.title || '') + ' ' + (item.message || '')).toLowerCase();
    return item.type === 'danger' || item.type === 'warning' || text.includes('stock') || text.includes('critical') || text.includes('alert');
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return n.is_read === 0;
    if (filter === 'warnings') return isWarningOrCritical(n);
    return true;
  });

  // Categorize strictly into 3 colors: 'critical' (Red), 'warning' (Amber), 'info' (Slate)
  const getSemanticType = (item: any): 'critical' | 'warning' | 'info' => {
    const text = ((item.title || '') + ' ' + (item.message || '')).toLowerCase();
    if (item.type === 'danger' || text.includes('out of stock') || text.includes('stockout') || text.includes('critical') || text.includes('error')) {
      return 'critical';
    }
    if (item.type === 'warning' || text.includes('low stock') || text.includes('reorder') || text.includes('threshold') || text.includes('warning')) {
      return 'warning';
    }
    return 'info';
  };

  const timeAgo = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Normal-sized Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Redesigned In-App Notifications Center Popover */}
      {isOpen && (
        <div 
          id="notification-inbox-popover"
          className="absolute right-0 mt-2.5 w-84 sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Bar (#111827) */}
          <div className="px-4 py-3.5 bg-[#111827] text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <span>In-App Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 text-[10px] font-mono rounded font-bold">
                      {unreadCount} NEW
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Real-time alerts, stock warnings & register updates</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={refreshNotifications}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Refresh notifications"
              >
                <RefreshCw size={14} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <CheckCheck size={12} className="text-emerald-400" />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Navigation Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="inline-flex bg-slate-200/70 p-0.5 rounded-lg border border-slate-200 text-[11px] font-medium">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filter === 'all' ? 'bg-white text-slate-900 font-extrabold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filter === 'unread' ? 'bg-white text-slate-900 font-extrabold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('warnings')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filter === 'warnings' ? 'bg-white text-slate-900 font-extrabold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Warnings
              </button>
            </div>

            {notifications.some(n => n.is_read === 1) && (
              <button
                onClick={handleClearRead}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                title="Clear read items"
              >
                Clear Read
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px] max-h-[340px] bg-slate-100/60 custom-scrollbar">
            {filtered.length > 0 ? (
              filtered.map(item => {
                const semanticType = getSemanticType(item);
                const isRead = item.is_read === 1;

                let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
                let badgeLabel = 'INFO';
                let dotColor = 'bg-blue-500';

                if (semanticType === 'critical') {
                  badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                  badgeLabel = 'CRITICAL';
                  dotColor = 'bg-rose-500';
                } else if (semanticType === 'warning') {
                  badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                  badgeLabel = 'WARNING';
                  dotColor = 'bg-amber-500';
                }

                const cardBase = isRead
                  ? 'bg-white/80 border-slate-200 text-slate-700 hover:border-slate-300'
                  : 'bg-white border-slate-300 shadow-xs text-slate-900 ring-1 ring-slate-900/5 hover:border-slate-400';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 text-xs rounded-xl border transition-all cursor-pointer hover:shadow-sm flex flex-col gap-1.5 ${cardBase}`}
                    title="Click to view details directly"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border shrink-0 ${badgeClasses}`}>
                          {badgeLabel}
                        </span>
                        <h4 className={`text-xs tracking-tight truncate ${isRead ? 'font-semibold text-slate-800' : 'font-black text-slate-900'}`}>
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium font-mono">
                          {timeAgo(item.created_at)}
                        </span>
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Unread" />
                        )}
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Dismiss"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <p className={`text-[11px] leading-relaxed pl-3.5 ${isRead ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between pt-1 pl-3.5 text-[10px] text-blue-600 font-bold group-hover:underline">
                      <span>Jump to page</span>
                      <span className="text-slate-400">→</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <CheckCheck size={28} className="text-slate-300" />
                <span>All caught up! No notifications in this view.</span>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-3 py-2 bg-white border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium flex items-center justify-between">
            <span>In-App Notification Dispatcher</span>
            <span className="text-emerald-600 font-bold">Live Synced</span>
          </div>
        </div>
      )}
    </div>
  );
}
