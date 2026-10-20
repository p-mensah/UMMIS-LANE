import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldAlert, Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  link?: string;
  duration?: number; // ms
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm sm:max-w-md w-full px-3 sm:px-0 pointer-events-none select-none"
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
  const duration = toast.duration || 4500;
  const navigate = useNavigate();

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

  // Determine semantic color and configuration
  const getSemanticType = (): 'critical' | 'warning' | 'success' | 'info' => {
    if (toast.type === 'success') {
      return 'success';
    }
    const text = ((toast.title || '') + ' ' + (toast.message || '')).toLowerCase();
    if (toast.type === 'danger' || text.includes('out of stock') || text.includes('critical') || text.includes('error') || text.includes('failed')) {
      return 'critical';
    }
    if (toast.type === 'warning' || text.includes('low stock') || text.includes('reorder') || text.includes('threshold') || text.includes('cannot exceed')) {
      return 'warning';
    }
    return 'info';
  };

  const semanticType = getSemanticType();

  let borderColor = 'border-slate-200/90';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let badgeText = 'NOTICE';
  let iconBg = 'bg-slate-50 text-slate-600 border-slate-200';
  let progressBarBg = 'bg-slate-600';
  let iconNode = <Bell size={16} className="text-slate-600 shrink-0" />;

  if (semanticType === 'critical') {
    borderColor = 'border-rose-200/90 shadow-rose-950/5';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    badgeText = 'CRITICAL';
    iconBg = 'bg-rose-50 text-rose-600 border-rose-200/80';
    progressBarBg = 'bg-rose-500';
    iconNode = <ShieldAlert size={16} className="text-rose-600 shrink-0" />;
  } else if (semanticType === 'warning') {
    borderColor = 'border-amber-200/90 shadow-amber-950/5';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    badgeText = 'WARNING';
    iconBg = 'bg-amber-50 text-amber-600 border-amber-200/80';
    progressBarBg = 'bg-amber-500';
    iconNode = <AlertTriangle size={16} className="text-amber-600 shrink-0" />;
  } else if (semanticType === 'success') {
    borderColor = 'border-emerald-200/90 shadow-emerald-950/5';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    badgeText = 'SUCCESS';
    iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200/80';
    progressBarBg = 'bg-emerald-500';
    iconNode = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
  } else {
    borderColor = 'border-blue-200/90 shadow-blue-950/5';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    badgeText = 'INFO';
    iconBg = 'bg-blue-50 text-blue-600 border-blue-200/80';
    progressBarBg = 'bg-blue-500';
    iconNode = <Bell size={16} className="text-blue-600 shrink-0" />;
  }

  const handleAction = () => {
    if (toast.link) {
      navigate(toast.link);
      onDismiss(toast.id);
    }
  };

  const displayTitle = toast.title || (
    semanticType === 'success' ? 'Success' :
    semanticType === 'critical' ? 'Action Required' :
    semanticType === 'warning' ? 'Notice' : 'Information'
  );

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-white/98 backdrop-blur-md shadow-lg p-3 sm:p-3.5 flex flex-col gap-1.5 transition-all duration-200 animate-in slide-in-from-top-2 fade-in hover:shadow-xl ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
            {iconNode}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded border ${badgeColor}`}>
                {badgeText}
              </span>
              <h4 className="text-xs font-black text-slate-900 truncate">
                {displayTitle}
              </h4>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors shrink-0 cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>

      {toast.message && (
        <p className="text-xs text-slate-600 leading-relaxed font-medium pl-9">
          {toast.message}
        </p>
      )}

      {toast.link && (
        <div className="pt-0.5 pl-9 flex items-center justify-end">
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

      {/* Modern Slim Countdown Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
        <div
          className={`h-full transition-all duration-75 ${progressBarBg}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
