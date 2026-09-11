import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Bell, RefreshCw, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
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
        target = '/purchases';
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

      {/* Normal-Sized In-App Notifications Popover */}
      {isOpen && (
        <div 
          id="notification-inbox-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[440px] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-black text-white flex items-center justify-between border-b border-black">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">In-App Notifications</h3>
              <p className="text-[11px] text-zinc-400 font-medium">System alerts & operational updates</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={refreshNotifications}
                className="p-1 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-zinc-700"
                >
                  <CheckCheck size={11} />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-zinc-200 text-xs">
            <div className="inline-flex bg-zinc-100 p-0.5 rounded border border-zinc-200 text-[11px] font-medium">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'all' ? 'bg-black text-white font-bold' : 'text-zinc-700 hover:text-black'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'unread' ? 'bg-black text-white font-bold' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('warnings')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  filter === 'warnings' ? 'bg-black text-white font-bold' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Warnings
              </button>
            </div>

            {notifications.some(n => n.is_read === 1) && (
              <button
                onClick={handleClearRead}
                className="text-[11px] font-semibold text-zinc-600 hover:text-black transition-colors"
                title="Clear read items"
              >
                Clear Read
              </button>
            )}
          </div>

          {/* Notification Items List - Strict Black & White card styling aside from the tags */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[160px] bg-zinc-50">
            {filtered.length > 0 ? (
              filtered.map(item => {
                const semanticType = getSemanticType(item);
                const isRead = item.is_read === 1;

                // Color tags: CRITICAL (Red), WARNING (Amber), INFO (Blue)
                let badgeClasses = 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
                let badgeLabel = 'INFO';

                if (semanticType === 'critical') {
                  badgeClasses = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                  badgeLabel = 'CRITICAL';
                } else if (semanticType === 'warning') {
                  badgeClasses = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
                  badgeLabel = 'WARNING';
                } else {
                  badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                  badgeLabel = 'INFO';
                }

                // Strict Black and White card styling
                const cardBase = isRead
                  ? 'bg-white border-zinc-200 text-zinc-700'
                  : 'bg-white border-black/30 shadow-2xs text-black ring-1 ring-black/10';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 text-xs rounded-lg border transition-all cursor-pointer hover:border-black hover:shadow-sm flex flex-col gap-1.5 ${cardBase}`}
                    title="Click to view details directly"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Only the status tags have colors */}
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border ${badgeClasses}`}>
                          {badgeLabel}
                        </span>
                        <h4 className={`text-xs tracking-tight ${isRead ? 'font-semibold text-zinc-900' : 'font-extrabold text-black'}`}>
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-medium font-mono">
                          {timeAgo(item.created_at)}
                        </span>
                        {item.is_read === 0 && (
                          <span className="w-2 h-2 rounded-full bg-black shrink-0" title="Unread notification" />
                        )}
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-zinc-400 hover:text-black p-0.5 rounded transition-colors"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    <p className={`text-[11px] leading-relaxed ${isRead ? 'text-zinc-600' : 'text-zinc-900 font-normal'}`}>
                      {item.message}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-zinc-400 text-xs">
                No notifications in this view.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-white border-t border-zinc-200 text-center text-[10px] text-zinc-600 font-medium">
            System Alerts & Operational Warnings • Click notice to navigate
          </div>
        </div>
      )}
    </div>
  );
}
