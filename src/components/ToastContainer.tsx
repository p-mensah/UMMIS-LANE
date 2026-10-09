import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldAlert, Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    <div 
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-3 sm:px-0 pointer-events-none select-none"
      role="region"
      aria-label="System notifications"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { key?: string; toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration || 5000;
  const navigate = useNavigate();

  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 40;
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

  // Determine color semantic
  const getSemanticType = (): 'critical' | 'warning' | 'success' | 'info' => {
    if (toast.type === 'success') {
      return 'success';
    }
    const text = ((toast.title || '') + ' ' + (toast.message || '')).toLowerCase();
    if (toast.type === 'danger' || text.includes('out of stock') || text.includes('critical') || text.includes('error')) {
      return 'critical';
    }
    if (toast.type === 'warning' || text.includes('low stock') || text.includes('reorder') || text.includes('threshold') || text.includes('warning')) {
      return 'warning';
    }
    return 'info';
  };

  const semanticType = getSemanticType();

  let borderColor = 'border-slate-200';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let badgeText = 'NOTICE';
  let progressBg = 'bg-slate-600';
  let iconNode = <Bell size={18} className="text-slate-600 shrink-0" />;

  if (semanticType === 'critical') {
    borderColor = 'border-rose-200';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    badgeText = 'CRITICAL';
    progressBg = 'bg-rose-600';
    iconNode = <ShieldAlert size={18} className="text-rose-600 shrink-0" />;
  } else if (semanticType === 'warning') {
    borderColor = 'border-amber-200';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
    badgeText = 'WARNING';
    progressBg = 'bg-amber-500';
    iconNode = <AlertTriangle size={18} className="text-amber-600 shrink-0" />;
  } else if (semanticType === 'success') {
    borderColor = 'border-emerald-200';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
    badgeText = 'SUCCESS';
    progressBg = 'bg-[#059669]';
    iconNode = <CheckCircle2 size={18} className="text-[#059669] shrink-0" />;
  }

  const handleAction = () => {
    if (toast.link) {
      navigate(toast.link);
      onDismiss(toast.id);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-white/95 backdrop-blur-md shadow-xl p-3.5 flex flex-col gap-2 transition-all duration-200 animate-in slide-in-from-top-4 fade-in hover:shadow-2xl ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-slate-50 border border-slate-100">
            {iconNode}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border ${badgeColor}`}>
                {badgeText}
              </span>
              <h4 className="text-xs font-black text-slate-900 truncate">
                {toast.title}
              </h4>
            </div>
          </div>
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          title="Dismiss"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed pl-1 font-medium">
        {toast.message}
      </p>

      {toast.link && (
        <div className="pt-1 pl-1 flex items-center justify-end">
          <button
            type="button"
            onClick={handleAction}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View Details</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Modern Progress Countdown Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/80">
        <div
          className={`h-full transition-all duration-75 ${progressBg}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
