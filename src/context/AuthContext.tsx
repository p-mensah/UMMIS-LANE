import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isConfiguredSupabaseUrl } from '../lib/supabase';
import { logNetworkError } from '../lib/networkLogger';

export interface User {
  id: number | string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'staff' | 'supplier';
  profile_picture?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage immediately
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);
      } catch (e) {
        console.warn('Could not parse stored session user:', e);
      }
    }

    // Only check Supabase if real Supabase URL is configured
    if (isConfiguredSupabaseUrl && typeof supabase?.auth?.getSession === 'function') {
      const timeoutTimer = setTimeout(() => {
        setLoading(false);
      }, 1500);

      supabase.auth.getSession()
        .then(({ data }: any) => {
          const session = data?.session;
          if (session?.user) {
            const email = session.user.email || '';
            const role = email.includes('admin') ? 'admin' : (session.user.user_metadata?.role || 'staff');
            const authUser: User = {
              id: session.user.id,
              name: session.user.user_metadata?.name || email.split('@')[0],
              email,
              role: role as 'admin' | 'staff'
            };
            setUser(authUser);
            setToken(session.access_token);
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('token', session.access_token);
          }
        })
        .catch((err: any) => {
          console.warn('[AuthContext] Supabase session check notice:', err?.message || err);
        })
        .finally(() => {
          clearTimeout(timeoutTimer);
          setLoading(false);
        });
      return;
    }

    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    supabase.auth.signOut().catch(() => {});
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

