import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full px-3 sm:px-0 pointer-events-none">
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

  // Determine color semantic: 'critical' (Red), 'warning' (Amber), 'success' (Emerald), 'info' (Slate)
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

  let cardClasses = 'bg-white border-slate-300 text-slate-900 shadow-lg';
  let badgeClasses = 'bg-slate-100 text-slate-800 border-slate-300';
  let badgeText = 'INFO';
  let progressBg = 'bg-slate-500';

  if (semanticType === 'critical') {
    cardClasses = 'bg-white border-rose-400 text-rose-950 shadow-lg shadow-rose-950/5';
    badgeClasses = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    badgeText = 'ERROR';
    progressBg = 'bg-rose-600';
  } else if (semanticType === 'warning') {
    cardClasses = 'bg-white border-amber-400 text-amber-950 shadow-lg shadow-amber-950/5';
    badgeClasses = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
    badgeText = 'WARNING';
    progressBg = 'bg-amber-500';
  } else if (semanticType === 'success') {
    cardClasses = 'bg-white border-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/5';
    badgeClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
    badgeText = 'SUCCESS';
    progressBg = 'bg-emerald-600';
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-lg border p-3 flex flex-col gap-1.5 transition-all shadow-md animate-in slide-in-from-top-3 fade-in duration-150 ${cardClasses}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border shrink-0 ${badgeClasses}`}>
            {badgeText}
          </span>
          <h4 className="text-xs font-bold text-slate-900 truncate">
            {toast.title}
          </h4>
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors shrink-0"
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
        {toast.message}
      </p>

      {/* Clean Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
        <div
          className={`h-full transition-all duration-75 ${progressBg}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
