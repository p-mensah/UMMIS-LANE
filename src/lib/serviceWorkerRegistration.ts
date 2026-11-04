/**
 * Service Worker Registration and Network Connectivity Manager
 * Coordinates Background Sync registration and offline store communication.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Immediately check for updates
        registration.update().catch(() => {});

        // Register background sync if supported by browser
        if ('sync' in registration) {
          (registration as any).sync.register('retailos-sync-queue').catch(() => {});
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.info('[PWA] Service worker v5 installed with offline mutation sync.');
                } else {
                  console.info('[PWA] Core shell & offline database cached for offline continuity.');
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

  // Reconnection hook: notify service worker to flush offline queues immediately
  window.addEventListener('online', () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
    }
  });
}
