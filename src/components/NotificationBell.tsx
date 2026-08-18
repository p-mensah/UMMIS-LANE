import React, { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Bell, RefreshCw, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'warnings'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

      {/* Normal-Sized In-App Notifications Popover */}
      {isOpen && (
        <div 
          id="notification-inbox-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[440px] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">In-App Notifications</h3>
              <p className="text-[11px] text-slate-400 font-medium">System warnings & operational alerts</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={refreshNotifications}
                className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <CheckCheck size={11} />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="inline-flex bg-slate-200/70 p-0.5 rounded text-[11px] font-medium">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'unread' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('warnings')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'warnings' ? 'bg-white text-amber-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Warnings
              </button>
            </div>

            {notifications.some(n => n.is_read === 1) && (
              <button
                onClick={handleClearRead}
                className="text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors"
                title="Clear read items"
              >
                Clear Read
              </button>
            )}
          </div>

          {/* Notification Items List (3 Distinct Semantic Colors: Red, Amber, Slate) */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[160px] bg-slate-50/50">
            {filtered.length > 0 ? (
              filtered.map(item => {
                const semanticType = getSemanticType(item);
                const isRead = item.is_read === 1;

                // Color 1: Critical (Red)
                // Color 2: Warning (Amber)
                // Color 3: Info (Slate)
                let itemClasses = 'bg-white border-slate-200 text-slate-900';
                let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
                let badgeLabel = 'INFO';

                if (semanticType === 'critical') {
                  itemClasses = isRead 
                    ? 'bg-rose-50/40 border-rose-100 text-slate-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-medium';
                  badgeClasses = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                  badgeLabel = 'CRITICAL';
                } else if (semanticType === 'warning') {
                  itemClasses = isRead 
                    ? 'bg-amber-50/40 border-amber-100 text-slate-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-950 font-medium';
                  badgeClasses = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
                  badgeLabel = 'WARNING';
                } else {
                  itemClasses = isRead 
                    ? 'bg-white border-slate-200 text-slate-600' 
                    : 'bg-slate-50 border-slate-300 text-slate-900';
                  badgeClasses = 'bg-slate-200 text-slate-700 border-slate-300 font-semibold';
                  badgeLabel = 'INFO';
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 text-xs rounded border transition-all cursor-pointer hover:shadow-xs flex flex-col gap-1.5 ${itemClasses}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border ${badgeClasses}`}>
                          {badgeLabel}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {timeAgo(item.created_at)}
                        </span>
                        {item.is_read === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" title="Unread" />
                        )}
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-normal font-normal">
                      {item.message}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No notifications in this view.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium">
            System Alerts & Operational Warnings
          </div>
        </div>
      )}
    </div>
  );
}
