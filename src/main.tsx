import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign dev WebSocket disconnections when HMR is disabled in cloud sandboxes
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason || '');
    const messageStr = String(event.reason?.message || '');
    if (
      reasonStr.includes('WebSocket') ||
      messageStr.includes('WebSocket') ||
      reasonStr.includes('closed without opened') ||
      messageStr.includes('closed without opened') ||
      messageStr.includes('failed to connect to websocket')
    ) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);
  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (msg.includes('WebSocket') || msg.includes('closed without opened')) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
