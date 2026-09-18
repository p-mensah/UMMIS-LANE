import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, HelpCircle, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  options,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Lock background scrolling
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Focus primary or cancel button
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    // Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onCancel]);

  if (!isOpen || !options) return null;

  const type = options.type || 'danger';

  const typeConfig = {
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-200',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
      defaultConfirm: 'Confirm & Delete',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-200',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
      defaultConfirm: 'Proceed',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 border-blue-200',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      defaultConfirm: 'Confirm',
    },
  }[type];

  const Icon = typeConfig.icon;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-lg border ${typeConfig.iconBg} ${typeConfig.iconColor} shrink-0`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 tracking-tight">
              {options.title}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {options.message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-200 min-h-[40px]"
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 min-h-[40px] shadow-2xs ${typeConfig.confirmBtn}`}
          >
            {options.confirmText || typeConfig.defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
