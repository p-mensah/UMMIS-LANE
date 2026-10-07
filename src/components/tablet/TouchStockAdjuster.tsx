import React, { useState } from 'react';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Check, 
  Hash, 
  SlidersHorizontal, 
  AlertCircle,
  Sparkles,
  PackageCheck
} from 'lucide-react';
import type { TabletInventoryItem } from '../../types/tablet';
import { soundFeedback } from '../../lib/soundFeedback';

interface TouchStockAdjusterProps {
  item: TabletInventoryItem;
  currentStock: number;
  onCommitAdjustment: (delta: number, newStock: number, reason: string) => Promise<void>;
  isLoading?: boolean;
}

type AdjustMode = 'delta' | 'exact';

const QUICK_REASONS = [
  'Physical Cycle Count',
  'Damaged / Spoiled Goods',
  'Restock / Found Stock',
  'Internal Store Transfer',
  'Customer Return Restock',
  'Shrinkage / Inventory Write-Off'
];

export default function TouchStockAdjuster({
  item,
  currentStock,
  onCommitAdjustment,
  isLoading = false
}: TouchStockAdjusterProps) {
  const [mode, setMode] = useState<AdjustMode>('delta');
  const [deltaValue, setDeltaValue] = useState<number>(0);
  const [keypadInput, setKeypadInput] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>(QUICK_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [feedbackFlash, setFeedbackFlash] = useState<'success' | null>(null);

  // Compute calculated new stock depending on mode
  const calculatedStock = mode === 'delta' 
    ? Math.max(0, currentStock + deltaValue)
    : (keypadInput === '' ? currentStock : Math.max(0, parseInt(keypadInput, 10) || 0));

  const effectiveDelta = mode === 'delta' 
    ? deltaValue 
    : calculatedStock - currentStock;

  // Handle Quick Increments / Decrements
  const applyQuickIncrement = (amt: number) => {
    soundFeedback.playKeypadClick();
    if (mode === 'delta') {
      setDeltaValue(prev => prev + amt);
    } else {
      const cur = keypadInput === '' ? currentStock : parseInt(keypadInput, 10) || 0;
      setKeypadInput(String(Math.max(0, cur + amt)));
    }
  };

  // Handle Touch Numeric Pad
  const handleKeypadPress = (key: string) => {
    soundFeedback.playKeypadClick();
    if (key === 'CLEAR') {
      setKeypadInput('');
      setDeltaValue(0);
      return;
    }
    if (key === 'BACK') {
      if (mode === 'exact') {
        setKeypadInput(prev => prev.slice(0, -1));
      } else {
        setDeltaValue(prev => {
          const s = String(Math.abs(prev));
          const nextS = s.slice(0, -1);
          const nextVal = nextS === '' ? 0 : parseInt(nextS, 10);
          return prev < 0 ? -nextVal : nextVal;
        });
      }
      return;
    }
    if (key === '+/-') {
      if (mode === 'delta') {
        setDeltaValue(prev => -prev);
      }
      return;
    }

    // Number digits 0-9
    if (mode === 'exact') {
      setKeypadInput(prev => (prev === '0' ? key : prev + key).slice(0, 6));
    } else {
      setDeltaValue(prev => {
        const sign = prev < 0 ? -1 : 1;
        const currentAbsStr = prev === 0 ? '' : String(Math.abs(prev));
        const nextVal = parseInt((currentAbsStr + key).slice(0, 5), 10) || 0;
        return nextVal * sign;
      });
    }
  };

  const handleCommit = async () => {
    if (effectiveDelta === 0 && mode === 'delta') return;
    const finalReason = customReason.trim() || selectedReason;
    soundFeedback.playAdjustmentSuccess();
    setFeedbackFlash('success');
    setTimeout(() => setFeedbackFlash(null), 800);

    await onCommitAdjustment(effectiveDelta, calculatedStock, finalReason);
    setDeltaValue(0);
    setKeypadInput('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 select-none touch-manipulation">
      {/* Header: Mode Switcher & Current vs New Stock Display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Touch Stock Adjuster</h3>
            <p className="text-[11px] text-slate-500 font-medium">Fast physical stock counts & bin adjustments</p>
          </div>
        </div>

        {/* Mode Toggle Buttons (Large 44px+ tap targets) */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              soundFeedback.playKeypadClick();
              setMode('delta');
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              mode === 'delta'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>+/- Relative Adjust</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundFeedback.playKeypadClick();
              setMode('exact');
            }}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              mode === 'exact'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Exact Count Take</span>
          </button>
        </div>
      </div>

      {/* Stock Comparison Live Banner */}
      <div className={`p-4 rounded-xl border transition-all duration-300 ${
        feedbackFlash === 'success' 
          ? 'bg-emerald-50 border-emerald-400 ring-4 ring-emerald-100' 
          : 'bg-slate-50/80 border-slate-200'
      }`}>
        <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
          <div className="pr-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Current Stock</span>
            <span className="text-xl sm:text-2xl font-mono font-black text-slate-800">{currentStock}</span>
            <span className="text-[10px] text-slate-500 font-medium block">{item.unit_of_measure || 'units'}</span>
          </div>

          <div className="px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              {mode === 'delta' ? 'Net Delta' : 'Count Override'}
            </span>
            <span className={`text-xl sm:text-2xl font-mono font-black ${
              effectiveDelta > 0 
                ? 'text-emerald-600' 
                : effectiveDelta < 0 
                ? 'text-rose-600' 
                : 'text-slate-400'
            }`}>
              {effectiveDelta > 0 ? `+${effectiveDelta}` : effectiveDelta}
            </span>
            <span className="text-[10px] text-slate-500 font-medium block">
              {effectiveDelta === 0 ? 'no change' : effectiveDelta > 0 ? 'stock increase' : 'stock reduction'}
            </span>
          </div>

          <div className="pl-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5">Calculated New Stock</span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-blue-700">{calculatedStock}</span>
            <span className="text-[10px] text-blue-600 font-bold block">{item.unit_of_measure || 'units'}</span>
          </div>
        </div>
      </div>

      {/* Quick Increments / Decrement Strip (Min 48px Touch Targets) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Quick Fast-Track Steppers:
        </label>
        <div className="grid grid-cols-6 gap-2">
          {[-10, -5, -1].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => applyQuickIncrement(amt)}
              className="min-h-[48px] bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl font-mono font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
            >
              {amt}
            </button>
          ))}
          {[1, 5, 10].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => applyQuickIncrement(amt)}
              className="min-h-[48px] bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl font-mono font-black text-sm flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
            >
              +{amt}
            </button>
          ))}
        </div>
      </div>

      {/* On-Screen Touch Keypad Grid (Full Touchscreen Ergonomics) */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
            <Hash size={13} className="text-blue-600" />
            <span>On-Screen Touchpad ({mode === 'exact' ? 'Input Count' : 'Input Delta'}):</span>
          </span>
          <span className="text-xs font-mono font-black text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
            {mode === 'exact' ? (keypadInput || currentStock) : (deltaValue > 0 ? `+${deltaValue}` : deltaValue)}
          </span>
        </div>

        {/* 4x3 Keypad Matrix */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypadPress(digit)}
              className="min-h-[50px] bg-white hover:bg-slate-100 active:bg-blue-100 text-slate-900 border border-slate-200 rounded-xl font-mono text-lg font-black shadow-xs transition active:scale-95 cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: +/- or CLEAR, 0, BACK */}
          <button
            type="button"
            onClick={() => handleKeypadPress(mode === 'delta' ? '+/-' : 'CLEAR')}
            className="min-h-[50px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
          >
            {mode === 'delta' ? '+ / -' : 'Clear'}
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="min-h-[50px] bg-white hover:bg-slate-100 active:bg-blue-100 text-slate-900 border border-slate-200 rounded-xl font-mono text-lg font-black shadow-xs transition active:scale-95 cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress('BACK')}
            className="min-h-[50px] bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center justify-center"
            title="Backspace"
          >
            ⌫ Del
          </button>
        </div>
      </div>

      {/* Quick Audit Reason Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
          <span>Adjustment Reason *</span>
          <span className="text-[10px] text-slate-400 normal-case">Logged for security audit</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                soundFeedback.playKeypadClick();
                setSelectedReason(r);
                setCustomReason('');
              }}
              className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                selectedReason === r && !customReason
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation & Commit Button (Large 54px Tap Target) */}
      <button
        type="button"
        disabled={isLoading || (effectiveDelta === 0 && mode === 'delta')}
        onClick={handleCommit}
        className={`w-full min-h-[54px] rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 ${
          effectiveDelta === 0 && mode === 'delta'
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20'
        }`}
      >
        <PackageCheck size={20} />
        <span>
          {isLoading 
            ? 'Syncing Inventory...' 
            : `Commit Stock Adjustment (${effectiveDelta >= 0 ? `+${effectiveDelta}` : effectiveDelta} units)`}
        </span>
      </button>
    </div>
  );
}
