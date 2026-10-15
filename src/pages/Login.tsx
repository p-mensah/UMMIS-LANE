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

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setTimeoutNotice(null);
    setLoading(true);
    
    try {
      const cleanEmail = loginEmail.trim();

      // Authenticate with real database backend via /api/auth/login
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: loginPass })
      });

      if (res?.token && res?.user) {
        login(res.token, res.user);
        navigate('/');
        return;
      }

      setError('Invalid email or password credentials. Please verify your login details.');
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

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    handleLogin(quickEmail, quickPass);
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

            {/* Quick Login 1-Click Role Accounts */}
            <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <KeyRound size={12} className="text-amber-400" />
                  Quick Login
                </span>
                <span className="text-[9px] text-slate-500 font-normal">Real Database Accounts</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('ing.mensah@gmail.com', 'Admin@ummis')}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/80 rounded-lg text-left transition group cursor-pointer disabled:opacity-50"
                >
                  <div className="text-[11px] font-bold text-white group-hover:text-blue-400 flex items-center justify-between">
                    <span>Owner / Admin</span>
                    <span className="text-[8px] uppercase px-1 py-0.2 bg-blue-900/60 text-blue-300 rounded font-mono">Owner</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">ing.mensah@gmail.com</div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('rabbi@ummis.com', 'Admin@ummis')}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/80 rounded-lg text-left transition group cursor-pointer disabled:opacity-50"
                >
                  <div className="text-[11px] font-bold text-white group-hover:text-indigo-400 flex items-center justify-between">
                    <span>Rabbi Admin</span>
                    <span className="text-[8px] uppercase px-1 py-0.2 bg-indigo-900/60 text-indigo-300 rounded font-mono">Admin</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">rabbi@ummis.com</div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('Staff@ummis.com', 'Password@ummis')}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/80 rounded-lg text-left transition group cursor-pointer disabled:opacity-50"
                >
                  <div className="text-[11px] font-bold text-white group-hover:text-emerald-400 flex items-center justify-between">
                    <span>Store Cashier</span>
                    <span className="text-[8px] uppercase px-1 py-0.2 bg-emerald-900/60 text-emerald-300 rounded font-mono">Staff</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">Staff@ummis.com</div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('orders@nestle.com.gh', 'Supplier@ummis')}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/80 rounded-lg text-left transition group cursor-pointer disabled:opacity-50"
                >
                  <div className="text-[11px] font-bold text-white group-hover:text-purple-400 flex items-center justify-between">
                    <span>Nestlé Supplier</span>
                    <span className="text-[8px] uppercase px-1 py-0.2 bg-purple-900/60 text-purple-300 rounded font-mono">Vendor</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">orders@nestle.com.gh</div>
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
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

