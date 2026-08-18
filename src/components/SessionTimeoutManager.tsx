import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Clock, LogOut, CheckCircle2, Lock } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD_MS = 2 * 60 * 1000;   // 2 minutes warning (at 28 mins)
const THROTTLE_INTERVAL_MS = 3000;            // Throttle activity listener to 3s

export default function SessionTimeoutManager() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const lastActiveRef = useRef<number>(Date.now());
  const lastThrottledCallRef = useRef<number>(0);

  // Initialize or read last activity timestamp from localStorage
  const updateActivityTimestamp = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    try {
      localStorage.setItem('umis_last_activity_timestamp', now.toString());
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    // Throttle activity updates to save CPU
    if (now - lastThrottledCallRef.current > THROTTLE_INTERVAL_MS) {
      lastThrottledCallRef.current = now;
      updateActivityTimestamp();
      if (showWarning) {
        setShowWarning(false);
      }
    }
  }, [showWarning, updateActivityTimestamp]);

  // Keep session alive on explicit user click in the modal
  const handleStaySignedIn = () => {
    updateActivityTimestamp();
    setShowWarning(false);
  };

  // Explicit immediate logout
  const handleImmediateLogout = () => {
    setShowWarning(false);
    logout();
    navigate('/login');
  };

  // Perform automatic logout when 30 minutes inactivity elapsed
  const performAutoLogout = useCallback(() => {
    setShowWarning(false);
    try {
      sessionStorage.setItem(
        'umis_session_timeout_msg',
        'Your session was automatically logged out after 30 minutes of inactivity to ensure security in a shared retail environment.'
      );
    } catch (e) {
      // ignore
    }
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // Listen to user activity events
  useEffect(() => {
    if (!token || !user) {
      setShowWarning(false);
      return;
    }

    // Initialize timestamp if missing
    const saved = localStorage.getItem('umis_last_activity_timestamp');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0 && Date.now() - parsed < INACTIVITY_TIMEOUT_MS) {
        lastActiveRef.current = parsed;
      } else {
        updateActivityTimestamp();
      }
    } else {
      updateActivityTimestamp();
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
    const onEvent = () => handleUserActivity();

    events.forEach(evt => window.addEventListener(evt, onEvent, { passive: true }));

    // Multi-tab storage synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'umis_last_activity_timestamp' && e.newValue) {
        const val = parseInt(e.newValue, 10);
        if (!isNaN(val)) {
          lastActiveRef.current = val;
          if (showWarning && Date.now() - val < INACTIVITY_TIMEOUT_MS - WARNING_THRESHOLD_MS) {
            setShowWarning(false);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, onEvent));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [token, user, handleUserActivity, updateActivityTimestamp, showWarning]);

  // Interval ticker checking inactivity every second
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      // Check timestamp from localStorage or ref
      let lastActive = lastActiveRef.current;
      try {
        const saved = localStorage.getItem('umis_last_activity_timestamp');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed)) lastActive = parsed;
        }
      } catch (e) {}

      const now = Date.now();
      const elapsed = now - lastActive;
      const remainingMs = INACTIVITY_TIMEOUT_MS - elapsed;

      if (remainingMs <= 0) {
        // Inactivity exceeded 30 minutes
        performAutoLogout();
      } else if (remainingMs <= WARNING_THRESHOLD_MS) {
        // Within 2 minutes warning threshold
        setShowWarning(true);
        setRemainingSeconds(Math.ceil(remainingMs / 1000));
      } else {
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [token, user, showWarning, performAutoLogout]);

  if (!showWarning || !user) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / 120) * 100));

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white rounded-lg max-w-md w-full border border-amber-300 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Header with Security Badge */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert size={26} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold rounded uppercase">
                30-Min Security Policy
              </span>
              <span className="text-xs text-slate-400 font-medium">UMMIS LANE ENT</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight mt-1">
              Session Inactivity Warning
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active account: <strong className="text-slate-800">{user.name}</strong> ({user.role})
            </p>
          </div>
        </div>

        {/* Informational Message */}
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
          No activity was detected for nearly 30 minutes. To protect cash register transactions and store records in a shared retail environment, your session will automatically terminate soon.
        </p>

        {/* Countdown Box */}
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-lg text-center space-y-2">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Clock size={14} className="text-amber-600" />
            Automatic Sign-Out In
          </div>
          <div className="text-3xl font-black font-mono text-amber-950 tracking-tight">
            {timeFormatted}
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-amber-200/60 h-2 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-amber-600 h-full rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleStaySignedIn}
            className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <CheckCircle2 size={16} />
            <span>Stay Signed In</span>
          </button>
          
          <button
            type="button"
            onClick={handleImmediateLogout}
            className="w-full sm:w-auto py-2.5 px-4 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <LogOut size={15} />
            <span>Log Out</span>
          </button>
        </div>

      </div>
    </div>
  );
}
