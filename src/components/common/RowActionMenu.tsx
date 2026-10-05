import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  id?: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface RowActionMenuProps {
  actions: (ActionMenuItem | null | false | undefined)[];
  align?: 'left' | 'right';
  triggerTitle?: string;
  className?: string;
  buttonClassName?: string;
}

export default function RowActionMenu({
  actions,
  align = 'right',
  triggerTitle = 'Actions',
  className = '',
  buttonClassName = '',
}: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right?: number; left?: number; openUpward: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const validActions = actions.filter(
    (action): action is ActionMenuItem => Boolean(action && !action.hidden)
  );

  const normalActions = validActions.filter(a => !a.destructive);
  const destructiveActions = validActions.filter(a => a.destructive);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuEstimatedHeight = validActions.length * 36 + 20;
    const openUpward = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    const top = openUpward ? rect.top - 4 : rect.bottom + 4;
    const right = Math.max(10, window.innerWidth - rect.right);
    const left = Math.max(10, rect.left);

    setCoords({
      top,
      right: align === 'right' ? right : undefined,
      left: align === 'left' ? left : undefined,
      openUpward,
    });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  if (validActions.length === 0) {
    return null;
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
          isOpen
            ? 'bg-slate-200 text-slate-900'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        } ${buttonClassName}`}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && coords && (
        <div
          ref={menuRef}
          style={{
            top: coords.openUpward ? undefined : `${coords.top}px`,
            bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : undefined,
            right: coords.right !== undefined ? `${coords.right}px` : undefined,
            left: coords.left !== undefined ? `${coords.left}px` : undefined,
          }}
          role="menu"
          aria-label={triggerTitle}
          onClick={(e) => e.stopPropagation()}
          className={`fixed min-w-[170px] max-w-[240px] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100 ${
            coords.openUpward ? 'origin-bottom-right' : 'origin-top-right'
          }`}
        >
          {/* Normal Action Items */}
          {normalActions.map((action, idx) => (
            <button
              key={action.id || `act-${idx}`}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={async (e) => {
                e.stopPropagation();
                setIsOpen(false);
                await action.onClick();
              }}
              className={`w-full px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer ${
                action.disabled
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-blue-700'
              }`}
            >
              {action.icon && (
                <span className="shrink-0 text-slate-500 group-hover:text-blue-600">
                  {action.icon}
                </span>
              )}
              <div className="min-w-0 flex-1 truncate">
                <span className="block truncate font-bold">{action.label}</span>
                {action.sublabel && (
                  <span className="block text-[10px] text-slate-400 font-normal truncate">
                    {action.sublabel}
                  </span>
                )}
              </div>
            </button>
          ))}

          {/* Destructive Actions Divider & Items */}
          {destructiveActions.length > 0 && (
            <>
              {normalActions.length > 0 && (
                <div className="my-1 border-t border-slate-100" />
              )}
              {destructiveActions.map((action, idx) => (
                <button
                  key={action.id || `destr-${idx}`}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    await action.onClick();
                  }}
                  className={`w-full px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors text-left cursor-pointer ${
                    action.disabled
                      ? 'opacity-40 cursor-not-allowed text-rose-300'
                      : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                >
                  {action.icon && (
                    <span className="shrink-0 text-rose-500">
                      {action.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 truncate">
                    <span className="block truncate font-bold text-rose-600">
                      {action.label}
                    </span>
                    {action.sublabel && (
                      <span className="block text-[10px] text-rose-400 font-normal truncate">
                        {action.sublabel}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
