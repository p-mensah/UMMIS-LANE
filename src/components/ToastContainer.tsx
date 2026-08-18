import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, Info, X, ExternalLink, ShoppingBag, Truck, Heart, Zap
} from 'lucide-react';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  link?: string;
  duration?: number; // ms
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { key?: string; toast: Toast; onDismiss: (id: string) => void }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration || 5000;

  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          return 0;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, isPaused]);

  useEffect(() => {
    if (progress <= 0) {
      onDismiss(toast.id);
    }
  }, [progress, toast.id, onDismiss]);

  const handleClick = () => {
    if (toast.link) {
      onDismiss(toast.id);
      navigate(toast.link);
    }
  };

  const getCuteEmojiIcon = () => {
    const titleLower = toast.title.toLowerCase();
    if (titleLower.includes('sale') || titleLower.includes('sold')) {
      return '🛍️';
    }
    if (titleLower.includes('purchase') || titleLower.includes('po')) {
      return '🚚';
    }
    if (titleLower.includes('stock') || titleLower.includes('inventory')) {
      return '📦';
    }
    switch (toast.type) {
      case 'danger':
        return '🌸';
      case 'warning':
        return '🎀';
      case 'success':
        return '✔️';
      default:
        return '💡';
    }
  };

  const getCuteStyling = () => {
    switch (toast.type) {
      case 'danger':
        return {
          card: 'bg-rose-50/95 border-rose-200/90 shadow-rose-100',
          badgeBg: 'bg-rose-100 text-rose-700',
          progressBg: 'bg-gradient-to-r from-rose-400 to-pink-500'
        };
      case 'warning':
        return {
          card: 'bg-amber-50/95 border-amber-200/90 shadow-amber-100',
          badgeBg: 'bg-amber-100 text-amber-800',
          progressBg: 'bg-gradient-to-r from-amber-400 to-orange-500'
        };
      case 'success':
        return {
          card: 'bg-emerald-50/95 border-emerald-200/90 shadow-emerald-100',
          badgeBg: 'bg-emerald-100 text-emerald-800',
          progressBg: 'bg-gradient-to-r from-emerald-400 to-teal-500'
        };
      default:
        return {
          card: 'bg-indigo-50/95 border-indigo-200/90 shadow-indigo-100',
          badgeBg: 'bg-indigo-100 text-indigo-800',
          progressBg: 'bg-gradient-to-r from-indigo-400 to-purple-500'
        };
    }
  };

  const styling = getCuteStyling();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md p-3.5 flex items-start gap-3 transition-all cursor-pointer hover:scale-[1.02] animate-in slide-in-from-top-4 fade-in duration-200 ${styling.card}`}
    >
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ${styling.badgeBg}`}>
        {getCuteEmojiIcon()}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-black text-slate-900 truncate tracking-tight">
            {toast.title}
          </h4>
          <span className="text-[9px] font-black uppercase tracking-wider bg-white/80 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100">
            Alert
          </span>
        </div>

        <p className="text-[11px] text-slate-700 font-medium mt-0.5 leading-relaxed">
          {toast.message}
        </p>

        {(toast.title + ' ' + toast.message).toLowerCase().includes('stock') || (toast.link && toast.link.includes('reorder')) ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
              const target = toast.link || '/purchases?reorder=all';
              navigate(target.includes('reorder') ? target : '/purchases?reorder=all');
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black text-amber-900 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 hover:from-amber-300 hover:to-orange-400 px-2.5 py-1 rounded-xl shadow-2xs border border-amber-300 transition-all hover:scale-105 active:scale-95"
          >
            <Zap size={11} className="text-amber-800 fill-amber-600" />
            <span>Quick Reorder ⚡</span>
          </button>
        ) : toast.link && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-700 bg-white px-2 py-0.5 rounded-lg border border-purple-100 hover:underline">
            <span>View details</span>
            <ExternalLink size={10} />
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-black/5 transition-colors"
        title="Dismiss"
      >
        <X size={14} />
      </button>

      {/* Cute Rounded Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
        <div
          className={`h-full transition-all duration-75 rounded-r-full ${styling.progressBg}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
