import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { 
  Bell, CheckCircle2, AlertTriangle, Info, AlertCircle, Trash2, ExternalLink, RefreshCw,
  Sparkles, Heart, BellRing, CheckCheck, Smile, PartyPopper, MessageSquare, Zap
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

  const getCuteIcon = (type: string, title: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('sale') || titleLower.includes('sold')) {
      return (
        <span className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
          🛍️
        </span>
      );
    }
    if (titleLower.includes('stock') || titleLower.includes('inventory')) {
      return (
        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
          📦
        </span>
      );
    }
    if (titleLower.includes('purchase') || titleLower.includes('po')) {
      return (
        <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
          🚚
        </span>
      );
    }

    switch (type) {
      case 'danger':
        return (
          <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
            🌸
          </span>
        );
      case 'warning':
        return (
          <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
            🎀
          </span>
        );
      case 'success':
        return (
          <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
            ✨
          </span>
        );
      default:
        return (
          <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
            💡
          </span>
        );
    }
  };

  const isStockAlert = (title: string, message: string) => {
    const text = (title + ' ' + message).toLowerCase();
    return text.includes('stock') || text.includes('reorder') || text.includes('inventory');
  };

  const getCuteCardBg = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-white/70 border-slate-100 opacity-80 hover:opacity-100';
    switch (type) {
      case 'danger':
        return 'bg-rose-50/90 border-rose-200/80 hover:border-rose-300';
      case 'warning':
        return 'bg-amber-50/90 border-amber-200/80 hover:border-amber-300';
      case 'success':
        return 'bg-emerald-50/90 border-emerald-200/80 hover:border-emerald-300';
      default:
        return 'bg-indigo-50/90 border-indigo-200/80 hover:border-indigo-300';
    }
  };

  const timeAgo = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 60) return 'Just now ✨';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Cute Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 hover:from-pink-100 hover:to-indigo-100 text-indigo-700 rounded-full border border-indigo-100/80 transition-all transform active:scale-95 shadow-2xs focus:outline-none group"
        title="System Notifications ✨"
      >
        <BellRing size={19} className="group-hover:rotate-12 transition-transform text-indigo-600" />
        
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] bg-pink-400 rounded-full animate-ping opacity-75 pointer-events-none" />
          </>
        )}
      </button>

      {/* Cute Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-purple-100/80 z-50 overflow-hidden flex flex-col max-h-[540px] animate-in fade-in slide-in-from-top-3 duration-200">
          
          {/* Cute Pastel Header */}
          <div className="p-4 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                <Sparkles size={18} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wider">In-App Inbox</h3>
                  <span className="text-xs">✨</span>
                </div>
                <p className="text-[10px] text-pink-100/90 font-medium">Real-time alerts & system logs</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={refreshNotifications}
                className="p-1.5 hover:bg-white/20 text-white rounded-xl transition-all active:scale-90"
                title="Refresh alerts"
              >
                <RefreshCw size={14} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-black uppercase bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl transition-all shadow-2xs flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Read All
                </button>
              )}
            </div>
          </div>

          {/* Cute Filter Toolbar */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-purple-50/50 border-b border-purple-100 text-[11px] font-bold">
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-purple-100/80 shadow-2xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-xl transition-all text-[11px] ${
                  filter === 'all' 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black shadow-xs' 
                    : 'text-slate-500 hover:text-purple-700'
                }`}
              >
                All 💌 ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-xl transition-all text-[11px] ${
                  filter === 'unread' 
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black shadow-xs' 
                    : 'text-slate-500 hover:text-pink-700'
                }`}
              >
                Unread 🎀 ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('alerts')}
                className={`px-3 py-1 rounded-xl transition-all text-[11px] ${
                  filter === 'alerts' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black shadow-xs' 
                    : 'text-slate-500 hover:text-amber-700'
                }`}
              >
                Alerts ⚡
              </button>
            </div>

            {notifications.some(n => n.is_read === 1) && (
              <button
                onClick={handleClearRead}
                className="text-[10px] font-bold text-purple-400 hover:text-rose-600 transition-colors flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-rose-50"
                title="Clear read items"
              >
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>

          {/* Cute Notification Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[220px] bg-slate-50/30">
            {/* Quick Reorder Shortcut Banner if low stock items exist */}
            {notifications.some(n => isStockAlert(n.title, n.message) && n.is_read === 0) && (
              <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 shadow-2xs mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">⚡</span>
                  <span className="truncate text-[11px] font-black">Low-stock alerts!</span>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/purchases?reorder=all');
                  }}
                  className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2.5 py-1 rounded-xl shadow-2xs transition-all active:scale-95"
                >
                  Reorder All Low Stock 🚚
                </button>
              </div>
            )}

            {filtered.length > 0 ? (
              filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 text-xs rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-start gap-3 ${getCuteCardBg(item.type, item.is_read === 1)}`}
                >
                  {getCuteIcon(item.type, item.title)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`font-black tracking-tight truncate ${item.is_read === 0 ? 'text-slate-900 text-[12px]' : 'text-slate-700 text-[11px]'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[9px] font-bold text-purple-400 shrink-0 bg-white/80 px-2 py-0.5 rounded-full border border-purple-100">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-2">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {isStockAlert(item.title, item.message) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.is_read === 0) handleMarkAsRead(item.id);
                            setIsOpen(false);
                            let targetLink = item.link || '/purchases?reorder=all';
                            if (!targetLink.includes('reorder')) {
                              targetLink = `/purchases?reorder=${item.id}`;
                            }
                            navigate(targetLink);
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-900 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 hover:from-amber-300 hover:to-orange-400 px-3 py-1 rounded-xl shadow-2xs border border-amber-300 transition-all hover:scale-105 active:scale-95"
                        >
                          <Zap size={12} className="text-amber-800 fill-amber-600" />
                          <span>Quick Reorder ⚡</span>
                        </button>
                      ) : item.link && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-700 hover:underline bg-white px-2 py-0.5 rounded-lg border border-purple-100">
                          View Details <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1 text-slate-300 hover:text-rose-500 rounded-full hover:bg-rose-100/50 transition-colors"
                    title="Dismiss"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            ) : (
              /* Cute Empty State */
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2 py-12">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-100 via-purple-100 to-indigo-100 flex items-center justify-center text-2xl shadow-inner border border-purple-100">
                  🌸
                </div>
                <div className="font-black text-slate-700 text-xs mt-1">All Clear & Cute! ✨</div>
                <p className="text-[11px] text-slate-400 font-medium max-w-[200px] leading-relaxed">
                  No notifications match your selected tab. Check back later ~
                </p>
              </div>
            )}
          </div>

          {/* Cute Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-purple-100 text-center text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1">
            <Sparkles size={11} className="text-pink-500" />
            <span>Ummis Lane System Notifications</span>
            <Sparkles size={11} className="text-pink-500" />
          </div>

        </div>
      )}
    </div>
  );
}
