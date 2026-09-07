import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Check, RotateCcw } from 'lucide-react';

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string, presetLabel?: string) => void;
  onClear: () => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  onClear,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync temp dates when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Helper date formatters
  const toDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Presets
  const handlePreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all') => {
    const now = new Date();
    let start = '';
    let end = '';
    let label = '';

    if (preset === 'today') {
      start = toDateString(now);
      end = toDateString(now);
      label = 'Today';
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      start = toDateString(y);
      end = toDateString(y);
      label = 'Yesterday';
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      start = toDateString(past);
      end = toDateString(now);
      label = 'Last 7 Days';
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      start = toDateString(past);
      end = toDateString(now);
      label = 'Last 30 Days';
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toDateString(firstDay);
      end = toDateString(now);
      label = 'This Month';
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      start = toDateString(firstDay);
      end = toDateString(lastDay);
      label = 'Last Month';
    } else {
      start = '';
      end = '';
      label = 'All Time';
    }

    setTempStart(start);
    setTempEnd(end);
    onChange(start, end, label);
    setIsOpen(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempStart && tempEnd && tempStart > tempEnd) {
      // Auto-swap if start > end
      onChange(tempEnd, tempStart, 'Custom Range');
    } else {
      onChange(tempStart, tempEnd, 'Custom Range');
    }
    setIsOpen(false);
  };

  const isPresetActive = (preset: string) => {
    if (!startDate && !endDate && preset === 'all') return true;
    const now = new Date();
    const todayStr = toDateString(now);

    if (preset === 'today' && startDate === todayStr && endDate === todayStr) return true;
    if (preset === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      if (startDate === toDateString(past) && endDate === todayStr) return true;
    }
    if (preset === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      if (startDate === toDateString(past) && endDate === todayStr) return true;
    }
    return false;
  };

  // Human label for display trigger
  const getButtonLabel = () => {
    if (!startDate && !endDate) {
      return 'All Time History';
    }
    if (startDate && endDate) {
      if (startDate === endDate) {
        const todayStr = toDateString(new Date());
        if (startDate === todayStr) return 'Today';
        return formatDisplayDate(startDate);
      }
      return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
    }
    if (startDate) return `From ${formatDisplayDate(startDate)}`;
    if (endDate) return `Until ${formatDisplayDate(endDate)}`;
    return 'Select Date Range';
  };

  const hasActiveFilter = Boolean(startDate || endDate);

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* Trigger Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
            hasActiveFilter
              ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Filter audit ledger by date window"
        >
          <Calendar size={13} className={hasActiveFilter ? 'text-blue-600' : 'text-slate-400'} />
          <span className="truncate max-w-[200px]">{getButtonLabel()}</span>
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-1 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
            title="Reset date filter to All Time"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-[330px] sm:w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-blue-600" /> Filter by Time Window
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 transition"
              >
                <RotateCcw size={10} /> Reset
              </button>
            )}
          </div>

          <div className="p-3.5 space-y-3 text-xs">
            {/* Quick Presets Grid */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Quick Presets
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('today')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center border transition ${
                    isPresetActive('today')
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('yesterday')}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-center border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('7days')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center border transition ${
                    isPresetActive('7days')
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('30days')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center border transition ${
                    isPresetActive('30days')
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('this_month')}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-center border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('all')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center border transition ${
                    isPresetActive('all')
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  All History
                </button>
              </div>
            </div>

            {/* Custom Range Picker */}
            <form onSubmit={handleApplyCustom} className="pt-2.5 border-t border-slate-100 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Custom Window
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    From (Start)
                  </label>
                  <input
                    type="date"
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    To (End)
                  </label>
                  <input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tempStart && !tempEnd}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={13} /> Apply Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
