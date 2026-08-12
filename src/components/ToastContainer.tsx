import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, Info, X, ExternalLink, ShoppingBag, Truck
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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
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

  const getIcon = () => {
    if (toast.title.toLowerCase().includes('sale')) {
      return <ShoppingBag size={18} className="text-emerald-600 shrink-0" />;
    }
    if (toast.title.toLowerCase().includes('purchase') || toast.title.toLowerCase().includes('po')) {
      return <Truck size={18} className="text-blue-600 shrink-0" />;
    }
    switch (toast.type) {
      case 'danger':
        return <AlertCircle size={18} className="text-red-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-600 shrink-0" />;
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />;
      default:
        return <Info size={18} className="text-blue-600 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'danger':
        return 'border-l-4 border-l-red-500 border-red-200 bg-red-50/95';
      case 'warning':
        return 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/95';
      case 'success':
        return 'border-l-4 border-l-emerald-500 border-emerald-200 bg-emerald-50/95';
      default:
        return 'border-l-4 border-l-blue-500 border-blue-200 bg-blue-50/95';
    }
  };

  const getProgressBg = () => {
    switch (toast.type) {
      case 'danger':
        return 'bg-red-500';
      case 'warning':
        return 'bg-amber-500';
      case 'success':
        return 'bg-emerald-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
      className={`pointer-events-auto relative overflow-hidden rounded-md border shadow-xl backdrop-blur-xs p-3.5 flex items-start gap-3 transition-all cursor-pointer hover:scale-[1.02] animate-in slide-in-from-top-4 fade-in duration-200 ${getBorderColor()}`}
    >
      <div className="mt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-black text-slate-900 truncate tracking-tight">{toast.title}</h4>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Real-time</span>
        </div>
        <p className="text-[11px] text-slate-700 font-medium mt-0.5 leading-relaxed">
          {toast.message}
        </p>

        {toast.link && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-blue-700 hover:underline">
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
        className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
        title="Dismiss toast"
      >
        <X size={14} />
      </button>

      {/* Progress timer bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50">
        <div
          className={`h-full transition-all duration-75 ${getProgressBg()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
