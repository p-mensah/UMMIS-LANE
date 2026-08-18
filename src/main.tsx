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
      reasonStr.includes('WebSocket closed without opened') ||
      messageStr.includes('WebSocket closed without opened') ||
      reasonStr.includes('failed to connect to websocket') ||
      messageStr.includes('failed to connect to websocket')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
