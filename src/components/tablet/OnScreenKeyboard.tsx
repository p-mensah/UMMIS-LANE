import React, { useState } from 'react';
import { 
  Delete, 
  CornerDownLeft, 
  X, 
  ChevronDown, 
  Search, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { soundFeedback } from '../../lib/soundFeedback';

export interface OnScreenKeyboardProps {
  isOpen: boolean;
  value: string;
  onChange: (newValue: string) => void;
  onSubmit?: () => void;
  onClose?: () => void;
  placeholder?: string;
  title?: string;
  soundEnabled?: boolean;
  className?: string;
}

export default function OnScreenKeyboard({
  isOpen,
  value,
  onChange,
  onSubmit,
  onClose,
  placeholder = 'Type to search or enter SKU...',
  title = 'Search Catalog & Products',
  soundEnabled = true,
  className = ''
}: OnScreenKeyboardProps) {
  const [isShift, setIsShift] = useState(false);
  const [isSymbols, setIsSymbols] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleKeyPress = (char: string) => {
    if (soundEnabled) {
      soundFeedback.playKeypadClick();
    }
    const charToInsert = isShift ? char.toUpperCase() : char.toLowerCase();
    onChange(value + charToInsert);
  };

  const handleBackspace = () => {
    if (soundEnabled) {
      soundFeedback.playKeypadClick();
    }
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (soundEnabled) {
      soundFeedback.playKeypadClick();
    }
    onChange('');
  };

  const handleSpace = () => {
    if (soundEnabled) {
      soundFeedback.playKeypadClick();
    }
    onChange(value + ' ');
  };

  const handleEnter = () => {
    if (soundEnabled) {
      soundFeedback.playKeypadClick();
    }
    if (onSubmit) {
      onSubmit();
    }
    if (onClose) {
      onClose();
    }
  };

  const lettersRow1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const lettersRow2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const lettersRow3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  const symbolsRow1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const symbolsRow2 = ['@', '#', '$', '%', '&', '*', '-', '+', '=', '/'];
  const symbolsRow3 = ['(', ')', '!', '?', '"', '\'', ':', ';', ',', '.'];

  return (
    <div 
      className={`fixed bottom-0 left-0 z-30 bg-slate-950/98 border-t-2 border-slate-700/80 backdrop-blur-md shadow-2xl p-2 sm:p-3 transition-transform animate-in slide-in-from-bottom-5 duration-200 select-none no-print ${className || 'right-0'}`}
      role="region"
      aria-label="On-Screen Tablet Keyboard"
    >
      <div className="max-w-4xl mx-auto space-y-2">
        {/* ================= 1. INPUT PREVIEW & UTILITY BAR ================= */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Search size={16} className="text-blue-400 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 font-medium hidden sm:flex">
              <span>{title}:</span>
            </div>
            <div className="min-w-0 flex-1 truncate text-xs sm:text-sm font-semibold text-white font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className={value ? 'text-white' : 'text-slate-500'}>
                {value || placeholder}
              </span>
              <span className="w-1.5 h-4 bg-blue-500 animate-pulse shrink-0 ml-1" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="Clear current text"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="Minimize keyboard"
              >
                <ChevronDown size={15} />
                <span>Hide</span>
              </button>
            )}
          </div>
        </div>

        {/* ================= 2. KEYBOARD BODY ================= */}
        <div className="space-y-1.5 sm:space-y-2">
          {/* Number Key Row (Always accessible across top) */}
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-slate-200 active:text-white font-mono font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                {num}
              </button>
            ))}
          </div>

          {!isSymbols ? (
            /* QWERTY Alphabetic Layout */
            <>
              {/* Row 1 */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {lettersRow1.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyPress(char)}
                    className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer uppercase"
                  >
                    {isShift ? char.toUpperCase() : char.toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Row 2 */}
              <div className="flex justify-center gap-1 sm:gap-1.5 px-3">
                {lettersRow2.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyPress(char)}
                    className="flex-1 min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer uppercase"
                  >
                    {isShift ? char.toUpperCase() : char.toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Row 3 with Shift & Backspace */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {/* Shift / Caps Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (soundEnabled) soundFeedback.playKeypadClick();
                    setIsShift(!isShift);
                  }}
                  className={`col-span-2 min-h-[44px] sm:min-h-[48px] rounded-xl font-bold text-xs sm:text-sm border transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                    isShift
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span>⇧ Shift</span>
                </button>

                {lettersRow3.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyPress(char)}
                    className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer uppercase"
                  >
                    {isShift ? char.toUpperCase() : char.toLowerCase()}
                  </button>
                ))}

                {/* Backspace Button */}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-850 hover:bg-rose-900/40 active:bg-rose-600 border border-slate-700 active:border-rose-500 text-slate-200 active:text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Backspace"
                >
                  <Delete size={18} />
                </button>
              </div>
            </>
          ) : (
            /* Symbols Layout */
            <>
              {/* Symbols Row 2 */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {symbolsRow2.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleKeyPress(sym)}
                    className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-mono font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                  >
                    {sym}
                  </button>
                ))}
              </div>

              {/* Symbols Row 3 */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {symbolsRow3.slice(0, 9).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleKeyPress(sym)}
                    className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-mono font-bold text-sm sm:text-base border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                  >
                    {sym}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-850 hover:bg-rose-900/40 active:bg-rose-600 border border-slate-700 active:border-rose-500 text-slate-200 active:text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Backspace"
                >
                  <Delete size={18} />
                </button>
              </div>
            </>
          )}

          {/* Bottom Action Row: ?123 / ABC, Space, Period, Search/Done */}
          <div className="grid grid-cols-12 gap-1 sm:gap-1.5 pt-0.5">
            {/* Mode Toggle: ABC / ?123 */}
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundFeedback.playKeypadClick();
                setIsSymbols(!isSymbols);
              }}
              className="col-span-2 min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              {isSymbols ? 'ABC' : '?123'}
            </button>

            {/* Quick Hyphen */}
            <button
              type="button"
              onClick={() => handleKeyPress('-')}
              className="col-span-1 min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-mono font-bold text-base border border-slate-700/60 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              -
            </button>

            {/* Space Bar */}
            <button
              type="button"
              onClick={handleSpace}
              className="col-span-5 min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-slate-400 font-bold text-xs uppercase tracking-widest border border-slate-700/60 shadow-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              Space
            </button>

            {/* Period */}
            <button
              type="button"
              onClick={() => handleKeyPress('.')}
              className="col-span-1 min-h-[44px] sm:min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 text-white font-mono font-bold text-base border border-slate-700/60 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              .
            </button>

            {/* Search / Done Action Key */}
            <button
              type="button"
              onClick={handleEnter}
              className="col-span-3 min-h-[44px] sm:min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <CornerDownLeft size={16} />
              <span>Search</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
