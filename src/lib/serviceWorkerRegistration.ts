/**
 * Service Worker Registration and Network Connectivity Manager
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.info('[PWA] New version available; will activate on next visit.');
                } else {
                  console.info('[PWA] Content cached for offline use.');
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.warn('[PWA] Service worker registration notice:', error);
      });
  });
}
