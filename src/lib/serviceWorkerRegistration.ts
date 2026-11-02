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
        // Immediately check for updates
        registration.update().catch(() => {});

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.info('[PWA] New service worker version installed and active.');
                } else {
                  console.info('[PWA] Core shell cached for offline continuity.');
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
