import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { 
  Bell, CheckCircle2, AlertTriangle, Info, AlertCircle, Trash2, ExternalLink, RefreshCw 
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');
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
    if (item.link) {
      setIsOpen(false);
      navigate(item.link);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return n.is_read === 0;
    if (filter === 'alerts') return n.type === 'warning' || n.type === 'danger';
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return <AlertCircle size={15} className="text-red-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={15} className="text-amber-600 shrink-0" />;
      case 'success':
        return <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />;
      default:
        return <Info size={15} className="text-blue-600 shrink-0" />;
    }
  };

  const getTypeBg = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-slate-100/50';
    switch (type) {
      case 'danger':
        return 'bg-red-50/80 border-l-2 border-l-red-500';
      case 'warning':
        return 'bg-amber-50/80 border-l-2 border-l-amber-500';
      case 'success':
        return 'bg-emerald-50/80 border-l-2 border-l-emerald-500';
      default:
        return 'bg-blue-50/80 border-l-2 border-l-blue-500';
    }
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
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-md shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-blue-400" />
              <h3 className="text-xs font-black uppercase tracking-wider">System Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-extrabold rounded-full border border-red-500/30">
                  {unreadCount} New
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={refreshNotifications}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold">
            <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded transition-all ${filter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded transition-all ${filter === 'unread' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('alerts')}
                className={`px-2.5 py-1 rounded transition-all ${filter === 'alerts' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Alerts
              </button>
            </div>

            {notifications.some(n => n.is_read === 1) && (
              <button
                onClick={handleClearRead}
                className="text-[10px] text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} /> Clear Read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-[220px]">
            {filtered.length > 0 ? (
              filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 text-xs flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-100/80 ${getTypeBg(item.type, item.is_read === 1)}`}
                >
                  <div className="mt-0.5">{getTypeIcon(item.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`font-bold text-slate-900 truncate ${item.is_read === 0 ? 'font-black text-[12px]' : 'text-[11px] text-slate-700'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[9px] text-slate-400 shrink-0 font-medium">{timeAgo(item.created_at)}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {item.link && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 mt-1 hover:underline">
                        View Details <ExternalLink size={10} />
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="opacity-80 hover:opacity-100 p-1 text-slate-300 hover:text-red-600 rounded transition-opacity"
                    title="Delete notification"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Bell size={28} className="opacity-30 stroke-1" />
                <p className="text-xs font-medium">No notifications matching your filter.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
