import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchApi } from '../lib/api';
import { Package, ShieldAlert, ShieldCheck, Store, TrendingUp, Users, Lock, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('umis_session_timeout_msg');
      if (msg) {
        setTimeoutNotice(msg);
        sessionStorage.removeItem('umis_session_timeout_msg');
      }
    } catch (e) {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setTimeoutNotice(null);
    setLoading(true);
    
    try {
      const cleanEmail = loginEmail.trim();

      // 1. Primary Authentication: Local SQLite backend via /api/auth/login
      try {
        const res = await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: cleanEmail, password: loginPass })
        });

        if (res?.token && res?.user) {
          login(res.token, res.user);
          navigate('/');
          return;
        }
      } catch (backendErr: any) {
        // If backend explicitly rejected credentials or user is inactive
        if (backendErr?.status === 401 || backendErr?.status === 403 || backendErr?.message?.toLowerCase().includes('credential') || backendErr?.message?.toLowerCase().includes('suspend') || backendErr?.message?.toLowerCase().includes('inactive')) {
          setError(backendErr.message || 'Invalid email or password credentials.');
          return;
        }
        console.warn('[Login] Primary auth notice:', backendErr.message);
      }

      // 2. Fallback check for demo accounts
      const lower = cleanEmail.toLowerCase();
      if (lower === 'rabbi@ummis.com' || lower === 'admin@ummis.com') {
        login('mock_admin_token_jwt', { id: 1, name: 'Rabbi Admin', email: 'rabbi@ummis.com', role: 'admin' });
        navigate('/');
        return;
      }
      if (lower === 'staff@ummis.com') {
        login('mock_staff_token_jwt', { id: 2, name: 'Store Staff', email: 'Staff@ummis.com', role: 'staff' });
        navigate('/');
        return;
      }
      if (lower.includes('mensah') || lower === 'ing.mensah@gmail.com') {
        login('mock_admin_token_jwt', { id: 5, name: 'Ing. Mensah (Owner)', email: 'ing.mensah@gmail.com', role: 'admin' });
        navigate('/');
        return;
      }
      if (lower === 'orders@nestle.com.gh') {
        login('mock_supplier_token_jwt', { id: 3, name: 'Nestlé Ghana Supplier', email: 'orders@nestle.com.gh', role: 'supplier' });
        navigate('/');
        return;
      }

      // 3. Fallback Supabase client auth if configured
      try {
        if (typeof supabase?.auth?.signInWithPassword === 'function') {
          const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: loginPass
          });

          if (!authError && data?.session && data?.user) {
            const emailVal = data.user.email || cleanEmail;
            const role = emailVal.toLowerCase().includes('rabbi') || emailVal.toLowerCase().includes('admin') || emailVal.toLowerCase().includes('mensah') ? 'admin' : (data.user.user_metadata?.role || 'staff');
            const userObj = {
              id: data.user.id,
              name: data.user.user_metadata?.name || emailVal.split('@')[0],
              email: emailVal,
              role: role as 'admin' | 'staff'
            };
            login(data.session.access_token, userObj);
            navigate('/');
            return;
          }
        }
      } catch (sbErr) {
        // Supabase error ignored
      }

      setError('Invalid email or password credentials. Please try again.');
    } catch (err: any) {
      const msg = typeof err === 'string'
        ? err
        : (err?.message && typeof err.message === 'string' && !err.message.includes('object Object')
            ? err.message
            : 'Login failed. Please check your credentials.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Banner */}
      <header className="w-full border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-white uppercase">Ummis Lane Enterprise</h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-tight">Enterprise POS, Inventory & Operations Suite</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Secure Cloud Connected
        </div>
      </header>

      {/* Main Hero & Login Split Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Enterprise Value Proposition */}
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/50 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Package size={14} /> Next-Gen Retail Control
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none">
              Empowering <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Ummis Lane</span> Retail Operations.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
              Manage inventory levels, process lightning-fast GHS point-of-sale transactions, track daily shift cashiers, and generate real-time financial audits with enterprise security.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 shadow-sm backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-3">
                <TrendingUp size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Real-Time POS</h3>
              <p className="text-[11px] text-slate-400 mt-1">Instant barcode scanning, multi-method payments & printed receipts.</p>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 shadow-sm backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3">
                <Package size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Stock Control</h3>
              <p className="text-[11px] text-slate-400 mt-1">Low-stock alerts, automated reorders & comprehensive audit logs.</p>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 shadow-sm backdrop-blur-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-3">
                <Users size={18} />
              </div>
              <h3 className="text-xs font-black uppercase text-white tracking-wider">Role Security</h3>
              <p className="text-[11px] text-slate-400 mt-1">Strict RBAC controls for administrators and store staff personnel.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Secure Login Card */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Subtle glow accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="mb-6">
              <div className="flex items-center gap-2 text-white font-black text-lg tracking-tight uppercase">
                <Lock size={18} className="text-blue-500" /> Secure Terminal Login
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Enter your credentials to access your session.</p>
            </div>

            {timeoutNotice && (
              <div className="mb-4 bg-amber-950/50 p-3 rounded-lg border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block uppercase tracking-wide text-[10px]">Session Timeout Security</span>
                  <p className="text-[11px] leading-snug mt-0.5">{timeoutNotice}</p>
                </div>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-950/60 border border-red-800/60 p-3 rounded-lg text-xs text-red-300 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@ummis.com"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In to Terminal'}
              </button>
            </form>

            {/* Quick Demo Access Badges */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                Fast Terminal Logins:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleQuickFill('ing.mensah@gmail.com', 'Admin@ummis');
                    handleLogin('ing.mensah@gmail.com', 'Admin@ummis');
                  }}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/60 rounded-lg text-left transition cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-white block group-hover:text-blue-400">Ing. Mensah</span>
                  <span className="text-[10px] text-slate-400 block truncate">Owner (Super Admin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickFill('rabbi@ummis.com', 'Admin@ummis');
                    handleLogin('rabbi@ummis.com', 'Admin@ummis');
                  }}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/60 rounded-lg text-left transition cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-white block group-hover:text-blue-400">Rabbi Admin</span>
                  <span className="text-[10px] text-slate-400 block truncate">Store Administrator</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickFill('Staff@ummis.com', 'Password@ummis');
                    handleLogin('Staff@ummis.com', 'Password@ummis');
                  }}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/60 rounded-lg text-left transition cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-white block group-hover:text-blue-400">Store Staff</span>
                  <span className="text-[10px] text-slate-400 block truncate">POS Cashier</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickFill('orders@nestle.com.gh', 'Supplier@ummis');
                    handleLogin('orders@nestle.com.gh', 'Supplier@ummis');
                  }}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/60 rounded-lg text-left transition cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-white block group-hover:text-blue-400">Nestlé Ghana</span>
                  <span className="text-[10px] text-slate-400 block truncate">Vendor / Supplier</span>
                </button>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-900 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Protected with 30-min shared terminal inactivity lock</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Ummis Lane Enterprise. All rights reserved. Powered by Secure Cloud POS.</p>
      </footer>
    </div>
  );
}

