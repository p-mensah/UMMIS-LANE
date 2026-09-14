import React from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  isTouched?: boolean;
  isValid?: boolean;
  helperText?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  required = false,
  error,
  isTouched = false,
  isValid = false,
  helperText,
  className = '',
  children
}: FormFieldProps) {
  const showError = isTouched && !!error;
  const showValid = isTouched && !error && isValid;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider text-left">
          {label}
          {required && <span className="text-rose-500 ml-1 font-black">*</span>}
        </label>
        
        {/* Real-time status indicator in label row */}
        {showError && (
          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
            <AlertCircle size={11} className="text-rose-500 shrink-0" />
            Invalid
          </span>
        )}
        {showValid && (
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
            <Check size={11} className="text-emerald-500 shrink-0" />
            Valid
          </span>
        )}
      </div>

      {/* Child input/select/textarea */}
      <div className="relative">
        {children}
      </div>

      {/* Error Message with alert icon and high visibility */}
      {showError && (
        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertCircle size={12} className="text-rose-500 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Helper text when no error */}
      {!showError && helperText && (
        <p className="text-[10.5px] text-slate-400 font-medium">{helperText}</p>
      )}
    </div>
  );
}

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  isTouched?: boolean;
  isValid?: boolean;
  fieldClassName?: string;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ error, isTouched = false, isValid = false, className = '', ...props }, ref) => {
    const isInvalid = isTouched && !!error;
    const isSuccess = isTouched && !error && isValid;

    let borderClass = 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200';
    if (isInvalid) {
      borderClass = 'border-rose-400 bg-rose-50/20 text-rose-950 focus:border-rose-500 focus:ring-1 focus:ring-rose-200';
    } else if (isSuccess) {
      borderClass = 'border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200';
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors focus:outline-none border ${borderClass} ${
            isInvalid || isSuccess ? 'pr-8' : ''
          } ${className}`}
          {...props}
        />
        {isInvalid && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-rose-500">
            <AlertCircle size={14} />
          </div>
        )}
        {isSuccess && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
            <Check size={14} />
          </div>
        )}
      </div>
    );
  }
);
ValidatedInput.displayName = 'ValidatedInput';

interface ValidatedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  isTouched?: boolean;
  isValid?: boolean;
  children: React.ReactNode;
}

export const ValidatedSelect = React.forwardRef<HTMLSelectElement, ValidatedSelectProps>(
  ({ error, isTouched = false, isValid = false, className = '', children, ...props }, ref) => {
    const isInvalid = isTouched && !!error;
    const isSuccess = isTouched && !error && isValid;

    let borderClass = 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200';
    if (isInvalid) {
      borderClass = 'border-rose-400 bg-rose-50/20 text-rose-950 focus:border-rose-500 focus:ring-1 focus:ring-rose-200';
    } else if (isSuccess) {
      borderClass = 'border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200';
    }

    return (
      <div className="relative">
        <select
          ref={ref}
          className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors focus:outline-none border bg-white ${borderClass} ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
ValidatedSelect.displayName = 'ValidatedSelect';

interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  isTouched?: boolean;
  isValid?: boolean;
}

export const ValidatedTextarea = React.forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  ({ error, isTouched = false, isValid = false, className = '', ...props }, ref) => {
    const isInvalid = isTouched && !!error;
    const isSuccess = isTouched && !error && isValid;

    let borderClass = 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200';
    if (isInvalid) {
      borderClass = 'border-rose-400 bg-rose-50/20 text-rose-950 focus:border-rose-500 focus:ring-1 focus:ring-rose-200';
    } else if (isSuccess) {
      borderClass = 'border-emerald-400 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200';
    }

    return (
      <div className="relative">
        <textarea
          ref={ref}
          className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors focus:outline-none border ${borderClass} ${className}`}
          {...props}
        />
      </div>
    );
  }
);
ValidatedTextarea.displayName = 'ValidatedTextarea';
