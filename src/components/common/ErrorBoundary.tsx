import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    // Clear any potentially corrupt cache if reloading
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
    } catch {}
    window.location.reload();
  };

  private handleResetToLogin = () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch {}
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                Temporary Display Issue Detected
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                The application encountered an unexpected display state. Your store data and cash register records remain completely safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-700/60 text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Details:</span>
                <p className="text-xs font-mono text-rose-400 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleResetToLogin}
                className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={14} />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
