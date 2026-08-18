import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Package, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('Password');
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
      const data = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shadow-sm">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-900 tracking-tight uppercase">UMMIS LANE ENT</h2>
          <p className="mt-1 text-xs text-slate-500 font-medium">Enterprise Retail POS & Inventory Operations</p>
        </div>

        {timeoutNotice && (
          <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs animate-in fade-in">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-950 uppercase tracking-wide text-[10px]">Session Timeout Security</span>
              <p className="text-[12px] leading-snug mt-0.5">{timeoutNotice}</p>
            </div>
          </div>
        )}
        
        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-600 flex items-center gap-2">
               <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Email Address</label>
              <input
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3.5 py-2.5 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-medium"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3.5 py-2.5 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-medium"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-colors uppercase tracking-wider shadow-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-extrabold">
              <span className="px-2 bg-white text-slate-400">Quick Test Access</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('admin@admin.com', 'Password')}
              className="flex-1 py-2 px-3 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 uppercase tracking-wide transition-colors"
            >
              Admin Role
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('staff@staff.com', 'Password')}
              className="flex-1 py-2 px-3 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 uppercase tracking-wide transition-colors"
            >
              Staff Role
            </button>
          </div>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Protected with 30-min shared terminal inactivity lock</span>
        </div>
      </div>
    </div>
  );
}
