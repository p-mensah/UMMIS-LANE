import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/serviceWorkerRegistration';

registerServiceWorker();

// Silence benign dev WebSocket disconnections when HMR is disabled or sandboxed in cloud environments
if (typeof window !== 'undefined') {
  const isBenignWsError = (str: string) => {
    return (
      str.includes('WebSocket') ||
      str.includes('websocket') ||
      str.includes('closed without opened') ||
      str.includes('failed to connect to websocket')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason || '');
    const messageStr = String(event.reason?.message || '');
    if (isBenignWsError(reasonStr) || isBenignWsError(messageStr)) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (isBenignWsError(msg)) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const text = args.map(a => String(a?.message || a || '')).join(' ');
    if (isBenignWsError(text)) return;
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    const text = args.map(a => String(a?.message || a || '')).join(' ');
    if (isBenignWsError(text)) return;
    originalConsoleWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
