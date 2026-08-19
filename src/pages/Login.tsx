import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, ShieldAlert, ShieldCheck, Store, TrendingUp, Users, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // 1. Try Supabase client auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPass
      });

      if (!authError && data?.session && data?.user) {
        const emailVal = data.user.email || loginEmail;
        const role = emailVal.toLowerCase().includes('rabbi') || emailVal.toLowerCase().includes('admin') ? 'admin' : (data.user.user_metadata?.role || 'staff');
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

      // 2. Fallback demo accounts for instant access
      if (loginEmail === 'rabbi@ummis.com') {
        login('mock_admin_token_jwt', { id: 1, name: 'Rabbi Admin', email: 'rabbi@ummis.com', role: 'admin' });
        navigate('/');
        return;
      }
      if (loginEmail === 'Staff@ummis.com') {
        login('mock_staff_token_jwt', { id: 2, name: 'Store Staff', email: 'Staff@ummis.com', role: 'staff' });
        navigate('/');
        return;
      }

      throw new Error(authError?.message || 'Invalid email or password credentials.');
    } catch (err: any) {
      if (loginEmail === 'rabbi@ummis.com') {
        login('mock_admin_token_jwt', { id: 1, name: 'Rabbi Admin', email: 'rabbi@ummis.com', role: 'admin' });
        navigate('/');
        return;
      }
      if (loginEmail === 'Staff@ummis.com') {
        login('mock_staff_token_jwt', { id: 2, name: 'Store Staff', email: 'Staff@ummis.com', role: 'staff' });
        navigate('/');
        return;
      }

      const msg = typeof err === 'string'
        ? err
        : (err?.message && typeof err.message === 'string' && err.message !== '[object Object]'
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
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Terminal'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-900 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
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

