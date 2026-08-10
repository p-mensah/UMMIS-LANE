import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Package } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('Password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);
    
    try {
      const data = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-slate-100 rounded-sm flex items-center justify-center border border-slate-200">
            <Package className="h-6 w-6 text-slate-800" />
          </div>
          <h2 className="mt-6 text-[24px] font-bold text-slate-900 tracking-tight uppercase">Ummis Lane Ent.</h2>
          <p className="mt-2 text-[13px] text-slate-500">Sign in to your account</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 p-3 rounded-sm border border-red-200 text-[13px] text-red-600 flex items-center">
               {error}
            </div>
          )}
          
          <div className="rounded-sm shadow-none space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email address</label>
              <input
                type="email"
                required
                className="appearance-none rounded-sm relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:border-blue-500 sm:text-[13px]"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded-sm relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:border-blue-500 sm:text-[13px]"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-[13px] font-bold rounded-sm text-white bg-blue-500 hover:bg-blue-600 focus:outline-none disabled:opacity-50 transition-colors uppercase tracking-wide"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wide font-bold">
              <span className="px-2 bg-white text-slate-400">Or quick login</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('admin@admin.com', 'Password')}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-sm text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 uppercase tracking-wide transition-colors"
            >
              As Admin
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('staff@staff.com', 'Password')}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-sm text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 uppercase tracking-wide transition-colors"
            >
              As Staff
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
